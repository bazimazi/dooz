import { MAX_STARS } from '@/features/journey/stages';
import { type MessageValues, translate } from '@/i18n';
import { type CosmeticMessageKey, cosmeticMessages } from '@/i18n/messages/cosmetics';
import type { EquippedCosmetics } from '@/lib/preferences';
import { beatNyx, journeyComplete, liveDailyStreak, totalBotWins, totalStars } from './selectors';
import type { ProgressData } from './store';
import { levelFor } from './xp';

/**
 * Everything collectable besides the piece sets.
 *
 * All of it is earned by playing - by level, by achievements, by finishing the
 * journey, by beating Nyx, by keeping a streak - and none of it is for sale.
 * Every kind has a default that is never locked, so an empty collection is a
 * plain look rather than a missing one.
 *
 * Piece sets stay in `unlocks.ts`, where the settings sheet has always read
 * them; the collection screen shows both catalogues side by side.
 *
 * Only ids live here: every name, requirement and victory line is read from
 * the cosmetic catalog by id when it is asked for, so it is always in the
 * language in force at the time.
 */

export type CosmeticKind = 'effect' | 'frame' | 'title' | 'emote';

interface CosmeticBase {
  readonly id: string;
  /** In the current language. */
  readonly name: string;
  /** How to earn it, as one sentence in the current language. */
  readonly requirement: string;
  readonly unlocked: (progress: ProgressData) => boolean;
  /** How far along a counting requirement is. */
  readonly progress?: (progress: ProgressData) => readonly [have: number, need: number];
}

export interface WinEffect extends CosmeticBase {
  readonly kind: 'effect';
  /** Confetti colours, any CSS colour. */
  readonly colours: readonly string[];
  readonly shape: 'mixed' | 'round' | 'star' | 'square';
}

export interface AvatarFrame extends CosmeticBase {
  readonly kind: 'frame';
  /** A CSS background drawn as the ring; empty for no frame. */
  readonly ring: string;
}

export interface Title extends CosmeticBase {
  readonly kind: 'title';
}

export interface Emote extends CosmeticBase {
  readonly kind: 'emote';
  /** What you say on the result panel when you win, in the current language. */
  readonly line: string;
}

export type Cosmetic = WinEffect | AvatarFrame | Title | Emote;

/** How a cosmetic is earned: the test, and the catalog sentence that says so. */
interface Earning {
  readonly requirement: CosmeticMessageKey;
  readonly values?: MessageValues;
  readonly unlocked: (progress: ProgressData) => boolean;
  readonly progress?: (progress: ProgressData) => readonly [have: number, need: number];
}

const always: Earning = { requirement: 'req.always', unlocked: () => true };

function atLevel(level: number): Earning {
  return {
    requirement: 'req.level',
    values: { level },
    unlocked: (progress) => levelFor(progress.xp) >= level,
    progress: (progress) => [Math.min(level, levelFor(progress.xp)), level],
  };
}

function counted(
  requirement: CosmeticMessageKey,
  have: (progress: ProgressData) => number,
  need: number,
  values?: MessageValues,
): Earning {
  return {
    requirement,
    ...(values ? { values } : {}),
    unlocked: (progress) => have(progress) >= need,
    progress: (progress) => [Math.min(need, have(progress)), need],
  };
}

const nyx: Earning = { requirement: 'req.nyx', unlocked: beatNyx };
const pathfinder = counted('req.pathfinder', (p) => p.run.won, 1);

/**
 * A cosmetic from its look and how it is earned. The name and requirement are
 * getters, read from the catalog by id each time they are asked for.
 */
function makeCosmetic<T extends { readonly kind: CosmeticKind; readonly id: string }>(
  look: T,
  earning: Earning,
): T & CosmeticBase {
  return {
    ...look,
    unlocked: earning.unlocked,
    ...(earning.progress ? { progress: earning.progress } : {}),
    get name() {
      return translate(cosmeticMessages, `${look.kind}.${look.id}` as CosmeticMessageKey);
    },
    get requirement() {
      return translate(cosmeticMessages, earning.requirement, earning.values);
    },
  };
}

function makeEmote(id: string, earning: Earning): Emote {
  return Object.defineProperty(makeCosmetic({ kind: 'emote', id }, earning), 'line', {
    enumerable: true,
    get: () => translate(cosmeticMessages, `emote.${id}.line` as CosmeticMessageKey),
  }) as Emote;
}

export const WIN_EFFECTS: readonly WinEffect[] = [
  makeCosmetic(
    {
      kind: 'effect',
      id: 'confetti',
      colours: [
        'var(--color-mark-x)',
        'var(--color-mark-x-soft)',
        'var(--color-mark-o)',
        'var(--color-mark-o-soft)',
        'var(--color-ink)',
        'var(--color-stroke)',
      ],
      shape: 'mixed',
    },
    always,
  ),
  makeCosmetic(
    {
      kind: 'effect',
      id: 'gold-rush',
      colours: ['#f7d774', '#e8b730', '#c99417', '#fff3c4', '#b07d10'],
      shape: 'square',
    },
    atLevel(3),
  ),
  makeCosmetic(
    {
      kind: 'effect',
      id: 'ember',
      colours: ['#ff7a3d', '#ffb347', '#e8452c', '#ffd27a', '#a92a1c'],
      shape: 'round',
    },
    atLevel(12),
  ),
  makeCosmetic(
    {
      kind: 'effect',
      id: 'starfall',
      colours: ['#fff6c9', '#ffe27a', '#ffffff', 'var(--color-mark-o-soft)'],
      shape: 'star',
    },
    counted('req.gauntlet5', (p) => p.gauntlet.best, 5),
  ),
  makeCosmetic(
    {
      kind: 'effect',
      id: 'frost',
      colours: ['#d8f1ff', '#9fd6ff', '#5aa9e6', '#ffffff', '#bfe4ff'],
      shape: 'mixed',
    },
    counted('req.challengeStreak7', (p) => p.challenge.best, 7),
  ),
  makeCosmetic(
    {
      kind: 'effect',
      id: 'ghostlight',
      colours: ['#b9a6ff', '#7e6bd9', '#e6dcff', '#4b3f99'],
      shape: 'round',
    },
    nyx,
  ),
  makeCosmetic(
    {
      kind: 'effect',
      id: 'prism',
      colours: ['#ff5d5d', '#ffb13d', '#ffe84d', '#5ee07a', '#4db8ff', '#9a6bff'],
      shape: 'mixed',
    },
    pathfinder,
  ),
];

export const AVATAR_FRAMES: readonly AvatarFrame[] = [
  makeCosmetic({ kind: 'frame', id: 'none', ring: '' }, always),
  makeCosmetic(
    {
      kind: 'frame',
      id: 'bronze',
      ring: 'linear-gradient(135deg, #f0b27a, #a0522d 55%, #e2a36b)',
    },
    atLevel(2),
  ),
  makeCosmetic(
    {
      kind: 'frame',
      id: 'silver',
      ring: 'linear-gradient(135deg, #ffffff, #9aa5b1 50%, #e3e8ee)',
    },
    atLevel(10),
  ),
  makeCosmetic(
    {
      kind: 'frame',
      id: 'gold',
      ring: 'linear-gradient(135deg, #fff1a8, #d4a017 50%, #ffe27a)',
    },
    atLevel(20),
  ),
  makeCosmetic(
    {
      kind: 'frame',
      id: 'flame',
      ring: 'conic-gradient(#ff4d2e, #ffb347, #ff4d2e, #ffd27a, #ff4d2e)',
    },
    counted('req.dailyStreak7', (p) => p.daily.best, 7),
  ),
  makeCosmetic(
    {
      kind: 'frame',
      id: 'laurel',
      ring: 'repeating-conic-gradient(#5fae5a 0 12deg, #3b7d3a 12deg 24deg)',
    },
    {
      requirement: 'req.journeyComplete',
      unlocked: (progress) => journeyComplete(progress.journey),
    },
  ),
  makeCosmetic(
    {
      kind: 'frame',
      id: 'void',
      ring: 'conic-gradient(#1b1440, #7e6bd9, #1b1440, #b9a6ff, #1b1440)',
    },
    nyx,
  ),
  makeCosmetic(
    {
      kind: 'frame',
      id: 'compass',
      ring: 'repeating-conic-gradient(var(--color-mark-x) 0 45deg, var(--color-mark-o) 45deg 90deg)',
    },
    pathfinder,
  ),
];

export const TITLES: readonly Title[] = [
  makeCosmetic({ kind: 'title', id: 'newcomer' }, always),
  makeCosmetic({ kind: 'title', id: 'apprentice' }, atLevel(4)),
  makeCosmetic({ kind: 'title', id: 'strategist' }, atLevel(15)),
  makeCosmetic({ kind: 'title', id: 'grandmaster' }, atLevel(25)),
  makeCosmetic(
    { kind: 'title', id: 'tactician' },
    counted('req.puzzles', (p) => p.puzzles.length, 25, { count: 25 }),
  ),
  makeCosmetic(
    { kind: 'title', id: 'star-collector' },
    counted('req.allStars', (p) => totalStars(p.journey), MAX_STARS),
  ),
  makeCosmetic({ kind: 'title', id: 'rival-slayer' }, nyx),
  makeCosmetic(
    { kind: 'title', id: 'survivor' },
    counted('req.gauntlet8', (p) => p.gauntlet.best, 8),
  ),
  makeCosmetic({ kind: 'title', id: 'pathfinder' }, pathfinder),
  makeCosmetic(
    { kind: 'title', id: 'speed-demon' },
    counted('req.blitz10', (p) => p.blitz.won, 10),
  ),
  makeCosmetic(
    { kind: 'title', id: 'devotee' },
    counted('req.challengeStreak7', (p) => p.challenge.best, 7),
  ),
];

export const EMOTES: readonly Emote[] = [
  makeEmote('gg', always),
  makeEmote('easy', atLevel(6)),
  makeEmote(
    'phew',
    counted('req.botWins', (p) => totalBotWins(p.bot), 10, { count: 10 }),
  ),
  makeEmote(
    'tick-tock',
    counted('req.blitz5', (p) => p.blitz.won, 5),
  ),
  makeEmote('streak', {
    requirement: 'req.dailyStreak3',
    unlocked: (progress) => progress.daily.best >= 3 || liveDailyStreak(progress.daily) >= 3,
  }),
  makeEmote('foreseen', nyx),
  makeEmote('onward', pathfinder),
  makeEmote('again', atLevel(18)),
];

export const COSMETICS: readonly Cosmetic[] = [
  ...WIN_EFFECTS,
  ...AVATAR_FRAMES,
  ...TITLES,
  ...EMOTES,
];

/** What each kind is called as a heading, read in the current language. */
export const COSMETIC_KIND_NAMES: Readonly<Record<CosmeticKind, string>> = {
  get effect() {
    return translate(cosmeticMessages, 'kind.effect');
  },
  get frame() {
    return translate(cosmeticMessages, 'kind.frame');
  },
  get title() {
    return translate(cosmeticMessages, 'kind.title');
  },
  get emote() {
    return translate(cosmeticMessages, 'kind.emote');
  },
};

const DEFAULTS: { [K in CosmeticKind]: Extract<Cosmetic, { kind: K }> } = {
  effect: WIN_EFFECTS[0]!,
  frame: AVATAR_FRAMES[0]!,
  title: TITLES[0]!,
  emote: EMOTES[0]!,
};

export function cosmeticsOf<K extends CosmeticKind>(kind: K): Extract<Cosmetic, { kind: K }>[] {
  return COSMETICS.filter((entry): entry is Extract<Cosmetic, { kind: K }> => entry.kind === kind);
}

export function cosmeticById(id: string): Cosmetic | undefined {
  return COSMETICS.find((entry) => entry.id === id);
}

/** The cosmetic of `kind` equipped, or the default when it is unknown or still locked. */
export function equippedCosmetic<K extends CosmeticKind>(
  kind: K,
  equipped: EquippedCosmetics,
  progress: ProgressData,
): Extract<Cosmetic, { kind: K }> {
  const id = equipped[kind];
  const found = cosmeticsOf(kind).find((entry) => entry.id === id);
  return found && found.unlocked(progress) ? found : DEFAULTS[kind];
}

export function isDefaultCosmetic(cosmetic: Cosmetic): boolean {
  return DEFAULTS[cosmetic.kind].id === cosmetic.id;
}
