import { isBoardFull } from '../board.js';
import { findWinLineFrom } from '../rules.js';
import { type Board, type BoardSize, Empty, type Player, opponentOf } from '../types.js';
import { candidateMoves } from './candidates.js';
import { evaluate, moveHeuristic, WIN_SCORE } from './evaluate.js';
import { hashBoard, slot, zobristFor } from './zobrist.js';

export interface SearchOptions {
  /** Hard ceiling on search depth in plies. */
  readonly maxDepth: number;
  /** Wall-clock timestamp (`Date.now()` scale) at which to stop searching. */
  readonly deadline: number;
  /** How far from an existing mark a cell may be and still be considered. */
  readonly radius?: number;
  /** Cap on candidates examined per node, after ordering. Prunes hopeless width. */
  readonly branchLimit?: number;
}

export interface SearchResult {
  readonly move: number;
  readonly score: number;
  /** Deepest ply fully searched. Lower than `maxDepth` means the deadline hit. */
  readonly depth: number;
  readonly nodes: number;
}

const EXACT = 0;
const LOWER_BOUND = 1;
const UPPER_BOUND = 2;

interface Entry {
  secondary: number;
  depth: number;
  score: number;
  flag: number;
  best: number;
}

/**
 * Iterative-deepening alpha-beta search.
 *
 * Depth is increased one ply at a time and the run stops when the deadline
 * passes. Searching shallow first sounds wasteful but is not: each pass fills
 * the transposition table and gives the next pass a good move to try first, and
 * — the point of the whole exercise — there is always a complete, usable answer
 * in hand whenever time runs out.
 */
export function search(
  board: Board,
  size: BoardSize,
  me: Player,
  options: SearchOptions,
): SearchResult {
  const table = zobristFor(size);
  const transpositions = new Map<number, Entry>();
  const radius = options.radius ?? 2;
  const branchLimit = options.branchLimit ?? Number.POSITIVE_INFINITY;
  const working = board.slice();

  let hash = hashBoard(working, size, me);
  let primary = hash.primary;
  let secondary = hash.secondary;
  let nodes = 0;
  let aborted = false;

  const outOfTime = () => {
    // Checking the clock is not free, so only sample it every so often.
    if ((nodes & 0x3ff) === 0 && Date.now() >= options.deadline) aborted = true;
    return aborted;
  };

  const play = (index: number, player: Player) => {
    working[index] = player;
    const key = slot(index, player);
    primary ^= table.primary[key]! ^ table.sidePrimary;
    secondary ^= table.secondary[key]! ^ table.sideSecondary;
  };

  const unplay = (index: number, player: Player) => {
    working[index] = Empty;
    const key = slot(index, player);
    primary ^= table.primary[key]! ^ table.sidePrimary;
    secondary ^= table.secondary[key]! ^ table.sideSecondary;
  };

  const order = (moves: number[], player: Player, preferred: number): number[] => {
    const scored = moves.map((move) => ({
      move,
      score: (move === preferred ? 1e9 : 0) + moveHeuristic(working, size, move, player),
    }));
    scored.sort((a, b) => b.score - a.score);
    const limited = Number.isFinite(branchLimit) ? scored.slice(0, branchLimit) : scored;
    return limited.map((entry) => entry.move);
  };

  /**
   * Negamax: always returns the score from `player`'s point of view, so the
   * recursive call is negated rather than needing separate min and max arms.
   * `lastMove` was played by `player`'s opponent.
   */
  const negamax = (
    ply: number,
    depth: number,
    alphaIn: number,
    beta: number,
    player: Player,
    lastMove: number | null,
  ): number => {
    nodes++;

    // The opponent just moved; if that move won, this node is lost for `player`.
    // Subtracting `ply` makes a win found sooner score higher than the same win
    // found later, so the AI finishes games instead of dawdling.
    if (lastMove !== null && findWinLineFrom(working, size, lastMove)) return -(WIN_SCORE - ply);
    if (isBoardFull(working)) return 0;
    if (depth <= 0 || outOfTime()) return evaluate(working, size, player);

    let alpha = alphaIn;
    const original = alpha;
    const stored = transpositions.get(primary);
    let preferred = -1;

    if (stored && stored.secondary === secondary) {
      preferred = stored.best;
      if (stored.depth >= depth) {
        if (stored.flag === EXACT) return stored.score;
        if (stored.flag === LOWER_BOUND && stored.score > alpha) alpha = stored.score;
        else if (stored.flag === UPPER_BOUND && stored.score < beta) beta = stored.score;
        if (alpha >= beta) return stored.score;
      }
    }

    const moves = order(candidateMoves(working, size, radius), player, preferred);
    let best = Number.NEGATIVE_INFINITY;
    let bestMove = moves[0] ?? -1;

    for (const move of moves) {
      play(move, player);
      const score = -negamax(ply + 1, depth - 1, -beta, -alpha, opponentOf(player), move);
      unplay(move, player);

      if (aborted) return best === Number.NEGATIVE_INFINITY ? score : best;

      if (score > best) {
        best = score;
        bestMove = move;
      }
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }

    const flag = best <= original ? UPPER_BOUND : best >= beta ? LOWER_BOUND : EXACT;
    transpositions.set(primary, { secondary, depth, score: best, flag, best: bestMove });
    return best;
  };

  const rootMoves = candidateMoves(working, size, radius);
  let bestMove = rootMoves[0] ?? -1;
  let bestScore = 0;
  let completedDepth = 0;

  for (let depth = 1; depth <= options.maxDepth; depth++) {
    let alpha = Number.NEGATIVE_INFINITY;
    let iterationMove = -1;
    let iterationScore = Number.NEGATIVE_INFINITY;

    for (const move of order(rootMoves, me, bestMove)) {
      play(move, me);
      const score = -negamax(1, depth - 1, Number.NEGATIVE_INFINITY, -alpha, opponentOf(me), move);
      unplay(move, me);

      if (aborted) break;
      if (score > iterationScore) {
        iterationScore = score;
        iterationMove = move;
      }
      if (score > alpha) alpha = score;
    }

    // Only trust an iteration that ran to completion; a partial one has looked
    // at an arbitrary subset of the root moves and can prefer a bad one.
    if (aborted) break;

    if (iterationMove >= 0) {
      bestMove = iterationMove;
      bestScore = iterationScore;
      completedDepth = depth;
    }

    // A forced win or loss is proven — searching deeper cannot change it.
    if (Math.abs(bestScore) >= WIN_SCORE - 100) break;
  }

  return { move: bestMove, score: bestScore, depth: completedDepth, nodes };
}
