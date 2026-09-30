import {
  applyMove,
  createGame,
  type GameConfig,
  type GameState,
  type Player,
  randomStartingPlayer,
  sameConfig,
} from '@dooz/engine';
import { useCallback, useState } from 'react';

export interface UseGame {
  game: GameState;
  /** Plays for whoever is to move. Ignores illegal moves. */
  play: (index: number) => void;
  /**
   * Fresh board. The opener is `opener` when given, the hook's fixed opener
   * when it has one, and a coin toss otherwise.
   */
  restart: (opener?: Player) => void;
  /** Take back the last move. Local and practice games only. */
  undo: () => void;
  canUndo: boolean;
  /** Counts games started in this hook, so a screen can tell one game from the next. */
  round: number;
}

interface UseGameOptions {
  /** Always open with this player instead of tossing for it. */
  opener?: Player;
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
export function useGame(config: GameConfig, options: UseGameOptions = {}): UseGame {
  const fixed = options.opener;
  const [game, setGame] = useState<GameState>(() =>
    createGame(config, fixed ?? randomStartingPlayer()),
  );
  const [opener, setOpener] = useState(() => game.currentPlayer);
  const [round, setRound] = useState(0);

  // Adjusted during render rather than in an effect: an effect would let one
  // frame of the previous board paint under the new rules first.
  if (!sameConfig(game.config, config)) {
    const starting = fixed ?? randomStartingPlayer();
    setOpener(starting);
    setGame(createGame(config, starting));
    setRound((count) => count + 1);
  }

  const play = useCallback((index: number) => {
    setGame((current) => applyMove(current, index) ?? current);
  }, []);

  const restart = useCallback(
    (next?: Player) => {
      const starting = next ?? fixed ?? randomStartingPlayer();
      setOpener(starting);
      setGame(createGame(config, starting));
      setRound((count) => count + 1);
    },
    [config, fixed],
  );

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

  return { game, play, restart, undo, canUndo: game.moves.length > 0, round };
}
