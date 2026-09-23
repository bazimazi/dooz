import { countEmpty, emptyIndices } from '../board.js';
import { legalMoves } from '../game.js';
import { type Board, Empty, type GameState, opponentOf, type Player } from '../types.js';
import { candidateMoves } from './candidates.js';
import { type BotDifficulty, profileForBoard, radiusFor } from './difficulty.js';
import { moveHeuristic, WIN_SCORE } from './evaluate.js';
import { type RootScore, search } from './search.js';
import { findForkDefence, findForkMove, findImmediateWin } from './threats.js';
import { searchUltimate } from './ultimate-search.js';

const MATE_THRESHOLD = WIN_SCORE - 1000;

export interface BotOptions {
  readonly difficulty?: BotDifficulty;
  /** Overrides the difficulty's default thinking time, in milliseconds. */
  readonly timeBudgetMs?: number;
  /** Injectable for deterministic tests. */
  readonly random?: () => number;
  /**
   * Polled during the search. Returning `true` abandons it, which is how the
   * worker drops work for a position the player has already moved on from.
   */
  readonly shouldStop?: () => boolean;
  /** Injectable clock, so a test can make the budget expire on demand. */
  readonly now?: () => number;
}

export interface BotMove {
  readonly move: number;
  /** How the move was arrived at. Surfaced in diagnostics, never in the UI. */
  readonly reason: 'only-move' | 'win' | 'block' | 'fork' | 'fork-defence' | 'search' | 'heuristic';
  readonly depth: number;
  readonly nodes: number;
  readonly score: number;
}

/**
 * Pick a move for the player to act in `state`.
 *
 * Returns `null` only when the game is already over or there is nothing legal
 * to play. The move is always legal in `state`: every path either comes from
 * the legal-move list or is checked against it before being returned, so a
 * search that ran out of time can degrade to a weaker move but never to an
 * invalid one.
 */
export function findBestMove(state: GameState, options: BotOptions = {}): number | null {
  return chooseMove(state, options)?.move ?? null;
}

/** As {@link findBestMove}, but with the reasoning attached. */
export function chooseMove(state: GameState, options: BotOptions = {}): BotMove | null {
  if (state.status !== 'playing') return null;

  const { random = Math.random } = options;
  const legal = legalMoves(state);
  if (legal.length === 0) return null;
  if (legal.length === 1) {
    return { move: legal[0]!, reason: 'only-move', depth: 0, nodes: 0, score: 0 };
  }

  if (state.config.variant === 'ultimate') {
    return chooseUltimateMove(state, legal, options, random);
  }

  return chooseLineMove(state, legal, options, random);
}

// ---------------------------------------------------------------------------
// Line variants: classic, gomoku, misere
// ---------------------------------------------------------------------------

function chooseLineMove(
  state: GameState,
  legal: number[],
  options: BotOptions,
  random: () => number,
): BotMove {
  const { difficulty = 'hard' } = options;
  const { board } = state;
  const { size, winLength, variant } = state.config;
  const me = state.currentPlayer;
  const misere = variant === 'misere';

  const profile = profileForBoard(difficulty, board.length, countEmpty(board));
  const budget = options.timeBudgetMs ?? profile.timeMs;
  const now = options.now ?? Date.now;

  // Candidates are the cells near existing marks. A legal move outside that
  // set is legal but pointless, and playing one is what makes a weak opponent
  // look broken rather than merely weak - so even the beginner draws from here.
  const radius = radiusFor(profile, board.length - countEmpty(board));
  const near = candidateMoves(board, size, radius);
  const nearSet = new Set(near);
  const sensible = legal.filter((move) => nearSet.has(move));
  const pool = sensible.length > 0 ? sensible : legal;

  // Under misere a completed line loses, so none of the tactical shortcuts
  // below mean what they say - "take the win" would be taking the loss. The
  // variant is only offered on a 3x3 board, which the search solves outright,
  // so it goes straight there.
  if (!misere) {
    // Winning and blocking are worth special-casing at every level: they are
    // the two moves a human immediately notices, and finding them here means
    // the bot never misses one because the search ran out of time.
    const winNow = findImmediateWin(board, size, me, winLength, near);
    if (winNow !== null) {
      return { move: winNow, reason: 'win', depth: 0, nodes: 0, score: WIN_SCORE };
    }

    const blockNow = findImmediateWin(board, size, opponentOf(me), winLength, near);
    if (blockNow !== null) {
      return { move: blockNow, reason: 'block', depth: 0, nodes: 0, score: 0 };
    }

    if (profile.tactics === 'fork' && near.length <= FORK_SCAN_LIMIT) {
      // A double threat is a forced win and is safe to play on sight, now that
      // the opponent is known to have no win of their own this move.
      const fork = findForkMove(board, size, me, winLength, near);
      if (fork !== null) {
        return { move: fork, reason: 'fork', depth: 0, nodes: 0, score: MATE_THRESHOLD };
      }

      // Fork *defence* is only a shortcut for the levels whose search is too
      // shallow to find it. From hard upwards the search sees it several plies
      // out and picks the best answer rather than the first adequate one -
      // letting the heuristic win there made the bot play a safe move when a
      // winning one was available.
      if (profile.plies <= 3) {
        const theirFork = findForkMove(board, size, opponentOf(me), winLength, near);
        if (theirFork !== null) {
          const defence = findForkDefence(board, size, me, winLength, near);
          // No defence means the position is already lost; fall through and let
          // the search pick the move that makes them work hardest for it.
          if (defence !== null) {
            return { move: defence, reason: 'fork-defence', depth: 0, nodes: 0, score: 0 };
          }
        }
      }
    }
  }

  if (profile.plies <= 0) {
    return { move: randomFrom(pool, random), reason: 'heuristic', depth: 0, nodes: 0, score: 0 };
  }

  const result = search(board, me, {
    size,
    winLength,
    misere,
    maxDepth: profile.plies,
    deadline: now() + budget,
    radius,
    branchLimit: profile.branchLimit,
    // The tie-break below compares root moves against each other, and
    // alpha-beta only ever proves that a move is no better than the one in
    // hand - so the scores have to be exact for it to mean anything. That costs
    // pruning at the root, which is affordable on a small board and not on a
    // large one, where distinct positions rarely score identically anyway.
    exactRootScores: profile.slack > 0 || board.length <= 36,
    ...(options.shouldStop ? { shouldStop: options.shouldStop } : {}),
    ...(options.now ? { now: options.now } : {}),
  });

  const legalSet = new Set(legal);
  const picked = pickWithSlack(result.rootScores, profile.slack, random, legalSet, (move) =>
    moveHeuristic(board, size, move, me, winLength),
  );

  if (picked !== null) {
    return {
      move: picked,
      reason: 'search',
      depth: result.depth,
      nodes: result.nodes,
      score: result.score,
    };
  }

  // The search found nothing usable - it was cut off before completing even one
  // root move. A static best is still a sound move, and never an illegal one.
  return {
    move: greedyMove(board, size, me, winLength, pool),
    reason: 'heuristic',
    depth: result.depth,
    nodes: result.nodes,
    score: 0,
  };
}

/**
 * Candidate ceiling above which the fork scan is skipped.
 *
 * It is quadratic in the candidate count, so on an open 15x15 board it would
 * cost more than the search it is meant to be helping. Past this point the
 * search finds forks on its own, several plies earlier than this could.
 */
const FORK_SCAN_LIMIT = 36;

// ---------------------------------------------------------------------------
// Ultimate
// ---------------------------------------------------------------------------

function chooseUltimateMove(
  state: GameState,
  legal: number[],
  options: BotOptions,
  random: () => number,
): BotMove {
  const { difficulty = 'hard' } = options;
  const profile = profileForBoard(difficulty, 81, countEmpty(state.board));
  const now = options.now ?? Date.now;

  if (profile.plies <= 0) {
    return { move: randomFrom(legal, random), reason: 'heuristic', depth: 0, nodes: 0, score: 0 };
  }

  const result = searchUltimate(state, {
    // Ultimate's branching factor is small when a board is forced and large
    // when it is not, so it can afford roughly the depth the line search gets.
    maxDepth: profile.plies + 1,
    deadline: now() + (options.timeBudgetMs ?? profile.timeMs),
    // The tie-break below compares root moves against each other, and
    // alpha-beta only ever proves that a move is no better than the one in
    // hand - so the scores have to be exact for it to mean anything. That costs
    // pruning at the root, which is affordable on a small board and not on a
    // large one, where distinct positions rarely score identically anyway.
    // Ultimate's root is at most nine moves wide when a board is forced and
    // eighty-one only on the opening move, so exact root scores are cheap here.
    exactRootScores: true,
    ...(options.shouldStop ? { shouldStop: options.shouldStop } : {}),
    ...(options.now ? { now: options.now } : {}),
  });

  const picked = pickWithSlack(result.rootScores, profile.slack, random, new Set(legal));
  if (picked !== null) {
    return {
      move: picked,
      reason: 'search',
      depth: result.depth,
      nodes: result.nodes,
      score: result.score,
    };
  }

  return { move: randomFrom(legal, random), reason: 'heuristic', depth: 0, nodes: 0, score: 0 };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * The move a level of this strength should play.
 *
 * With slack it is a uniform choice among the moves that are nearly as good -
 * but never among losing ones, and never instead of a forced win, because a
 * level being weaker should not mean it hands games away.
 *
 * With no slack it is the best move, and where several are exactly as good it
 * is the most threatening of them. That tie-break matters more than it sounds:
 * a solved game like 3x3 scores every sound move as a draw, so without it the
 * bot picks an arbitrary one and a weak opponent is never made to find the
 * difficult reply. Preferring the move that builds the most threats costs
 * nothing against a perfect defence and beats an imperfect one.
 */
function pickWithSlack(
  rootScores: readonly RootScore[],
  slack: number,
  random: () => number,
  legal: ReadonlySet<number>,
  threat?: (move: number) => number,
): number | null {
  const usable = rootScores.filter((entry) => legal.has(entry.move));
  if (usable.length === 0) return null;

  let bestScore = Number.NEGATIVE_INFINITY;
  for (const entry of usable) if (entry.score > bestScore) bestScore = entry.score;

  if (slack > 0 && bestScore < MATE_THRESHOLD) {
    const pool = usable.filter(
      (entry) => entry.score >= bestScore - slack && entry.score > -MATE_THRESHOLD,
    );
    const from = pool.length > 0 ? pool : usable;
    return from[Math.min(from.length - 1, Math.floor(random() * from.length))]!.move;
  }

  const tied = usable.filter((entry) => entry.score === bestScore);
  if (tied.length === 1 || !threat) return tied[0]!.move;

  let best = tied[0]!;
  let bestThreat = threat(best.move);
  for (const entry of tied) {
    const value = threat(entry.move);
    if (value > bestThreat) {
      bestThreat = value;
      best = entry;
    }
  }
  return best.move;
}

/** Best move by static heuristic alone - the fallback when there is no time to search. */
function greedyMove(
  board: Board,
  size: number,
  player: Player,
  winLength: number,
  pool: readonly number[],
): number {
  let best = -1;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const move of pool) {
    const score = moveHeuristic(board, size, move, player, winLength);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }

  return best >= 0 ? best : (pool[0] ?? emptyIndices(board)[0] ?? -1);
}

function randomFrom(moves: readonly number[], random: () => number): number {
  const at = Math.min(moves.length - 1, Math.floor(random() * moves.length));
  return moves[at] ?? moves[0]!;
}

/** True when `index` is empty on `board`. Used by callers validating a stale move. */
export function isEmptyCell(board: Board, index: number): boolean {
  return board[index] === Empty;
}

export {
  BOT_DIFFICULTIES,
  type BotDifficulty,
  isBotDifficulty,
  profileFor,
  type DifficultyProfile,
} from './difficulty.js';
export { search, type SearchOptions, type SearchResult, type RootScore } from './search.js';
export { evaluate, WIN_SCORE } from './evaluate.js';
export { searchUltimate } from './ultimate-search.js';
export { evaluateUltimate, UltimatePosition } from './ultimate.js';
export {
  completesLine,
  findForkDefence,
  findForkMove,
  findImmediateWin,
  winningMoves,
} from './threats.js';
export { candidateMoves } from './candidates.js';
