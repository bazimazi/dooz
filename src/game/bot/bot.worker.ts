/// <reference lib="webworker" />
import { chooseMove, type BotOptions, type GameState } from '@/game/engine';

export interface BotRequest {
  type: 'search';
  id: number;
  state: GameState;
  options: BotOptions;
}

/**
 * Abandon a search in flight.
 *
 * A worker running a two-second gomoku search cannot be interrupted by dropping
 * the message - it is a tight loop, not a queue - so cancellation is a flag the
 * search itself polls. Without it, leaving a game mid-think leaves a core busy
 * until the budget expires, which on a phone is the difference between a smooth
 * transition and a stuttering one.
 */
export interface BotCancel {
  type: 'cancel';
  /** Cancels this search, or every outstanding one when omitted. */
  id?: number;
}

export type BotMessage = BotRequest | BotCancel;

export interface BotResponse {
  id: number;
  move: number | null;
  /** Diagnostics, for the practice screen's "what did it see" panel. */
  depth: number;
  nodes: number;
  reason: string;
}

/** Ids the main thread has withdrawn since they were sent. */
const cancelled = new Set<number>();
let newestRequest = 0;

self.addEventListener('message', (event: MessageEvent<BotMessage>) => {
  const message = event.data;

  if (message.type === 'cancel') {
    if (message.id === undefined) {
      // Everything outstanding. The counter is the only id that can still be
      // running, so cancelling it is enough.
      cancelled.add(newestRequest);
    } else {
      cancelled.add(message.id);
    }
    return;
  }

  const { id, state, options } = message;
  newestRequest = id;

  const chosen = chooseMove(state, {
    ...options,
    // A newer request supersedes an older one: by the time it arrives the board
    // has moved on, so finishing the old search would be work for a position
    // nobody is looking at.
    shouldStop: () => cancelled.has(id) || newestRequest !== id,
  });

  cancelled.delete(id);

  const response: BotResponse = {
    id,
    move: chosen?.move ?? null,
    depth: chosen?.depth ?? 0,
    nodes: chosen?.nodes ?? 0,
    reason: chosen?.reason ?? 'none',
  };
  self.postMessage(response);
});
