import type { Board, BoardSize, Player } from '../types.js';

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
}

const cache = new Map<BoardSize, Zobrist>();

export function zobristFor(size: BoardSize): Zobrist {
  const cached = cache.get(size);
  if (cached) return cached;

  // Seeded so a given position always hashes the same way across runs, which
  // keeps AI behaviour reproducible in tests.
  const random = mulberry32(0x9e3779b9 ^ size);
  const cells = size * size;
  const primary = new Int32Array(cells * 2);
  const secondary = new Int32Array(cells * 2);

  for (let i = 0; i < cells * 2; i++) {
    primary[i] = (random() * 0x1_0000_0000) | 0;
    secondary[i] = (random() * 0x1_0000_0000) | 0;
  }

  const table: Zobrist = {
    primary,
    secondary,
    sidePrimary: (random() * 0x1_0000_0000) | 0,
    sideSecondary: (random() * 0x1_0000_0000) | 0,
  };
  cache.set(size, table);
  return table;
}

export function slot(index: number, player: Player): number {
  return index * 2 + (player - 1);
}

export function hashBoard(
  board: Board,
  size: BoardSize,
  sideToMove: Player,
): { primary: number; secondary: number } {
  const table = zobristFor(size);
  let primary = 0;
  let secondary = 0;

  for (let index = 0; index < board.length; index++) {
    const cell = board[index];
    if (cell === undefined || cell === 0) continue;
    const key = slot(index, cell);
    primary ^= table.primary[key]!;
    secondary ^= table.secondary[key]!;
  }

  if (sideToMove === 2) {
    primary ^= table.sidePrimary;
    secondary ^= table.sideSecondary;
  }

  return { primary, secondary };
}

/** Small, fast, seedable PRNG. Only used to fill the hash tables. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}
