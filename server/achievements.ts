import { RANKED_MODES } from '@/game/engine';

/**
 * Achievements, all of them derived from authoritative match results.
 *
 * Nothing here is awarded for time spent, for opening the app, or for anything
 * the client could assert on its own. Each one names something a player did
 * across a board, which is the only kind worth having: the check runs on the
 * server against the same rows the statistics come from, so an achievement and
 * a profile can never disagree.
 */

export interface AchievementDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { id: 'first-win', name: 'Off the mark', description: 'Win your first online match.' },
  { id: 'ten-wins', name: 'Regular', description: 'Win ten online matches.' },
  { id: 'fifty-wins', name: 'Veteran', description: 'Win fifty online matches.' },
  { id: 'streak-3', name: 'On a roll', description: 'Win three matches in a row.' },
  { id: 'streak-5', name: 'Unstoppable', description: 'Win five matches in a row.' },
  { id: 'streak-10', name: 'Untouchable', description: 'Win ten matches in a row.' },
  { id: 'century', name: 'Centurion', description: 'Play one hundred online matches.' },
  {
    id: 'polymath',
    name: 'All-rounder',
    description: 'Play a match in every ranked mode.',
  },
  {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    description: 'Win a match in the fewest moves the rules allow.',
  },
  {
    id: 'marathon',
    name: 'Marathon',
    description: 'Win a match that ran to sixty moves or more.',
  },
  { id: 'climber', name: 'Climber', description: 'Reach a rating of 1500 in any mode.' },
  { id: 'summit', name: 'Summit', description: 'Reach a rating of 1800 in any mode.' },
];

const BY_ID = new Map(ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]));

export function achievementById(id: string): AchievementDefinition | undefined {
  return BY_ID.get(id);
}

/** What the checker needs to know about a player after a match. */
export interface AchievementContext {
  readonly totalPlayed: number;
  readonly totalWon: number;
  /** Current consecutive wins. Zero or negative once a match is not won. */
  readonly streak: number;
  readonly bestRating: number;
  /** Distinct ranked mode ids this account has played at least once. */
  readonly modesPlayed: ReadonlySet<string>;
  /** Set only when the player won the match that triggered this check. */
  readonly won: boolean;
  readonly moveCount: number;
  /** Marks needed in a row, used to work out the fastest possible win. */
  readonly winLength: number;
}

/**
 * The achievements `context` satisfies.
 *
 * Returns every one that currently holds rather than only the new ones; the
 * caller inserts them with `ON CONFLICT DO NOTHING`, so awarding one twice is
 * free and the check needs no memory of what came before.
 */
export function earnedAchievements(context: AchievementContext): string[] {
  const earned: string[] = [];

  if (context.totalWon >= 1) earned.push('first-win');
  if (context.totalWon >= 10) earned.push('ten-wins');
  if (context.totalWon >= 50) earned.push('fifty-wins');
  if (context.streak >= 3) earned.push('streak-3');
  if (context.streak >= 5) earned.push('streak-5');
  if (context.streak >= 10) earned.push('streak-10');
  if (context.totalPlayed >= 100) earned.push('century');
  if (RANKED_MODES.every((mode) => context.modesPlayed.has(mode.id))) earned.push('polymath');
  if (context.bestRating >= 1500) earned.push('climber');
  if (context.bestRating >= 1800) earned.push('summit');

  if (context.won) {
    // The fastest possible win is the winner's marks plus the opponent's
    // replies, which is one fewer because the winner moved last - and only if
    // the winner opened. A win in that many moves cannot be bettered.
    const fastest = context.winLength * 2 - 1;
    if (context.moveCount <= fastest) earned.push('sharpshooter');
    if (context.moveCount >= 60) earned.push('marathon');
  }

  return earned;
}
