import { type Board, type BoardSize, Empty } from '../types.js';

/**
 * Empty cells worth considering: those within `radius` of a mark already on the
 * board.
 *
 * On a 9x9 board a naive search would branch 81 ways at the root and stay wide
 * for the whole tree. Play is inherently local - a mark far from every other
 * mark cannot join or block a line - so restricting to the neighbourhood keeps
 * the branching factor small enough to search several plies deep.
 *
 * On an empty board the only sensible move is the centre, so that is returned
 * directly.
 */
export function candidateMoves(board: Board, size: BoardSize, radius = 2): number[] {
  const occupied = board.some((cell) => cell !== Empty);
  if (!occupied) {
    const centre = Math.floor(size / 2);
    return [centre * size + centre];
  }

  const candidates: number[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const index = row * size + col;
      if (board[index] !== Empty) continue;
      if (hasNeighbour(board, size, row, col, radius)) candidates.push(index);
    }
  }

  // A board so full that nothing is within `radius` cannot happen while empty
  // cells exist, but fall back to every empty cell rather than returning none.
  if (candidates.length === 0) {
    for (let i = 0; i < board.length; i++) if (board[i] === Empty) candidates.push(i);
  }

  return candidates;
}

function hasNeighbour(
  board: Board,
  size: BoardSize,
  row: number,
  col: number,
  radius: number,
): boolean {
  const minRow = Math.max(0, row - radius);
  const maxRow = Math.min(size - 1, row + radius);
  const minCol = Math.max(0, col - radius);
  const maxCol = Math.min(size - 1, col + radius);

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      if (board[r * size + c] !== Empty) return true;
    }
  }
  return false;
}
