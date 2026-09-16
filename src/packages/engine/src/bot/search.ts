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

/**
 * Anything at least this large is a proven win rather than a heuristic score.
 *
 * Wins are scored `WIN_SCORE - ply` so a mate found sooner outranks the same
 * mate found later, which is what stops the bot dawdling once it is winning.
 */
const MATE_THRESHOLD = WIN_SCORE - 1000;

/**
 * Convert a mate score to and from a table entry.
 *
 * A mate score is relative to the node that found it, but a table entry is
 * shared by every path that reaches the position - and those paths are not all
 * the same length. Storing the raw score would hand a later path a mate
 * distance measured from an earlier one, so it is rebased to "plies from here"
 * on the way in and back to "plies from the root" on the way out.
 *
 * Without this the bot can prefer a slower win, or misjudge how far away a loss
 * is and walk into it.
 */
const toEntryScore = (score: number, ply: number): number => {
  if (score >= MATE_THRESHOLD) return score + ply;
  if (score <= -MATE_THRESHOLD) return score - ply;
  return score;
};

const fromEntryScore = (score: number, ply: number): number => {
  if (score >= MATE_THRESHOLD) return score - ply;
  if (score <= -MATE_THRESHOLD) return score + ply;
  return score;
};

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
 * - the point of the whole exercise - there is always a complete, usable answer
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
    // The bounds an entry is written with have to be the ones it was searched
    // against, not ones a table hit has since narrowed.
    const originalBeta = beta;
    const stored = transpositions.get(primary);
    let preferred = -1;

    if (stored && stored.secondary === secondary) {
      preferred = stored.best;
      if (stored.depth >= depth) {
        const score = fromEntryScore(stored.score, ply);
        if (stored.flag === EXACT) return score;
        if (stored.flag === LOWER_BOUND && score > alpha) alpha = score;
        else if (stored.flag === UPPER_BOUND && score < beta) beta = score;
        if (alpha >= beta) return score;
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

    const flag = best <= original ? UPPER_BOUND : best >= originalBeta ? LOWER_BOUND : EXACT;
    transpositions.set(primary, {
      secondary,
      depth,
      score: toEntryScore(best, ply),
      flag,
      best: bestMove,
    });
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

    // A forced win or loss is proven - searching deeper cannot change it.
    if (Math.abs(bestScore) >= MATE_THRESHOLD) break;
  }

  return { move: bestMove, score: bestScore, depth: completedDepth, nodes };
}
