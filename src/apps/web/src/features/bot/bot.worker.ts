/// <reference lib="webworker" />
import { type BotOptions, findBestMove, type GameState } from '@dooz/engine';

export interface BotRequest {
  id: number;
  state: GameState;
  options: BotOptions;
}

export interface BotResponse {
  id: number;
  move: number | null;
}

/**
 * Runs the move search off the main thread.
 *
 * A 9x9 search spends up to 1.2 seconds in a tight loop. On the main thread
 * that would freeze scrolling, the turn indicator and any in-flight animation
 * for its whole duration; here the interface stays live and the result arrives
 * as a message.
 */
self.addEventListener('message', (event: MessageEvent<BotRequest>) => {
  const { id, state, options } = event.data;
  const move = findBestMove(state, options);
  const response: BotResponse = { id, move };
  self.postMessage(response);
});
