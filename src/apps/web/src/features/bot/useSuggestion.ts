import { canPlay, chooseMove, type GameState } from '@dooz/engine';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BotRequest, BotResponse } from './bot.worker';

/**
 * "What would the engine play here?" - for practice games.
 *
 * Asks a strong level on its own worker, so a suggestion never queues behind
 * the opponent's search or delays its reply. The answer belongs to the position
 * it was asked about: it clears as soon as the game moves on, and a reply that
 * arrives for a position no longer on screen is dropped. The search itself is
 * capped at under a second, so one left running for a stale position costs
 * less than the bookkeeping to cancel it would.
 */
export function useSuggestion(game: GameState): {
  suggestion: number | null;
  thinking: boolean;
  suggest: () => void;
} {
  const workerRef = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const [answer, setAnswer] = useState<{ for: GameState; move: number } | null>(null);
  const [asking, setAsking] = useState<GameState | null>(null);

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

  const suggest = useCallback(() => {
    if (game.status !== 'playing') return;
    const position = game;
    setAsking(position);

    const settle = (move: number | null) => {
      setAsking((current) => (current === position ? null : current));
      if (move !== null && canPlay(position, move)) setAnswer({ for: position, move });
    };

    const worker = workerRef.current;
    if (!worker) {
      setTimeout(() => settle(chooseMove(position, { difficulty: 'expert' })?.move ?? null), 0);
      return;
    }

    const id = ++requestId.current;
    const onMessage = (event: MessageEvent<BotResponse>) => {
      if (event.data.id !== id) return;
      worker.removeEventListener('message', onMessage);
      settle(event.data.move);
    };
    worker.addEventListener('message', onMessage);
    const request: BotRequest = {
      type: 'search',
      id,
      state: position,
      options: { difficulty: 'expert', timeBudgetMs: 900 },
    };
    worker.postMessage(request);
  }, [game]);

  return {
    suggestion: answer && answer.for === game ? answer.move : null,
    thinking: asking === game,
    suggest,
  };
}
