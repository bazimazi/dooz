import { create } from 'zustand';
import type { PuzzleSummary } from './puzzles';

/**
 * Puzzle Rush: as many puzzles as you can in three minutes, five misses out.
 *
 * The puzzles climb in difficulty as the score does, so a run starts with
 * wins you can see at a glance and ends somewhere you have to think - which
 * is what makes the best score a measure of the player rather than of luck.
 */

/** Length of a run. */
export const RUSH_SECONDS = 180;
/** Misses that end a run early. */
export const RUSH_STRIKES = 5;

const STORAGE_KEY = 'dooz.rush';

export interface RushRecord {
  /** Highest score of any run. */
  readonly best: number;
  /** Runs finished. */
  readonly runs: number;
  /** The most recent scores, newest first, for a sense of progress. */
  readonly recent: readonly number[];
}

const EMPTY: RushRecord = { best: 0, runs: 0, recent: [] };

function whole(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function load(): RushRecord {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<RushRecord>;
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;
    return {
      best: whole(parsed.best),
      runs: whole(parsed.runs),
      recent: Array.isArray(parsed.recent) ? parsed.recent.map(whole).slice(0, 10) : [],
    };
  } catch {
    return EMPTY;
  }
}

interface RushState extends RushRecord {
  /** Record a finished run. Returns whether it set a new best. */
  finishRun: (score: number) => boolean;
}

export const useRushStore = create<RushState>((set, get) => ({
  ...load(),
  finishRun(score) {
    const { best, runs, recent } = get();
    const record: RushRecord = {
      best: Math.max(best, score),
      runs: runs + 1,
      recent: [score, ...recent].slice(0, 10),
    };
    set(record);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch {
      // A run without storage still counts for the session.
    }
    const improved = score > best;
    // For anything that awards progress for a run, without a dependency on
    // this store: the same shape as the lessons' completion event.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('dooz:rush-complete', { detail: { score, best: record.best, improved } }),
      );
    }
    return improved;
  },
}));

/**
 * The rating a run aims at after `score` puzzles solved: easy first, then a
 * steady climb, reaching the pack's hardest around the twentieth.
 */
export function targetRating(score: number): number {
  return Math.min(100, 6 + score * 5);
}

/**
 * The next puzzle for a run: unplayed, and as close to the target rating as
 * the pack allows - chosen at random among the few closest, so two runs at the
 * same score do not see the same puzzles.
 */
export function nextRushPuzzle(
  pool: readonly PuzzleSummary[],
  played: ReadonlySet<string>,
  score: number,
  random: () => number = Math.random,
): PuzzleSummary | undefined {
  const target = targetRating(score);
  const fresh = pool.filter((puzzle) => !played.has(puzzle.id));
  const candidates = (fresh.length > 0 ? fresh : pool).toSorted(
    (a, b) => Math.abs(a.rating - target) - Math.abs(b.rating - target),
  );
  const near = candidates.slice(0, 6);
  return near[Math.min(near.length - 1, Math.floor(random() * near.length))];
}
