import { type GameState, O, opponentOf, type Player, X } from '../types.js';
import { PENTE_CAPTURES_TO_WIN, PENTE_DIRECTIONS, penteCaptures } from '../variants/pente.js';
import { WIN_SCORE } from './evaluate.js';
import type { RootScore } from './search.js';

/**
 * Pente search.
 *
 * The line search cannot play Pente: it does not know a mark can leave the
 * board, so it would happily build a four out of a pair that is about to be
 * taken, and it has no idea that a capture is worth anything. This is the same
 * shape - iterative-deepening alpha-beta over the cells near the stones, a
 * static score at the leaves - on a board that undoes captures as well as
 * placements, with an evaluation that values captures, threats to capture and
 * exposed pairs alongside the five-in-a-row windows.
 *
 * Tactics come first, as they do for every rule set: a move that wins on the
 * spot (five in a row or the fifth pair) is played, and if the opponent has
 * one, the root is narrowed to the moves that leave them without it - which in
 * Pente includes capturing a stone out of their line, not only blocking it.
 */

export interface PenteSearchOptions {
  /** Plies to search; 0 scores the root moves statically. */
  readonly maxDepth: number;
  readonly deadline: number;
  /** Candidates examined per interior node, after ordering. */
  readonly branchLimit: number;
  readonly shouldStop?: () => boolean;
  readonly now?: () => number;
}

export interface PenteSearchResult {
  /** A move the tactics settled without searching, if any. */
  readonly forced: { readonly move: number; readonly reason: 'win' | 'block' } | null;
  readonly rootScores: readonly RootScore[];
  readonly depth: number;
  readonly nodes: number;
  readonly score: number;
}

/** Window values by stones of one colour in an otherwise empty five. */
const WINDOW_VALUE = [0, 1, 8, 60, 420, 0];
/** Value of a capture count, steepening towards the fifth pair. */
const CAPTURE_VALUE = [0, 70, 160, 300, 620, 0];
const MATE = WIN_SCORE - 1000;

class Aborted extends Error {}

/** A mutable Pente board that can take a move back, captures and all. */
export class PenteBoard {
  readonly cells: Int8Array;
  readonly size: number;
  /** Captured pairs, indexed by player (1 = X, 2 = O); slot 0 unused. */
  readonly captures = [0, 0, 0];
  private readonly history: { move: number; player: Player; taken: number[] }[] = [];
  private readonly windows: readonly (readonly number[])[];

  constructor(state: GameState) {
    this.size = state.config.size;
    this.cells = Int8Array.from(state.board);
    const [x, o] = penteCaptures(state);
    this.captures[X] = x;
    this.captures[O] = o;
    this.windows = windowsFor(this.size);
  }

  /** Place `player` at `move`, take any captures, and report whether it won. */
  play(move: number, player: Player): boolean {
    const { cells, size } = this;
    cells[move] = player;
    const opponent = opponentOf(player);
    const row = Math.floor(move / size);
    const col = move % size;
    const taken: number[] = [];
    for (const [dRow, dCol] of PENTE_DIRECTIONS) {
      const farRow = row + dRow * 3;
      const farCol = col + dCol * 3;
      if (farRow < 0 || farRow >= size || farCol < 0 || farCol >= size) continue;
      const step = dRow * size + dCol;
      if (
        cells[move + step] === opponent &&
        cells[move + step * 2] === opponent &&
        cells[move + step * 3] === player
      ) {
        cells[move + step] = 0;
        cells[move + step * 2] = 0;
        taken.push(move + step, move + step * 2);
      }
    }
    this.captures[player] = this.captures[player]! + taken.length / 2;
    this.history.push({ move, player, taken });
    return this.captures[player] >= PENTE_CAPTURES_TO_WIN || this.fiveThrough(move, player);
  }

  undo(): void {
    const last = this.history.pop();
    if (!last) return;
    const opponent = opponentOf(last.player);
    this.cells[last.move] = 0;
    for (const cell of last.taken) this.cells[cell] = opponent;
    this.captures[last.player] = this.captures[last.player]! - last.taken.length / 2;
  }

  /** Whether `player` has five or more in a row through `move`. */
  fiveThrough(move: number, player: Player): boolean {
    const { cells, size } = this;
    const row = Math.floor(move / size);
    const col = move % size;
    for (const [dRow, dCol] of PENTE_DIRECTIONS.slice(0, 4)) {
      let run = 1;
      for (const sign of [1, -1]) {
        let r = row + dRow * sign;
        let c = col + dCol * sign;
        while (r >= 0 && r < size && c >= 0 && c < size && cells[r * size + c] === player) {
          run++;
          r += dRow * sign;
          c += dCol * sign;
        }
      }
      if (run >= 5) return true;
    }
    return false;
  }

  /** Empty cells within `radius` of a stone, or the centre on an empty board. */
  candidates(radius: number): number[] {
    const { cells, size } = this;
    const near = new Uint8Array(cells.length);
    let stones = 0;
    for (let index = 0; index < cells.length; index++) {
      if (cells[index] === 0) continue;
      stones++;
      const row = Math.floor(index / size);
      const col = index % size;
      for (let r = Math.max(0, row - radius); r <= Math.min(size - 1, row + radius); r++) {
        for (let c = Math.max(0, col - radius); c <= Math.min(size - 1, col + radius); c++) {
          near[r * size + c] = 1;
        }
      }
    }
    if (stones === 0) return [Math.floor(cells.length / 2)];
    const result: number[] = [];
    for (let index = 0; index < cells.length; index++) {
      if (near[index] && cells[index] === 0) result.push(index);
    }
    return result;
  }

  /** Every move that wins on the spot for `player`. */
  winsFor(player: Player): number[] {
    const wins: number[] = [];
    for (const move of this.candidates(1)) {
      const won = this.play(move, player);
      this.undo();
      if (won) wins.push(move);
    }
    return wins;
  }

  /**
   * How promising `move` looks for `player` without searching: the runs it
   * extends and blocks, the pairs it takes, and the captures it denies.
   */
  moveScore(move: number, player: Player): number {
    const { cells, size } = this;
    const opponent = opponentOf(player);
    const row = Math.floor(move / size);
    const col = move % size;
    let score = 0;
    for (const [dRow, dCol] of PENTE_DIRECTIONS.slice(0, 4)) {
      let mine = 1;
      let theirs = 1;
      for (const sign of [1, -1]) {
        for (const [who, add] of [
          [player, (n: number) => (mine += n)],
          [opponent, (n: number) => (theirs += n)],
        ] as const) {
          let r = row + dRow * sign;
          let c = col + dCol * sign;
          let run = 0;
          while (r >= 0 && r < size && c >= 0 && c < size && cells[r * size + c] === who) {
            run++;
            r += dRow * sign;
            c += dCol * sign;
          }
          add(run);
        }
      }
      score += RUN_VALUE[Math.min(mine, 5)]! + RUN_VALUE[Math.min(theirs, 5)]! * 0.9;
    }
    for (const [dRow, dCol] of PENTE_DIRECTIONS) {
      const farRow = row + dRow * 3;
      const farCol = col + dCol * 3;
      if (farRow < 0 || farRow >= size || farCol < 0 || farCol >= size) continue;
      const step = dRow * size + dCol;
      const a = cells[move + step];
      const b = cells[move + step * 2];
      const far = cells[move + step * 3];
      // A capture, and the square that would capture us denied.
      if (a === opponent && b === opponent && far === player) {
        score += 500 + this.captures[player]! * 250;
      } else if (a === player && b === player && far === opponent) {
        score += 260 + this.captures[opponent]! * 200;
      }
    }
    return score;
  }

  /** Static score from `player`'s side, with `player` to move. */
  evaluate(player: Player): number {
    const { cells } = this;
    let x = 0;
    let o = 0;
    for (const window of this.windows) {
      let xs = 0;
      let os = 0;
      for (const cell of window) {
        const value = cells[cell];
        if (value === X) xs++;
        else if (value === O) os++;
      }
      if (os === 0) x += WINDOW_VALUE[xs]!;
      else if (xs === 0) o += WINDOW_VALUE[os]!;
    }
    x += CAPTURE_VALUE[Math.min(this.captures[X]!, 5)]!;
    o += CAPTURE_VALUE[Math.min(this.captures[O]!, 5)]!;

    // Exposed pairs: two stones with an enemy at one end and space at the
    // other. The side to move takes one now; the other side's are only a
    // threat, and a smaller penalty.
    const exposed = this.exposedPairs();
    const opponent = opponentOf(player);
    const mineExposed = exposed[player]!;
    const theirsExposed = exposed[opponent]!;
    const mine = player === X ? x : o;
    const theirs = player === X ? o : x;
    return mine - theirs + theirsExposed * 90 - mineExposed * 40 + 12;
  }

  private exposedPairs(): number[] {
    const { cells, size } = this;
    const exposed = [0, 0, 0];
    for (let index = 0; index < cells.length; index++) {
      const owner = cells[index];
      if (owner !== X && owner !== O) continue;
      const row = Math.floor(index / size);
      const col = index % size;
      for (const [dRow, dCol] of PENTE_DIRECTIONS.slice(0, 4)) {
        const nextRow = row + dRow;
        const nextCol = col + dCol;
        if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size) continue;
        if (cells[nextRow * size + nextCol] !== owner) continue;
        const before = cellAt(cells, size, row - dRow, col - dCol);
        const after = cellAt(cells, size, row + dRow * 2, col + dCol * 2);
        const enemy = owner === X ? O : X;
        if ((before === enemy && after === 0) || (before === 0 && after === enemy)) {
          exposed[owner]!++;
        }
      }
    }
    return exposed;
  }
}

const RUN_VALUE = [0, 0, 6, 40, 300, 5000];

function cellAt(cells: Int8Array, size: number, row: number, col: number): number {
  if (row < 0 || row >= size || col < 0 || col >= size) return -1;
  return cells[row * size + col]!;
}

const WINDOWS = new Map<number, number[][]>();

/** Every run of five cells on a board of `size`, in all four directions. */
function windowsFor(size: number): number[][] {
  const cached = WINDOWS.get(size);
  if (cached) return cached;
  const windows: number[][] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      for (const [dRow, dCol] of PENTE_DIRECTIONS.slice(0, 4)) {
        const endRow = row + dRow * 4;
        const endCol = col + dCol * 4;
        if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;
        windows.push(
          Array.from({ length: 5 }, (_, step) => (row + dRow * step) * size + col + dCol * step),
        );
      }
    }
  }
  WINDOWS.set(size, windows);
  return windows;
}

/**
 * Score the root moves of a Pente position.
 *
 * The forced answers come back in `forced`; otherwise `rootScores` holds every
 * root move with the score of the deepest iteration that finished.
 */
export function searchPente(state: GameState, options: PenteSearchOptions): PenteSearchResult {
  const board = new PenteBoard(state);
  const me = state.currentPlayer;
  const opponent = opponentOf(me);
  const now = options.now ?? Date.now;

  const wins = board.winsFor(me);
  if (wins.length > 0) {
    return {
      forced: { move: wins[0]!, reason: 'win' },
      rootScores: [],
      depth: 0,
      nodes: 0,
      score: WIN_SCORE,
    };
  }

  let root = board.candidates(2);
  // If the opponent wins next move, only the moves that take that away count.
  if (board.winsFor(opponent).length > 0) {
    const saving = root.filter((move) => {
      board.play(move, me);
      const safe = board.winsFor(opponent).length === 0;
      board.undo();
      return safe;
    });
    if (saving.length === 1) {
      return {
        forced: { move: saving[0]!, reason: 'block' },
        rootScores: [],
        depth: 0,
        nodes: 0,
        score: 0,
      };
    }
    if (saving.length > 0) root = saving;
  }

  root = root.toSorted((a, b) => board.moveScore(b, me) - board.moveScore(a, me));
  let rootScores: RootScore[] = root.map((move, at) => ({ move, score: -at }));
  if (options.maxDepth <= 0) {
    rootScores = root.map((move) => ({ move, score: Math.round(board.moveScore(move, me)) }));
    return { forced: null, rootScores, depth: 0, nodes: root.length, score: 0 };
  }

  // The root is wider than interior nodes, but not unbounded: on an open board
  // the radius-two ring is a hundred squares and most of them are nothing.
  const rootWidth = Math.max(options.branchLimit * 2, 18);
  root = root.slice(0, rootWidth);

  let nodes = 0;
  let completed = 0;
  let bestScore = 0;
  const stop = () => now() >= options.deadline || options.shouldStop?.() === true;

  const negamax = (
    depth: number,
    ply: number,
    alpha: number,
    beta: number,
    player: Player,
  ): number => {
    nodes++;
    if ((nodes & 255) === 0 && stop()) throw new Aborted();
    if (depth === 0) return board.evaluate(player);

    const moves = board.candidates(1);
    if (moves.length === 0) return 0;
    const ordered = moves
      .map((move) => ({ move, score: board.moveScore(move, player) }))
      .toSorted((a, b) => b.score - a.score)
      .slice(0, options.branchLimit);

    let best = -WIN_SCORE;
    for (const { move } of ordered) {
      const won = board.play(move, player);
      const score = won
        ? WIN_SCORE - ply
        : -negamax(depth - 1, ply + 1, -beta, -alpha, opponentOf(player));
      board.undo();
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  };

  for (let depth = 1; depth <= options.maxDepth; depth++) {
    const scores: RootScore[] = [];
    try {
      for (const move of root) {
        const won = board.play(move, me);
        const score = won ? WIN_SCORE : -negamax(depth - 1, 2, -WIN_SCORE, WIN_SCORE, opponent);
        board.undo();
        scores.push({ move, score });
      }
    } catch (error) {
      if (!(error instanceof Aborted)) throw error;
      // The board is left mid-search; rebuild nothing, the caller only reads
      // scores from here on. Partial proofs still count.
      for (const entry of scores) {
        if (Math.abs(entry.score) >= MATE) {
          rootScores = rootScores.map((old) => (old.move === entry.move ? entry : old));
        }
      }
      break;
    }
    rootScores = scores;
    completed = depth;
    bestScore = Math.max(...scores.map((entry) => entry.score));
    // Keep the best first so the next iteration's ordering is sharper.
    root = scores.toSorted((a, b) => b.score - a.score).map((entry) => entry.move);
    if (bestScore >= MATE || stop()) break;
  }

  return { forced: null, rootScores, depth: completed, nodes, score: bestScore };
}

/**
 * The squares where `player` would win on the spot - five in a row or the
 * fifth pair - in `state`, whoever is to move. What the practice hints show.
 */
export function penteWinningMoves(state: GameState, player: Player): number[] {
  if (state.status !== 'playing') return [];
  return new PenteBoard(state).winsFor(player).toSorted((a, b) => a - b);
}
