import { describe, expect, it } from 'vitest';
import { applyMove, canPlay, createGame, randomStartingPlayer, replay } from './game.js';
import { O, X } from './types.js';

describe('createGame', () => {
  it('starts empty and playing', () => {
    const game = createGame(3, X);
    expect(game.board).toHaveLength(9);
    expect(game.board.every((cell) => cell === 0)).toBe(true);
    expect(game.status).toBe('playing');
    expect(game.currentPlayer).toBe(X);
    expect(game.lastMove).toBeNull();
  });

  it('sizes the board from the board size', () => {
    expect(createGame(6).board).toHaveLength(36);
    expect(createGame(9).board).toHaveLength(81);
  });
});

describe('applyMove', () => {
  it('places a mark and passes the turn', () => {
    const game = applyMove(createGame(3, X), 4);
    expect(game?.board[4]).toBe(X);
    expect(game?.currentPlayer).toBe(O);
    expect(game?.lastMove).toBe(4);
    expect(game?.moves).toEqual([4]);
  });

  it('does not mutate the previous state', () => {
    const before = createGame(3, X);
    applyMove(before, 0);
    expect(before.board[0]).toBe(0);
    expect(before.moves).toEqual([]);
  });

  it('rejects an occupied cell', () => {
    const game = applyMove(createGame(3, X), 0)!;
    expect(applyMove(game, 0)).toBeNull();
  });

  it('rejects out-of-range and non-integer indices', () => {
    const game = createGame(3, X);
    expect(applyMove(game, -1)).toBeNull();
    expect(applyMove(game, 9)).toBeNull();
    expect(applyMove(game, 1.5)).toBeNull();
  });

  it('detects a win and freezes the game', () => {
    // X: 0,1,2 — O: 3,4
    const won = replay(3, X, [0, 3, 1, 4, 2])!;
    expect(won.status).toBe('won');
    expect(won.winner).toBe(X);
    expect(won.winLine).toEqual([0, 1, 2]);
    expect(applyMove(won, 5)).toBeNull();
    expect(canPlay(won, 5)).toBe(false);
  });

  it('detects a draw on a full board', () => {
    // X O X / X O O / O X X
    const drawn = replay(3, X, [0, 1, 2, 4, 3, 5, 7, 6, 8])!;
    expect(drawn.status).toBe('draw');
    expect(drawn.winner).toBeNull();
    expect(drawn.winLine).toBeNull();
  });

  it('does not call a full board a draw when the last move wins', () => {
    // The final move completes the middle column, so this is a win, not a draw.
    const game = replay(3, X, [0, 1, 2, 4, 5, 7])!;
    expect(game.status).toBe('won');
    expect(game.winner).toBe(O);
    expect(game.board.filter((cell) => cell === 0)).toHaveLength(3);
  });
});

describe('replay', () => {
  it('rebuilds a game from its move list', () => {
    const moves = [4, 0, 8, 2, 1];
    const built = replay(3, X, moves)!;
    expect(built.moves).toEqual(moves);
    expect(built.board[4]).toBe(X);
    expect(built.board[0]).toBe(O);
  });

  it('returns null for an illegal move list', () => {
    expect(replay(3, X, [4, 4])).toBeNull();
  });
});

describe('randomStartingPlayer', () => {
  it('maps the low half of the range to X and the high half to O', () => {
    expect(randomStartingPlayer(() => 0.1)).toBe(X);
    expect(randomStartingPlayer(() => 0.9)).toBe(O);
  });
});
