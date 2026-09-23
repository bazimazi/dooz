import { describe, expect, it } from 'vitest';
import { applyMove, createGame, legalMoves, replay } from '../game.js';
import { modeById } from '../modes.js';
import { O, X } from '../types.js';

const MISERE = modeById('misere').config;

describe('misere', () => {
  it('hands the win to the player who did not complete the line', () => {
    // X completes the top row, which under these rules loses it.
    const game = replay(MISERE, X, [0, 3, 1, 4, 2])!;
    expect(game.status).toBe('won');
    expect(game.winner).toBe(O);
    // The run is still recorded: it is what ended the game, and the board
    // should show it even though it belongs to the loser.
    expect(game.winLine).toEqual([0, 1, 2]);
  });

  it('freezes the game once a line is completed', () => {
    const game = replay(MISERE, X, [0, 3, 1, 4, 2])!;
    expect(applyMove(game, 5)).toBeNull();
    expect(legalMoves(game)).toEqual([]);
  });

  it('draws a full board with no line, exactly as classic does', () => {
    const drawn = replay(MISERE, X, [0, 1, 2, 4, 3, 5, 7, 6, 8])!;
    expect(drawn.status).toBe('draw');
    expect(drawn.winner).toBeNull();
  });

  it('places marks and alternates turns like any other variant', () => {
    const game = applyMove(createGame(MISERE, X), 4)!;
    expect(game.board[4]).toBe(X);
    expect(game.currentPlayer).toBe(O);
    expect(legalMoves(game)).toHaveLength(8);
  });

  it('is the mirror of classic on the same move list', () => {
    const moves = [0, 3, 1, 4, 2];
    const classic = replay(3, X, moves)!;
    const misere = replay(MISERE, X, moves)!;

    expect(misere.board).toEqual(classic.board);
    expect(misere.winLine).toEqual(classic.winLine);
    expect(misere.winner).toBe(classic.winner === X ? O : X);
  });
});
