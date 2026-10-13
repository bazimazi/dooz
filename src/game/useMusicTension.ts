import type { GameState } from '@/game/engine';
import { useEffect, useMemo } from 'react';
import { hintsFor } from '@/game/hints';
import { RESTING_INTENSITY, setMusicIntensity } from '@/lib/music';

/**
 * Drive the score's intensity from the game on screen.
 *
 * The music is off unless the player turned it on, and this costs nothing
 * when it is: it only passes a number along. Leaving the screen hands the
 * score back at its resting level.
 */
export function useMusicTension(game: GameState, { assist = true }: { assist?: boolean } = {}) {
  const tension = useMemo(() => tensionOf(game, assist), [game, assist]);

  useEffect(() => {
    setMusicIntensity(tension);
  }, [tension]);

  useEffect(() => () => setMusicIntensity(RESTING_INTENSITY), []);
}

/**
 * How tense a position is, 0 to 1.
 *
 * Three things raise it: how far into the game it is, measured against what a
 * game of this run length usually takes rather than against the whole board
 * (a 15x15 board is never nearly full); a square on the board that wins or
 * loses next move, read from the same exact check the hints use; and the
 * board running out of room. A finished game is calm again - the result has
 * its own sound.
 *
 * `assist: false` leaves the threat check out. Online, music that swells the
 * moment a threat appears would be a hint by ear.
 */
export function tensionOf(game: GameState, assist: boolean): number {
  if (game.status !== 'playing') return 0.15;
  const { size, winLength } = game.config;
  const cells = size * size;
  const played = game.moves.length;

  const expected = Math.min(cells, winLength * 5);
  const progress = Math.min(1, played / expected);
  let tension = 0.12 + progress * 0.33;

  if (assist && played >= winLength) {
    const hints = hintsFor(game);
    if (hints.some((hint) => hint.kind === 'win')) tension += 0.45;
    else if (hints.length > 1) tension += 0.42;
    else if (hints.length === 1) tension += 0.32;
  }

  const fill = played / cells;
  if (fill > 0.75) tension += (fill - 0.75) * 0.8;

  return Math.round(Math.min(1, Math.max(0, tension)) * 100) / 100;
}
