import { isBoardFull } from '../board.js';
import { hasWinFrom } from '../rules.js';
import { type Board, Empty, type Player, opponentOf } from '../types.js';
import { candidateMoves } from './candidates.js';
import { evaluate, moveHeuristic, WIN_SCORE } from './evaluate.js';
import { findImmediateWin, winningMoves } from './threats.js';
import { hashBoard, slot, zobristFor } from './zobrist.js';

export interface SearchOptions {
  readonly size: number;
  readonly winLength: number;
  /** Hard ceiling on search depth in plies. */
  readonly maxDepth: number;
  /** Wall-clock timestamp (`Date.now()` scale) at which to stop searching. */
  readonly deadline: number;
  /** How far from an existing mark a cell may be and still be considered. */
  readonly radius?: number;
  /** Cap on candidates examined per node, after ordering. Prunes hopeless width. */
  readonly branchLimit?: number;
  /** Completing a run loses rather than wins. */
  readonly misere?: boolean;
  /**
   * Checked alongside the deadline. The worker uses it to drop a search whose
   * position is no longer on screen, rather than finishing work nobody wants.
   */
  readonly shouldStop?: () => boolean;
  readonly now?: () => number;
  /**
   * Search every root move with a full window so `rootScores` are exact.
   *
   * Alpha-beta at the root only ever proves that a move is no better than the
   * one already found, so the scores it leaves behind are upper bounds. That is
   * fine when all the caller wants is the best move, and wrong when it wants to
   * deliberately pick a slightly worse one - an upper bound can make a losing
   * move look playable. It costs pruning, so only the weaker profiles ask.
   */
  readonly exactRootScores?: boolean;
}

export interface SearchResult {
  readonly move: number;
  readonly score: number;
  /** Deepest ply fully searched. Lower than `maxDepth` means the deadline hit. */
  readonly depth: number;
  readonly nodes: number;
  /** True when the run was cut short, so the caller knows the answer is provisional. */
  readonly aborted: boolean;
  /**
   * Every root move with the score the last completed iteration gave it.
   *
   * This is what makes the lower difficulties principled rather than random:
   * a weaker bot picks from the moves within a slack window of the best one, so
   * it plays a defensible move that is simply not the strongest, instead of
   * a coin flip that occasionally throws the game away.
   *
   * Exact only when `exactRootScores` was set; otherwise every entry but the
   * best is an upper bound.
   */
  readonly rootScores: readonly RootScore[];
}

export interface RootScore {
  readonly move: number;
  readonly score: number;
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
 * How many plies the search may add beyond its nominal depth to settle a threat.
 *
 * The extension only ever follows forced moves, so this is a depth bound on a
 * single line rather than on a tree - but a cap is still wanted, because a long
 * chain of mutual threats on a gomoku board would otherwise run until the clock
 * stopped it.
 */
const MAX_EXTENSIONS = 8;

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
 * Iterative-deepening alpha-beta search over the line variants.
 *
 * Depth is increased one ply at a time and the run stops when the deadline
 * passes. Searching shallow first sounds wasteful but is not: each pass fills
 * the transposition table and gives the next pass a good move to try first, and
 * - the point of the whole exercise - there is always a complete, usable answer
 * in hand whenever time runs out.
 */
export function search(board: Board, me: Player, options: SearchOptions): SearchResult {
  const { size, winLength, misere = false } = options;
  const now = options.now ?? Date.now;
  const table = zobristFor(board.length);
  const transpositions = new Map<number, Entry>();
  const radius = options.radius ?? 2;
  const branchLimit = options.branchLimit ?? Number.POSITIVE_INFINITY;
  const working = board.slice();

  // Move ordering scratch, indexed by cell and reused by every node: the sort
  // below has to be allocation-free, because it runs more often than anything
  // else in the search.
  const orderScore = new Float64Array(board.length);
  /** Two quiet moves per ply that caused a cutoff. Tried early at sibling nodes. */
  const killers = new Int32Array(options.maxDepth + MAX_EXTENSIONS + 2).fill(-1);

  const hash = hashBoard(working, me);
  let primary = hash.primary;
  let secondary = hash.secondary;
  let nodes = 0;
  let aborted = false;

  const outOfTime = () => {
    // Checking the clock is not free, so only sample it every so often.
    if ((nodes & 0x3ff) === 0 && (now() >= options.deadline || options.shouldStop?.() === true)) {
      aborted = true;
    }
    return aborted;
  };

  const play = (index: number, player: Player) => {
    working[index] = player;
    const key = slot(index, player);
    primary ^= (table.primary[key] ?? 0) ^ table.sidePrimary;
    secondary ^= (table.secondary[key] ?? 0) ^ table.sideSecondary;
  };

  const unplay = (index: number, player: Player) => {
    working[index] = Empty;
    const key = slot(index, player);
    primary ^= (table.primary[key] ?? 0) ^ table.sidePrimary;
    secondary ^= (table.secondary[key] ?? 0) ^ table.sideSecondary;
  };

  const order = (moves: number[], player: Player, preferred: number, killer: number): number[] => {
    for (const move of moves) {
      orderScore[move] =
        (move === preferred ? 1e12 : 0) +
        (move === killer ? 1e9 : 0) +
        moveHeuristic(working, size, move, player, winLength);
    }
    moves.sort((a, b) => (orderScore[b] ?? 0) - (orderScore[a] ?? 0));
    return Number.isFinite(branchLimit) && moves.length > branchLimit
      ? moves.slice(0, branchLimit)
      : moves;
  };

  /** The score of a node whose parent's move completed a run. */
  const terminalScore = (ply: number): number =>
    // Normally the opponent just won, so this node is lost. Under misere the
    // same move loses it for them, so the identical position is won instead.
    misere ? WIN_SCORE - ply : -(WIN_SCORE - ply);

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
    extensions: number,
  ): number => {
    nodes++;

    if (lastMove !== null && hasWinFrom(working, size, lastMove, winLength)) {
      return terminalScore(ply);
    }
    if (isBoardFull(working)) return 0;
    if (outOfTime()) return evalHere(player);

    let searchDepth = depth;
    // Moves the extension is restricted to. Empty means "no restriction".
    let forced: number[] | null = null;

    if (searchDepth <= 0) {
      /**
       * Threat resolution at the leaves.
       *
       * Stopping the search on a position where somebody is one move from
       * winning reads that position as quiet, which is exactly how a bot walks
       * into a loss it could see coming. So the search keeps going - but only
       * down *forced* lines. An earlier version extended every candidate, which
       * turned one leaf into `branchLimit ^ extensions` nodes and swallowed the
       * whole time budget several plies from anything that mattered.
       */
      if (extensions >= MAX_EXTENSIONS || misere) return evalHere(player);

      const here = candidateMoves(working, size, radius);

      // Side to move has a win on the board: the position is won, exactly.
      if (findImmediateWin(working, size, player, winLength, here) !== null) {
        return WIN_SCORE - ply - 1;
      }

      const threats = winningMoves(working, size, opponentOf(player), winLength, here, 2);
      // Two threats at once cannot both be answered, so this is lost, exactly.
      if (threats.length >= 2) return -(WIN_SCORE - ply - 2);
      if (threats.length === 0) return evalHere(player);

      // One threat: the reply is forced, so follow it and nothing else.
      forced = threats;
      searchDepth = 1;
      extensions += 1;
    }

    let alpha = alphaIn;
    const original = alpha;
    // The bounds an entry is written with have to be the ones it was searched
    // against, not ones a table hit has since narrowed.
    const originalBeta = beta;
    const stored = transpositions.get(primary);
    let preferred = -1;

    if (stored && stored.secondary === secondary) {
      preferred = stored.best;
      if (stored.depth >= searchDepth) {
        const score = fromEntryScore(stored.score, ply);
        if (stored.flag === EXACT) return score;
        if (stored.flag === LOWER_BOUND && score > alpha) alpha = score;
        else if (stored.flag === UPPER_BOUND && score < beta) beta = score;
        if (alpha >= beta) return score;
      }
    }

    const moves = order(
      forced ?? candidateMoves(working, size, radius),
      player,
      preferred,
      killers[ply] ?? -1,
    );
    let best = Number.NEGATIVE_INFINITY;
    let bestMove = moves[0] ?? -1;

    for (const move of moves) {
      play(move, player);
      const score = -negamax(
        ply + 1,
        searchDepth - 1,
        -beta,
        -alpha,
        opponentOf(player),
        move,
        extensions,
      );
      unplay(move, player);

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
    transpositions.set(primary, {
      secondary,
      depth: searchDepth,
      score: toEntryScore(best, ply),
      flag,
      best: bestMove,
    });
    return best;
  };

  function evalHere(player: Player): number {
    const score = evaluate(working, size, player, winLength);
    // Under misere every threat is a liability: the same position is worth the
    // opposite to the same player.
    return misere ? -score : score;
  }

  const rootMoves = candidateMoves(working, size, radius);
  let bestMove = rootMoves[0] ?? -1;
  let bestScore = 0;
  let completedDepth = 0;
  let rootScores: RootScore[] = rootMoves.map((move) => ({ move, score: 0 }));

  for (let depth = 1; depth <= options.maxDepth; depth++) {
    let alpha = Number.NEGATIVE_INFINITY;
    let iterationMove = -1;
    let iterationScore = Number.NEGATIVE_INFINITY;
    const scored: RootScore[] = [];

    for (const move of order(rootMoves.slice(), me, bestMove, -1)) {
      play(move, me);
      const score = -negamax(
        1,
        depth - 1,
        Number.NEGATIVE_INFINITY,
        options.exactRootScores === true ? Number.POSITIVE_INFINITY : -alpha,
        opponentOf(me),
        move,
        0,
      );
      unplay(move, me);

      if (aborted) break;
      scored.push({ move, score });
      if (score > iterationScore) {
        iterationScore = score;
        iterationMove = move;
      }
      if (score > alpha) alpha = score;
    }

    // A partial iteration is still worth taking, because the move it started
    // with was the previous iteration's best: anything that beat that one did
    // so on a deeper search, so the answer only ever improves. Throwing the
    // whole iteration away instead is what made a longer budget buy nothing on
    // the boards where one more ply does not fit in the time available.
    if (iterationMove >= 0) {
      bestMove = iterationMove;
      bestScore = iterationScore;
      if (!aborted) {
        completedDepth = depth;
        rootScores = scored;
      }
    }

    if (aborted) break;

    // A forced win or loss is proven - searching deeper cannot change it.
    if (Math.abs(bestScore) >= MATE_THRESHOLD) break;
  }

  return { move: bestMove, score: bestScore, depth: completedDepth, nodes, aborted, rootScores };
}

export { WIN_SCORE, MATE_THRESHOLD };
