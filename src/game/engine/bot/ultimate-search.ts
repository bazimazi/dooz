import { ultimateBoardOf, ultimateCellOf } from '../board.js';
import { Empty, type GameState, type Player } from '../types.js';
import { WIN_SCORE } from './evaluate.js';
import type { RootScore, SearchResult } from './search.js';
import { evaluateUltimate, UltimatePosition } from './ultimate.js';

const MATE_THRESHOLD = WIN_SCORE - 1000;
const EXACT = 0;
const LOWER_BOUND = 1;
const UPPER_BOUND = 2;

export interface UltimateSearchOptions {
  readonly maxDepth: number;
  readonly deadline: number;
  readonly shouldStop?: () => boolean;
  readonly now?: () => number;
  /** Search every root move with a full window, so `rootScores` are exact. */
  readonly exactRootScores?: boolean;
}

interface Entry {
  secondary: number;
  depth: number;
  score: number;
  flag: number;
  best: number;
}

/**
 * Iterative-deepening alpha-beta over an Ultimate position.
 *
 * Structurally the same as the line search - same table, same mate rebasing,
 * same rule that a partial iteration is thrown away - but over a position that
 * knows about sub-boards, because in Ultimate the board a move sends the
 * opponent to matters more than the mark it places.
 */
export function searchUltimate(state: GameState, options: UltimateSearchOptions): SearchResult {
  const now = options.now ?? Date.now;
  const position = new UltimatePosition(state);
  const me = state.currentPlayer;
  const transpositions = new Map<number, Entry>();
  const killers = new Int32Array(options.maxDepth + 2).fill(-1);

  let nodes = 0;
  let aborted = false;

  const outOfTime = () => {
    if ((nodes & 0x1ff) === 0 && (now() >= options.deadline || options.shouldStop?.() === true)) {
      aborted = true;
    }
    return aborted;
  };

  /**
   * Ordering score for a candidate.
   *
   * Winning a sub-board and taking the centre of one are the two moves that
   * actually change the position; sending the opponent somewhere they have a
   * free choice is the commonest way to throw a game away, so it is pushed to
   * the back rather than merely priced in the evaluation.
   */
  const orderValue = (move: number, player: Player, preferred: number, killer: number): number => {
    if (move === preferred) return 1e12;
    let score = move === killer ? 1e9 : 0;

    const board = ultimateBoardOf(move);
    position.play(move);
    if (position.boards[board] === player) score += 5000;
    if (position.winner === player) score += 1e11;
    if (position.active === -1) score -= 900;
    position.unplay();

    const cell = ultimateCellOf(move);
    if (cell === 4) score += 120;
    else if (cell % 2 === 0) score += 60;
    return score;
  };

  const negamax = (ply: number, depth: number, alphaIn: number, beta: number): number => {
    nodes++;
    const player = position.toMove;

    if (position.settled) {
      if (position.winner === Empty) return 0;
      // `winner` is whoever completed the meta line, which is never the player
      // now to move - the turn passed after it.
      return -(WIN_SCORE - ply);
    }
    if (depth <= 0 || outOfTime()) return evaluateUltimate(position, player);

    let alpha = alphaIn;
    const original = alpha;
    const originalBeta = beta;
    const stored = transpositions.get(position.primary);
    let preferred = -1;

    if (stored && stored.secondary === position.secondary) {
      preferred = stored.best;
      if (stored.depth >= depth) {
        const score = fromEntry(stored.score, ply);
        if (stored.flag === EXACT) return score;
        if (stored.flag === LOWER_BOUND && score > alpha) alpha = score;
        else if (stored.flag === UPPER_BOUND && score < beta) beta = score;
        if (alpha >= beta) return score;
      }
    }

    const moves = position.moves();
    if (moves.length === 0) return evaluateUltimate(position, player);

    const killer = killers[ply] ?? -1;
    const scores = new Map<number, number>();
    for (const move of moves) scores.set(move, orderValue(move, player, preferred, killer));
    moves.sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0));

    let best = Number.NEGATIVE_INFINITY;
    let bestMove = moves[0] ?? -1;

    for (const move of moves) {
      position.play(move);
      const score = -negamax(ply + 1, depth - 1, -beta, -alpha);
      position.unplay();

      if (aborted) return best === Number.NEGATIVE_INFINITY ? score : best;

      if (score > best) {
        best = score;
        bestMove = move;
      }
      if (best > alpha) alpha = best;
      if (alpha >= beta) {
        killers[ply] = move;
        break;
      }
    }

    const flag = best <= original ? UPPER_BOUND : best >= originalBeta ? LOWER_BOUND : EXACT;
    transpositions.set(position.primary, {
      secondary: position.secondary,
      depth,
      score: toEntry(best, ply),
      flag,
      best: bestMove,
    });
    return best;
  };

  const rootMoves = position.moves();
  let bestMove = rootMoves[0] ?? -1;
  let bestScore = 0;
  let completedDepth = 0;
  let rootScores: RootScore[] = rootMoves.map((move) => ({ move, score: 0 }));

  for (let depth = 1; depth <= options.maxDepth; depth++) {
    let alpha = Number.NEGATIVE_INFINITY;
    let iterationMove = -1;
    let iterationScore = Number.NEGATIVE_INFINITY;
    const scored: RootScore[] = [];

    const ordered = rootMoves.slice();
    const scores = new Map<number, number>();
    for (const move of ordered) scores.set(move, orderValue(move, me, bestMove, -1));
    ordered.sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0));

    for (const move of ordered) {
      position.play(move);
      const score = -negamax(
        1,
        depth - 1,
        Number.NEGATIVE_INFINITY,
        options.exactRootScores === true ? Number.POSITIVE_INFINITY : -alpha,
      );
      position.unplay();

      if (aborted) break;
      scored.push({ move, score });
      if (score > iterationScore) {
        iterationScore = score;
        iterationMove = move;
      }
      if (score > alpha) alpha = score;
    }

    // A partial iteration still improves on the previous one: its first move
    // was the previous best, so anything that beat it did so at this depth.
    if (iterationMove >= 0) {
      bestMove = iterationMove;
      bestScore = iterationScore;
      if (!aborted) {
        completedDepth = depth;
        rootScores = scored;
      }
    }
    if (aborted) break;
    if (Math.abs(bestScore) >= MATE_THRESHOLD) break;
  }

  return { move: bestMove, score: bestScore, depth: completedDepth, nodes, aborted, rootScores };
}

const toEntry = (score: number, ply: number): number => {
  if (score >= MATE_THRESHOLD) return score + ply;
  if (score <= -MATE_THRESHOLD) return score - ply;
  return score;
};

const fromEntry = (score: number, ply: number): number => {
  if (score >= MATE_THRESHOLD) return score - ply;
  if (score <= -MATE_THRESHOLD) return score + ply;
  return score;
};
