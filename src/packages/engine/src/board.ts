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
// Gravity geometry
// ---------------------------------------------------------------------------

/**
 * Where a mark dropped into `col` comes to rest, or `-1` for a full column.
 *
 * Row 0 is the top of the board, so a mark falls towards the highest row
 * number and stops on the first square with something under it.
 */
export function gravityLanding(board: Board, size: number, col: number): number {
  if (col < 0 || col >= size) return -1;
  for (let row = size - 1; row >= 0; row--) {
    const index = row * size + col;
    if (board[index] === Empty) return index;
  }
  return -1;
}

/**
 * Every square a mark can land on right now, one per column that has room.
 *
 * Ascending, which on a row-major board is also top-to-bottom - the order the
 * rest of the engine reports legal moves in.
 */
export function gravityMoves(board: Board, size: number): number[] {
  const moves: number[] = [];
  for (let col = 0; col < size; col++) {
    const landing = gravityLanding(board, size, col);
    if (landing >= 0) moves.push(landing);
  }
  return moves.toSorted((a, b) => a - b);
}

/** True when `index` is empty and resting on the floor or on another mark. */
export function isGravityLanding(board: Board, size: number, index: number): boolean {
  if (board[index] !== Empty) return false;
  const below = index + size;
  return below >= board.length || board[below] !== Empty;
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
