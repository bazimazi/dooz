import { type GameState, O, opponentOf, type Player, X } from '../types.js';
import { QUBIC_LINES, QUBIC_LINES_THROUGH } from '../variants/qubic.js';
import { WIN_SCORE } from './evaluate.js';
import type { RootScore } from './search.js';

/**
 * Qubic search: alpha-beta over the cube's seventy-six lines.
 *
 * Every line keeps a running count of each player's marks, updated as a mark
 * is placed and taken back, so "does this complete a line", "is this a threat"
 * and the static score all read counts instead of rescanning the cube. That is
 * what makes the cube - sixty-four cells, a branching factor that starts at 64
 * - searchable to a useful depth.
 *
 * Threats drive the search the way they drive the game. A node where the side
 * to move can complete a line is won on the spot. A node where the opponent
 * threatens one has exactly one sensible reply - block it - and two such
 * threats are a lost position, so the search only ever widens out at quiet
 * nodes, and there it tries the moves that make threats of their own first.
 */

export interface QubicSearchOptions {
  readonly maxDepth: number;
  readonly deadline: number;
  readonly branchLimit: number;
  readonly shouldStop?: () => boolean;
  readonly now?: () => number;
}

export interface QubicSearchResult {
  readonly forced: { readonly move: number; readonly reason: 'win' | 'block' } | null;
  readonly rootScores: readonly RootScore[];
  readonly depth: number;
  readonly nodes: number;
  readonly score: number;
}

/** Value of a line holding this many marks of one player and none of the other. */
const LINE_VALUE = [0, 1, 12, 90, 0];
const MATE = WIN_SCORE - 1000;

class Aborted extends Error {}

/** A mutable cube with per-line counts, for searching. */
export class QubicCube {
  readonly cells: Int8Array;
  /** Marks per line, indexed `[player][line]`; row 0 is unused. */
  private readonly counts: Int8Array[] = [
    new Int8Array(0),
    new Int8Array(QUBIC_LINES.length),
    new Int8Array(QUBIC_LINES.length),
  ];

  constructor(state: GameState) {
    this.cells = Int8Array.from(state.board);
    for (let cell = 0; cell < this.cells.length; cell++) {
      const owner = this.cells[cell];
      if (owner === X || owner === O)
        for (const line of QUBIC_LINES_THROUGH[cell]!) this.counts[owner]![line]!++;
    }
  }

  /** Place a mark; returns whether it completed a line. */
  play(cell: number, player: Player): boolean {
    this.cells[cell] = player;
    const counts = this.counts[player]!;
    let won = false;
    for (const line of QUBIC_LINES_THROUGH[cell]!) if (++counts[line]! === 4) won = true;
    return won;
  }

  undo(cell: number, player: Player): void {
    this.cells[cell] = 0;
    const counts = this.counts[player]!;
    for (const line of QUBIC_LINES_THROUGH[cell]!) counts[line]!--;
  }

  /** The empty cells that would complete a line for `player`. */
  threats(player: Player): number[] {
    const mine = this.counts[player]!;
    const theirs = this.counts[opponentOf(player)]!;
    const found = new Set<number>();
    for (let line = 0; line < QUBIC_LINES.length; line++) {
      if (mine[line] !== 3 || theirs[line] !== 0) continue;
      for (const cell of QUBIC_LINES[line]!) if (this.cells[cell] === 0) found.add(cell);
    }
    return [...found];
  }

  empties(): number[] {
    const result: number[] = [];
    for (let cell = 0; cell < this.cells.length; cell++)
      if (this.cells[cell] === 0) result.push(cell);
    return result;
  }

  /** Static ordering score of `cell` for `player`: what it builds and what it blocks. */
  moveScore(cell: number, player: Player): number {
    const mine = this.counts[player]!;
    const theirs = this.counts[opponentOf(player)]!;
    let score = 0;
    for (const line of QUBIC_LINES_THROUGH[cell]!) {
      if (theirs[line] === 0) score += mine[line] === 2 ? 60 : mine[line] === 1 ? 6 : 1;
      if (mine[line] === 0) score += theirs[line] === 2 ? 40 : theirs[line] === 1 ? 4 : 0;
    }
    return score;
  }

  /** Static score from `player`'s side, with `player` to move. */
  evaluate(player: Player): number {
    const mine = this.counts[player]!;
    const theirs = this.counts[opponentOf(player)]!;
    let score = 0;
    let myThrees = 0;
    let theirThrees = 0;
    for (let line = 0; line < QUBIC_LINES.length; line++) {
      const m = mine[line]!;
      const t = theirs[line]!;
      if (t === 0) {
        score += LINE_VALUE[m]!;
        if (m === 3) myThrees++;
      } else if (m === 0) {
        score -= LINE_VALUE[t]!;
        if (t === 3) theirThrees++;
      }
    }
    // A threat for the side to move is a win; two for the other side is a loss.
    if (myThrees > 0) return WIN_SCORE - 2;
    if (theirThrees > 1) return -(WIN_SCORE - 3);
    return score;
  }
}

/** Score the root moves of a Qubic position. */
export function searchQubic(state: GameState, options: QubicSearchOptions): QubicSearchResult {
  const cube = new QubicCube(state);
  const me = state.currentPlayer;
  const opponent = opponentOf(me);
  const now = options.now ?? Date.now;

  const wins = cube.threats(me);
  if (wins.length > 0) {
    return {
      forced: { move: wins[0]!, reason: 'win' },
      rootScores: [],
      depth: 0,
      nodes: 0,
      score: WIN_SCORE,
    };
  }
  const blocks = cube.threats(opponent);
  if (blocks.length === 1) {
    return {
      forced: { move: blocks[0]!, reason: 'block' },
      rootScores: [],
      depth: 0,
      nodes: 0,
      score: 0,
    };
  }

  let root = cube.empties().toSorted((a, b) => cube.moveScore(b, me) - cube.moveScore(a, me));
  let rootScores: RootScore[] = root.map((move) => ({ move, score: cube.moveScore(move, me) }));
  if (options.maxDepth <= 0)
    return { forced: null, rootScores, depth: 0, nodes: root.length, score: 0 };

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
    if ((nodes & 511) === 0 && stop()) throw new Aborted();
    const other = opponentOf(player);
    if (cube.threats(player).length > 0) return WIN_SCORE - ply;
    const forcedReplies = cube.threats(other);
    if (forcedReplies.length > 1) return -(WIN_SCORE - ply - 1);
    if (depth <= 0 && forcedReplies.length === 0) return cube.evaluate(player);

    // A threat against us has one answer, and searching it does not cost a
    // ply: forced sequences are followed to their end, which is where Qubic's
    // wins are found.
    let moves: number[];
    let nextDepth = depth - 1;
    if (forcedReplies.length === 1) {
      moves = forcedReplies;
      nextDepth = Math.max(depth, 0);
    } else {
      moves = cube
        .empties()
        .map((move) => ({ move, score: cube.moveScore(move, player) }))
        .toSorted((a, b) => b.score - a.score)
        .slice(0, options.branchLimit)
        .map((entry) => entry.move);
    }
    if (moves.length === 0) return 0;

    let best = -WIN_SCORE;
    for (const move of moves) {
      cube.play(move, player);
      const score = -negamax(nextDepth, ply + 1, -beta, -alpha, other);
      cube.undo(move, player);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  };

  if (blocks.length > 1) root = blocks;

  for (let depth = 1; depth <= options.maxDepth; depth++) {
    const scores: RootScore[] = [];
    try {
      for (const move of root) {
        cube.play(move, me);
        const score = -negamax(depth - 1, 1, -WIN_SCORE, WIN_SCORE, opponent);
        cube.undo(move, me);
        scores.push({ move, score });
      }
    } catch (error) {
      if (!(error instanceof Aborted)) throw error;
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
    root = scores.toSorted((a, b) => b.score - a.score).map((entry) => entry.move);
    if (bestScore >= MATE || stop()) break;
  }

  return { forced: null, rootScores, depth: completed, nodes, score: bestScore };
}

/** The cells where `player` would complete a line in `state`. What the hints show. */
export function qubicWinningMoves(state: GameState, player: Player): number[] {
  if (state.status !== 'playing') return [];
  return new QubicCube(state).threats(player).toSorted((a, b) => a - b);
}
