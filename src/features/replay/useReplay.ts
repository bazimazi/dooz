import { type GameState, replayFrames } from '@/game/engine';
import type { MatchRecord } from '@/protocol';
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface Replay {
  /** Every position the game passed through, including the empty board. */
  frames: readonly GameState[];
  /** Index into `frames`. Zero is the empty board. */
  at: number;
  current: GameState;
  playing: boolean;
  atStart: boolean;
  atEnd: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  restart: () => void;
  seek: (index: number) => void;
  /** Milliseconds the move that produced the current frame actually took. */
  moveTimeMs: number | null;
}

/** How long each move is held during playback, regardless of how long it took. */
const STEP_MS = 900;

/**
 * Step through a recorded match.
 *
 * The frames are rebuilt by running the engine over the stored move list rather
 * than being fetched, which is the point of storing a match as moves: the
 * replay is exact by construction, because it is the same code that produced
 * the game in the first place. A record that does not play out yields no
 * frames at all, so a corrupt one shows an error instead of a wrong board.
 *
 * Playback runs at a fixed pace rather than the original timings. Watching
 * somebody's ninety-second think in real time is not a feature.
 */
export function useReplay(record: MatchRecord | null): Replay | null {
  const frames = useMemo(() => {
    if (!record) return null;
    return replayFrames(record.config, record.startingPlayer, record.moves);
  }, [record]);

  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);

  // A different match means a different game: rewind during render rather than
  // in an effect, so the new board is never shown at the old move index.
  const [loadedId, setLoadedId] = useState(record?.matchId ?? null);
  if (loadedId !== (record?.matchId ?? null)) {
    setLoadedId(record?.matchId ?? null);
    setAt(0);
    setPlaying(false);
  }

  const total = frames?.length ?? 0;
  const atEnd = at >= total - 1;

  useEffect(() => {
    if (!playing || atEnd) return;

    const timer = setTimeout(() => {
      const next = Math.min(at + 1, total - 1);
      setAt(next);
      // Reaching the end stops playback rather than looping, so the final
      // position stays on screen - which is the one most people came to see.
      if (next >= total - 1) setPlaying(false);
    }, STEP_MS);

    return () => clearTimeout(timer);
  }, [playing, at, atEnd, total]);

  const seek = useCallback(
    (index: number) => {
      setPlaying(false);
      setAt(Math.max(0, Math.min(index, total - 1)));
    },
    [total],
  );

  const restart = useCallback(() => {
    setAt(0);
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    // Pressing play at the end starts again rather than doing nothing.
    if (!playing && atEnd) setAt(0);
    setPlaying(!playing);
  }, [playing, atEnd]);

  if (!frames || frames.length === 0) return null;
  const current = frames[at] ?? frames[0]!;

  return {
    frames,
    at,
    current,
    playing,
    atStart: at === 0,
    atEnd,
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    toggle,
    next: () => seek(at + 1),
    previous: () => seek(at - 1),
    restart,
    seek,
    moveTimeMs: at > 0 ? (record?.moveTimesMs[at - 1] ?? null) : null,
  };
}
