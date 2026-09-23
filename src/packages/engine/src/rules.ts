import { colOf, rowOf } from './board.js';
import { type Board, Empty, type Player, type WinLine } from './types.js';

/** Horizontal, vertical, and both diagonals as [rowStep, colStep] pairs. */
export const DIRECTIONS = [
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
export function findWinLineFrom(
  board: Board,
  size: number,
  index: number,
  winLength: number,
): WinLine | null {
  const player = board[index];
  if (player === undefined || player === Empty) return null;

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

    if (run.length >= winLength) return run;
  }

  return null;
}

/**
 * Whether a run of `winLength` passes through `index`, without building it.
 *
 * The allocation-free half of {@link findWinLineFrom}, for the search - which
 * asks this question at every node and never looks at the answer's contents.
 */
export function hasWinFrom(board: Board, size: number, index: number, winLength: number): boolean {
  const player = board[index];
  if (player === undefined || player === Empty) return false;

  const row = rowOf(size, index);
  const col = colOf(size, index);

  for (const [dRow, dCol] of DIRECTIONS) {
    let run = 1;
    for (
      let step = 1;
      isPlayerAt(board, size, row + dRow * step, col + dCol * step, player);
      step++
    ) {
      run++;
    }
    for (
      let step = 1;
      isPlayerAt(board, size, row - dRow * step, col - dCol * step, player);
      step++
    ) {
      run++;
    }
    if (run >= winLength) return true;
  }

  return false;
}

/**
 * Scan the whole board for a winning run. Slower than {@link findWinLineFrom};
 * use it when there is no trusted "last move" - checking a hand-built position,
 * or auditing a board that did not arrive one move at a time.
 */
export function findAnyWinLine(
  board: Board,
  size: number,
  winLength: number,
): { player: Player; line: WinLine } | null {
  for (let index = 0; index < board.length; index++) {
    const cell = board[index];
    if (cell === undefined || cell === Empty) continue;
    const line = findWinLineFrom(board, size, index, winLength);
    if (line) return { player: cell, line };
  }
  return null;
}

/**
 * True when placing `player` at `index` would immediately complete a run.
 *
 * Tries the move in place and takes it back. The board handed in is sometimes a
 * live `GameState.board`, so the mark must never be observable afterwards -
 * hence the restore on every path rather than only the winning one.
 */
export function isWinningMove(
  board: Board,
  size: number,
  index: number,
  player: Player,
  winLength: number,
): boolean {
  if (board[index] !== Empty) return false;

  board[index] = player;
  const won = hasWinFrom(board, size, index, winLength);
  board[index] = Empty;
  return won;
}

function isPlayerAt(board: Board, size: number, row: number, col: number, player: Player): boolean {
  if (row < 0 || row >= size || col < 0 || col >= size) return false;
  return board[row * size + col] === player;
}
