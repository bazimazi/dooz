import { type Board, Empty, O, type Player } from '../types.js';

/**
 * Zobrist hashing: each (cell, player) pair gets a fixed random value, and a
 * position's hash is the XOR of the values for every mark on it.
 *
 * XOR is its own inverse, so making and unmaking a move during search is a
 * single XOR rather than a rescan of the board - which is what makes the
 * transposition table cheap enough to be worth having.
 *
 * Two independent 32-bit hashes are kept. The first indexes the table, the
 * second is stored alongside each entry and verified on lookup, so an index
 * collision cannot silently return another position's score.
 */
export interface Zobrist {
  readonly primary: Int32Array;
  readonly secondary: Int32Array;
  readonly sidePrimary: number;
  readonly sideSecondary: number;
  /** Extra values for state that is not a mark - Ultimate's active sub-board. */
  readonly auxPrimary: Int32Array;
  readonly auxSecondary: Int32Array;
}

const cache = new Map<number, Zobrist>();

/** `cells` is the board's cell count; tables are shared by every board that size. */
export function zobristFor(cells: number): Zobrist {
  const cached = cache.get(cells);
  if (cached) return cached;

  // Seeded so a given position always hashes the same way across runs, which
  // keeps AI behaviour reproducible in tests.
  const random = mulberry32(0x9e37_79b9 ^ cells);
  const primary = new Int32Array(cells * 2);
  const secondary = new Int32Array(cells * 2);

  for (let i = 0; i < cells * 2; i++) {
    primary[i] = (random() * 0x1_0000_0000) | 0;
    secondary[i] = (random() * 0x1_0000_0000) | 0;
  }

  // 16 is comfortably more than the 10 states Ultimate's active board has, and
  // leaves room for any later variant that needs a few of its own.
  const auxPrimary = new Int32Array(16);
  const auxSecondary = new Int32Array(16);
  for (let i = 0; i < 16; i++) {
    auxPrimary[i] = (random() * 0x1_0000_0000) | 0;
    auxSecondary[i] = (random() * 0x1_0000_0000) | 0;
  }

  const table: Zobrist = {
    primary,
    secondary,
    sidePrimary: (random() * 0x1_0000_0000) | 0,
    sideSecondary: (random() * 0x1_0000_0000) | 0,
    auxPrimary,
    auxSecondary,
  };
  cache.set(cells, table);
  return table;
}

export function slot(index: number, player: Player): number {
  return index * 2 + (player - 1);
}

export function hashBoard(
  board: Board,
  sideToMove: Player,
): { primary: number; secondary: number } {
  const table = zobristFor(board.length);
  let primary = 0;
  let secondary = 0;

  for (let index = 0; index < board.length; index++) {
    const cell = board[index];
    if (cell === undefined || cell === Empty) continue;
    const key = slot(index, cell);
    primary ^= table.primary[key] ?? 0;
    secondary ^= table.secondary[key] ?? 0;
  }

  if (sideToMove === O) {
    primary ^= table.sidePrimary;
    secondary ^= table.sideSecondary;
  }

  return { primary, secondary };
}

/** Small, fast, seedable PRNG. Only used to fill the hash tables. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b_79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}
