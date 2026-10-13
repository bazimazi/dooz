import {
  type BotDifficulty,
  GAME_MODES,
  type GameConfig,
  type GameMode,
  type ModeId,
  O,
  type Player,
  withSeed,
  X,
} from '@/game/engine';
import { difficultyLabel } from '@/game/bot/labels';
import { translate } from '@/i18n';
import {
  type DailyChallengeMessageKey,
  dailyChallengeMessages,
} from '@/i18n/messages/dailyChallenge';
import type { Outcome } from '@/features/progress/store';
import { type XpLine, xpLine } from '@/features/progress/xp';
import { handicapSetup, type Setup } from './handicap';
import { hashSeed, pick, type Random, seededRandom } from './random';
import type { ClockSpec } from './useHumanClock';

/**
 * The daily challenge: one bot game a day, the same for everyone.
 *
 * Like the daily puzzle it is chosen from the day number alone, so two players
 * comparing scores played the same thing - the same mode, the same bot, the
 * same twist and, on a board with obstacles, the same obstacles. The first
 * game finished each day is the one that counts; anything after is practice.
 *
 * The bot's level follows the week, easing in on Monday and peaking at the
 * weekend, and a 3x3 board never gets a level that plays it perfectly - a
 * challenge nobody can win is not one.
 */

export type ModifierId = 'bot-first' | 'bot-head-start' | 'your-head-start' | 'clock';

export interface Modifier {
  readonly id: ModifierId;
  /** In the current language, read from the daily challenge catalog by id. */
  readonly name: string;
  readonly description: string;
  /** Applied to the win score: harder twists pay more. */
  readonly multiplier: number;
}

export interface DailyChallenge {
  readonly day: number;
  /** The challenge's public number, for the share line. */
  readonly number: number;
  readonly mode: ModeId;
  readonly config: GameConfig;
  readonly difficulty: BotDifficulty;
  readonly modifiers: readonly Modifier[];
  readonly opener: Player;
  readonly setup?: Setup;
  readonly clock?: ClockSpec;
  /** Your own moves to win within for the par bonus. */
  readonly par: number;
}

/** A twist by id, its name and description read in the current language. */
function modifier(id: ModifierId, multiplier: number): Modifier {
  return {
    id,
    multiplier,
    get name() {
      return translate(dailyChallengeMessages, `mod.${id}.name`);
    },
    get description() {
      return translate(dailyChallengeMessages, `mod.${id}.description`);
    },
  };
}

const MODIFIERS: Record<ModifierId, Modifier> = {
  'bot-first': modifier('bot-first', 1.2),
  'bot-head-start': modifier('bot-head-start', 1.5),
  'your-head-start': modifier('your-head-start', 0.8),
  clock: modifier('clock', 1.25),
};

/** The first challenge's day, so numbers count up from one. */
const FIRST_DAY = Math.floor(Date.UTC(2026, 9, 1) / 86_400_000);

/** Bot level by day of the week, Monday first. */
const WEEK: readonly BotDifficulty[] = [
  'easy',
  'medium',
  'medium',
  'hard',
  'medium',
  'hard',
  'expert',
];

const DIFFICULTY_FACTOR: Record<BotDifficulty, number> = {
  beginner: 0.5,
  easy: 0.7,
  medium: 1,
  hard: 1.3,
  expert: 1.6,
  master: 2,
};

/** Boards so small the strong levels play them perfectly. */
export function isSolvedBoard(config: GameConfig): boolean {
  return config.size <= 3;
}

/** The strongest level worth facing on `config`: medium on a solved board. */
export function capDifficulty(config: GameConfig, difficulty: BotDifficulty): BotDifficulty {
  if (!isSolvedBoard(config)) return difficulty;
  return ['hard', 'expert', 'master'].includes(difficulty) ? 'medium' : difficulty;
}

/** A par for `mode`: roughly the run length plus room to build it. */
export function parFor(config: GameConfig): number {
  if (config.variant === 'ultimate') return 22;
  return config.winLength + Math.ceil(config.size / 3);
}

/** A shorter clock than an online game's, for a single sharp game. */
export function blitzClockFor(mode: GameMode): ClockSpec {
  return {
    initialMs: Math.max(30, Math.round(mode.clock.initialSeconds / 3)) * 1000,
    incrementMs: Math.min(3, mode.clock.incrementSeconds) * 1000,
  };
}

/** The day of the week, Monday 0, for day number `day`. */
function weekday(day: number): number {
  // Day 0 of the epoch was a Thursday.
  return (((day + 3) % 7) + 7) % 7;
}

export function dailyChallenge(day: number): DailyChallenge {
  const random = seededRandom(hashSeed(`dooz-daily-${day}`));
  const mode = pick(random, GAME_MODES);
  const config = withSeed(mode.config, random);
  const difficulty = capDifficulty(config, WEEK[weekday(day)]!);
  const modifiers = chooseModifiers(random, config);
  const ids = new Set(modifiers.map((entry) => entry.id));

  let opener: Player = X;
  let setup: Setup | undefined;
  if (ids.has('bot-first')) opener = O;
  if (ids.has('bot-head-start')) {
    setup = handicapSetup(config, config.size >= 6 ? 2 : 1, O, random);
    opener = O;
  }
  if (ids.has('your-head-start')) setup = handicapSetup(config, 1, X, random);

  return {
    day,
    number: day - FIRST_DAY + 1,
    mode: mode.id,
    config,
    difficulty,
    modifiers,
    opener,
    ...(setup && setup.moves.length > 0 ? { setup } : {}),
    ...(ids.has('clock') ? { clock: blitzClockFor(mode) } : {}),
    par: parFor(config),
  };
}

/**
 * One or two twists. At most one changes who starts or what is on the board,
 * since they cannot all apply at once; a head start for you only on the days
 * the bot is at its strongest, where it is a kindness rather than a gift.
 */
function chooseModifiers(random: Random, config: GameConfig): Modifier[] {
  const chosen: Modifier[] = [];
  const opening = random();
  if (opening < 0.3) chosen.push(MODIFIERS['bot-first']);
  else if (opening < 0.5 && config.variant !== 'ultimate') chosen.push(MODIFIERS['bot-head-start']);
  else if (opening < 0.6 && !isSolvedBoard(config)) chosen.push(MODIFIERS['your-head-start']);
  if (random() < 0.45 || chosen.length === 0) chosen.push(MODIFIERS.clock);
  return chosen;
}

export interface ChallengeScore {
  readonly total: number;
  readonly lines: readonly { readonly label: string; readonly points: number }[];
  /** 0-3, for the share line. */
  readonly stars: number;
}

/** A line of a challenge's score, labelled in the language in force when it is shown. */
function scoreLine(
  key: DailyChallengeMessageKey,
  points: number,
): { label: string; points: number } {
  return {
    points,
    get label() {
      return translate(dailyChallengeMessages, key);
    },
  };
}

/** The score for a finished challenge. */
export function scoreChallenge(
  challenge: DailyChallenge,
  result: { outcome: Outcome; moves: number; timeLeftMs: number | null },
): ChallengeScore {
  if (result.outcome === 'loss') return { total: 0, lines: [], stars: 0 };
  const multiplier = challenge.modifiers.reduce((product, entry) => product * entry.multiplier, 1);
  const base = Math.round(1000 * DIFFICULTY_FACTOR[challenge.difficulty] * multiplier);
  const lines: { label: string; points: number }[] = [];

  if (result.outcome === 'draw') {
    lines.push(scoreLine('score.draw', Math.round(base * 0.4)));
  } else {
    const level = challenge.difficulty;
    lines.push({
      points: base,
      get label() {
        return translate(dailyChallengeMessages, 'score.win', { level: difficultyLabel(level) });
      },
    });
    if (result.moves <= challenge.par) {
      lines.push(scoreLine('score.underPar', (challenge.par - result.moves + 1) * 100));
    }
    if (result.timeLeftMs !== null) {
      lines.push(
        scoreLine('score.timeLeft', Math.min(500, Math.floor(result.timeLeftMs / 1000) * 5)),
      );
    }
  }
  const total = Math.round(lines.reduce((sum, line) => sum + line.points, 0) / 10) * 10;
  const stars = result.outcome === 'draw' ? 1 : result.moves <= challenge.par ? 3 : 2;
  return { total, lines, stars };
}

/** XP for the official result: a flat amount for playing, and a share of the score. */
export function challengeXp(score: ChallengeScore): XpLine[] {
  const lines: XpLine[] = [xpLine('xp.dailyChallenge', 25)];
  if (score.total > 0) lines.push(xpLine('xp.scoreBonus', Math.round(score.total / 25)));
  return lines;
}

/**
 * A result anyone can paste into a chat. It says how it went, never how it
 * was played: no squares, no moves, so it spoils nothing for a friend who has
 * not played yet.
 */
export function shareText(
  challenge: DailyChallenge,
  modeName: string,
  result: { outcome: Outcome; score: number; stars: number },
  streak: number,
): string {
  const stars = '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars);
  const verdict = translate(
    dailyChallengeMessages,
    result.outcome === 'win' ? 'won' : result.outcome === 'draw' ? 'drew' : 'lost',
  );
  const twists = challenge.modifiers.map((entry) => entry.name).join(' · ');
  return [
    translate(dailyChallengeMessages, 'shareHeading', { number: challenge.number }),
    `${modeName} · ${difficultyLabel(challenge.difficulty)}${twists ? ` · ${twists}` : ''}`,
    translate(dailyChallengeMessages, 'shareScore', { stars, verdict, score: result.score }),
    streak > 1 ? translate(dailyChallengeMessages, 'shareStreak', { count: streak }) : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}
