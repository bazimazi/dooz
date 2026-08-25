import { emptyIndices } from '../board.js';
import { isWinningMove } from '../rules.js';
import { type Board, type BoardSize, type GameState, opponentOf, type Player } from '../types.js';
import { candidateMoves } from './candidates.js';
import { moveHeuristic } from './evaluate.js';
import { search } from './search.js';

export const BOT_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type BotDifficulty = (typeof BOT_DIFFICULTIES)[number];

const DIFFICULTY_SET: ReadonlySet<string> = new Set(BOT_DIFFICULTIES);

/** Narrows untrusted input - a URL parameter, a stored preference. */
export function isBotDifficulty(value: unknown): value is BotDifficulty {
  return typeof value === 'string' && DIFFICULTY_SET.has(value);
}

export interface BotOptions {
  readonly difficulty?: BotDifficulty;
  /** Overrides the difficulty's default thinking time, in milliseconds. */
  readonly timeBudgetMs?: number;
  /** Injectable for deterministic tests. */
  readonly random?: () => number;
}

interface Profile {
  readonly maxDepth: number;
  readonly timeBudgetMs: number;
  readonly radius: number;
  readonly branchLimit: number;
}

/**
 * Search settings per board size.
 *
 * 3x3 is small enough to solve outright, so it gets unlimited width and enough
 * depth to reach every terminal position - the bot is unbeatable there. The
 * larger boards cannot be solved, so they trade width and depth for a fixed
 * thinking time and lean on the static evaluation instead.
 */
const HARD_PROFILE: Record<BoardSize, Profile> = {
  3: { maxDepth: 9, timeBudgetMs: 400, radius: 2, branchLimit: 9 },
  6: { maxDepth: 8, timeBudgetMs: 900, radius: 1, branchLimit: 12 },
  9: { maxDepth: 6, timeBudgetMs: 1200, radius: 1, branchLimit: 10 },
};

/** Chance an `easy` bot throws the move away and plays at random. */
const EASY_BLUNDER_RATE = 0.4;

/**
 * Pick a move for the player to act in `state`.
 *
 * Returns `null` only when the game is already over or the board is full.
 */
export function findBestMove(state: GameState, options: BotOptions = {}): number | null {
  if (state.status !== 'playing') return null;

  const { difficulty = 'hard', random = Math.random } = options;
  const { board, size, currentPlayer: me } = state;
  const empties = emptyIndices(board);
  if (empties.length === 0) return null;
  if (empties.length === 1) return empties[0]!;

  if (difficulty === 'easy' && random() < EASY_BLUNDER_RATE) {
    return empties[Math.floor(random() * empties.length)] ?? empties[0]!;
  }

  // Winning and blocking are worth special-casing: they are the two moves a
  // human immediately notices, and finding them here means the bot never misses
  // one because the search ran out of time.
  const winNow = findImmediateWin(board, size, me);
  if (winNow !== null) return winNow;

  const blockNow = findImmediateWin(board, size, opponentOf(me));
  if (blockNow !== null) return blockNow;

  if (difficulty === 'easy') return greedyMove(board, size, me);

  const profile = HARD_PROFILE[size];
  const budget = options.timeBudgetMs ?? profile.timeBudgetMs;
  const maxDepth = difficulty === 'medium' ? Math.min(profile.maxDepth, 4) : profile.maxDepth;
  const timeBudgetMs = difficulty === 'medium' ? Math.min(budget, 250) : budget;

  const result = search(board, size, me, {
    maxDepth,
    deadline: Date.now() + timeBudgetMs,
    radius: profile.radius,
    branchLimit: profile.branchLimit,
  });

  if (result.move >= 0 && board[result.move] === 0) return result.move;
  return greedyMove(board, size, me);
}

function findImmediateWin(board: Board, size: BoardSize, player: Player): number | null {
  for (const move of candidateMoves(board, size, 1)) {
    if (isWinningMove(board, size, move, player)) return move;
  }
  return null;
}

/** Best move by static heuristic alone - the fallback when there is no time to search. */
function greedyMove(board: Board, size: BoardSize, player: Player): number {
  let best = -1;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const move of candidateMoves(board, size, 2)) {
    const score = moveHeuristic(board, size, move, player);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }

  return best >= 0 ? best : (emptyIndices(board)[0] ?? -1);
}

export { search, type SearchOptions, type SearchResult } from './search.js';
export { evaluate, WIN_SCORE } from './evaluate.js';
