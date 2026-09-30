import { type GameConfig, isGameConfig, sameConfig, type VariantId } from './types.js';

/**
 * The curated list of games dooz offers.
 *
 * A mode is a `GameConfig` with a name and an explanation attached. Keeping the
 * two apart is what makes a new variant cheap: the rules only ever see the
 * config, so adding a mode is a row in this table plus - if it is a new rule set
 * rather than a new board - one variant implementation.
 *
 * `ranked` marks the modes with a competitive ladder behind them. It is
 * deliberately not every mode: a ladder needs enough players in one pool to
 * produce meaningful ratings, and splitting them across every board size would
 * leave all of them empty.
 */
export type ModeId =
  | 'classic'
  | 'grid-6'
  | 'grid-9'
  | 'gomoku-13'
  | 'gomoku-15'
  | 'misere'
  | 'vanish'
  | 'gravity'
  | 'ultimate';

export type ModeGroup = 'classic' | 'large' | 'variant';

export interface GameMode {
  readonly id: ModeId;
  readonly name: string;
  /** One line, shown under the name on the mode picker. */
  readonly tagline: string;
  /** The rules, as the short list the tutorial and the help sheet both read from. */
  readonly rules: readonly string[];
  readonly config: GameConfig;
  readonly group: ModeGroup;
  /** Has a competitive ladder. Unranked and private games are open to every mode. */
  readonly ranked: boolean;
  /**
   * Seconds each player gets for the whole game in a timed match, and the
   * increment added after each move. Longer for the boards that take longer to
   * read - a 15x15 position is not a 3x3 one.
   */
  readonly clock: { readonly initialSeconds: number; readonly incrementSeconds: number };
}

export const GAME_MODES: readonly GameMode[] = [
  {
    id: 'classic',
    name: 'Classic',
    tagline: 'Three in a row on a 3×3 board',
    rules: [
      'Take turns placing your mark on an empty square.',
      'Get three of your marks in a row — across, down or diagonally.',
      'If the board fills with nobody in a row, the game is a draw.',
    ],
    config: { variant: 'classic', size: 3, winLength: 3 },
    group: 'classic',
    ranked: true,
    clock: { initialSeconds: 120, incrementSeconds: 3 },
  },
  {
    id: 'grid-6',
    name: 'Grid 6',
    tagline: 'Four in a row on a 6×6 board',
    rules: [
      'Take turns placing your mark on an empty square.',
      'Get four of your marks in a row — across, down or diagonally.',
      'A full row is not needed: four in a line anywhere on the board wins.',
    ],
    config: { variant: 'classic', size: 6, winLength: 4 },
    group: 'classic',
    ranked: true,
    clock: { initialSeconds: 240, incrementSeconds: 5 },
  },
  {
    id: 'grid-9',
    name: 'Grid 9',
    tagline: 'Five in a row on a 9×9 board',
    rules: [
      'Take turns placing your mark on an empty square.',
      'Get five of your marks in a row — across, down or diagonally.',
      'Space to build means space to be blocked: watch both ends of a run.',
    ],
    config: { variant: 'classic', size: 9, winLength: 5 },
    group: 'classic',
    ranked: true,
    clock: { initialSeconds: 300, incrementSeconds: 5 },
  },
  {
    id: 'gomoku-13',
    name: 'Gomoku 13',
    tagline: 'Five in a row on a 13×13 board',
    rules: [
      'Take turns placing your mark on any empty point.',
      'Get five of your marks in a row — across, down or diagonally.',
      'An open run of three or four threatens at both ends. Block early.',
    ],
    config: { variant: 'gomoku', size: 13, winLength: 5 },
    group: 'large',
    ranked: true,
    clock: { initialSeconds: 420, incrementSeconds: 8 },
  },
  {
    id: 'gomoku-15',
    name: 'Gomoku 15',
    tagline: 'Five in a row on a full 15×15 board',
    rules: [
      'Take turns placing your mark on any empty point.',
      'Get five of your marks in a row — across, down or diagonally.',
      'Two open threats at once cannot both be blocked. That is how games end.',
    ],
    config: { variant: 'gomoku', size: 15, winLength: 5 },
    group: 'large',
    ranked: true,
    clock: { initialSeconds: 480, incrementSeconds: 10 },
  },
  {
    id: 'misere',
    name: 'Misère',
    tagline: 'Three in a row on 3×3 — and it loses',
    rules: [
      'Take turns placing your mark on an empty square, exactly as normal.',
      'Getting three in a row makes you LOSE the game.',
      'A full board with nobody forced into a line is a draw.',
    ],
    config: { variant: 'misere', size: 3, winLength: 3 },
    group: 'variant',
    ranked: true,
    clock: { initialSeconds: 120, incrementSeconds: 3 },
  },
  {
    id: 'vanish',
    name: 'Vanish',
    tagline: 'Keep only your three newest marks',
    rules: [
      'Take turns placing your mark on an empty square.',
      'You may only have three marks on the board. Placing a fourth removes your oldest first.',
      'Your next mark to vanish is shown fading — it cannot be part of your winning line.',
      'Get three in a row to win. No line after 50 moves is a draw.',
    ],
    config: { variant: 'vanish', size: 3, winLength: 3 },
    group: 'variant',
    // New rule sets start casual: a ladder needs a crowd, and splitting the
    // existing ones to seed a new one would leave every pool thinner.
    ranked: false,
    clock: { initialSeconds: 150, incrementSeconds: 3 },
  },
  {
    id: 'gravity',
    name: 'Gravity',
    tagline: 'Marks drop — four in a row on 7×7',
    rules: [
      'Pick a column. Your mark drops to the lowest empty square in it.',
      'Get four of your marks in a row — across, down or diagonally.',
      'A square only opens once the one beneath it is taken. Plan your stacks.',
    ],
    config: { variant: 'gravity', size: 7, winLength: 4 },
    group: 'variant',
    ranked: false,
    clock: { initialSeconds: 300, incrementSeconds: 5 },
  },
  {
    id: 'ultimate',
    name: 'Ultimate',
    tagline: 'Nine small boards inside one big one',
    rules: [
      'The big board is made of nine small 3×3 boards.',
      'Win a small board by getting three in a row inside it.',
      'Win the game by winning three small boards in a row.',
      'Your move decides where your opponent must play: the square you pick sends them to the matching small board.',
      'If that small board is already finished, they may play anywhere.',
    ],
    config: { variant: 'ultimate', size: 9, winLength: 3 },
    group: 'variant',
    ranked: true,
    clock: { initialSeconds: 420, incrementSeconds: 8 },
  },
];

const BY_ID = new Map<ModeId, GameMode>(GAME_MODES.map((mode) => [mode.id, mode]));

export const DEFAULT_MODE_ID: ModeId = 'classic';

export function isModeId(value: unknown): value is ModeId {
  return typeof value === 'string' && BY_ID.has(value as ModeId);
}

export function modeById(id: ModeId): GameMode {
  const mode = BY_ID.get(id);
  if (!mode) throw new Error(`Unknown mode: ${id}`);
  return mode;
}

/** The mode a config corresponds to, or `null` for a custom game. */
export function modeForConfig(config: GameConfig): GameMode | null {
  return GAME_MODES.find((mode) => sameConfig(mode.config, config)) ?? null;
}

/**
 * The name to show for a config.
 *
 * Custom games - a board and run length nobody put on the mode list - still
 * need something readable next to a result or in a match history.
 */
export function describeConfig(config: GameConfig): string {
  const mode = modeForConfig(config);
  if (mode) return mode.name;
  return `${VARIANT_NAMES[config.variant]} ${config.size}×${config.size} · ${config.winLength} in a row`;
}

const VARIANT_NAMES: Record<VariantId, string> = {
  classic: 'Custom',
  gomoku: 'Gomoku',
  misere: 'Misère',
  gravity: 'Gravity',
  vanish: 'Vanish',
  ultimate: 'Ultimate',
};

/** Modes with a ladder, in the order a leaderboard should list them. */
export const RANKED_MODES: readonly GameMode[] = GAME_MODES.filter((mode) => mode.ranked);

/**
 * The clock a config should use, falling back to something proportionate for a
 * custom board rather than refusing to time it.
 */
export function clockForConfig(config: GameConfig): {
  initialSeconds: number;
  incrementSeconds: number;
} {
  const mode = modeForConfig(config);
  if (mode) return mode.clock;

  const cells = config.size * config.size;
  return {
    initialSeconds: Math.min(600, Math.max(120, Math.round(cells * 2.2))),
    incrementSeconds: config.size <= 3 ? 3 : config.size <= 9 ? 5 : 8,
  };
}

/** Narrows a config that arrived from outside, falling back to the default mode. */
export function coerceConfig(value: unknown): GameConfig {
  return isGameConfig(value) ? value : modeById(DEFAULT_MODE_ID).config;
}
