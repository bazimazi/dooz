import { modeById } from '@dooz/engine';
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
