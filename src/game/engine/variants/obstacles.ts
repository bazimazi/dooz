import { colOf, rowOf } from '../board.js';
import type { GameConfig } from '../types.js';

/**
 * Where an Obstacles game's blocked squares go.
 *
 * Read from the config's seed, so a game's obstacles are part of its rules
 * rather than of its moves: a replay, the server and both clients all rebuild
 * the same board from the same config. The layout is point-symmetric through
 * the centre, which keeps it fair - whatever one side of the board gains from
 * a rock, the opposite side gains from its twin - and it keeps away from the
 * middle, where the opening is played and a rock would decide too much.
 */

/** Chebyshev distance from the centre an obstacle must keep. */
const CLEAR_CENTRE = 2;

/** Obstacles per board: one per ten squares, in pairs. */
export function obstacleCount(size: number): number {
  return Math.round((size * size) / 20) * 2;
}

/** The blocked squares for `config`, ascending. An absent seed reads as 0. */
export function obstacleCells(config: GameConfig): number[] {
  const { size } = config;
  const cells = size * size;
  const random = mulberry32(config.seed ?? 0);
  const mid = Math.floor(size / 2);
  const chosen = new Set<number>();
  const wanted = obstacleCount(size);

  const clearOfCentre = (cell: number) =>
    Math.max(Math.abs(rowOf(size, cell) - mid), Math.abs(colOf(size, cell) - mid)) >= CLEAR_CENTRE;

  // Rocks never touch, not even at a corner: a wall of them would cut the
  // board in two, and a clump reads as one big obstacle rather than several.
  const crowded = (cell: number) => {
    for (const other of chosen) {
      if (
        Math.abs(rowOf(size, cell) - rowOf(size, other)) <= 1 &&
        Math.abs(colOf(size, cell) - colOf(size, other)) <= 1
      ) {
        return true;
      }
    }
    return false;
  };

  // Bounded rather than "until done", so an unlucky seed settles for fewer
  // rocks instead of looping; on the boards the variant allows it never has to.
  for (let attempt = 0; attempt < 400 && chosen.size < wanted; attempt++) {
    const cell = Math.floor(random() * cells);
    const twin = cells - 1 - cell;
    if (cell === twin || !clearOfCentre(cell)) continue;
    if (chosen.has(cell) || chosen.has(twin) || crowded(cell) || crowded(twin)) continue;
    // The twin may sit right next to the original near the middle of an edge.
    if (
      Math.abs(rowOf(size, cell) - rowOf(size, twin)) <= 1 &&
      Math.abs(colOf(size, cell) - colOf(size, twin)) <= 1
    ) {
      continue;
    }
    chosen.add(cell);
    chosen.add(twin);
  }

  return [...chosen].toSorted((a, b) => a - b);
}

/** Small, fast, seedable PRNG: the same seed always lays out the same board. */
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
