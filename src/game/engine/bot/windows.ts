import { DIRECTIONS } from '../rules.js';

/**
 * Every straight run of `winLength` cells on a board of `size`, plus the cell
 * just off each end of it.
 *
 * These windows are the only groups of cells that can ever produce a win, so
 * the evaluation only has to look at them. The flanks are what let it tell an
 * open three - which threatens at both ends and has to be answered now - from a
 * closed one that is already half dead, and that distinction is most of the
 * difference between an AI that plays gomoku and one that shuffles stones
 * around.
 *
 * Everything is stored flat in typed arrays and built once per (size, run)
 * pair. A 15x15 board has 1,300 windows and the search evaluates thousands of
 * positions a second, so an array of arrays here is measurable.
 */
export interface WindowTable {
  readonly size: number;
  readonly winLength: number;
  readonly count: number;
  /** `cells[w * winLength + k]` is the k-th cell of window `w`. */
  readonly cells: Int32Array;
  /** `flanks[w * 2]` and `+ 1`: the cells past each end, or -1 off the board. */
  readonly flanks: Int32Array;
  /** Windows each cell belongs to, flattened. See `windowsOf`. */
  readonly byCellStart: Int32Array;
  readonly byCellIndex: Int32Array;
}

const cache = new Map<string, WindowTable>();

export function windowTable(size: number, winLength: number): WindowTable {
  const key = `${size}:${winLength}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const cells: number[] = [];
  const flanks: number[] = [];
  const perCell: number[][] = Array.from({ length: size * size }, () => []);
  let count = 0;

  const inBoard = (row: number, col: number) => row >= 0 && row < size && col >= 0 && col < size;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      for (const [dRow, dCol] of DIRECTIONS) {
        const endRow = row + dRow * (winLength - 1);
        const endCol = col + dCol * (winLength - 1);
        if (!inBoard(endRow, endCol)) continue;

        for (let k = 0; k < winLength; k++) {
          const cell = (row + dRow * k) * size + (col + dCol * k);
          cells.push(cell);
          perCell[cell]?.push(count);
        }

        const beforeRow = row - dRow;
        const beforeCol = col - dCol;
        const afterRow = endRow + dRow;
        const afterCol = endCol + dCol;
        flanks.push(
          inBoard(beforeRow, beforeCol) ? beforeRow * size + beforeCol : -1,
          inBoard(afterRow, afterCol) ? afterRow * size + afterCol : -1,
        );
        count++;
      }
    }
  }

  // Compressed adjacency: one array of window ids, plus a start offset per
  // cell. `byCellStart` has one extra entry so the last cell's range closes.
  const byCellStart = new Int32Array(size * size + 1);
  for (let cell = 0; cell < size * size; cell++) {
    byCellStart[cell + 1] = (byCellStart[cell] ?? 0) + (perCell[cell]?.length ?? 0);
  }
  const byCellIndex = new Int32Array(byCellStart[size * size] ?? 0);
  for (let cell = 0; cell < size * size; cell++) {
    const start = byCellStart[cell] ?? 0;
    const list = perCell[cell] ?? [];
    for (let k = 0; k < list.length; k++) byCellIndex[start + k] = list[k] ?? 0;
  }

  const table: WindowTable = {
    size,
    winLength,
    count,
    cells: Int32Array.from(cells),
    flanks: Int32Array.from(flanks),
    byCellStart,
    byCellIndex,
  };
  cache.set(key, table);
  return table;
}

/** Calls `visit` with the id of every window `cell` belongs to. */
export function forEachWindowOf(
  table: WindowTable,
  cell: number,
  visit: (windowId: number) => void,
): void {
  const start = table.byCellStart[cell] ?? 0;
  const end = table.byCellStart[cell + 1] ?? start;
  for (let i = start; i < end; i++) visit(table.byCellIndex[i] ?? 0);
}
