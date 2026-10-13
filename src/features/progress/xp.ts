import type { BotDifficulty } from '@/game/engine';
import { type MessageValues, translate } from '@/i18n';
import { rewardMessages, type XpReason } from '@/i18n/messages/rewards';

/**
 * Experience and the player level.
 *
 * Every finished game is worth something - a loss included, because a level
 * that only climbs on wins tells a struggling player they are standing still
 * when they are not. What a game is worth scales with what it asked of the
 * player: the bot's level, the clock, a handicap given or taken.
 *
 * The curve is gentle at the bottom and steady after it. The first levels come
 * in an evening so the system introduces itself; later ones take a week of
 * casual play, which is the pace a cosmetic reward can still feel earned at.
 */

export const MAX_LEVEL = 50;

/** One line of an XP breakdown, as the result panel lists it. */
export interface XpLine {
  /** In the current language, read when it is shown. */
  readonly label: string;
  readonly xp: number;
}

/**
 * A line of XP for `reason`, whose label is read from the rewards catalog
 * each time it is shown, so a breakdown follows a change of language.
 */
export function xpLine(reason: XpReason, xp: number, values?: MessageValues): XpLine {
  return {
    xp,
    get label() {
      return translate(rewardMessages, reason, values);
    },
  };
}

/** XP needed to go from `level` to the one after it. */
export function xpForStep(level: number): number {
  return 100 + 40 * (Math.max(1, level) - 1);
}

/** Total XP at which `level` is reached. Level 1 is where everyone starts. */
export function xpToReach(level: number): number {
  const steps = Math.max(0, Math.min(level, MAX_LEVEL) - 1);
  return 100 * steps + 20 * steps * (steps - 1);
}

export function levelFor(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpToReach(level + 1)) level++;
  return level;
}

/** Where `xp` sits within its level, for a progress bar. */
export function levelProgress(xp: number): {
  level: number;
  into: number;
  span: number;
  fraction: number;
} {
  const level = levelFor(xp);
  if (level >= MAX_LEVEL) return { level, into: 0, span: 0, fraction: 1 };
  const floor = xpToReach(level);
  const span = xpToReach(level + 1) - floor;
  const into = xp - floor;
  return { level, into, span, fraction: span > 0 ? into / span : 1 };
}

/** A win against each bot level. Draws earn a share, losses a token. */
export const BOT_WIN_XP: Record<BotDifficulty, number> = {
  beginner: 10,
  easy: 15,
  medium: 25,
  hard: 40,
  expert: 60,
  master: 90,
};

const LOSS_XP = 5;
const FIRST_WIN_XP = 20;

export type Outcome = 'win' | 'loss' | 'draw';

export interface BotGameOptions {
  /** Played against the clock. */
  readonly blitz?: boolean;
  /**
   * Pre-placed marks: positive for the player, negative for the bot. Taking
   * a head start costs XP; giving the bot one pays more.
   */
  readonly handicap?: number;
}

/** The base line for a game against the bot. */
export function botGameXp(
  difficulty: BotDifficulty,
  outcome: Outcome,
  options: BotGameOptions = {},
): XpLine[] {
  const win = BOT_WIN_XP[difficulty];
  const base =
    outcome === 'win' ? win : outcome === 'draw' ? Math.max(LOSS_XP, Math.round(win * 0.4)) : 0;
  const lines: XpLine[] = [
    outcome === 'loss'
      ? xpLine('xp.forPlaying', LOSS_XP)
      : xpLine(outcome === 'win' ? 'xp.win' : 'xp.draw', base),
  ];
  if (outcome === 'loss') return lines;

  if (options.blitz) lines.push(xpLine('xp.blitzBonus', Math.round(base * 0.25)));
  const handicap = Math.trunc(options.handicap ?? 0);
  if (handicap > 0) {
    // A head start makes the same win easier; never below a token.
    const cut = Math.min(base - 1, Math.round(base * 0.15 * handicap));
    if (cut > 0) lines.push(xpLine('xp.headStart', -cut));
  } else if (handicap < 0) {
    lines.push(xpLine('xp.gaveHeadStart', Math.round(base * 0.2 * -handicap)));
  }
  return lines;
}

/** Extra for a run of wins against one level: from the third, capped. */
export function streakXp(streak: number): XpLine | null {
  if (streak < 3) return null;
  return xpLine('xp.streak', Math.min(25, (streak - 2) * 5), { count: streak });
}

export function firstWinXp(): XpLine {
  return xpLine('xp.firstWin', FIRST_WIN_XP);
}

export const LOCAL_GAME_XP = 5;

export function onlineGameXp(outcome: Outcome, ranked: boolean): XpLine {
  if (outcome === 'win') return xpLine(ranked ? 'xp.rankedWin' : 'xp.onlineWin', ranked ? 50 : 40);
  if (outcome === 'draw') return xpLine('xp.onlineDraw', 20);
  return xpLine('xp.forPlaying', 10);
}

export function puzzleXp(firstSolve: boolean, daily: boolean): XpLine[] {
  const lines: XpLine[] = [
    firstSolve ? xpLine('xp.puzzleSolved', 30) : xpLine('xp.puzzleReplayed', 5),
  ];
  if (daily) lines.push(xpLine('xp.dailyPuzzle', 40));
  return lines;
}

/** A journey stage: a little for the game, more for every new star. */
export function stageXp(stars: number, newStars: number): XpLine[] {
  if (stars === 0) return [xpLine('xp.forPlaying', LOSS_XP)];
  const lines: XpLine[] = [xpLine('xp.stageCleared', 15)];
  if (newStars > 0) lines.push(xpLine('xp.newStars', 25 * newStars, { count: newStars }));
  return lines;
}

export function sumXp(lines: readonly XpLine[]): number {
  return lines.reduce((sum, line) => sum + line.xp, 0);
}
