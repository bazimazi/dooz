import { describe, expect, it } from 'vitest';
import { createBoard } from './board.js';
import { findAnyWinLine, findWinLineFrom, isWinningMove } from './rules.js';
import { type Board, type BoardSize, O, X } from './types.js';

/** Build a board from a picture, e.g. `board(3, 'XX.', '.O.', 'O..')`. */
function board(size: BoardSize, ...rows: string[]): Board {
  const cells = createBoard(size);
  rows.forEach((row, r) => {
    Array.from(row).forEach((char, c) => {
      if (char === 'X') cells[r * size + c] = X;
      else if (char === 'O') cells[r * size + c] = O;
    });
  });
  return cells;
}

describe('findWinLineFrom', () => {
  it('finds a horizontal win on 3x3', () => {
    const cells = board(3, 'XXX', 'OO.', '...');
    expect(findWinLineFrom(cells, 3, 1)).toEqual([0, 1, 2]);
  });

  it('finds a vertical win on 3x3', () => {
    const cells = board(3, 'O..', 'OX.', 'OX.');
    expect(findWinLineFrom(cells, 3, 3)).toEqual([0, 3, 6]);
  });

  it('finds the main diagonal', () => {
    const cells = board(3, 'X..', 'OX.', 'O.X');
    expect(findWinLineFrom(cells, 3, 4)).toEqual([0, 4, 8]);
  });

  it('finds the anti-diagonal', () => {
    const cells = board(3, '..X', 'OX.', 'X.O');
    expect(findWinLineFrom(cells, 3, 4)).toEqual([2, 4, 6]);
  });

  it('returns null when the cell is not part of a win', () => {
    const cells = board(3, 'XX.', '.O.', '...');
    expect(findWinLineFrom(cells, 3, 0)).toBeNull();
  });

  it('returns null for an empty cell', () => {
    expect(findWinLineFrom(createBoard(3), 3, 4)).toBeNull();
  });

  it('needs four in a row on 6x6, not three', () => {
    const three = board(6, '.XXX..', '......', '......', '......', '......', '......');
    expect(findWinLineFrom(three, 6, 2)).toBeNull();

    const four = board(6, '.XXXX.', '......', '......', '......', '......', '......');
    expect(findWinLineFrom(four, 6, 2)).toEqual([1, 2, 3, 4]);
  });

  it('needs five in a row on 9x9', () => {
    const four = board(9, '....OOOO.', ...Array<string>(8).fill('.'.repeat(9)));
    expect(findWinLineFrom(four, 9, 5)).toBeNull();

    const five = board(9, '....OOOOO', ...Array<string>(8).fill('.'.repeat(9)));
    expect(findWinLineFrom(five, 9, 5)).toEqual([4, 5, 6, 7, 8]);
  });

  it('does not wrap around a row edge', () => {
    // Cells 2, 3, 4 are contiguous in the flat array but span two rows.
    const cells = board(3, '..X', 'XX.', '...');
    expect(findWinLineFrom(cells, 3, 3)).toBeNull();
  });

  it('reports the full run when it is longer than the win length', () => {
    const cells = board(6, 'XXXXX.', '......', '......', '......', '......', '......');
    expect(findWinLineFrom(cells, 6, 2)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('findAnyWinLine', () => {
  it('finds a win without being told where to look', () => {
    const cells = board(3, 'O.X', 'OXO', 'X..');
    expect(findAnyWinLine(cells, 3)).toEqual({ player: X, line: [2, 4, 6] });
  });

  it('returns null for a position with no winner', () => {
    expect(findAnyWinLine(board(3, 'XOX', 'XOO', 'OXX'), 3)).toBeNull();
  });
});

describe('isWinningMove', () => {
  it('detects a completing move and leaves the board untouched', () => {
    const cells = board(3, 'XX.', 'OO.', '...');
    const before = [...cells];
    expect(isWinningMove(cells, 3, 2, X)).toBe(true);
    expect(cells).toEqual(before);
  });

  it('rejects an occupied cell', () => {
    expect(isWinningMove(board(3, 'XX.', 'OO.', '...'), 3, 0, X)).toBe(false);
  });
});
