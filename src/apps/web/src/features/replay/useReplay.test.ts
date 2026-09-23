import { modeById, replay as replayGame } from '@dooz/engine';
import type { MatchRecord } from '@dooz/protocol';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReplay } from './useReplay';

const CLASSIC = modeById('classic').config;

function record(overrides: Partial<MatchRecord> = {}): MatchRecord {
  const profile = { accountId: 'a', displayName: 'Ada', avatar: 'fox' as const, rating: 1200 };
  return {
    matchId: 'm1',
    mode: 'classic',
    config: CLASSIC,
    kind: 'ranked',
    opponent: { ...profile, accountId: 'b', displayName: 'Bob' },
    outcome: 'win',
    reason: 'line',
    ratingDelta: 16,
    playedAt: 1_700_000_000_000,
    durationMs: 42_000,
    moveCount: 5,
    startingPlayer: 1,
    moves: [0, 3, 1, 4, 2],
    moveTimesMs: [1000, 2000, 1500, 3000, 900],
    players: { x: profile, o: { ...profile, accountId: 'b', displayName: 'Bob' } },
    winner: 1,
    ...overrides,
  };
}

describe('useReplay', () => {
  it('rebuilds one frame per position, starting from the empty board', () => {
    const { result } = renderHook(() => useReplay(record()));

    expect(result.current?.frames).toHaveLength(6);
    expect(result.current?.frames[0]?.moves).toEqual([]);
    expect(result.current?.at).toBe(0);
    expect(result.current?.atStart).toBe(true);
  });

  it('ends on exactly the position the match ended on', () => {
    const { result } = renderHook(() => useReplay(record()));
    const final = result.current!.frames.at(-1)!;
    const expected = replayGame(CLASSIC, 1, [0, 3, 1, 4, 2]);

    expect(final).toEqual(expected);
    expect(final.status).toBe('won');
    expect(final.winner).toBe(1);
  });

  it('steps forwards and backwards', () => {
    const { result } = renderHook(() => useReplay(record()));

    act(() => result.current!.next());
    expect(result.current?.at).toBe(1);
    expect(result.current?.current.board[0]).toBe(1);

    act(() => result.current!.previous());
    expect(result.current?.at).toBe(0);
    expect(result.current?.current.board[0]).toBe(0);
  });

  it('will not step past either end', () => {
    const { result } = renderHook(() => useReplay(record()));

    act(() => result.current!.previous());
    expect(result.current?.at).toBe(0);

    act(() => result.current!.seek(999));
    expect(result.current?.at).toBe(5);
    expect(result.current?.atEnd).toBe(true);
  });

  it('reports how long each move took', () => {
    const { result } = renderHook(() => useReplay(record()));

    expect(result.current?.moveTimeMs).toBeNull();
    act(() => result.current!.seek(2));
    expect(result.current?.moveTimeMs).toBe(2000);
  });

  it('returns nothing for a record that does not play out', () => {
    const { result } = renderHook(() => useReplay(record({ moves: [0, 0] })));
    expect(result.current).toBeNull();
  });

  it('starts again from the top when a different match is loaded', () => {
    const { result, rerender } = renderHook(({ match }) => useReplay(match), {
      initialProps: { match: record() },
    });

    act(() => result.current!.seek(3));
    expect(result.current?.at).toBe(3);

    rerender({ match: record({ matchId: 'm2' }) });
    expect(result.current?.at).toBe(0);
  });
});

describe('useReplay: playback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('advances a move at a time while playing', () => {
    const { result } = renderHook(() => useReplay(record()));

    act(() => result.current!.play());
    expect(result.current?.playing).toBe(true);

    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(result.current?.at).toBe(1);

    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(result.current?.at).toBe(2);
  });

  it('stops at the end rather than looping', () => {
    const { result } = renderHook(() => useReplay(record()));

    act(() => result.current!.play());
    // Each step is scheduled by the effect the previous one triggered, so the
    // timers have to be advanced with a render in between rather than in one go.
    for (let step = 0; step < 8; step++) {
      act(() => {
        vi.advanceTimersByTime(900);
      });
    }

    expect(result.current?.at).toBe(5);
    expect(result.current?.playing).toBe(false);
  });

  it('stops playing when the player scrubs', () => {
    const { result } = renderHook(() => useReplay(record()));

    act(() => result.current!.play());
    act(() => result.current!.seek(2));

    expect(result.current?.playing).toBe(false);
    expect(result.current?.at).toBe(2);
  });

  it('starts again from the top when played from the end', () => {
    const { result } = renderHook(() => useReplay(record()));

    act(() => result.current!.seek(5));
    act(() => result.current!.toggle());

    expect(result.current?.at).toBe(0);
    expect(result.current?.playing).toBe(true);
  });
});
