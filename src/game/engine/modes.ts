import { isGameConfig, sameConfig, variantName } from './config.js';
import type { GameConfig } from './types.js';

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
  | 'ultimate'
  | 'pente'
  | 'qubic'
  | 'quantum'
  | 'gomoku-pro'
  | 'connect4'
  | 'wild'
  | 'wild-4'
  | 'order-chaos'
  | 'obstacles'
  | 'powers';

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
    // Solved: two careful players always draw, so a ladder on it would only
    // measure who blunders first.
    ranked: false,
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
    // Freestyle gomoku is a proven first-player win; the ladder lives on Gomoku
    // Pro, whose opening rules take that edge away.
    ranked: false,
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
    // Solved like the classic board it is played on.
    ranked: false,
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
  {
    id: 'pente',
    name: 'Pente',
    tagline: 'Five in a row — or five captured pairs',
    rules: [
      'Take turns placing your mark on any empty point of a 13×13 board.',
      'Flank exactly two of your opponent’s marks in a line — X O O X — and you capture them: they leave the board.',
      'Only the mark you place captures. Moving into a flanked spot yourself is safe.',
      'Win with five in a row, or by capturing five pairs.',
    ],
    config: { variant: 'pente', size: 13, winLength: 5 },
    group: 'variant',
    ranked: false,
    clock: { initialSeconds: 420, incrementSeconds: 8 },
  },
  {
    id: 'qubic',
    name: 'Qubic',
    tagline: 'Four in a row inside a 4×4×4 cube',
    rules: [
      'The board is a cube: four layers of 4×4, stacked.',
      'Take turns placing your mark in any empty cell of any layer.',
      'Get four in a row — within a layer, straight down through all four layers, or diagonally through the cube.',
      'There are 76 lines. Threats in two layers at once are how games are won.',
    ],
    config: { variant: 'qubic', size: 8, winLength: 4 },
    group: 'variant',
    ranked: false,
    clock: { initialSeconds: 300, incrementSeconds: 5 },
  },
  {
    id: 'quantum',
    name: 'Quantum',
    tagline: 'Every mark is in two places at once',
    rules: [
      'Each move puts one spooky mark in two different squares at once, numbered by the move.',
      'When the spooky marks form a closed loop, the loop collapses: the other player chooses where the newest mark really is, and every mark on the loop settles into one square.',
      'Collapsed marks are ordinary marks. Three of yours in a row wins.',
      'If one collapse makes lines for both players, the line whose newest mark is older wins.',
    ],
    config: { variant: 'quantum', size: 3, winLength: 3 },
    group: 'variant',
    ranked: false,
    clock: { initialSeconds: 240, incrementSeconds: 5 },
  },
  {
    id: 'gomoku-pro',
    name: 'Gomoku Pro',
    tagline: 'Exactly five on 15×15, with the swap',
    rules: [
      'Take turns placing your mark on any empty point.',
      'Get exactly five in a row to win. Six or more in a line does not count.',
      'Swap rule: after the first mark, the second player may take it as their own instead of replying. The opener then moves again.',
      'So open with a mark you would be happy to play either side of.',
    ],
    config: { variant: 'gomoku', size: 15, winLength: 5, exact: true, opening: 'swap' },
    group: 'large',
    ranked: true,
    clock: { initialSeconds: 600, incrementSeconds: 10 },
  },
  {
    id: 'connect4',
    name: 'Connect Four',
    tagline: 'Drop discs — four in a row on 7×6',
    rules: [
      'Pick one of the seven columns. Your disc drops to the lowest empty slot in it.',
      'Get four of your discs in a row — across, down or diagonally.',
      'Each column holds six discs. A full board with no line is a draw.',
      'Swap rule: after the first disc, the second player may take it as their own.',
    ],
    config: { variant: 'connect4', size: 7, winLength: 4, opening: 'swap' },
    group: 'variant',
    ranked: false,
    clock: { initialSeconds: 300, incrementSeconds: 5 },
  },
  {
    id: 'wild',
    name: 'Wild',
    tagline: 'Place X or O — any line wins for you',
    rules: [
      'On your turn, choose X or O, then place it on an empty square.',
      'Complete three in a row of either mark and you win — whoever made the line.',
      'Every two-in-a-row is a gift to the next player. Leave none behind.',
      'A full board with no line is a draw.',
    ],
    config: { variant: 'wild', size: 3, winLength: 3 },
    group: 'variant',
    ranked: false,
    clock: { initialSeconds: 120, incrementSeconds: 3 },
  },
  {
    id: 'wild-4',
    name: 'Wild 4',
    tagline: 'Wild rules — four in a row on 4×4',
    rules: [
      'On your turn, choose X or O, then place it on an empty square.',
      'Complete four in a row of either mark and you win.',
      'Three alike with a gap is a win waiting for the next player. Spoil lines with the other mark.',
      'A full board with no line is a draw.',
    ],
    config: { variant: 'wild', size: 4, winLength: 4 },
    group: 'variant',
    ranked: false,
    clock: { initialSeconds: 150, incrementSeconds: 3 },
  },
  {
    id: 'order-chaos',
    name: 'Order & Chaos',
    tagline: 'One builds five alike, one spoils it',
    rules: [
      'One player is Order, the other is Chaos. Both may place an X or an O on any empty square.',
      'Order wins as soon as five identical marks stand in a row — whoever placed the last one.',
      'Chaos wins if the board fills up without one. There are no draws.',
      'Order sits in the X seat and Chaos in the O seat — the marks themselves belong to nobody.',
    ],
    config: { variant: 'order-chaos', size: 6, winLength: 5 },
    group: 'variant',
    ranked: false,
    clock: { initialSeconds: 300, incrementSeconds: 5 },
  },
  {
    id: 'obstacles',
    name: 'Obstacles',
    tagline: 'Five in a row around rocks on 9×9',
    rules: [
      'A few squares are rocks: nobody can play on them and no line passes through.',
      'Take turns placing your mark on an empty square.',
      'Get five of your marks in a row — across, down or diagonally.',
      'Every game scatters the rocks differently, always in a balanced pattern.',
    ],
    config: { variant: 'obstacles', size: 9, winLength: 5 },
    group: 'variant',
    ranked: false,
    clock: { initialSeconds: 300, incrementSeconds: 5 },
  },
  {
    id: 'powers',
    name: 'Powers',
    tagline: 'Five in a row with a bomb and a wall',
    rules: [
      'Take turns placing your mark. Five in a row wins, on a 9×9 board.',
      'Once per game you may use a Bomb instead of placing: remove any one of your opponent’s marks.',
      'Once per game you may build a Wall instead: block an empty square for good.',
      'Using a power is your whole turn.',
    ],
    config: { variant: 'powers', size: 9, winLength: 5 },
    group: 'variant',
    ranked: false,
    clock: { initialSeconds: 360, incrementSeconds: 6 },
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
  return `${variantName(config)} ${config.size}×${config.size} · ${config.winLength} in a row`;
}

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
