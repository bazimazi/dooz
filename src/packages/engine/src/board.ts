import { type Board, type BoardSize, type Cell, Empty } from './types.js';

export function createBoard(size: BoardSize): Board {
  return Array.from<Cell>({ length: size * size }).fill(Empty);
}

export function indexOf(size: BoardSize, row: number, col: number): number {
  return row * size + col;
}

export function rowOf(size: BoardSize, index: number): number {
  return Math.floor(index / size);
}

export function colOf(size: BoardSize, index: number): number {
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
