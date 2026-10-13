import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMove, createGame, type GameState, X } from '@/game/engine';
import { formatDuration, useGameDuration } from './useGameDuration';

function after(game: GameState, moves: number[]): GameState {
  for (const move of moves) game = applyMove(game, move)!;
  return game;
}

describe('useGameDuration', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('times a game from its first move to its last', () => {
    const fresh = createGame(3, X);
    const { result, rerender } = renderHook(({ game }) => useGameDuration(game), {
      initialProps: { game: fresh },
    });
    const first = after(fresh, [0]);
    rerender({ game: first });
    vi.advanceTimersByTime(42_000);
    const middle = after(first, [3, 1, 4]);
    rerender({ game: middle });
    expect(result.current).toBeNull();
    rerender({ game: after(middle, [2]) });
    expect(result.current).toBe(42_000);
  });

  it('does not guess at a game it joined half-way through', () => {
    const joined = after(createGame(3, X), [0, 3, 1, 4]);
    const { result, rerender } = renderHook(({ game }) => useGameDuration(game), {
      initialProps: { game: joined },
    });
    rerender({ game: after(joined, [2]) });
    expect(result.current).toBeNull();
  });
});

describe('formatDuration', () => {
  it('reads as a clock', () => {
    expect(formatDuration(83_000)).toBe('1:23');
    expect(formatDuration(3_723_000)).toBe('1:02:03');
    expect(formatDuration(400)).toBe('0:00');
  });
});
