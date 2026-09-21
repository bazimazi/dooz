import {
  applyMove,
  type BoardSize,
  createGame,
  type GameState,
  randomStartingPlayer,
} from '@dooz/engine';
import { useCallback, useState } from 'react';

export interface UseGame {
  game: GameState;
  /** Plays for whoever is to move. Ignores illegal moves. */
  play: (index: number) => void;
  /** Fresh board, new random opener. */
  restart: () => void;
}

/**
 * A game of dooz held in component state.
 *
 * Used for both the pass-and-play and the bot screens; the bot is layered on
 * top by `useBotOpponent` rather than being baked in here, so the two screens
 * share one source of truth for the rules.
 *
 * Changing `size` starts a new game on the new board - there is no sensible way
 * to carry a 3x3 position onto a 9x9 one. It is handled here rather than by
 * remounting the screen, so picking a size swaps the board alone instead of
 * playing every screen's entrance animation again.
 */
export function useGame(size: BoardSize): UseGame {
  const [game, setGame] = useState<GameState>(() => createGame(size, randomStartingPlayer()));

  // Adjusted during render rather than in an effect: an effect would let one
  // frame of the previous board paint at the new size first.
  if (game.size !== size) setGame(createGame(size, randomStartingPlayer()));

  const play = useCallback((index: number) => {
    setGame((current) => applyMove(current, index) ?? current);
  }, []);

  const restart = useCallback(() => {
    setGame(createGame(size, randomStartingPlayer()));
  }, [size]);

  return { game, play, restart };
}
