import { GAME_MODES } from '@/game/engine';
import { MAX_STARS } from '@/features/journey/stages';
import { achievementText } from '@/i18n/messages/achievements';
import {
  beatNyx,
  bestBotStreak,
  botWinsAt,
  journeyComplete,
  stagesCleared,
  totalBotWins,
  totalStars,
} from './selectors';
import type { ProgressData } from './store';
import { levelFor } from './xp';

/**
 * Achievements earned on this device.
 *
 * The online set in `lib/achievements.ts` is awarded by the server, where a
 * result cannot be edited. These are the solo counterpart: every one is a
 * question about the progress data, asked again whenever something is earned,
 * so none of them needs its own bookkeeping and an old save earns whatever it
 * already deserves the first time it is loaded.
 *
 * Once earned an achievement is kept, even if the number behind it later
 * falls - a streak that ends does not take its medal with it.
 */
export interface OfflineAchievement {
  readonly id: string;
  /** In the current language: read from the achievement catalog by id. */
  readonly name: string;
  readonly description: string;
  /** Shown as a group heading on the profile. */
  readonly group: AchievementGroup;
  /** Paid once, when it is earned. */
  readonly xp: number;
  readonly earned: (progress: ProgressData) => boolean;
  /** How far along a counting achievement is, for a progress hint. */
  readonly progress?: (progress: ProgressData) => readonly [have: number, need: number];
}

export type AchievementGroup = 'Journey' | 'Puzzles' | 'Bot' | 'Arcade' | 'Level';

function counting(
  have: (progress: ProgressData) => number,
  need: number,
): Pick<OfflineAchievement, 'earned' | 'progress'> {
  return {
    earned: (progress) => have(progress) >= need,
    progress: (progress) => [Math.min(need, have(progress)), need],
  };
}

/**
 * An achievement whose name and description are looked up by its id, in the
 * language in force when they are read.
 */
function achievement(entry: Omit<OfflineAchievement, 'name' | 'description'>): OfflineAchievement {
  return {
    ...entry,
    get name() {
      return achievementText(entry.id, 'name');
    },
    get description() {
      return achievementText(entry.id, 'description');
    },
  };
}

const botWin = (
  id: string,
  difficulty: Parameters<typeof botWinsAt>[1],
  xp: number,
): OfflineAchievement =>
  achievement({
    id,
    group: 'Bot',
    xp,
    earned: (progress) => botWinsAt(progress.bot, difficulty) > 0,
  });

export const OFFLINE_ACHIEVEMENTS: readonly OfflineAchievement[] = [
  // Journey
  achievement({
    id: 'journey-first-star',
    group: 'Journey',
    xp: 25,
    ...counting((progress) => totalStars(progress.journey), 1),
  }),
  achievement({
    id: 'journey-halfway',
    group: 'Journey',
    xp: 50,
    ...counting((progress) => stagesCleared(progress.journey), 9),
  }),
  achievement({
    id: 'journey-complete',
    group: 'Journey',
    xp: 100,
    earned: (progress) => journeyComplete(progress.journey),
  }),
  achievement({
    id: 'journey-perfect',
    group: 'Journey',
    xp: 150,
    ...counting((progress) => totalStars(progress.journey), MAX_STARS),
  }),
  achievement({
    id: 'beat-nyx',
    group: 'Journey',
    xp: 100,
    earned: beatNyx,
  }),
  // Puzzles
  achievement({
    id: 'puzzle-first',
    group: 'Puzzles',
    xp: 25,
    ...counting((progress) => progress.puzzles.length, 1),
  }),
  achievement({
    id: 'puzzle-10',
    group: 'Puzzles',
    xp: 50,
    ...counting((progress) => progress.puzzles.length, 10),
  }),
  achievement({
    id: 'puzzle-40',
    group: 'Puzzles',
    xp: 100,
    ...counting((progress) => progress.puzzles.length, 40),
  }),
  achievement({
    id: 'daily-puzzle-streak-7',
    group: 'Puzzles',
    xp: 75,
    ...counting((progress) => progress.daily.best, 7),
  }),
  // Bot
  botWin('bot-beginner', 'beginner', 10),
  botWin('bot-easy', 'easy', 15),
  botWin('bot-medium', 'medium', 25),
  botWin('bot-hard', 'hard', 40),
  botWin('bot-expert', 'expert', 60),
  botWin('bot-master', 'master', 100),
  achievement({
    id: 'bot-streak-5',
    group: 'Bot',
    xp: 50,
    ...counting((progress) => bestBotStreak(progress.bot), 5),
  }),
  achievement({
    id: 'bot-wins-50',
    group: 'Bot',
    xp: 75,
    ...counting((progress) => totalBotWins(progress.bot), 50),
  }),
  achievement({
    id: 'variety-3',
    group: 'Bot',
    xp: 25,
    ...counting((progress) => knownModes(progress), 3),
  }),
  achievement({
    id: 'variety-all',
    group: 'Bot',
    xp: 100,
    // Read at the time of asking, so a mode added later raises the bar
    // rather than leaving the medal earned against a shorter list.
    earned: (progress) => knownModes(progress) >= GAME_MODES.length,
    progress: (progress) => [knownModes(progress), GAME_MODES.length],
  }),
  achievement({
    id: 'local-10',
    group: 'Bot',
    xp: 25,
    ...counting((progress) => progress.localGames, 10),
  }),
  // Arcade
  achievement({
    id: 'challenge-first',
    group: 'Arcade',
    xp: 25,
    ...counting((progress) => progress.challenge.played, 1),
  }),
  achievement({
    id: 'challenge-streak-7',
    group: 'Arcade',
    xp: 100,
    ...counting((progress) => progress.challenge.best, 7),
  }),
  achievement({
    id: 'challenge-score-1500',
    group: 'Arcade',
    xp: 50,
    ...counting((progress) => progress.challenge.bestScore, 1500),
  }),
  achievement({
    id: 'gauntlet-3',
    group: 'Arcade',
    xp: 25,
    ...counting((progress) => progress.gauntlet.best, 3),
  }),
  achievement({
    id: 'gauntlet-10',
    group: 'Arcade',
    xp: 100,
    ...counting((progress) => progress.gauntlet.best, 10),
  }),
  achievement({
    id: 'run-elite',
    group: 'Arcade',
    xp: 25,
    ...counting((progress) => progress.run.elites, 1),
  }),
  achievement({
    id: 'run-win',
    group: 'Arcade',
    xp: 100,
    ...counting((progress) => progress.run.won, 1),
  }),
  achievement({
    id: 'run-flawless',
    group: 'Arcade',
    xp: 150,
    ...counting((progress) => progress.run.flawless, 1),
  }),
  achievement({
    id: 'blitz-first',
    group: 'Arcade',
    xp: 25,
    ...counting((progress) => progress.blitz.won, 1),
  }),
  achievement({
    id: 'blitz-10',
    group: 'Arcade',
    xp: 75,
    ...counting((progress) => progress.blitz.won, 10),
  }),
  // Level
  achievement({
    id: 'level-5',
    group: 'Level',
    xp: 0,
    ...counting((progress) => levelFor(progress.xp), 5),
  }),
  achievement({
    id: 'level-10',
    group: 'Level',
    xp: 0,
    ...counting((progress) => levelFor(progress.xp), 10),
  }),
  achievement({
    id: 'level-25',
    group: 'Level',
    xp: 0,
    ...counting((progress) => levelFor(progress.xp), 25),
  }),
];

function knownModes(progress: ProgressData): number {
  return GAME_MODES.filter((mode) => progress.modes.includes(mode.id)).length;
}

const BY_ID = new Map(OFFLINE_ACHIEVEMENTS.map((entry) => [entry.id, entry]));

export function offlineAchievement(id: string): OfflineAchievement | undefined {
  return BY_ID.get(id);
}

/** Achievements `progress` qualifies for that it has not been given yet. */
export function newlyEarned(progress: ProgressData): OfflineAchievement[] {
  return OFFLINE_ACHIEVEMENTS.filter(
    (entry) => !progress.achievements.includes(entry.id) && entry.earned(progress),
  );
}
