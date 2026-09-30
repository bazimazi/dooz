import type { Skin } from '@/lib/preferences';
import { type ProgressData, totalBotWins, totalStars } from './store';

/**
 * What each piece set costs.
 *
 * One per way of playing alone - the bot, the puzzles, the journey - so a
 * player who only ever does one of them still earns something, and each
 * threshold is reachable in an evening. Classic is never locked: the game's
 * own look is not a reward.
 */
export interface SkinUnlock {
  readonly skin: Skin;
  readonly name: string;
  readonly requirement: string;
  readonly need: number;
  readonly have: (progress: ProgressData) => number;
}

export const SKIN_UNLOCKS: readonly SkinUnlock[] = [
  {
    skin: 'classic',
    name: 'Classic',
    requirement: 'The original set.',
    need: 0,
    have: () => 0,
  },
  {
    skin: 'neon',
    name: 'Neon',
    requirement: 'Win 3 games against the bot.',
    need: 3,
    have: (progress) => totalBotWins(progress.bot),
  },
  {
    skin: 'chalk',
    name: 'Chalk',
    requirement: 'Solve 5 puzzles.',
    need: 5,
    have: (progress) => progress.puzzles.length,
  },
  {
    skin: 'candy',
    name: 'Candy',
    requirement: 'Earn 12 stars on the journey.',
    need: 12,
    have: (progress) => totalStars(progress.journey),
  },
];

export function isSkinUnlocked(skin: Skin, progress: ProgressData): boolean {
  const unlock = SKIN_UNLOCKS.find((entry) => entry.skin === skin);
  return !unlock || unlock.have(progress) >= unlock.need;
}

/** Unlocks earned but not yet celebrated. */
export function freshUnlocks(progress: ProgressData): SkinUnlock[] {
  return SKIN_UNLOCKS.filter(
    (unlock) =>
      unlock.need > 0 &&
      unlock.have(progress) >= unlock.need &&
      !progress.announced.includes(`skin:${unlock.skin}`),
  );
}
