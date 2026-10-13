import { BOT_DIFFICULTIES, type BotDifficulty } from '@/game/engine';
import { STAGES } from '@/features/journey/stages';
import type { BotRecord, ProgressData } from './store';
import { levelFor } from './xp';

/**
 * Read-only views of the progress data.
 *
 * Kept apart from the store so the achievement and cosmetic catalogues can use
 * them without importing the store itself, which evaluates those catalogues
 * whenever something is earned.
 */

/** Today as a whole number of days, in the player's own time zone. */
export function dayNumber(date = new Date()): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

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

/** Wins against one bot level, across every mode. */
export function botWinsAt(bot: Record<string, BotRecord>, difficulty: BotDifficulty): number {
  return Object.entries(bot).reduce(
    (sum, [key, record]) => (key.endsWith(`:${difficulty}`) ? sum + record.won : sum),
    0,
  );
}

/** The longest run of wins against any one mode and level. */
export function bestBotStreak(bot: Record<string, BotRecord>): number {
  return Object.values(bot).reduce((best, record) => Math.max(best, record.best), 0);
}

/** Stars across the whole journey. */
export function totalStars(journey: Record<string, number>): number {
  return Object.values(journey).reduce((sum, stars) => sum + stars, 0);
}

/** Journey stages with at least one star. */
export function stagesCleared(journey: Record<string, number>): number {
  return STAGES.filter((stage) => (journey[stage.id] ?? 0) > 0).length;
}

/** Every stage of the journey has at least one star. */
export function journeyComplete(journey: Record<string, number>): boolean {
  return stagesCleared(journey) === STAGES.length;
}

/**
 * Whether the player has beaten the strongest rival: a star against Nyx on the
 * journey, or a win against the master bot she plays as.
 */
export function beatNyx(progress: Pick<ProgressData, 'journey' | 'bot'>): boolean {
  const nyx = STAGES.some(
    (stage) => stage.rival.id === 'nyx' && (progress.journey[stage.id] ?? 0) > 0,
  );
  return nyx || botWinsAt(progress.bot, BOT_DIFFICULTIES.at(-1)!) > 0;
}

/** The daily streak as it stands today: broken if yesterday was missed. */
export function liveDailyStreak(daily: ProgressData['daily']): number {
  if (daily.lastDay === null) return 0;
  return daily.lastDay >= dayNumber() - 1 ? daily.streak : 0;
}

/** The daily challenge streak as it stands today. */
export function liveChallengeStreak(challenge: ProgressData['challenge']): number {
  if (challenge.lastDay === null) return 0;
  return challenge.lastDay >= dayNumber() - 1 ? challenge.streak : 0;
}

export function playerLevel(progress: Pick<ProgressData, 'xp'>): number {
  return levelFor(progress.xp);
}
