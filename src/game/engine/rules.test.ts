import { describe, expect, it } from 'vitest';
import { createBoard } from './board.js';
import { findAnyWinLine, findWinLineFrom, hasWinFrom, isWinningMove } from './rules.js';
import { blank, board } from './testing.js';
import { O, X } from './types.js';

describe('findWinLineFrom', () => {
  it('finds a horizontal win on 3x3', () => {
    const cells = board(3, 'XXX', 'OO.', '...');
    expect(findWinLineFrom(cells, 3, 1, 3)).toEqual([0, 1, 2]);
  });

  it('finds a vertical win on 3x3', () => {
    const cells = board(3, 'O..', 'OX.', 'OX.');
    expect(findWinLineFrom(cells, 3, 3, 3)).toEqual([0, 3, 6]);
  });

  it('finds the main diagonal', () => {
    const cells = board(3, 'X..', 'OX.', 'O.X');
    expect(findWinLineFrom(cells, 3, 4, 3)).toEqual([0, 4, 8]);
  });

  it('finds the anti-diagonal', () => {
    const cells = board(3, '..X', 'OX.', 'X.O');
    expect(findWinLineFrom(cells, 3, 4, 3)).toEqual([2, 4, 6]);
  });

  it('returns null when the cell is not part of a win', () => {
    const cells = board(3, 'XX.', '.O.', '...');
    expect(findWinLineFrom(cells, 3, 0, 3)).toBeNull();
  });

  it('returns null for an empty cell', () => {
    expect(findWinLineFrom(createBoard(3), 3, 4, 3)).toBeNull();
  });

  it('needs four in a row on 6x6, not three', () => {
    const three = board(6, '.XXX..', ...Array<string>(5).fill(blank(6)));
    expect(findWinLineFrom(three, 6, 2, 4)).toBeNull();

    const four = board(6, '.XXXX.', ...Array<string>(5).fill(blank(6)));
    expect(findWinLineFrom(four, 6, 2, 4)).toEqual([1, 2, 3, 4]);
  });

  it('needs five in a row on 9x9', () => {
    const four = board(9, '....OOOO.', ...Array<string>(8).fill(blank(9)));
    expect(findWinLineFrom(four, 9, 5, 5)).toBeNull();

    const five = board(9, '....OOOOO', ...Array<string>(8).fill(blank(9)));
    expect(findWinLineFrom(five, 9, 5, 5)).toEqual([4, 5, 6, 7, 8]);
  });

  it('finds a diagonal run on a 15x15 board', () => {
    const rows = Array.from({ length: 15 }, (_, row) =>
      row >= 3 && row <= 7 ? `${'.'.repeat(row)}X${'.'.repeat(14 - row)}` : blank(15),
    );
    const cells = board(15, ...rows);
    expect(findWinLineFrom(cells, 15, 5 * 15 + 5, 5)).toEqual([
      3 * 15 + 3,
      4 * 15 + 4,
      5 * 15 + 5,
      6 * 15 + 6,
      7 * 15 + 7,
    ]);
  });

  it('does not wrap around a row edge', () => {
    // Cells 2, 3, 4 are contiguous in the flat array but span two rows.
    const cells = board(3, '..X', 'XX.', '...');
    expect(findWinLineFrom(cells, 3, 3, 3)).toBeNull();
  });

  it('reports the full run when it is longer than the win length', () => {
    const cells = board(6, 'XXXXX.', ...Array<string>(5).fill(blank(6)));
    expect(findWinLineFrom(cells, 6, 2, 4)).toEqual([0, 1, 2, 3, 4]);
  });

  it('respects a win length that is not the board default', () => {
    const cells = board(6, 'XXX...', ...Array<string>(5).fill(blank(6)));
    expect(findWinLineFrom(cells, 6, 1, 3)).toEqual([0, 1, 2]);
    expect(findWinLineFrom(cells, 6, 1, 4)).toBeNull();
  });
});

describe('hasWinFrom', () => {
  it('agrees with findWinLineFrom everywhere on a sample board', () => {
    const cells = board(6, '.XXXX.', 'OOO...', '..O...', '...O..', '......', '......');
    for (let index = 0; index < cells.length; index++) {
      expect(hasWinFrom(cells, 6, index, 4)).toBe(findWinLineFrom(cells, 6, index, 4) !== null);
    }
  });
});

describe('findAnyWinLine', () => {
  it('finds a win without being told where to look', () => {
    const cells = board(3, 'O.X', 'OXO', 'X..');
    expect(findAnyWinLine(cells, 3, 3)).toEqual({ player: X, line: [2, 4, 6] });
  });

  it('returns null for a position with no winner', () => {
    expect(findAnyWinLine(board(3, 'XOX', 'XOO', 'OXX'), 3, 3)).toBeNull();
  });
});

describe('isWinningMove', () => {
  it('detects a completing move and leaves the board untouched', () => {
    const cells = board(3, 'XX.', 'OO.', '...');
    const before = [...cells];
    expect(isWinningMove(cells, 3, 2, X, 3)).toBe(true);
    expect(cells).toEqual(before);
  });

  it('leaves the board untouched when the move does not win', () => {
    const cells = board(3, 'X..', 'O..', '...');
    const before = [...cells];
    expect(isWinningMove(cells, 3, 8, X, 3)).toBe(false);
    expect(cells).toEqual(before);
  });

  it('rejects an occupied cell', () => {
    expect(isWinningMove(board(3, 'XX.', 'OO.', '...'), 3, 0, X, 3)).toBe(false);
    expect(isWinningMove(board(3, 'XX.', 'OO.', '...'), 3, 3, O, 3)).toBe(false);
  });

  it('is symmetric between the two players', () => {
    const cells = board(3, 'XX.', 'OO.', '...');
    expect(isWinningMove(cells, 3, 2, X, 3)).toBe(true);
    expect(isWinningMove(cells, 3, 5, O, 3)).toBe(true);
  });
});
