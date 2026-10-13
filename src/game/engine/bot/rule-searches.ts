import { countEmpty } from '../board.js';
import type { GameState } from '../types.js';
import { type BotDifficulty, profileForBoard } from './difficulty.js';
import { WIN_SCORE } from './evaluate.js';
import { searchPente } from './pente.js';
import { searchQuantum } from './quantum.js';
import { searchQubic } from './qubic.js';
import type { RootScore } from './search.js';

/**
 * The bot for the rule sets with a search of their own: Pente, Qubic and
 * Quantum.
 *
 * Each has its own search module, because what a good move is differs too much
 * between them for one search to serve - captures, a cube of lines, marks in
 * two places. What they share is how a difficulty becomes a move, and that
 * follows the rest of the AI: every level takes a win and stops a loss it can
 * see (the searches return those as `forced` before searching), levels differ
 * in how far ahead they look, and the weaker ones pick among the root moves
 * within a score window of the best rather than always the best.
 */

export interface RuleSearchMove {
  readonly move: number;
  readonly reason: 'win' | 'block' | 'search' | 'heuristic';
  readonly depth: number;
  readonly nodes: number;
  readonly score: number;
}

interface Options {
  readonly difficulty?: BotDifficulty;
  readonly timeBudgetMs?: number;
  readonly random?: () => number;
  readonly shouldStop?: () => boolean;
  readonly now?: () => number;
}

/** Plies each level searches, per rule set. */
const DEPTH: Record<'pente' | 'qubic' | 'quantum', Record<BotDifficulty, number>> = {
  // Beginner scores the root statically; the rest search, with Pente's eval
  // expensive enough that depth comes slowly.
  pente: { beginner: 0, easy: 1, medium: 2, hard: 3, expert: 4, master: 6 },
  // Forced replies are free in the Qubic search, so a few plies see far.
  qubic: { beginner: 0, easy: 1, medium: 2, hard: 4, expert: 6, master: 9 },
  quantum: { beginner: 1, easy: 1, medium: 2, hard: 2, expert: 3, master: 4 },
};

/** Score windows on each search's own scale. */
const SLACK: Record<'pente' | 'qubic' | 'quantum', Record<BotDifficulty, number>> = {
  pente: { beginner: 400, easy: 200, medium: 60, hard: 0, expert: 0, master: 0 },
  qubic: { beginner: 40, easy: 25, medium: 10, hard: 0, expert: 0, master: 0 },
  quantum: { beginner: 1_000, easy: 25, medium: 10, hard: 0, expert: 0, master: 0 },
};

const MATE = WIN_SCORE - 1000;

export function chooseRuleSearchMove(
  state: GameState,
  legal: readonly number[],
  options: Options,
): RuleSearchMove {
  const variant = state.config.variant as 'pente' | 'qubic' | 'quantum';
  const { difficulty = 'hard', random = Math.random } = options;
  const now = options.now ?? Date.now;
  const profile = profileForBoard(difficulty, state.board.length, countEmpty(state.board));
  const search = { pente: searchPente, qubic: searchQubic, quantum: searchQuantum }[variant];

  const result = search(state, {
    maxDepth: DEPTH[variant][difficulty],
    deadline: now() + (options.timeBudgetMs ?? Math.max(profile.timeMs, 120)),
    branchLimit: variant === 'quantum' ? 14 : profile.branchLimit,
    ...(options.shouldStop ? { shouldStop: options.shouldStop } : {}),
    ...(options.now ? { now: options.now } : {}),
  });

  const legalSet = new Set(legal);
  if (result.forced && legalSet.has(result.forced.move)) {
    return { ...result.forced, depth: 0, nodes: result.nodes, score: result.score };
  }

  const picked = pickRoot(result.rootScores, SLACK[variant][difficulty], random, legalSet);
  if (picked !== null) {
    const score = result.rootScores.find((entry) => entry.move === picked)?.score ?? 0;
    return {
      move: picked,
      reason: result.depth > 0 ? 'search' : 'heuristic',
      depth: result.depth,
      nodes: result.nodes,
      score,
    };
  }

  // Nothing scored is legal - which the searches never produce, but a move is
  // owed whatever happens.
  const fallback = legal[Math.min(legal.length - 1, Math.floor(random() * legal.length))]!;
  return { move: fallback, reason: 'heuristic', depth: 0, nodes: result.nodes, score: 0 };
}

/**
 * The best root move, or with slack a uniform pick among the moves close to
 * it - never a losing one while a non-losing one is in the window, and never
 * instead of a proven win.
 */
function pickRoot(
  rootScores: readonly RootScore[],
  slack: number,
  random: () => number,
  legal: ReadonlySet<number>,
): number | null {
  const usable = rootScores.filter((entry) => legal.has(entry.move));
  if (usable.length === 0) return null;
  let best = usable[0]!;
  for (const entry of usable) if (entry.score > best.score) best = entry;

  if (slack > 0 && best.score < MATE) {
    const pool = usable.filter((entry) => entry.score >= best.score - slack && entry.score > -MATE);
    if (pool.length > 0)
      return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]!.move;
  }
  return best.move;
}
