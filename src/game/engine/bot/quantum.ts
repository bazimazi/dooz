import { type GameState, opponentOf, type Player } from '../types.js';
import { quantumOf, quantumVariant } from '../variants/quantum.js';
import { TRIPLES } from '../variants/ultimate.js';
import { WIN_SCORE } from './evaluate.js';
import type { RootScore } from './search.js';

/**
 * Quantum tic-tac-toe search.
 *
 * A quantum position is small - nine squares - but a move is a pair of squares
 * and, when a cycle is pending, a choice of how it collapses too, so a node has
 * up to seventy-two children and every one of them has to be played out through
 * the collapse rules to be scored. That makes a shallow, well-ordered search
 * the right tool: the rules engine itself generates and applies the moves (a
 * second implementation of measurement would be a second place for it to be
 * wrong), the interior nodes keep only their most promising children, and the
 * static score reads what the classical board and the spooky marks promise.
 *
 * Every level still takes a win it can see and refuses a move that lets the
 * opponent win at once while anything else is left: the root filters those
 * before the search is consulted.
 */

export interface QuantumSearchOptions {
  readonly maxDepth: number;
  readonly deadline: number;
  readonly branchLimit: number;
  readonly shouldStop?: () => boolean;
  readonly now?: () => number;
}

export interface QuantumSearchResult {
  readonly forced: { readonly move: number; readonly reason: 'win' } | null;
  readonly rootScores: readonly RootScore[];
  readonly depth: number;
  readonly nodes: number;
  readonly score: number;
}

const MATE = WIN_SCORE - 1000;

class Aborted extends Error {}

/** The positions after each legal move, in move order. */
function children(state: GameState): { move: number; next: GameState }[] {
  return quantumVariant.legalMoves(state).map((move) => ({
    move,
    next: quantumVariant.apply(state, move)!,
  }));
}

/** Whether the player to move in `state` can win on this move. */
function winsNow(state: GameState): boolean {
  const player = state.currentPlayer;
  for (const move of quantumVariant.legalMoves(state)) {
    const next = quantumVariant.apply(state, move)!;
    if (next.status === 'won' && next.winner === player) return true;
  }
  return false;
}

/**
 * A static score from `player`'s side.
 *
 * Classical marks count as they do in tic-tac-toe - a line with two of yours
 * and none of theirs is nearly a win. Spooky marks count for a little in every
 * line they touch, because each is a mark that will land in one of its squares.
 * The player who will choose the next collapse holds the initiative, which is
 * worth a small bonus of its own.
 */
export function evaluateQuantum(state: GameState, player: Player): number {
  if (state.status === 'won') return state.winner === player ? WIN_SCORE : -WIN_SCORE;
  if (state.status === 'draw') return 0;

  const quantum = quantumOf(state);
  const opponent = opponentOf(player);
  const spooky = [0, 0, 0].map(() => Array.from({ length: 9 }, () => 0));
  for (const mark of quantum.marks) {
    if (mark.at !== null) continue;
    for (const cell of mark.cells) spooky[mark.player]![cell]!++;
  }

  let score = 0;
  for (const line of TRIPLES) {
    let mine = 0;
    let theirs = 0;
    let mySpooky = 0;
    let theirSpooky = 0;
    for (const cell of line) {
      const owner = state.board[cell];
      if (owner === player) mine++;
      else if (owner === opponent) theirs++;
      else {
        mySpooky += spooky[player]![cell]!;
        theirSpooky += spooky[opponent]![cell]!;
      }
    }
    if (theirs === 0) score += [0, 6, 30, 0][mine]! + mySpooky * (1 + mine);
    if (mine === 0) score -= [0, 6, 30, 0][theirs]! + theirSpooky * (1 + theirs);
  }
  if (quantum.pending !== null) score += state.currentPlayer === player ? 8 : -8;
  return score;
}

/** Score the root moves of a quantum position. */
export function searchQuantum(
  state: GameState,
  options: QuantumSearchOptions,
): QuantumSearchResult {
  const me = state.currentPlayer;
  const now = options.now ?? Date.now;
  const root = children(state);

  const win = root.find((child) => child.next.status === 'won' && child.next.winner === me);
  if (win) {
    return {
      forced: { move: win.move, reason: 'win' },
      rootScores: [],
      depth: 0,
      nodes: root.length,
      score: WIN_SCORE,
    };
  }

  // Moves that lose on the spot, or hand the opponent a win on their move, are
  // only kept when nothing else is left.
  const safe = root.filter(
    (child) =>
      !(child.next.status === 'won' && child.next.winner !== me) &&
      !(child.next.status === 'playing' && winsNow(child.next)),
  );
  const pool = safe.length > 0 ? safe : root;

  let rootScores: RootScore[] = pool.map((child) => ({
    move: child.move,
    score: evaluateQuantum(child.next, me),
  }));
  if (options.maxDepth <= 1) {
    return { forced: null, rootScores, depth: options.maxDepth, nodes: root.length, score: 0 };
  }

  let nodes = 0;
  let completed = 1;
  let bestScore = Math.max(...rootScores.map((entry) => entry.score));
  const stop = () => now() >= options.deadline || options.shouldStop?.() === true;

  const negamax = (
    node: GameState,
    depth: number,
    ply: number,
    alpha: number,
    beta: number,
  ): number => {
    nodes++;
    if ((nodes & 63) === 0 && stop()) throw new Aborted();
    const player = node.currentPlayer;
    if (node.status === 'won') return node.winner === player ? WIN_SCORE - ply : -(WIN_SCORE - ply);
    if (node.status === 'draw') return 0;
    if (depth <= 0) return evaluateQuantum(node, player);

    const ordered = children(node)
      .map((child) => Object.assign(child, { score: evaluateQuantum(child.next, player) }))
      .toSorted((a, b) => b.score - a.score)
      .slice(0, options.branchLimit);

    let best = -WIN_SCORE;
    for (const child of ordered) {
      const next = child.next;
      // A finished child is scored from the mover's side directly: the state
      // freezes `currentPlayer` at the mover, so negating it would be wrong.
      const score =
        next.status === 'won'
          ? next.winner === player
            ? WIN_SCORE - ply
            : -(WIN_SCORE - ply)
          : next.status === 'draw'
            ? 0
            : -negamax(next, depth - 1, ply + 1, -beta, -alpha);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  };

  for (let depth = 2; depth <= options.maxDepth; depth++) {
    const scores: RootScore[] = [];
    try {
      for (const child of pool) {
        const next = child.next;
        const score =
          next.status === 'won'
            ? next.winner === me
              ? WIN_SCORE
              : -WIN_SCORE
            : next.status === 'draw'
              ? 0
              : -negamax(next, depth - 1, 1, -WIN_SCORE, WIN_SCORE);
        scores.push({ move: child.move, score });
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
    if (bestScore >= MATE || stop()) break;
  }

  return { forced: null, rootScores, depth: completed, nodes, score: bestScore };
}
