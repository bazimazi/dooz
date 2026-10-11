import { legalMoves, type GameState } from '@/game/engine';
import type { BotMove, BotOptions } from '@/game/engine/bot';
import type { BotRequest, BotResponse } from './bot.worker';

// A missing/crashed worker must not put a multi-second search on the UI thread.
const INLINE_BUDGET_MS = 24;

/** One lazily started worker, reused between completed searches. */
export class BotSearch {
  private worker: Worker | null = null;
  private workerFailed = false;
  private nextId = 0;
  private cancelActive: (() => void) | null = null;

  search(
    game: GameState,
    options: BotOptions,
    onResult: (move: BotMove | null) => void,
  ): () => void {
    this.cancelActive?.();
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let detach = () => {};
    const finish = (move: BotMove | null) => {
      if (!active) return;
      active = false;
      detach();
      this.cancelActive = null;
      onResult(move);
    };
    const cancel = () => {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      detach();
      // Message handlers cannot run while the worker is in synchronous search.
      // Termination interrupts it, including on browsers without shared memory.
      this.stopWorker();
      this.cancelActive = null;
    };
    this.cancelActive = cancel;

    const fallback = () => {
      void import('@/game/engine/bot')
        .then(({ chooseMove }) => {
          if (!active) return;
          timer = setTimeout(() => {
            if (!active) return;
            finish(
              chooseMove(game, {
                ...options,
                timeBudgetMs: Math.min(options.timeBudgetMs ?? INLINE_BUDGET_MS, INLINE_BUDGET_MS),
              }),
            );
          }, 0);
        })
        .catch(() => {
          // Even a failed fallback chunk must leave offline play usable.
          const move = legalMoves(game)[0];
          finish(
            move === undefined ? null : { move, depth: 0, nodes: 0, score: 0, reason: 'heuristic' },
          );
        });
    };

    if (!this.worker && !this.workerFailed && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./bot.worker.ts', import.meta.url), { type: 'module' });
      } catch {
        this.workerFailed = true;
      }
    }
    const worker = this.worker;
    if (!worker) {
      fallback();
      return cancel;
    }

    const id = ++this.nextId;
    const onMessage = (event: MessageEvent<BotResponse>) => {
      if (event.data.id !== id) return;
      const { move, depth, nodes, reason, score } = event.data;
      finish(move === null ? null : { move, depth, nodes, reason, score });
    };
    const onError = (event: Event) => {
      event.preventDefault();
      if (!active) return;
      detach();
      this.stopWorker();
      this.workerFailed = true;
      fallback();
    };
    detach = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      worker.removeEventListener('messageerror', onError);
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.addEventListener('messageerror', onError);
    const request: BotRequest = { type: 'search', id, state: game, options };
    try {
      worker.postMessage(request);
    } catch {
      onError(new Event('error'));
    }
    return cancel;
  }

  dispose(): void {
    this.cancelActive?.();
    this.stopWorker();
  }

  private stopWorker(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
