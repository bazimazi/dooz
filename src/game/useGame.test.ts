import { modeById } from '@/game/engine';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useGame } from './useGame';

const CLASSIC = modeById('classic').config;
const GRID_6 = modeById('grid-6').config;

describe('useGame', () => {
  it('starts a fresh game under the given rules', () => {
    const { result } = renderHook(() => useGame(CLASSIC));

    expect(result.current.game.config).toEqual(CLASSIC);
    expect(result.current.game.board).toHaveLength(9);
    expect(result.current.game.status).toBe('playing');
    expect(result.current.canUndo).toBe(false);
  });

  it('plays a move for whoever is to move', () => {
    const { result } = renderHook(() => useGame(CLASSIC));
    const opener = result.current.game.currentPlayer;

    act(() => result.current.play(4));

    expect(result.current.game.board[4]).toBe(opener);
    expect(result.current.game.currentPlayer).not.toBe(opener);
    expect(result.current.canUndo).toBe(true);
  });

  it('ignores an illegal move rather than throwing', () => {
    const { result } = renderHook(() => useGame(CLASSIC));

    act(() => result.current.play(4));
    const before = result.current.game;
    act(() => result.current.play(4));

    expect(result.current.game).toBe(before);
  });

  it('starts a new game when the rules change', () => {
    const { result, rerender } = renderHook(({ config }) => useGame(config), {
      initialProps: { config: CLASSIC },
    });

    act(() => result.current.play(0));
    expect(result.current.game.moves).toHaveLength(1);

    rerender({ config: GRID_6 });

    expect(result.current.game.config).toEqual(GRID_6);
    expect(result.current.game.board).toHaveLength(36);
    expect(result.current.game.moves).toHaveLength(0);
  });

  it('takes the last move back', () => {
    const { result } = renderHook(() => useGame(CLASSIC));

    act(() => result.current.play(0));
    act(() => result.current.play(4));
    expect(result.current.game.moves).toEqual([0, 4]);

    act(() => result.current.undo());

    expect(result.current.game.moves).toEqual([0]);
    expect(result.current.game.board[4]).toBe(0);
    // The turn has to come back with the move, or the wrong player is on.
    expect(result.current.game.currentPlayer).not.toBe(result.current.game.board[0]);
  });

  it('undoes all the way back to an empty board', () => {
    const { result } = renderHook(() => useGame(CLASSIC));

    act(() => result.current.play(0));
    act(() => result.current.play(1));
    act(() => result.current.undo());
    act(() => result.current.undo());

    expect(result.current.game.moves).toEqual([]);
    expect(result.current.canUndo).toBe(false);

    // One more must be a no-op rather than an error.
    act(() => result.current.undo());
    expect(result.current.game.moves).toEqual([]);
  });

  it('restarts to an empty board under the same rules', () => {
    const { result } = renderHook(() => useGame(CLASSIC));

    act(() => result.current.play(0));
    act(() => result.current.restart());

    expect(result.current.game.moves).toEqual([]);
    expect(result.current.game.config).toEqual(CLASSIC);
  });

  it('keeps the opener consistent through an undo', () => {
    const { result } = renderHook(() => useGame(CLASSIC));
    const opener = result.current.game.currentPlayer;

    act(() => result.current.play(0));
    act(() => result.current.play(1));
    act(() => result.current.undo());
    act(() => result.current.undo());

    expect(result.current.game.currentPlayer).toBe(opener);
  });
});

describe('saved games', () => {
  it('restores a legal position and can undo after reopening', () => {
    localStorage.removeItem('dooz.game:test-resume');
    const first = renderHook(() => useGame(CLASSIC, { storageKey: 'test-resume', opener: 1 }));
    act(() => first.result.current.play(0));
    act(() => first.result.current.play(4));
    first.unmount();
    const reopened = renderHook(() => useGame(CLASSIC, { storageKey: 'test-resume' }));
    expect(reopened.result.current.game.moves).toEqual([0, 4]);
    act(() => reopened.result.current.undo());
    expect(reopened.result.current.game.moves).toEqual([0]);
    expect(reopened.result.current.game.currentPlayer).toBe(2);
    reopened.unmount();
    localStorage.removeItem('dooz.game:test-resume');
  });
  it('ignores corrupt or illegal saved moves', () => {
    localStorage.setItem(
      'dooz.game:test-corrupt',
      JSON.stringify({ config: CLASSIC, opener: 1, moves: [0, 0] }),
    );
    const { result, unmount } = renderHook(() => useGame(CLASSIC, { storageKey: 'test-corrupt' }));
    expect(result.current.game.moves).toEqual([]);
    unmount();
    localStorage.removeItem('dooz.game:test-corrupt');
  });
});
