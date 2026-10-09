import {
  applyMove,
  createGame,
  type GameConfig,
  type GameState,
  isGameConfig,
  startingPlayerOf,
  type Player,
  randomStartingPlayer,
  sameConfig,
} from '@/game/engine';
import { useCallback, useEffect, useState } from 'react';

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
  /** Independent on-device position for this game mode or journey stage. */
  storageKey?: string;
}

function restoreGame(config: GameConfig, storageKey?: string): GameState | null {
  if (!storageKey) return null;
  try {
    const saved = JSON.parse(localStorage.getItem(`dooz.game:${storageKey}`) ?? 'null');
    if (
      !saved ||
      !isGameConfig(saved.config) ||
      !sameConfig(saved.config, config) ||
      (saved.opener !== 1 && saved.opener !== 2) ||
      !Array.isArray(saved.moves) ||
      saved.moves.length > 1000
    )
      return null;
    let game = createGame(config, saved.opener);
    for (const move of saved.moves) {
      if (!Number.isInteger(move)) return null;
      const next = applyMove(game, move);
      if (!next) return null;
      game = next;
    }
    return game.status === 'playing' ? game : null;
  } catch {
    return null;
  }
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
  const storageKey = options.storageKey;
  const [loadedKey, setLoadedKey] = useState(storageKey);
  const [game, setGame] = useState<GameState>(
    () => restoreGame(config, storageKey) ?? createGame(config, fixed ?? randomStartingPlayer()),
  );
  const [opener, setOpener] = useState(() => startingPlayerOf(game));
  const [round, setRound] = useState(0);

  // Adjusted during render rather than in an effect: an effect would let one
  // frame of the previous board paint under the new rules first.
  if (!sameConfig(game.config, config) || loadedKey !== storageKey) {
    const restored =
      restoreGame(config, storageKey) ?? createGame(config, fixed ?? randomStartingPlayer());
    setLoadedKey(storageKey);
    setOpener(startingPlayerOf(restored));
    setGame(restored);
    setRound((count) => count + 1);
  }

  useEffect(() => {
    if (!storageKey) return;
    try {
      const key = `dooz.game:${storageKey}`;
      // Results are recorded separately. Restoring a finished board would award them twice.
      if (game.status !== 'playing') localStorage.removeItem(key);
      else
        localStorage.setItem(
          key,
          JSON.stringify({
            config: game.config,
            opener: startingPlayerOf(game),
            moves: game.moves,
          }),
        );
    } catch {
      /* Local play remains available when storage is full. */
    }
  }, [game, storageKey]);

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
