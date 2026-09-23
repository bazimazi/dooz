import {
  applyMove,
  createGame,
  type GameConfig,
  type GameState,
  randomStartingPlayer,
  sameConfig,
} from '@dooz/engine';
import { useCallback, useState } from 'react';

export interface UseGame {
  game: GameState;
  /** Plays for whoever is to move. Ignores illegal moves. */
  play: (index: number) => void;
  /** Fresh board, new random opener. */
  restart: () => void;
  /** Take back the last move. Local and practice games only. */
  undo: () => void;
  canUndo: boolean;
}

/**
 * A game of dooz held in component state.
 *
 * Used for the pass-and-play, bot and practice screens; the bot is layered on
 * top by `useBotOpponent` rather than being baked in here, so every local
 * screen shares one source of truth for the rules.
 *
 * Changing `config` starts a new game under the new rules - there is no
 * sensible way to carry a 3x3 position onto a 15x15 one, let alone onto a
 * different variant. It is handled here rather than by remounting the screen,
 * so picking a mode swaps the board alone instead of playing every screen's
 * entrance animation again.
 */
export function useGame(config: GameConfig): UseGame {
  const [game, setGame] = useState<GameState>(() => createGame(config, randomStartingPlayer()));
  const [opener, setOpener] = useState(() => game.currentPlayer);

  // Adjusted during render rather than in an effect: an effect would let one
  // frame of the previous board paint under the new rules first.
  if (!sameConfig(game.config, config)) {
    const starting = randomStartingPlayer();
    setOpener(starting);
    setGame(createGame(config, starting));
  }

  const play = useCallback((index: number) => {
    setGame((current) => applyMove(current, index) ?? current);
  }, []);

  const restart = useCallback(() => {
    const starting = randomStartingPlayer();
    setOpener(starting);
    setGame(createGame(config, starting));
  }, [config]);

  /**
   * Replays the game one move short of where it is.
   *
   * Rebuilding from the move list rather than keeping a stack of past states:
   * the engine is deterministic, so the moves are the only history worth
   * holding, and this cannot drift out of step with the board the way a
   * parallel stack can.
   */
  const undo = useCallback(() => {
    setGame((current) => {
      if (current.moves.length === 0) return current;
      let rebuilt = createGame(current.config, opener);
      for (const move of current.moves.slice(0, -1)) {
        rebuilt = applyMove(rebuilt, move) ?? rebuilt;
      }
      return rebuilt;
    });
  }, [opener]);

  return { game, play, restart, undo, canUndo: game.moves.length > 0 };
}
