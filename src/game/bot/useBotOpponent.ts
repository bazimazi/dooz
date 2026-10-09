import {
  type BotDifficulty,
  canPlay,
  chooseMove,
  type GameState,
  type Player,
} from '@/game/engine';
import { useEffect, useRef, useState } from 'react';
import type { BotMessage, BotRequest, BotResponse } from './bot.worker';

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
}

export interface BotStatus {
  thinking: boolean;
  /** Depth and node count of the last completed search, for the practice panel. */
  lastSearch: { depth: number; nodes: number; reason: string } | null;
}

/**
 * Plays `botPlayer`'s turns.
 *
 * The search runs in a worker; if the worker cannot start - an old browser, or
 * a restrictive content policy - it falls back to searching inline, which is
 * slower to the eye on a big board but never leaves the game stuck waiting.
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
}: UseBotOpponentOptions): BotStatus {
  const workerRef = useRef<Worker | null>(null);
  // Tags each search, so a reply from an abandoned one is ignored.
  const requestId = useRef(0);
  const [lastSearch, setLastSearch] = useState<BotStatus['lastSearch']>(null);

  useEffect(() => {
    if (typeof Worker === 'undefined') return;

    let worker: Worker;
    try {
      worker = new Worker(new URL('./bot.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      return;
    }

    workerRef.current = worker;
    return () => {
      workerRef.current = null;
      worker.terminate();
    };
  }, []);

  // "Thinking" is not separate state: the bot is thinking exactly while it is
  // the bot's turn. Deriving it avoids a second render pass per move, and it
  // cannot drift out of step with the board.
  const thinking = !paused && game.status === 'playing' && game.currentPlayer === botPlayer;

  useEffect(() => {
    if (!thinking) return;

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
      const minimum = game.moves.length === 0 ? OPENING_THINK_MS : MINIMUM_THINK_MS;
      const wait = Math.max(0, minimum - (Date.now() - startedAt));
      delayTimer = setTimeout(() => {
        if (cancelled) return;
        if (diagnostics) setLastSearch(diagnostics);
        onMove(move);
      }, wait);
    };

    const worker = workerRef.current;

    if (worker) {
      const id = ++requestId.current;
      const onMessage = (event: MessageEvent<BotResponse>) => {
        if (event.data.id !== id) return;
        worker.removeEventListener('message', onMessage);
        settle(event.data.move, {
          depth: event.data.depth,
          nodes: event.data.nodes,
          reason: event.data.reason,
        });
      };
      worker.addEventListener('message', onMessage);

      const request: BotRequest = { type: 'search', id, state: game, options: { difficulty } };
      worker.postMessage(request);

      return () => {
        cancelled = true;
        clearTimeout(delayTimer);
        worker.removeEventListener('message', onMessage);
        // Tell the worker to stop rather than merely ignoring what it sends:
        // a search it finishes for a board nobody is looking at is a core spun
        // up for nothing, which on a phone is felt as much as it is measured.
        const cancel: BotMessage = { type: 'cancel', id };
        worker.postMessage(cancel);
      };
    }

    // No worker: search on the main thread, one tick later so the mark the
    // human just placed has a chance to paint first.
    const fallbackTimer = setTimeout(() => {
      const chosen = chooseMove(game, { difficulty });
      settle(
        chosen?.move ?? null,
        chosen ? { depth: chosen.depth, nodes: chosen.nodes, reason: chosen.reason } : null,
      );
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
      clearTimeout(delayTimer);
    };
  }, [thinking, game, difficulty, onMove]);

  return { thinking, lastSearch };
}
