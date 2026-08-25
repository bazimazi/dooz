import { type BotDifficulty, findBestMove, type GameState, type Player } from '@dooz/engine';
import { useEffect, useRef } from 'react';
import type { BotRequest, BotResponse } from './bot.worker';

/** Never answer faster than this - an instant reply reads as a glitch. */
const MINIMUM_THINK_MS = 450;

interface UseBotOpponentOptions {
  game: GameState;
  /** The mark the bot plays. */
  botPlayer: Player;
  difficulty: BotDifficulty;
  /** Must be stable across renders; a `useCallback` with no dependencies. */
  onMove: (index: number) => void;
  /** Set false to suspend the bot, e.g. while a result modal is up. */
  enabled?: boolean;
}

/**
 * Plays `botPlayer`'s turns.
 *
 * The search runs in a worker; if the worker cannot start - an old browser, or
 * a restrictive content policy - it falls back to searching inline, which is
 * slower to the eye on 9x9 but never leaves the game stuck waiting.
 */
export function useBotOpponent({
  game,
  botPlayer,
  difficulty,
  onMove,
  enabled = true,
}: UseBotOpponentOptions): { thinking: boolean } {
  const workerRef = useRef<Worker | null>(null);
  // Tags each search, so a reply from an abandoned one is ignored.
  const requestId = useRef(0);

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
  const thinking = enabled && game.status === 'playing' && game.currentPlayer === botPlayer;

  useEffect(() => {
    if (!thinking) return;

    let cancelled = false;
    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const settle = (move: number | null) => {
      if (cancelled || move === null) return;
      // Hold the move back until the minimum has elapsed, so the bot appears to
      // consider even the positions it solves instantly.
      const wait = Math.max(0, MINIMUM_THINK_MS - (Date.now() - startedAt));
      delayTimer = setTimeout(() => {
        if (!cancelled) onMove(move);
      }, wait);
    };

    const worker = workerRef.current;

    if (worker) {
      const id = ++requestId.current;
      const onMessage = (event: MessageEvent<BotResponse>) => {
        if (event.data.id !== id) return;
        worker.removeEventListener('message', onMessage);
        settle(event.data.move);
      };
      worker.addEventListener('message', onMessage);

      const request: BotRequest = { id, state: game, options: { difficulty } };
      worker.postMessage(request);

      return () => {
        cancelled = true;
        clearTimeout(delayTimer);
        worker.removeEventListener('message', onMessage);
      };
    }

    // No worker: search on the main thread, one tick later so the mark the
    // human just placed has a chance to paint first.
    const fallbackTimer = setTimeout(() => settle(findBestMove(game, { difficulty })), 0);
    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
      clearTimeout(delayTimer);
    };
  }, [thinking, game, difficulty, onMove]);

  return { thinking };
}
