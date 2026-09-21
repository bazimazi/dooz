import { Empty } from '@dooz/engine';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useGame } from './useGame';

describe('useGame', () => {
  it('starts a fresh game on the new board when the size changes', () => {
    const { result, rerender } = renderHook(({ size }) => useGame(size), {
      initialProps: { size: 3 as 3 | 9 },
    });

    act(() => {
      result.current.play(0);
    });
    expect(result.current.game.board[0]).not.toBe(Empty);

    // The screen stays mounted across a size change, so the reset has to happen
    // here - otherwise the 3x3 position would be left sitting on a 9x9 board.
    rerender({ size: 9 });
    expect(result.current.game.size).toBe(9);
    expect(result.current.game.board).toHaveLength(81);
    expect(result.current.game.board.every((cell) => cell === Empty)).toBe(true);
  });

  it('keeps the position when the size is unchanged', () => {
    const { result, rerender } = renderHook(({ size }) => useGame(size), {
      initialProps: { size: 3 as const },
    });

    act(() => {
      result.current.play(4);
    });
    const afterMove = result.current.game;

    rerender({ size: 3 });
    expect(result.current.game).toBe(afterMove);
  });
});
