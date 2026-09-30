import { type GameState, X } from '@dooz/engine';
import { useEffect } from 'react';

/**
 * Tint the backdrop towards the player to move.
 *
 * Set as an attribute on the root rather than passed down, because the
 * backdrop sits behind every screen and knows nothing about games - and the
 * attribute is cleared on the way out, so the home screen is never left
 * glowing in the colour of the last game's loser.
 */
export function useTurnTint(game: GameState | null): void {
  const turn = game && game.status === 'playing' ? (game.currentPlayer === X ? 'x' : 'o') : '';

  useEffect(() => {
    const root = document.documentElement;
    if (turn) root.dataset['turn'] = turn;
    else delete root.dataset['turn'];
  }, [turn]);

  useEffect(
    () => () => {
      delete document.documentElement.dataset['turn'];
    },
    [],
  );
}
