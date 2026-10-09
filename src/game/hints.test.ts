import { applyMove, createGame, modeById, type GameState, O, X } from '@/game/engine';
import { describe, expect, it } from 'vitest';
import { hintsFor } from './hints';

function fromMoves(config: Parameters<typeof createGame>[0], moves: number[]): GameState {
  let game = createGame(config, X);
  for (const move of moves) game = applyMove(game, move)!;
  return game;
}

describe('hintsFor', () => {
  it('points at the square that wins', () => {
    // X holds 0 and 1; 2 completes the top row.
    const game = fromMoves(3, [0, 3, 1, 4]);
    expect(hintsFor(game)).toEqual([{ index: 2, kind: 'win' }]);
  });

  it('points at the square that must be blocked', () => {
    // O to move. X threatens 0-1-2, and O has nothing of its own.
    const game = fromMoves(3, [0, 4, 1]);
    expect(hintsFor(game)).toEqual([{ index: 2, kind: 'threat' }]);
  });

  it('prefers a win of its own over a block', () => {
    // O holds 3 and 4 (5 wins); X holds 0 and 1 (2 would need blocking).
    const game = fromMoves(3, [0, 3, 1, 4, 8]);
    expect(hintsFor(game)).toEqual([{ index: 5, kind: 'win' }]);
  });

  it('says nothing about a quiet position', () => {
    expect(hintsFor(createGame(3, X))).toEqual([]);
    expect(hintsFor(fromMoves(3, [4]))).toEqual([]);
  });

  it('says nothing about a finished game', () => {
    expect(hintsFor(fromMoves(3, [0, 3, 1, 4, 2]))).toEqual([]);
  });

  it('finds every winning square when there is more than one', () => {
    // X X .   X holds 0, 1 and 3, so both 2 (the top row) and 6 (the left
    // X O O   column) finish the game. A hint that showed only one of them
    // . O .   would be telling half the truth.
    const game = fromMoves(3, [0, 4, 1, 5, 3, 7]);
    const hints = hintsFor(game);

    expect(hints.map((hint) => hint.index).toSorted((a, b) => a - b)).toEqual([2, 6]);
    expect(hints.every((hint) => hint.kind === 'win')).toBe(true);
  });

  it('works on a bigger board with a longer run', () => {
    const config = modeById('grid-6').config;
    // X builds 0,1,2 across the top; 3 would win it.
    const game = fromMoves(config, [0, 6, 1, 7, 2, 8]);
    expect(hintsFor(game)).toContainEqual({ index: 3, kind: 'win' });
  });

  /**
   * Misere inverts what a line is worth and Ultimate's threats live at the
   * sub-board level, so the same computation would be actively misleading.
   */
  it('stays quiet in the variants it cannot reason about', () => {
    const misere = fromMoves(modeById('misere').config, [0, 3, 1, 4]);
    expect(hintsFor(misere)).toEqual([]);

    const ultimate = applyMove(createGame(modeById('ultimate').config, X), 30)!;
    expect(hintsFor(ultimate)).toEqual([]);
  });

  it('ignores a vanish line that leans on a mark about to leave', () => {
    // X holds 0 (oldest), 1 and 8 and is to move: 2 looks like it finishes the
    // top row, but 0 lifts first. O's 2-4-6 and 3-4-5 both lean on O's own
    // oldest mark, 4, so neither is a threat either.
    const game = fromMoves(modeById('vanish').config, [0, 4, 1, 3, 8, 6]);
    expect(hintsFor(game)).toEqual([]);
  });

  it('names a real vanish threat', () => {
    // O to move. X threatens 0-1-2 with marks that are staying.
    const game = fromMoves(modeById('vanish').config, [0, 4, 1]);
    expect(hintsFor(game)).toEqual([{ index: 2, kind: 'threat' }]);
  });

  it('points at the landing square under gravity', () => {
    // X on the floor in columns 0-2, O stacked above: X wins by dropping into
    // column 3, which lands on the floor at row 7.
    const config = modeById('gravity').config;
    const game = fromMoves(config, [42, 35, 43, 36, 44, 37]);
    expect(hintsFor(game)).toContainEqual({ index: 45, kind: 'win' });
  });

  it('only ever names an empty square', () => {
    const game = fromMoves(3, [0, 3, 1, 4]);
    for (const hint of hintsFor(game)) {
      expect(game.board[hint.index]).toBe(0);
    }
    expect(game.currentPlayer).toBe(X);
    expect(game.board[3]).toBe(O);
  });
});
