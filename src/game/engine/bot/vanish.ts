import { findWinLineFrom } from '../rules.js';
import { Empty, type GameState, type Player } from '../types.js';
import { VANISH_KEEP, VANISH_MOVE_LIMIT } from '../variants/vanish.js';
import { TRIPLES } from '../variants/ultimate.js';

/**
 * Vanish, solved.
 *
 * Every mark on a vanish board is one of the last three its owner placed, so a
 * position is fully described by two short queues of squares - the mover's and
 * the opponent's, oldest first. There are only 73,450 of those reachable from
 * an empty board, and once both players have three marks down every position
 * has exactly three legal moves. That is small enough to solve outright, by
 * retrograde analysis, the first time the bot is asked for a move.
 *
 * The result is a value (won, lost or drawn for the player to move) and a
 * distance: how many plies the winner needs, played fastest, and the loser can
 * hold out, played slowest. The bot's levels differ in how far down that
 * distance they are allowed to see rather than in how much noise they add -
 * the same principle as the line search's depth limit.
 */

const CELLS = 9;
/** Distinct queue encodings: empty, then one, two or three squares in order. */
const QUEUE_CODES = 1 + CELLS + CELLS ** 2 + CELLS ** 3;

const WIN = 1;
const LOSS = -1;
const UNKNOWN = 0;

export interface VanishSolution {
  /** Value for the player to move: 1 won, -1 lost, 0 drawn. */
  readonly value: Int8Array;
  /** Plies to the end under best play by both sides. Meaningless for draws. */
  readonly distance: Uint8Array;
  readonly stateCount: number;
}

let solved: VanishSolution | null = null;
/** State index by `moverCode * QUEUE_CODES + otherCode`, or -1 if unreachable. */
let indexByKey: Int32Array | null = null;

/** Encode an oldest-first queue of up to three squares as a small integer. */
function queueCode(queue: readonly number[]): number {
  let code = 0;
  let offset = 0;
  let span = 1;
  for (let length = 0; length < queue.length; length++) {
    offset += span;
    span *= CELLS;
  }
  for (const cell of queue) code = code * CELLS + cell;
  return offset + code;
}

function stateKey(mover: readonly number[], other: readonly number[]): number {
  return queueCode(mover) * QUEUE_CODES + queueCode(other);
}

function hasTriple(queue: readonly number[]): boolean {
  if (queue.length < 3) return false;
  return TRIPLES.some(([a, b, c]) => queue.includes(a) && queue.includes(b) && queue.includes(c));
}

/** The queue after its owner places on `cell`, oldest mark lifted if full. */
function pushed(queue: readonly number[], cell: number): number[] {
  return queue.length >= VANISH_KEEP ? [...queue.slice(1), cell] : [...queue, cell];
}

/**
 * Solve the whole game.
 *
 * Positions are enumerated breadth-first from the empty board, then labelled in
 * rounds. Round `r` labels exactly the positions whose best-play distance is
 * `r`, using only labels from earlier rounds - which is what makes the
 * distances exact rather than merely achievable: a win is recorded at the
 * first round one of its losing successors is known, and that successor was
 * itself recorded at the earliest round it could be. Anything still unlabelled
 * when a round changes nothing is a draw, since neither side can force it
 * anywhere else.
 */
export function solveVanish(): VanishSolution {
  if (solved) return solved;

  const index = new Int32Array(QUEUE_CODES * QUEUE_CODES).fill(-1);
  const movers: number[][] = [];
  const others: number[][] = [];

  const add = (mover: number[], other: number[]) => {
    const key = stateKey(mover, other);
    if (index[key] !== -1) return;
    index[key] = movers.length;
    movers.push(mover);
    others.push(other);
  };

  add([], []);
  for (let at = 0; at < movers.length; at++) {
    const mover = movers[at]!;
    const other = others[at]!;
    // The player who just moved made a line: the game ended here.
    if (hasTriple(other)) continue;
    for (let cell = 0; cell < CELLS; cell++) {
      if (mover.includes(cell) || other.includes(cell)) continue;
      add(other, pushed(mover, cell));
    }
  }

  const count = movers.length;
  const successors = new Int32Array(count * CELLS).fill(-1);
  const terminal = new Uint8Array(count);
  for (let at = 0; at < count; at++) {
    const mover = movers[at]!;
    const other = others[at]!;
    if (hasTriple(other)) {
      terminal[at] = 1;
      continue;
    }
    let slot = 0;
    for (let cell = 0; cell < CELLS; cell++) {
      if (mover.includes(cell) || other.includes(cell)) continue;
      successors[at * CELLS + slot++] = index[stateKey(other, pushed(mover, cell))]!;
    }
  }

  const value = new Int8Array(count);
  const distance = new Uint8Array(count);
  const round = new Uint16Array(count);
  for (let at = 0; at < count; at++) {
    if (terminal[at]) {
      value[at] = LOSS;
      round[at] = 0;
    }
  }

  for (let r = 1; ; r++) {
    let labelled = 0;
    for (let at = 0; at < count; at++) {
      if (value[at] !== UNKNOWN || terminal[at]) continue;

      let fastestWin = Number.POSITIVE_INFINITY;
      let slowestLoss = 0;
      let allWinning = true;
      for (let slot = 0; slot < CELLS; slot++) {
        const next = successors[at * CELLS + slot]!;
        if (next < 0) break;
        const known = value[next] !== UNKNOWN && round[next]! < r;
        if (known && value[next] === LOSS) {
          fastestWin = Math.min(fastestWin, distance[next]! + 1);
        }
        if (known && value[next] === WIN) slowestLoss = Math.max(slowestLoss, distance[next]! + 1);
        else allWinning = false;
      }

      if (fastestWin !== Number.POSITIVE_INFINITY) {
        value[at] = WIN;
        distance[at] = fastestWin;
        round[at] = r;
        labelled++;
      } else if (allWinning) {
        value[at] = LOSS;
        distance[at] = slowestLoss;
        round[at] = r;
        labelled++;
      }
    }
    if (labelled === 0) break;
  }

  indexByKey = index;
  solved = { value, distance, stateCount: count };
  return solved;
}

/**
 * The two queues for the position in `state`, player to move first.
 *
 * Read straight off the move list: the mover's marks are the moves two, four
 * and six plies back, their opponent's one, three and five - whichever of those
 * exist - and those are oldest-last as read, so they are reversed.
 */
export function vanishQueues(state: GameState): { mover: number[]; other: number[] } {
  const { moves } = state;
  const ply = moves.length;
  const mover: number[] = [];
  const other: number[] = [];
  for (let back = VANISH_KEEP * 2; back >= 1; back--) {
    const move = moves[ply - back];
    if (move === undefined) continue;
    (back % 2 === 0 ? mover : other).push(move);
  }
  return { mover, other };
}

export interface VanishVerdict {
  /** 1 won for the player to move, -1 lost, 0 drawn with best play. */
  readonly value: -1 | 0 | 1;
  /** Plies to the end with best play. Zero for a draw. */
  readonly distance: number;
}

/** What best play makes of the position in `state`, for the player to move. */
export function vanishVerdict(state: GameState): VanishVerdict {
  const solution = solveVanish();
  const { mover, other } = vanishQueues(state);
  const at = indexByKey?.[stateKey(mover, other)] ?? -1;
  if (at < 0) return { value: 0, distance: 0 };
  const value = solution.value[at] as -1 | 0 | 1;
  return { value, distance: value === 0 ? 0 : (solution.distance[at] ?? 0) };
}

/**
 * Squares where `player` would complete a line on their next placement.
 *
 * Their oldest mark is lifted first when they already have three down, so a
 * "two in a row" that leans on that mark is not a threat at all - which is
 * precisely the thing this variant makes hard to see.
 */
export function vanishWinningMoves(state: GameState, player: Player): number[] {
  const { mover, other } = vanishQueues(state);
  const own = player === state.currentPlayer ? mover : other;
  const board = state.board.slice();
  if (own.length >= VANISH_KEEP) board[own[0]!] = Empty;

  const wins: number[] = [];
  for (let cell = 0; cell < CELLS; cell++) {
    if (state.board[cell] !== Empty) continue;
    board[cell] = player;
    if (findWinLineFrom(board, 3, cell, 3)) wins.push(cell);
    board[cell] = Empty;
  }
  return wins;
}

/** Plies left before the move limit calls the game drawn. */
export function vanishPliesLeft(state: GameState): number {
  return Math.max(0, VANISH_MOVE_LIMIT - state.moves.length);
}
