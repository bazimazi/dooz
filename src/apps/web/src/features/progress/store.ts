import type { BotDifficulty, ModeId } from '@dooz/engine';
import { create } from 'zustand';

const STORAGE_KEY = 'dooz.progress';

/**
 * Everything a player earns without an account.
 *
 * Online results live on the server, where they cannot be edited. Everything
 * here is played against the device - the bot, the journey, the puzzles - so
 * it is kept on the device, in the same spirit as the preferences: it survives
 * a relaunch, and losing it (a cleared browser, a private window) costs some
 * stars but never breaks a screen.
 *
 * Nothing here is trusted by anything that matters. It unlocks cosmetics and
 * fills in a profile card; a player who edits their own storage to get a piece
 * set early has cheated nobody.
 */

export type Outcome = 'win' | 'loss' | 'draw';

export interface BotRecord {
  won: number;
  lost: number;
  drawn: number;
  /** Current run of wins; zero after anything else. */
  streak: number;
  best: number;
}

export interface ProgressData {
  /** Keyed by `${mode}:${difficulty}`. */
  bot: Record<string, BotRecord>;
  localGames: number;
  /** Puzzle ids solved at least once. */
  puzzles: string[];
  daily: {
    /** Day number (days since the epoch, local time) of the last daily solved. */
    lastDay: number | null;
    streak: number;
    best: number;
  };
  /** Journey stage id to best stars earned, 1-3. */
  journey: Record<string, number>;
  /** Unlocks already announced, so each one is celebrated exactly once. */
  announced: string[];
}

const EMPTY: ProgressData = {
  bot: {},
  localGames: 0,
  puzzles: [],
  daily: { lastDay: null, streak: 0, best: 0 },
  journey: {},
  announced: [],
};

function load(): ProgressData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<ProgressData> | null;
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;
    return {
      bot: isRecordMap(parsed.bot) ? parsed.bot : {},
      localGames: count(parsed.localGames),
      puzzles: Array.isArray(parsed.puzzles)
        ? parsed.puzzles.filter((id): id is string => typeof id === 'string')
        : [],
      daily: {
        lastDay:
          typeof parsed.daily?.lastDay === 'number' ? Math.floor(parsed.daily.lastDay) : null,
        streak: count(parsed.daily?.streak),
        best: count(parsed.daily?.best),
      },
      journey: isStarMap(parsed.journey) ? parsed.journey : {},
      announced: Array.isArray(parsed.announced)
        ? parsed.announced.filter((id): id is string => typeof id === 'string')
        : [],
    };
  } catch {
    return EMPTY;
  }
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function isRecordMap(value: unknown): value is Record<string, BotRecord> {
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value).every(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      ['won', 'lost', 'drawn', 'streak', 'best'].every(
        (key) => typeof (entry as Record<string, unknown>)[key] === 'number',
      ),
  );
}

function isStarMap(value: unknown): value is Record<string, number> {
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value).every(
    (stars) => typeof stars === 'number' && stars >= 0 && stars <= 3,
  );
}

function save(data: ProgressData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Progress without storage lasts the session, which is still worth having.
  }
}

/** Today as a whole number of days, in the player's own time zone. */
export function dayNumber(date = new Date()): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

interface ProgressState extends ProgressData {
  /** Record a finished game against the bot. Returns the updated record. */
  recordBotGame: (mode: ModeId, difficulty: BotDifficulty, outcome: Outcome) => BotRecord;
  recordLocalGame: () => void;
  /** Record a solved puzzle. `daily` also advances the daily streak. */
  recordPuzzle: (id: string, daily: boolean) => void;
  /** Keep the best star count for a stage. Returns whether it improved. */
  recordStage: (stage: string, stars: number) => boolean;
  markAnnounced: (ids: readonly string[]) => void;
  reset: () => void;
}

export const useProgressStore = create<ProgressState>((set, get) => {
  const commit = (next: Partial<ProgressData>) => {
    set(next);
    const { bot, localGames, puzzles, daily, journey, announced } = get();
    save({ bot, localGames, puzzles, daily, journey, announced });
  };

  return {
    ...load(),

    recordBotGame(mode, difficulty, outcome) {
      const key = `${mode}:${difficulty}`;
      const before = get().bot[key] ?? { won: 0, lost: 0, drawn: 0, streak: 0, best: 0 };
      const streak = outcome === 'win' ? before.streak + 1 : 0;
      const record: BotRecord = {
        won: before.won + (outcome === 'win' ? 1 : 0),
        lost: before.lost + (outcome === 'loss' ? 1 : 0),
        drawn: before.drawn + (outcome === 'draw' ? 1 : 0),
        streak,
        best: Math.max(before.best, streak),
      };
      commit({ bot: { ...get().bot, [key]: record } });
      return record;
    },

    recordLocalGame() {
      commit({ localGames: get().localGames + 1 });
    },

    recordPuzzle(id, daily) {
      const puzzles = get().puzzles.includes(id) ? get().puzzles : [...get().puzzles, id];
      if (!daily) {
        commit({ puzzles });
        return;
      }
      const today = dayNumber();
      const { lastDay, streak, best } = get().daily;
      if (lastDay === today) {
        commit({ puzzles });
        return;
      }
      // A streak survives only if yesterday's daily was solved too.
      const next = lastDay === today - 1 ? streak + 1 : 1;
      commit({ puzzles, daily: { lastDay: today, streak: next, best: Math.max(best, next) } });
    },

    recordStage(stage, stars) {
      const before = get().journey[stage] ?? 0;
      if (stars <= before) return false;
      commit({ journey: { ...get().journey, [stage]: stars } });
      return true;
    },

    markAnnounced(ids) {
      const announced = new Set(get().announced);
      for (const id of ids) announced.add(id);
      commit({ announced: [...announced] });
    },

    reset() {
      commit(EMPTY);
    },
  };
});

/** Wins against the bot across every mode and level. */
export function totalBotWins(bot: Record<string, BotRecord>): number {
  return Object.values(bot).reduce((sum, record) => sum + record.won, 0);
}

/** Every game against the bot, finished either way. */
export function totalBotGames(bot: Record<string, BotRecord>): number {
  return Object.values(bot).reduce(
    (sum, record) => sum + record.won + record.lost + record.drawn,
    0,
  );
}

/** Stars across the whole journey. */
export function totalStars(journey: Record<string, number>): number {
  return Object.values(journey).reduce((sum, stars) => sum + stars, 0);
}

/** The daily streak as it stands today: broken if yesterday was missed. */
export function liveDailyStreak(daily: ProgressData['daily']): number {
  if (daily.lastDay === null) return 0;
  return daily.lastDay >= dayNumber() - 1 ? daily.streak : 0;
}
