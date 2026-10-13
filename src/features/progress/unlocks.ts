import { type MessageValues, translate } from '@/i18n';
import { type CosmeticMessageKey, cosmeticMessages } from '@/i18n/messages/cosmetics';
import type { Skin } from '@/lib/preferences';
import { offlineAchievement } from './achievements';
import { COSMETICS, type Cosmetic, isDefaultCosmetic } from './cosmetics';
import { beatNyx, totalBotWins, totalStars } from './selectors';
import type { ProgressData } from './store';
import { levelFor } from './xp';

/**
 * What each piece set costs.
 *
 * One per way of playing alone - the bot, the puzzles, the journey, the
 * arcade, the level - so a player who only ever does one of them still earns
 * something, and the first thresholds are reachable in an evening. Classic is
 * never locked: the game's own look is not a reward.
 */
export interface SkinUnlock {
  readonly skin: Skin;
  /** In the current language, read from the cosmetic catalog by skin id. */
  readonly name: string;
  readonly requirement: string;
  readonly need: number;
  readonly have: (progress: ProgressData) => number;
}

/** A piece set whose name and requirement are read by id when asked for. */
function skinUnlock(
  skin: Skin,
  requirement: CosmeticMessageKey,
  need: number,
  have: (progress: ProgressData) => number,
  values?: MessageValues,
): SkinUnlock {
  return {
    skin,
    need,
    have,
    get name() {
      return translate(cosmeticMessages, `skin.${skin}`);
    },
    get requirement() {
      return translate(cosmeticMessages, requirement, values);
    },
  };
}

export const SKIN_UNLOCKS: readonly SkinUnlock[] = [
  skinUnlock('classic', 'req.original', 0, () => 0),
  skinUnlock(
    'neon',
    'req.botWins',
    3,
    // Journey stages are bot games too; a stage with stars was a win.
    (progress) =>
      totalBotWins(progress.bot) +
      Object.values(progress.journey).filter((stars) => stars > 0).length,
    { count: 3 },
  ),
  skinUnlock('chalk', 'req.puzzles', 5, (progress) => progress.puzzles.length, { count: 5 }),
  skinUnlock('candy', 'req.stars', 12, (progress) => totalStars(progress.journey), {
    count: 12,
  }),
  skinUnlock('pixel', 'req.level', 5, (progress) => levelFor(progress.xp), { level: 5 }),
  skinUnlock('brush', 'req.challengeWins', 3, (progress) => progress.challenge.won, {
    count: 3,
  }),
  skinUnlock('gem', 'req.nyx', 1, (progress) => (beatNyx(progress) ? 1 : 0)),
];

export function isSkinUnlocked(skin: Skin, progress: ProgressData): boolean {
  const unlock = SKIN_UNLOCKS.find((entry) => entry.skin === skin);
  return !unlock || unlock.have(progress) >= unlock.need;
}

/** Piece sets earned but not yet celebrated. */
export function freshUnlocks(progress: ProgressData): SkinUnlock[] {
  return SKIN_UNLOCKS.filter(
    (unlock) =>
      unlock.need > 0 &&
      unlock.have(progress) >= unlock.need &&
      !progress.announced.includes(`skin:${unlock.skin}`),
  );
}

/**
 * Something worth a toast: a new level, an achievement, a piece set or
 * another cosmetic. Each carries the id it is marked announced under, so it
 * is celebrated exactly once wherever the player happens to be.
 */
export type Announcement =
  | { readonly id: string; readonly kind: 'level'; readonly level: number }
  | { readonly id: string; readonly kind: 'achievement'; readonly name: string }
  | { readonly id: string; readonly kind: 'skin'; readonly skin: Skin; readonly name: string }
  | { readonly id: string; readonly kind: 'cosmetic'; readonly cosmetic: Cosmetic };

export function cosmeticAnnouncementId(cosmetic: Cosmetic): string {
  return `cosmetic:${cosmetic.kind}:${cosmetic.id}`;
}

/** Every announcement `progress` qualifies for, seen or not. */
export function allAnnouncements(progress: ProgressData): Announcement[] {
  const list: Announcement[] = [];
  const level = levelFor(progress.xp);
  if (level > 1) list.push({ id: `level:${level}`, kind: 'level', level });
  for (const id of progress.achievements) {
    const entry = offlineAchievement(id);
    if (entry) list.push({ id: `achievement:${id}`, kind: 'achievement', name: entry.name });
  }
  for (const unlock of SKIN_UNLOCKS) {
    if (unlock.need > 0 && unlock.have(progress) >= unlock.need) {
      list.push({ id: `skin:${unlock.skin}`, kind: 'skin', skin: unlock.skin, name: unlock.name });
    }
  }
  for (const cosmetic of COSMETICS) {
    if (!isDefaultCosmetic(cosmetic) && cosmetic.unlocked(progress)) {
      list.push({ id: cosmeticAnnouncementId(cosmetic), kind: 'cosmetic', cosmetic });
    }
  }
  return list;
}

/** Announcement ids `progress` already qualifies for, for marking an old save as seen. */
export function announcementIds(progress: ProgressData): string[] {
  return allAnnouncements(progress).map((entry) => entry.id);
}

/**
 * Announcements earned but not yet celebrated, most important first: a level,
 * then the things it may have unlocked, then achievements.
 */
export function freshAnnouncements(progress: ProgressData): Announcement[] {
  const seen = new Set(progress.announced);
  const order = { level: 0, skin: 1, cosmetic: 2, achievement: 3 } as const;
  return allAnnouncements(progress)
    .filter((entry) => !seen.has(entry.id))
    .toSorted((a, b) => order[a.kind] - order[b.kind]);
}

/** A short label for what kind of thing an announcement is. */
export function announcementHeading(entry: Announcement): string {
  switch (entry.kind) {
    case 'level':
      return translate(cosmeticMessages, 'levelUp');
    case 'achievement':
      return translate(cosmeticMessages, 'achievementUnlocked');
    case 'skin':
      return translate(cosmeticMessages, 'piecesUnlocked');
    case 'cosmetic':
      return translate(cosmeticMessages, `new.${entry.cosmetic.kind}`);
  }
}
