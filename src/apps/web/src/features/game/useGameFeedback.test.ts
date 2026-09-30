import { applyMove, createGame, type GameState, O, X } from '@dooz/engine';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameFeedback } from './useGameFeedback';

const sfx = vi.hoisted(() => ({
  place: vi.fn(),
  drop: vi.fn(),
  vanish: vi.fn(),
  undo: vi.fn(),
  start: vi.fn(),
  win: vi.fn(),
  lose: vi.fn(),
  draw: vi.fn(),
  claim: vi.fn(),
  threat: vi.fn(),
}));

vi.mock('@/lib/sound', () => ({ sfx, haptics: { buzz: vi.fn() } }));

function play(game: GameState, ...moves: number[]): GameState {
  return moves.reduce((state, move) => applyMove(state, move)!, game);
}

describe('useGameFeedback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    for (const fn of Object.values(sfx)) fn.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('sounds a fresh board, then each mark by who played it and where', () => {
    const start = createGame(3, X);
    const { rerender } = renderHook(({ game }) => useGameFeedback(game), {
      initialProps: { game: start },
    });
    expect(sfx.start).toHaveBeenCalledTimes(1);

    rerender({ game: play(start, 4) });
    expect(sfx.place).toHaveBeenLastCalledWith(X, 4, 3);

    rerender({ game: play(start, 4, 0) });
    expect(sfx.place).toHaveBeenLastCalledWith(O, 0, 3);
  });

  it('hears a take-back as a take-back, and a new game as a new game', () => {
    const start = createGame(3, X);
    const two = play(start, 4, 0);
    const { rerender } = renderHook(({ game }) => useGameFeedback(game), {
      initialProps: { game: two },
    });

    rerender({ game: play(start, 4) });
    expect(sfx.undo).toHaveBeenCalledTimes(1);

    // A different position with fewer moves is not an undo of this one.
    rerender({ game: play(start, 8) });
    rerender({ game: createGame(3, O) });
    expect(sfx.undo).toHaveBeenCalledTimes(1);
    expect(sfx.start).toHaveBeenCalledTimes(1);
  });

  it('plays the result from the point of view of the player at this device', () => {
    const start = createGame(3, X);
    const almost = play(start, 0, 3, 1, 4);
    const { rerender } = renderHook(({ game }) => useGameFeedback(game, { you: O }), {
      initialProps: { game: almost },
    });

    rerender({ game: play(almost, 2) });
    vi.runAllTimers();
    expect(sfx.lose).toHaveBeenCalledTimes(1);
    expect(sfx.win).not.toHaveBeenCalled();
  });

  it('keeps a replay to its marks', () => {
    const start = createGame(3, X);
    const almost = play(start, 0, 3, 1, 4);
    const { rerender } = renderHook(({ game }) => useGameFeedback(game, { replay: true }), {
      initialProps: { game: almost },
    });

    rerender({ game: play(almost, 2) });
    vi.runAllTimers();
    expect(sfx.place).toHaveBeenCalledTimes(1);
    expect(sfx.win).not.toHaveBeenCalled();
  });

  it('marks a vanish lift and a gravity drop with their own sounds', () => {
    const vanish = createGame({ variant: 'vanish', size: 3, winLength: 3 }, X);
    const before = play(vanish, 0, 4, 2, 1, 7, 3);
    const { rerender } = renderHook(({ game }) => useGameFeedback(game), {
      initialProps: { game: before },
    });
    rerender({ game: play(before, 5) });
    expect(sfx.vanish).toHaveBeenCalledTimes(1);

    const gravity = createGame({ variant: 'gravity', size: 7, winLength: 4 }, X);
    const view = renderHook(({ game }) => useGameFeedback(game), {
      initialProps: { game: gravity },
    });
    view.rerender({ game: play(gravity, 45) });
    expect(sfx.drop).toHaveBeenCalledWith(X, 45, 7, 7);
  });
});
