import type { BotDifficulty, ModeId } from '@/game/engine';
import { create } from 'zustand';
import { stageById } from '@/features/journey/stages';
import { newlyEarned, OFFLINE_ACHIEVEMENTS } from './achievements';
import { dayNumber } from './selectors';
import { announcementIds } from './unlocks';
import {
  BOT_WIN_XP,
  botGameXp,
  type BotGameOptions,
  firstWinXp,
  LOCAL_GAME_XP,
  onlineGameXp,
  type Outcome,
  puzzleXp,
  stageXp,
  streakXp,
  sumXp,
  type XpLine,
} from './xp';

const STORAGE_KEY = 'dooz.progress';

/**
 * Everything a player earns without an account.
 *
 * Online results live on the server, where they cannot be edited. Everything
 * here is played against the device - the bot, the journey, the puzzles, the
 * arcade - so it is kept on the device, in the same spirit as the preferences:
 * it survives a relaunch, and losing it (a cleared browser, a private window)
 * costs some stars but never breaks a screen.
 *
 * Nothing here is trusted by anything that matters. It unlocks cosmetics and
 * fills in a profile card; a player who edits their own storage to get a piece
 * set early has cheated nobody.
 */

export type { Outcome };

export interface BotRecord {
  won: number;
  lost: number;
  drawn: number;
  /** Current run of wins; zero after anything else. */
  streak: number;
  best: number;
}

export interface ChallengeRecord {
  /** Day number of the last daily challenge finished. */
  lastDay: number | null;
  /** Consecutive days with a challenge finished, win or lose. */
  streak: number;
  best: number;
  played: number;
  won: number;
  bestScore: number;
  /** The official result of the latest day played, for its share line. */
  last: { day: number; score: number; outcome: Outcome; moves: number } | null;
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
  /** Experience across everything; the level is worked out from it. */
  xp: number;
  /** Offline achievement ids earned. */
  achievements: string[];
  /** Mode ids finished at least once, in any game played on this device. */
  modes: string[];
  /** Day number of the last win of any kind, for the first-win bonus. */
  lastWinDay: number | null;
  online: { played: number; won: number };
  blitz: { played: number; won: number };
  challenge: ChallengeRecord;
  gauntlet: { runs: number; best: number; beaten: number };
  run: { runs: number; won: number; flawless: number; elites: number; bestFloor: number };
}

/** What one finished game earned, for the result panel to show. */
export interface Award {
  readonly lines: readonly XpLine[];
  readonly xp: number;
  readonly before: number;
  readonly after: number;
  /** Achievement ids earned by this game. */
  readonly achievements: readonly string[];
  /** Announcement ids of piece sets and cosmetics this game unlocked. */
  readonly unlocked: readonly string[];
}

const EMPTY_CHALLENGE: ChallengeRecord = {
  lastDay: null,
  streak: 0,
  best: 0,
  played: 0,
  won: 0,
  bestScore: 0,
  last: null,
};

const EMPTY: ProgressData = {
  bot: {},
  localGames: 0,
  puzzles: [],
  daily: { lastDay: null, streak: 0, best: 0 },
  journey: {},
  announced: [],
  xp: 0,
  achievements: [],
  modes: [],
  lastWinDay: null,
  online: { played: 0, won: 0 },
  blitz: { played: 0, won: 0 },
  challenge: EMPTY_CHALLENGE,
  gauntlet: { runs: 0, best: 0, beaten: 0 },
  run: { runs: 0, won: 0, flawless: 0, elites: 0, bestFloor: 0 },
};

function load(): ProgressData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Record<keyof ProgressData, unknown>> | null;
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;
    const daily = object(parsed.daily);
    const data: ProgressData = {
      bot: isRecordMap(parsed.bot) ? parsed.bot : {},
      localGames: count(parsed.localGames),
      puzzles: strings(parsed.puzzles),
      daily: {
        lastDay: day(daily['lastDay']),
        streak: count(daily['streak']),
        best: count(daily['best']),
      },
      journey: starMap(parsed.journey),
      announced: strings(parsed.announced),
      xp: count(parsed.xp),
      achievements: strings(parsed.achievements),
      modes: strings(parsed.modes),
      lastWinDay: day(parsed.lastWinDay),
      online: counts(parsed.online, ['played', 'won']),
      blitz: counts(parsed.blitz, ['played', 'won']),
      challenge: challengeRecord(parsed.challenge),
      gauntlet: counts(parsed.gauntlet, ['runs', 'best', 'beaten']),
      run: counts(parsed.run, ['runs', 'won', 'flawless', 'elites', 'bestFloor']),
    };
    // A save from before levels existed: credit what it already did, and
    // celebrate none of it - a dozen toasts on the first launch after an
    // update would bury the one that matters next.
    return parsed.xp === undefined ? migrate(data) : data;
  } catch {
    return EMPTY;
  }
}

/** XP for the record an older save already holds, with everything it earns marked as seen. */
export function migrate(data: ProgressData): ProgressData {
  let xp = data.localGames * LOCAL_GAME_XP + data.puzzles.length * 30;
  for (const [key, record] of Object.entries(data.bot)) {
    const difficulty = key.split(':')[1] as BotDifficulty;
    const win = BOT_WIN_XP[difficulty] ?? 10;
    xp += record.won * win + record.drawn * Math.round(win * 0.4) + record.lost * 5;
  }
  for (const stars of Object.values(data.journey)) xp += stars > 0 ? 15 + 25 * stars : 0;

  let next: ProgressData = { ...data, xp };
  next = { ...next, achievements: newlyEarned(next).map((entry) => entry.id) };
  return { ...next, announced: [...new Set([...next.announced, ...announcementIds(next)])] };
}

function object(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function day(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

function counts<K extends string>(value: unknown, keys: readonly K[]): Record<K, number> {
  const source = object(value);
  return Object.fromEntries(keys.map((key) => [key, count(source[key])])) as Record<K, number>;
}

function isOutcome(value: unknown): value is Outcome {
  return value === 'win' || value === 'loss' || value === 'draw';
}

function challengeRecord(value: unknown): ChallengeRecord {
  const source = object(value);
  const last = object(source['last']);
  const lastDay = day(last['day']);
  return {
    ...counts(source, ['streak', 'best', 'played', 'won', 'bestScore']),
    lastDay: day(source['lastDay']),
    last:
      lastDay !== null && isOutcome(last['outcome'])
        ? {
            day: lastDay,
            score: count(last['score']),
            outcome: last['outcome'],
            moves: count(last['moves']),
          }
        : null,
  };
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

/** Stars per stage, keeping only stages that exist and whole star counts. */
function starMap(value: unknown): Record<string, number> {
  if (typeof value !== 'object' || value === null) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([stage, stars]) =>
        stageById(stage) !== undefined && Number.isInteger(stars) && stars >= 0 && stars <= 3,
    ),
  ) as Record<string, number>;
}

function save(data: ProgressData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Progress without storage lasts the session, which is still worth having.
  }
}

/** What a finished arcade match adds besides its XP. */
export interface ArcadeResult {
  readonly mode: ModeId;
  readonly outcome: Outcome;
  /** The XP breakdown, worked out by the arcade mode that knows its rules. */
  readonly lines: readonly XpLine[];
}

interface ProgressState extends ProgressData {
  /** The most recent award, for a result panel that did not keep the return value. */
  lastAward: Award | null;
  /** Record a finished game against the bot. Returns the updated record. */
  recordBotGame: (
    mode: ModeId,
    difficulty: BotDifficulty,
    outcome: Outcome,
    options?: BotGameOptions,
  ) => BotRecord;
  recordLocalGame: (mode?: ModeId) => void;
  /** Record a finished online match. Only XP and a tally; the server keeps the record. */
  recordOnlineGame: (mode: string, outcome: Outcome, ranked: boolean) => Award;
  /** Record a solved puzzle. `daily` also advances the daily streak. */
  recordPuzzle: (id: string, daily: boolean) => void;
  /** Keep the best star count for a stage. Returns whether it improved. */
  recordStage: (stage: string, stars: number) => boolean;
  /** The official result of a day's challenge. Ignored if that day is already recorded. */
  recordChallenge: (
    result: ArcadeResult & { day: number; score: number; moves: number },
  ) => Award | null;
  /** One match inside a gauntlet or a run. */
  recordArcadeGame: (result: ArcadeResult) => Award;
  recordGauntletEnd: (beaten: number) => Award;
  recordRunEnd: (summary: {
    won: boolean;
    floor: number;
    flawless: boolean;
    lines: readonly XpLine[];
  }) => Award;
  /** Count an elite defeated in a run, for its achievement. */
  recordRunElite: () => void;
  markAnnounced: (ids: readonly string[]) => void;
  reset: () => void;
}

export const useProgressStore = create<ProgressState>((set, get) => {
  const snapshot = (): ProgressData => {
    const state = get();
    return {
      bot: state.bot,
      localGames: state.localGames,
      puzzles: state.puzzles,
      daily: state.daily,
      journey: state.journey,
      announced: state.announced,
      xp: state.xp,
      achievements: state.achievements,
      modes: state.modes,
      lastWinDay: state.lastWinDay,
      online: state.online,
      blitz: state.blitz,
      challenge: state.challenge,
      gauntlet: state.gauntlet,
      run: state.run,
    };
  };

  const commit = (next: Partial<ProgressData>) => {
    set(next);
    save(snapshot());
  };

  /**
   * Apply a result and pay for it.
   *
   * Achievements are checked after the change lands, and checked again after
   * paying for them, since reaching a level is itself an achievement. Two
   * passes is the most that can chain: the level ones pay nothing.
   */
  const grant = (
    patch: Partial<ProgressData>,
    lines: XpLine[],
    options: { won?: boolean; mode?: string } = {},
  ): Award => {
    const before = get().xp;
    const today = dayNumber();
    const unlockedBefore = new Set(announcementIds(snapshot()));
    const next: ProgressData = { ...snapshot(), ...patch };
    if (options.won && next.lastWinDay !== today) {
      lines.push(firstWinXp());
      next.lastWinDay = today;
    }
    if (options.mode && !next.modes.includes(options.mode)) {
      next.modes = [...next.modes, options.mode];
    }
    next.xp = Math.max(0, before + sumXp(lines));

    const earned: string[] = [];
    for (let pass = 0; pass < 3; pass++) {
      const fresh = newlyEarned(next);
      if (fresh.length === 0) break;
      next.achievements = [...next.achievements, ...fresh.map((entry) => entry.id)];
      for (const entry of fresh) {
        earned.push(entry.id);
        if (entry.xp > 0) {
          // The achievement's own name, read when the line is shown.
          lines.push({
            xp: entry.xp,
            get label() {
              return entry.name;
            },
          });
          next.xp += entry.xp;
        }
      }
    }

    const award: Award = {
      lines,
      xp: next.xp - before,
      before,
      after: next.xp,
      achievements: earned,
      unlocked: announcementIds(next).filter(
        (id) => !unlockedBefore.has(id) && (id.startsWith('skin:') || id.startsWith('cosmetic:')),
      ),
    };
    set({ lastAward: award });
    commit(next);
    return award;
  };

  return {
    ...load(),
    lastAward: null,

    recordBotGame(mode, difficulty, outcome, options = {}) {
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
      const lines = botGameXp(difficulty, outcome, options);
      const bonus = streakXp(streak);
      if (bonus) lines.push(bonus);
      const blitz = get().blitz;
      grant(
        {
          bot: { ...get().bot, [key]: record },
          ...(options.blitz
            ? {
                blitz: {
                  played: blitz.played + 1,
                  won: blitz.won + (outcome === 'win' ? 1 : 0),
                },
              }
            : {}),
        },
        lines,
        { won: outcome === 'win', mode },
      );
      return record;
    },

    recordLocalGame(mode) {
      grant(
        { localGames: get().localGames + 1 },
        [{ label: 'Game played', xp: LOCAL_GAME_XP }],
        mode ? { mode } : {},
      );
    },

    recordOnlineGame(mode, outcome, ranked) {
      const online = get().online;
      return grant(
        {
          online: { played: online.played + 1, won: online.won + (outcome === 'win' ? 1 : 0) },
        },
        [onlineGameXp(outcome, ranked)],
        { won: outcome === 'win', mode },
      );
    },

    recordPuzzle(id, daily) {
      const known = get().puzzles.includes(id);
      const puzzles = known ? get().puzzles : [...get().puzzles, id];
      const today = dayNumber();
      const { lastDay, streak, best } = get().daily;
      // Only the first daily solve of a day counts for the streak and its XP.
      const countsAsDaily = daily && lastDay !== today;
      const patch: Partial<ProgressData> = { puzzles };
      if (countsAsDaily) {
        // A streak survives only if yesterday's daily was solved too.
        const next = lastDay === today - 1 ? streak + 1 : 1;
        patch.daily = { lastDay: today, streak: next, best: Math.max(best, next) };
      }
      grant(patch, puzzleXp(!known, countsAsDaily));
    },

    recordStage(stage, stars) {
      const before = get().journey[stage] ?? 0;
      const improved = stars > before;
      const mode = stageById(stage)?.mode;
      grant(
        improved ? { journey: { ...get().journey, [stage]: stars } } : {},
        stageXp(stars, Math.max(0, stars - before)),
        { won: stars > 0, ...(mode ? { mode } : {}) },
      );
      return improved;
    },

    recordChallenge(result) {
      const challenge = get().challenge;
      if (challenge.last?.day === result.day) return null;
      const streak = challenge.lastDay === result.day - 1 ? challenge.streak + 1 : 1;
      return grant(
        {
          challenge: {
            lastDay: result.day,
            streak,
            best: Math.max(challenge.best, streak),
            played: challenge.played + 1,
            won: challenge.won + (result.outcome === 'win' ? 1 : 0),
            bestScore: Math.max(challenge.bestScore, result.score),
            last: {
              day: result.day,
              score: result.score,
              outcome: result.outcome,
              moves: result.moves,
            },
          },
        },
        [...result.lines],
        { won: result.outcome === 'win', mode: result.mode },
      );
    },

    recordArcadeGame(result) {
      return grant({}, [...result.lines], {
        won: result.outcome === 'win',
        mode: result.mode,
      });
    },

    recordGauntletEnd(beaten) {
      const gauntlet = get().gauntlet;
      return grant(
        {
          gauntlet: {
            runs: gauntlet.runs + 1,
            best: Math.max(gauntlet.best, beaten),
            beaten: gauntlet.beaten + beaten,
          },
        },
        beaten > 0 ? [{ label: `${beaten} beaten`, xp: beaten * 15 }] : [],
      );
    },

    recordRunEnd({ won, floor, flawless, lines }) {
      const run = get().run;
      return grant(
        {
          run: {
            ...run,
            runs: run.runs + 1,
            won: run.won + (won ? 1 : 0),
            flawless: run.flawless + (won && flawless ? 1 : 0),
            bestFloor: Math.max(run.bestFloor, floor),
          },
        },
        [...lines],
      );
    },

    recordRunElite() {
      const run = get().run;
      grant({ run: { ...run, elites: run.elites + 1 } }, []);
    },

    markAnnounced(ids) {
      const announced = new Set(get().announced);
      for (const id of ids) announced.add(id);
      commit({ announced: [...announced] });
    },

    reset() {
      set({ lastAward: null });
      commit(EMPTY);
    },
  };
});

export {
  dayNumber,
  liveChallengeStreak,
  liveDailyStreak,
  totalBotGames,
  totalBotWins,
  totalStars,
} from './selectors';

/** Every offline achievement id, in catalogue order. */
export const OFFLINE_ACHIEVEMENT_IDS = OFFLINE_ACHIEVEMENTS.map((entry) => entry.id);

/**
 * Replace the whole of the stored progress - a cloud save merged with this
 * device's - and load it back through the same checks as a launch, so nothing
 * that came over the network reaches the store unvalidated.
 */
export function replaceProgress(data: Record<string, unknown>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    return;
  }
  useProgressStore.setState(load());
}
