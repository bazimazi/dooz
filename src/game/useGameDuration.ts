import type { GameState } from '@/game/engine';
import { useState } from 'react';

interface Clock {
  game: GameState;
  /** When the first move was seen; `false` once the start is unknowable. */
  start: number | false | null;
  duration: number | null;
}

/**
 * How long the finished game took, in milliseconds, for the result screen.
 *
 * Timed from the first move this screen saw being played to the move that
 * ended it. A game picked up half-way through - restored from the device, or
 * joined as a spectator - has no honest start, so it reports `null` rather
 * than a time that is too short. Also `null` while the game is still on.
 *
 * Worked out during render as each new position arrives, so the time and the
 * result that shows it land in the same paint.
 */
export function useGameDuration(game: GameState): number | null {
  const [clock, setClock] = useState<Clock>(() =>
    tick({ game, start: null, duration: null }, game),
  );
  if (clock.game !== game) setClock(tick(clock, game));
  return clock.duration;
}

function tick(clock: Clock, game: GameState): Clock {
  if (game.moves.length === 0) return { game, start: null, duration: null };
  const start = clock.start ?? (game.moves.length === 1 ? Date.now() : false);
  const over = game.status !== 'playing' && start !== false;
  return {
    game,
    start,
    // A finished position seen again (a re-render, the server echoing it)
    // keeps the time it first finished at.
    duration: over ? (clock.duration ?? Date.now() - start) : null,
  };
}

/** `m:ss`, or `h:mm:ss` for a marathon. */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}
