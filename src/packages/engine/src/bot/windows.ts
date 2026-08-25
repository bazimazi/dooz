import type { BoardSize } from '../types.js';
import { WIN_LENGTH } from '../types.js';

/**
 * Every straight run of `WIN_LENGTH` cells on the board, as flat indices.
 *
 * These are the only groups of cells that can ever produce a win, so the static
 * evaluation only has to look at them. Built once per board size and cached,
 * because the AI evaluates thousands of positions per move.
 */
const cache = new Map<BoardSize, readonly (readonly number[])[]>();

export function winWindows(size: BoardSize): readonly (readonly number[])[] {
  const cached = cache.get(size);
  if (cached) return cached;

  const need = WIN_LENGTH[size];
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ] as const;
  const windows: number[][] = [];

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      for (const [dRow, dCol] of directions) {
        const endRow = row + dRow * (need - 1);
        const endCol = col + dCol * (need - 1);
        if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;

        const window: number[] = [];
        for (let k = 0; k < need; k++) {
          window.push((row + dRow * k) * size + (col + dCol * k));
        }
        windows.push(window);
      }
    }
  }

  cache.set(size, windows);
  return windows;
}

/**
 * For each cell, the windows it belongs to. Lets the search re-score only the
 * windows a move actually touched instead of the whole board.
 */
const byCellCache = new Map<BoardSize, readonly (readonly number[])[]>();

export function windowsByCell(size: BoardSize): readonly (readonly number[])[] {
  const cached = byCellCache.get(size);
  if (cached) return cached;

  const windows = winWindows(size);
  const byCell: number[][] = Array.from({ length: size * size }, () => []);
  windows.forEach((window, windowIndex) => {
    for (const cell of window) byCell[cell]!.push(windowIndex);
  });

  byCellCache.set(size, byCell);
  return byCell;
}
