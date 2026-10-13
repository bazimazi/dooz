import {
  type BotDifficulty,
  type BotStyle,
  canPlay,
  type GameState,
  type Player,
} from '@/game/engine';
import { useEffect, useRef, useState } from 'react';
import { usePageVisible } from '@/lib/usePageVisible';
import { BotSearch } from './BotSearch';

/** Never answer faster than this - an instant reply reads as a glitch. */
const MINIMUM_THINK_MS = 450;
/**
 * An opening move waits longer, so the coin toss that says who opens can be
 * read before the first mark lands on top of it.
 */
const OPENING_THINK_MS = 1100;

interface UseBotOpponentOptions {
  game: GameState;
  /** The mark the bot plays. */
  botPlayer: Player;
  difficulty: BotDifficulty;
  /** Must be stable across renders; a `useCallback` with no dependencies. */
  onMove: (index: number) => void;
  /** Set to stop the bot thinking at all - the practice screen pauses it. */
  paused?: boolean;
  /**
   * Overrides the level's thinking time, in milliseconds. Blitz shortens it so
   * the bot keeps pace with a player on the clock.
   */
  timeBudgetMs?: number;
  /**
   * A journey rival's style: which moves it prefers, and through `tempo` how
   * long it appears to think. Must be stable across renders, like `onMove`.
   */
  style?: BotStyle;
}

export interface BotStatus {
  thinking: boolean;
  /**
   * The last completed search: depth and nodes for the practice panel, and
   * the move with the bot's reason and score, which a rival's lines are read
   * from.
   */
  lastSearch: {
    depth: number;
    nodes: number;
    reason: string;
    move: number;
    score: number;
  } | null;
}

/**
 * Plays `botPlayer`'s turns.
 *
 * The search runs in a worker; if the worker cannot start - an old browser, or
 * a restrictive content policy - it falls back to searching inline, which is
 * bounded to a short budget so a big board cannot freeze the interface.
 *
 * Every move is re-checked against the board it is about to be played on. The
 * search is asynchronous and the position can have moved on underneath it - a
 * restart, an undo, a mode change - and a stale index is worse than a slow one.
 */
export function useBotOpponent({
  game,
  botPlayer,
  difficulty,
  onMove,
  paused = false,
  timeBudgetMs,
  style,
}: UseBotOpponentOptions): BotStatus {
  const searchRef = useRef<BotSearch | null>(null);
  const visible = usePageVisible();
  const [lastSearch, setLastSearch] = useState<BotStatus['lastSearch']>(null);

  useEffect(() => {
    const search = new BotSearch();
    searchRef.current = search;
    return () => search.dispose();
  }, []);

  // "Thinking" is not separate state: the bot is thinking exactly while it is
  // the bot's turn. Deriving it avoids a second render pass per move, and it
  // cannot drift out of step with the board.
  const thinking = !paused && game.status === 'playing' && game.currentPlayer === botPlayer;

  useEffect(() => {
    if (!thinking || !visible) return;

    let cancelled = false;
    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const settle = (move: number | null, diagnostics: BotStatus['lastSearch']) => {
      if (cancelled || move === null) return;
      // The board the search started from is the one it must be legal on. A
      // restart or an undo while it was thinking makes the answer worthless.
      if (!canPlay(game, move)) return;

      // Hold the move back until the minimum has elapsed, so the bot appears to
      // consider even the positions it solves instantly.
      // A rival's tempo stretches or shortens the pause - Sage deliberates,
      // Bruno barely waits - without touching how long the search may run.
      const minimum =
        (game.moves.length === 0 ? OPENING_THINK_MS : MINIMUM_THINK_MS) * (style?.tempo ?? 1);
      const wait = Math.max(0, minimum - (Date.now() - startedAt));
      delayTimer = setTimeout(() => {
        if (cancelled) return;
        if (diagnostics) setLastSearch(diagnostics);
        onMove(move);
      }, wait);
    };

    const options = {
      difficulty,
      ...(timeBudgetMs === undefined ? {} : { timeBudgetMs }),
      ...(style ? { style } : {}),
    };
    const cancelSearch = searchRef.current?.search(game, options, (chosen) => {
      settle(
        chosen?.move ?? null,
        chosen
          ? {
              depth: chosen.depth,
              nodes: chosen.nodes,
              reason: chosen.reason,
              move: chosen.move,
              score: chosen.score,
            }
          : null,
      );
    });

    return () => {
      cancelled = true;
      cancelSearch?.();
      clearTimeout(delayTimer);
    };
  }, [thinking, visible, game, difficulty, onMove, timeBudgetMs, style]);

  return { thinking, lastSearch };
}
