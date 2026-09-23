import { type Board, type Cell, Empty } from './types.js';

export function createBoard(size: number): Board {
  return Array.from<Cell>({ length: size * size }).fill(Empty);
}

export function indexOf(size: number, row: number, col: number): number {
  return row * size + col;
}

export function rowOf(size: number, index: number): number {
  return Math.floor(index / size);
}

export function colOf(size: number, index: number): number {
  return index % size;
}

export function isBoardFull(board: Board): boolean {
  return board.every((cell) => cell !== Empty);
}

export function emptyIndices(board: Board): number[] {
  const result: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === Empty) result.push(i);
  }
  return result;
}

export function countEmpty(board: Board): number {
  let total = 0;
  for (const cell of board) if (cell === Empty) total++;
  return total;
}

// ---------------------------------------------------------------------------
// Ultimate geometry
// ---------------------------------------------------------------------------

/**
 * Which of the nine sub-boards a cell of an Ultimate board belongs to.
 *
 * The flat board is row-major over the whole 9x9 grid, so a sub-board's cells
 * are not contiguous: board 0 is columns 0-2 of rows 0-2. Both directions are
 * needed constantly during play and search, so they are tabulated once.
 */
const ULTIMATE_SIZE = 9;

export function ultimateBoardOf(index: number): number {
  const row = Math.floor(index / ULTIMATE_SIZE);
  const col = index % ULTIMATE_SIZE;
  return Math.floor(row / 3) * 3 + Math.floor(col / 3);
}

/** Position of a cell within its own sub-board, 0-8. */
export function ultimateCellOf(index: number): number {
  const row = Math.floor(index / ULTIMATE_SIZE);
  const col = index % ULTIMATE_SIZE;
  return (row % 3) * 3 + (col % 3);
}

/** The nine flat board indices making up sub-board `board`, in reading order. */
export function ultimateCells(board: number): readonly number[] {
  return ULTIMATE_CELLS[board] ?? [];
}

const ULTIMATE_CELLS: readonly (readonly number[])[] = Array.from({ length: 9 }, (_, board) => {
  const baseRow = Math.floor(board / 3) * 3;
  const baseCol = (board % 3) * 3;
  const cells: number[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) cells.push((baseRow + r) * ULTIMATE_SIZE + baseCol + c);
  }
  return cells;
});
