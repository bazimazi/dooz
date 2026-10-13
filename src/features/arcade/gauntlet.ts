import { type BotDifficulty, GAME_MODES, type ModeId } from '@/game/engine';
import { create } from 'zustand';
import { RIVALS, type Rival } from '@/features/journey/stages';
import type { Outcome } from '@/features/progress/store';
import { capDifficulty } from './daily';
import { freshSeed, hashSeed, pick, seededRandom } from './random';

const STORAGE_KEY = 'dooz.gauntlet';

/**
 * The gauntlet: bots of rising strength, one after another, until you run out
 * of lives.
 *
 * Every win moves you a step up the ladder; a loss costs a life and puts a
 * fresh opponent at the same step in front of you; a draw costs nothing and
 * gains nothing. The mode changes every match, so surviving means being
 * comfortable everywhere rather than grinding one board.
 *
 * The opponents come from a seed chosen when the gauntlet starts, so a reload
 * mid-gauntlet faces the same opponent it left.
 */

export const GAUNTLET_LIVES = 3;

/** Bot level for each step of the ladder; past the end it stays at the top. */
const LADDER: readonly BotDifficulty[] = [
  'beginner',
  'easy',
  'easy',
  'medium',
  'medium',
  'medium',
  'hard',
  'hard',
  'hard',
  'expert',
  'expert',
  'expert',
  'master',
];

export interface GauntletOpponent {
  readonly mode: ModeId;
  readonly difficulty: BotDifficulty;
  /** The journey character who plays at this level, for a face and a name. */
  readonly rival: Rival;
  /** One-based, for "Opponent 4". */
  readonly number: number;
}

export interface GauntletData {
  /** Null when no gauntlet is under way. */
  seed: number | null;
  lives: number;
  beaten: number;
  /** Matches played so far, which also picks the next mode. */
  played: number;
}

const IDLE: GauntletData = { seed: null, lives: GAUNTLET_LIVES, beaten: 0, played: 0 };

/** The opponent at `beaten` wins in, on match `played`, for gauntlet `seed`. */
export function gauntletOpponent(seed: number, beaten: number, played: number): GauntletOpponent {
  const random = seededRandom(hashSeed(`gauntlet-${seed}-${played}`));
  const step = LADDER[Math.min(beaten, LADDER.length - 1)]!;
  const mode = pick(random, GAME_MODES);
  const difficulty = capDifficulty(mode.config, step);
  const rival = RIVALS.find((entry) => entry.difficulty === difficulty) ?? RIVALS[0]!;
  return { mode: mode.id, difficulty, rival, number: beaten + 1 };
}

/** The gauntlet after a match. `over` once the last life is gone. */
export function afterMatch(data: GauntletData, outcome: Outcome): GauntletData & { over: boolean } {
  const lives = data.lives - (outcome === 'loss' ? 1 : 0);
  return {
    ...data,
    lives,
    beaten: data.beaten + (outcome === 'win' ? 1 : 0),
    played: data.played + 1,
    over: lives <= 0,
  };
}

/** A whole number in [0, max], or null. */
function whole(value: unknown, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max
    ? value
    : null;
}

function load(): GauntletData {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<
      Record<keyof GauntletData, unknown>
    > | null;
    if (!parsed || typeof parsed.seed !== 'number') return IDLE;
    const lives = whole(parsed.lives, GAUNTLET_LIVES);
    const beaten = whole(parsed.beaten, 10_000);
    const played = whole(parsed.played, 10_000);
    if (lives === null || lives === 0 || beaten === null || played === null) return IDLE;
    return { seed: parsed.seed >>> 0, lives, beaten, played };
  } catch {
    return IDLE;
  }
}

function save(data: GauntletData): void {
  try {
    if (data.seed === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* A gauntlet without storage lasts the session. */
  }
}

interface GauntletState extends GauntletData {
  start: () => void;
  /** Apply a finished match. Returns whether the gauntlet is over. */
  report: (outcome: Outcome) => boolean;
  /** End the gauntlet without finishing it. */
  abandon: () => void;
}

export const useGauntletStore = create<GauntletState>((set, get) => {
  const commit = (data: GauntletData) => {
    set(data);
    save(data);
  };
  return {
    ...load(),
    start() {
      commit({ ...IDLE, seed: freshSeed() });
    },
    report(outcome) {
      const { over, ...next } = afterMatch(get(), outcome);
      commit(over ? { ...next, seed: null } : next);
      return over;
    },
    abandon() {
      commit(IDLE);
    },
  };
});
