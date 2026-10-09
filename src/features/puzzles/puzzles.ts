import {
  applyMove,
  type GameState,
  isModeId,
  modeById,
  type ModeId,
  type Player,
  replay,
} from '@/game/engine';
import pack from './pack.json';

/**
 * The puzzle pack: positions where the side to move can force a win.
 *
 * Every puzzle was found and proved by the generator in
 * `scripts/bench/puzzles.ts`, which also recorded the defence, so
 * nothing is searched at runtime - the board plays back the stored line and
 * checks each answer against the stored set of accepted moves.
 *
 * The pack is still checked on load: a puzzle whose moves do not replay, or
 * whose line does not end in a win, is dropped rather than shown. A broken
 * puzzle that cannot be solved is worse than one fewer puzzle.
 */
export interface Puzzle {
  readonly id: string;
  readonly mode: ModeId;
  readonly startingPlayer: Player;
  /** The moves that lead to the puzzle, from an empty board. */
  readonly moves: readonly number[];
  /** Moves the solver needs, counting only their own. */
  readonly mateIn: number;
  /** Solver, defender, solver … solver. The defence is the stored one. */
  readonly line: readonly number[];
  /** Accepted answers at each of the solver's steps. */
  readonly accept: readonly (readonly number[])[];
  readonly tier: 1 | 2 | 3;
  readonly theme?: string;
  /** Position number within the pack, for "Puzzle 12". */
  readonly number: number;
}

function isNumberList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((entry) => Number.isInteger(entry));
}

function validate(entry: unknown, number: number): Puzzle | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const raw = entry as Record<string, unknown>;
  const { id, mode, startingPlayer, moves, mateIn, line, accept, tier, theme } = raw;

  if (typeof id !== 'string' || !isModeId(mode)) return null;
  if (startingPlayer !== 1 && startingPlayer !== 2) return null;
  if (!isNumberList(moves) || !isNumberList(line)) return null;
  if (typeof mateIn !== 'number' || line.length !== mateIn * 2 - 1) return null;
  if (!Array.isArray(accept) || accept.length !== mateIn || !accept.every(isNumberList)) {
    return null;
  }
  if (tier !== 1 && tier !== 2 && tier !== 3) return null;

  // The position has to exist, be live, and the line has to win it.
  let game = replay(modeById(mode).config, startingPlayer, moves);
  if (!game || game.status !== 'playing') return null;
  const solver = game.currentPlayer;
  for (const move of line) {
    const next = applyMove(game, move);
    if (!next) return null;
    game = next;
  }
  if (game.status !== 'won' || game.winner !== solver) return null;

  return {
    id,
    mode,
    startingPlayer,
    moves,
    mateIn,
    line,
    accept,
    tier,
    ...(typeof theme === 'string' ? { theme } : {}),
    number,
  };
}

const entries: unknown[] = Array.isArray((pack as { puzzles?: unknown }).puzzles)
  ? (pack as { puzzles: unknown[] }).puzzles
  : [];

export const PUZZLES: readonly Puzzle[] = entries
  .map((entry, at) => validate(entry, at + 1))
  .filter((puzzle): puzzle is Puzzle => puzzle !== null);

export function puzzleById(id: string): Puzzle | undefined {
  return PUZZLES.find((puzzle) => puzzle.id === id);
}

/** The puzzle's starting position. */
export function puzzleStart(puzzle: Puzzle): GameState {
  return replay(modeById(puzzle.mode).config, puzzle.startingPlayer, puzzle.moves)!;
}

/**
 * The order the daily puzzles come round in.
 *
 * A fixed shuffle rather than pack order, which is sorted by difficulty -
 * walking it day by day would be a month of easy ones followed by a month of
 * hard ones. The seed is a constant so every player gets the same puzzle on
 * the same day, which is what makes it a daily rather than a random one.
 */
const DAILY_ORDER: readonly Puzzle[] = (() => {
  const order = [...PUZZLES];
  let state = 0x0d00_2da1;
  const random = () => {
    state = (state + 0x6d2b_79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
  };
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
})();

/** The puzzle for day number `day` (see `dayNumber`). */
export function dailyPuzzle(day: number): Puzzle | undefined {
  if (DAILY_ORDER.length === 0) return undefined;
  return DAILY_ORDER[((day % DAILY_ORDER.length) + DAILY_ORDER.length) % DAILY_ORDER.length];
}

export const TIER_NAMES: Record<Puzzle['tier'], string> = {
  1: 'Easy',
  2: 'Medium',
  3: 'Hard',
};

const THEME_NAMES: Record<string, string> = {
  fork: 'Fork',
  'double-four': 'Double four',
  'four-three': 'Four-three',
  'open-three': 'Open three',
  'open-four': 'Open four',
  'quiet-move': 'Quiet move',
  'forcing-line': 'Forcing line',
  stack: 'Stacked threats',
  zugzwang: 'Zugzwang',
  'vanish-tempo': 'Vanishing act',
  'win-in-one': 'Spot the win',
};

export function themeName(theme: string | undefined): string | null {
  if (!theme) return null;
  return THEME_NAMES[theme] ?? theme.replace(/-/g, ' ');
}
