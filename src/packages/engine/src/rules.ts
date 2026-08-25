import { colOf, rowOf } from './board.js';
import {
  type Board,
  type BoardSize,
  Empty,
  type Player,
  WIN_LENGTH,
  type WinLine,
} from './types.js';

/** Horizontal, vertical, and both diagonals as [rowStep, colStep] pairs. */
const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const;

/**
 * Look for a winning run through `index`.
 *
 * Scanning outward from the move just played is what keeps the AI search cheap:
 * it costs O(4 * winLength) instead of re-testing every line on the board, and a
 * board can only ever be won by the line that runs through the newest mark.
 *
 * Returns the full contiguous run (which may be longer than the win length)
 * ordered from one end to the other, or `null` if `index` is not part of a win.
 */
export function findWinLineFrom(board: Board, size: BoardSize, index: number): WinLine | null {
  const player = board[index];
  if (player === undefined || player === Empty) return null;

  const need = WIN_LENGTH[size];
  const row = rowOf(size, index);
  const col = colOf(size, index);

  for (const [dRow, dCol] of DIRECTIONS) {
    // Walk backwards to the start of the run, then forwards to its end.
    let startRow = row;
    let startCol = col;
    while (isPlayerAt(board, size, startRow - dRow, startCol - dCol, player)) {
      startRow -= dRow;
      startCol -= dCol;
    }

    const run: number[] = [];
    let r = startRow;
    let c = startCol;
    while (isPlayerAt(board, size, r, c, player)) {
      run.push(r * size + c);
      r += dRow;
      c += dCol;
    }

    if (run.length >= need) return run;
  }

  return null;
}

/**
 * Scan the whole board for a winning run. Slower than {@link findWinLineFrom};
 * use it when there is no trusted "last move" - validating a board received
 * over the network, or checking a hand-built position in a test.
 */
export function findAnyWinLine(
  board: Board,
  size: BoardSize,
): { player: Player; line: WinLine } | null {
  for (let index = 0; index < board.length; index++) {
    const cell = board[index];
    if (cell === undefined || cell === Empty) continue;
    const line = findWinLineFrom(board, size, index);
    if (line) return { player: cell, line };
  }
  return null;
}

/** True when placing `player` at `index` would immediately win. Does not mutate `board`. */
export function isWinningMove(
  board: Board,
  size: BoardSize,
  index: number,
  player: Player,
): boolean {
  if (board[index] !== Empty) return false;
  board[index] = player;
  const line = findWinLineFrom(board, size, index);
  board[index] = Empty;
  return line !== null;
}

function isPlayerAt(
  board: Board,
  size: BoardSize,
  row: number,
  col: number,
  player: Player,
): boolean {
  if (row < 0 || row >= size || col < 0 || col >= size) return false;
  return board[row * size + col] === player;
}
