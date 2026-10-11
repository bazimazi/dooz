/// <reference lib="webworker" />
import { chooseMove, type BotMove, type BotOptions, type GameState } from '@/game/engine';

export interface BotRequest {
  type: 'search';
  id: number;
  state: GameState;
  options: BotOptions;
}

export interface BotResponse {
  id: number;
  move: number | null;
  depth: number;
  nodes: number;
  reason: BotMove['reason'];
  score: number;
}

// The client terminates this worker when a position is abandoned. A cancel
// message cannot interrupt chooseMove's synchronous search loop.
self.addEventListener('message', (event: MessageEvent<BotRequest>) => {
  const { id, state, options } = event.data;
  const chosen = chooseMove(state, options);
  const response: BotResponse = {
    id,
    move: chosen?.move ?? null,
    depth: chosen?.depth ?? 0,
    nodes: chosen?.nodes ?? 0,
    reason: chosen?.reason ?? 'heuristic',
    score: chosen?.score ?? 0,
  };
  self.postMessage(response);
});
