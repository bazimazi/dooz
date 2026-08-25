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
 * `size` is read once. Changing the board size is a change of game, not of
 * game state, and the routes handle it by remounting the screen - there is no
 * sensible way to carry a 3x3 position onto a 9x9 board.
 */
export function useGame(size: BoardSize): UseGame {
  const [game, setGame] = useState<GameState>(() => createGame(size, randomStartingPlayer()));

  const play = useCallback((index: number) => {
    setGame((current) => applyMove(current, index) ?? current);
  }, []);

  const restart = useCallback(() => {
    setGame(createGame(size, randomStartingPlayer()));
  }, [size]);

  return { game, play, restart };
}
