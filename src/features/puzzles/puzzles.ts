import {
  applyMove,
  type GameState,
  isModeId,
  modeById,
  type ModeId,
  type Player,
  replay,
} from '@/game/engine';
import { useEffect, useState } from 'react';
import catalogue from './index.json';

/**
 * The puzzle pack: positions where the side to move can force a win.
 *
 * Every puzzle was found and proved by the generator in
 * `scripts/bench/puzzles.ts`, which also recorded the defence, so
 * nothing is searched at runtime - the board plays back the stored line and
 * checks each answer against the stored set of accepted moves.
 *
 * The pack comes in two parts. `index.json` is a line per puzzle - its id,
 * mode, length, tier and rating - small enough to ship with the home screen,
 * which only needs today's puzzle's name. `pack.json` holds the positions and
 * the lines, hundreds of them, and is loaded only by the screens that play
 * them.
 *
 * The full pack is still checked on load: a puzzle whose moves do not replay,
 * or whose line does not end in a win, is dropped rather than shown. A broken
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
  /**
   * Solver, defender, solver … solver. The defence is the stored one. Under
   * misère, where a win is the defender being forced to complete a line, it
   * ends one move later, on that forced move.
   */
  readonly line: readonly number[];
  /** Accepted answers at each of the solver's steps. */
  readonly accept: readonly (readonly number[])[];
  readonly tier: 1 | 2 | 3;
  readonly theme?: string;
  /** Difficulty from 1 to 100 across the whole pack, for escalating a rush. */
  readonly rating: number;
  /** Position number within the pack, for "Puzzle 12". */
  readonly number: number;
}

/** What the index knows about a puzzle: enough to list it, not to play it. */
export type PuzzleSummary = Pick<
  Puzzle,
  'id' | 'mode' | 'mateIn' | 'tier' | 'theme' | 'rating' | 'number'
>;

function isNumberList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((entry) => Number.isInteger(entry));
}

/** Whether a mode's puzzles end on the defender's forced move rather than the solver's. */
export function endsOnDefence(mode: ModeId): boolean {
  return modeById(mode).config.variant === 'misere';
}

function validate(entry: unknown, number: number): Puzzle | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const raw = entry as Record<string, unknown>;
  const { id, mode, startingPlayer, moves, mateIn, line, accept, tier, theme, rating } = raw;

  if (typeof id !== 'string' || !isModeId(mode)) return null;
  if (startingPlayer !== 1 && startingPlayer !== 2) return null;
  if (!isNumberList(moves) || !isNumberList(line)) return null;
  if (typeof mateIn !== 'number' || mateIn < 1) return null;
  if (line.length !== mateIn * 2 - (endsOnDefence(mode) ? 0 : 1)) return null;
  if (!Array.isArray(accept) || accept.length !== mateIn || !accept.every(isNumberList)) {
    return null;
  }
  if (tier !== 1 && tier !== 2 && tier !== 3) return null;

  // The position has to exist, be live, and the line has to win it.
  let game = replay(modeById(mode).config, startingPlayer, moves);
  if (!game || game.status !== 'playing') return null;
  const solver = game.currentPlayer;
  for (const move of line) {
    if (game.status !== 'playing') return null;
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
    rating: typeof rating === 'number' ? Math.min(100, Math.max(1, Math.round(rating))) : 50,
    number,
  };
}

// ---------------------------------------------------------------------------
// The index, which ships with the app
// ---------------------------------------------------------------------------

function summarise(row: unknown, at: number): PuzzleSummary | null {
  if (!Array.isArray(row)) return null;
  const [id, mode, mateIn, tier, theme, rating] = row as unknown[];
  if (typeof id !== 'string' || !isModeId(mode) || typeof mateIn !== 'number') return null;
  if (tier !== 1 && tier !== 2 && tier !== 3) return null;
  return {
    id,
    mode,
    mateIn,
    tier,
    ...(typeof theme === 'string' ? { theme } : {}),
    rating: typeof rating === 'number' ? rating : 50,
    number: at + 1,
  };
}

const rows: unknown[] = Array.isArray((catalogue as { puzzles?: unknown }).puzzles)
  ? (catalogue as { puzzles: unknown[] }).puzzles
  : [];

/** Every puzzle in the pack, in pack order: easiest tier first. */
export const PUZZLE_INDEX: readonly PuzzleSummary[] = rows
  .map((row, at) => summarise(row, at))
  .filter((summary): summary is PuzzleSummary => summary !== null);

// ---------------------------------------------------------------------------
// The full pack, loaded on demand
// ---------------------------------------------------------------------------

let packPromise: Promise<readonly Puzzle[]> | null = null;

/** The whole pack, validated. Loaded once and shared. */
export function loadPuzzles(): Promise<readonly Puzzle[]> {
  packPromise ??= import('./pack.json')
    .then((module) => {
      const pack = (module as { default?: unknown }).default ?? module;
      const entries = Array.isArray((pack as { puzzles?: unknown }).puzzles)
        ? (pack as { puzzles: unknown[] }).puzzles
        : [];
      return entries
        .map((entry, at) => validate(entry, at + 1))
        .filter((puzzle): puzzle is Puzzle => puzzle !== null);
    })
    .catch(() => {
      // A failed chunk (offline before it was cached) may load next time.
      packPromise = null;
      return [];
    });
  return packPromise;
}

/** The puzzle `id` names - a pack id, or a pack id turned by a symmetry. */
export async function loadPuzzle(id: string): Promise<Puzzle | undefined> {
  const { base, turn } = parseId(id);
  const puzzle = (await loadPuzzles()).find((entry) => entry.id === base);
  if (!puzzle) return undefined;
  return turn === 0 ? puzzle : (transformPuzzle(puzzle, turn) ?? undefined);
}

/** The whole pack as React state: loading at first, then the list. */
export function usePuzzlePack(): readonly Puzzle[] | null {
  const [pack, setPack] = useState<readonly Puzzle[] | null>(null);
  useEffect(() => {
    let live = true;
    void loadPuzzles().then((loaded) => {
      if (live) setPack(loaded);
      return undefined;
    });
    return () => {
      live = false;
    };
  }, []);
  return pack;
}

/** One puzzle as React state: undefined while loading, null when there is none. */
export function usePuzzle(id: string): Puzzle | null | undefined {
  const [loaded, setLoaded] = useState<{ id: string; puzzle: Puzzle | null } | null>(null);
  useEffect(() => {
    let live = true;
    void loadPuzzle(id).then((puzzle) => {
      if (live) setLoaded({ id, puzzle: puzzle ?? null });
      return undefined;
    });
    return () => {
      live = false;
    };
  }, [id]);
  return loaded?.id === id ? loaded.puzzle : undefined;
}

/** The puzzle's starting position. */
export function puzzleStart(puzzle: Puzzle): GameState {
  return replay(modeById(puzzle.mode).config, puzzle.startingPlayer, puzzle.moves)!;
}

// ---------------------------------------------------------------------------
// Symmetry
// ---------------------------------------------------------------------------

/**
 * Turns of the board a mode's puzzles stay true under.
 *
 * A forced win rotated or reflected is the same forced win, so a proven
 * puzzle turned by one of the square's eight symmetries is a proven puzzle
 * too - which is how the daily puzzle goes round the pack again without
 * repeating itself. Gravity can only be mirrored left to right: turned over,
 * marks would fall the other way. Ultimate's small boards map onto small
 * boards under every symmetry, and so do the squares within them, so where a
 * move sends the opponent turns with it.
 */
export function turnsFor(mode: ModeId): readonly number[] {
  const { variant } = modeById(mode).config;
  if (variant === 'gravity') return [0, 4];
  if (['classic', 'gomoku', 'misere', 'vanish', 'ultimate'].includes(variant)) {
    return [0, 1, 2, 3, 4, 5, 6, 7];
  }
  return [0];
}

/** Where `cell` lands under turn `turn` of a `size` board. */
export function turnCell(cell: number, size: number, turn: number): number {
  let row = Math.floor(cell / size);
  let col = cell % size;
  if (turn & 1) [row, col] = [col, row];
  if (turn & 2) row = size - 1 - row;
  if (turn & 4) col = size - 1 - col;
  return row * size + col;
}

const TURN_SEPARATOR = '~';

function parseId(id: string): { base: string; turn: number } {
  const at = id.lastIndexOf(TURN_SEPARATOR);
  if (at < 0) return { base: id, turn: 0 };
  const turn = Number(id.slice(at + 1));
  return Number.isInteger(turn) && turn >= 0 && turn < 8
    ? { base: id.slice(0, at), turn }
    : { base: id, turn: 0 };
}

/** `puzzle` turned by `turn`, or null if its mode does not allow that turn. */
export function transformPuzzle(puzzle: Puzzle, turn: number): Puzzle | null {
  if (!turnsFor(puzzle.mode).includes(turn)) return null;
  const { size } = modeById(puzzle.mode).config;
  const map = (cell: number) => turnCell(cell, size, turn);
  return validate(
    {
      ...puzzle,
      id: `${puzzle.id}${TURN_SEPARATOR}${turn}`,
      moves: puzzle.moves.map(map),
      line: puzzle.line.map(map),
      // Kept in board order, as the generator writes them.
      accept: puzzle.accept.map((step) => step.map(map).toSorted((a, b) => a - b)),
    },
    puzzle.number,
  );
}

// ---------------------------------------------------------------------------
// The daily puzzle
// ---------------------------------------------------------------------------

/**
 * The order the daily puzzles come round in.
 *
 * A fixed shuffle rather than pack order, which is sorted by difficulty -
 * walking it day by day would be a month of easy ones followed by a month of
 * hard ones. The seed is a constant so every player gets the same puzzle on
 * the same day, which is what makes it a daily rather than a random one.
 */
const DAILY_ORDER: readonly PuzzleSummary[] = (() => {
  const order = [...PUZZLE_INDEX];
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

/**
 * The puzzle for day number `day` (see `dayNumber`).
 *
 * Each pass through the pack shows every puzzle once; the next pass shows
 * them again turned by another of the board's symmetries, so a player who
 * remembers last year's answer still has to find it on a different square.
 * With the pack this size a pass alone is longer than a year.
 */
export function dailyPuzzle(day: number): PuzzleSummary | undefined {
  const count = DAILY_ORDER.length;
  if (count === 0) return undefined;
  const at = ((day % count) + count) % count;
  const pass = Math.floor(day / count);
  const summary = DAILY_ORDER[at]!;
  const turns = turnsFor(summary.mode);
  const turn = turns[((pass % turns.length) + turns.length) % turns.length] ?? 0;
  return turn === 0 ? summary : { ...summary, id: `${summary.id}${TURN_SEPARATOR}${turn}` };
}

// Tier and theme names are translated: see `tierName` and `themeName` in
// `@/i18n/messages/puzzles`.
