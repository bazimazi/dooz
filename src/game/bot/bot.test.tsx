import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMove, createGame, O, X } from '@/game/engine';
import { chooseMove } from '@/game/engine/bot';
import { BotSearch } from './BotSearch';
import { useBotOpponent } from './useBotOpponent';
import { useSuggestion } from './useSuggestion';

vi.mock('@/game/engine/bot', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/game/engine/bot')>(),
  chooseMove: vi.fn(),
}));

class TestWorker extends EventTarget {
  static instances: TestWorker[] = [];
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    super();
    TestWorker.instances.push(this);
  }
  answer(move = 4) {
    const request = this.postMessage.mock.lastCall![0];
    this.dispatchEvent(new MessageEvent('message', {
      data: { id: request.id, move, nodes: 10, depth: 2, reason: 'search', score: 0 },
    }));
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  TestWorker.instances = [];
  vi.stubGlobal('Worker', TestWorker);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.mocked(chooseMove).mockReturnValue({ move: 4, nodes: 1, depth: 1, reason: 'search', score: 0 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('bot search lifecycle', () => {
  it('starts lazily, reuses completed workers, and stops an abandoned search immediately', () => {
    const search = new BotSearch();
    expect(TestWorker.instances).toHaveLength(0);
    const first = vi.fn();
    const cancelFirst = search.search(createGame(3), {}, first);
    const worker = TestWorker.instances[0]!;
    worker.answer();
    const stale = vi.fn();
    const cancelSecond = search.search(createGame(3), {}, stale);
    expect(TestWorker.instances).toHaveLength(1);
    cancelFirst();
    expect(worker.terminate).not.toHaveBeenCalled();
    cancelSecond();
    expect(worker.terminate).toHaveBeenCalledOnce();
    worker.answer();
    expect(first).toHaveBeenCalledOnce();
    expect(stale).not.toHaveBeenCalled();
    search.dispose();
  });

  it('recovers from a worker error using a bounded fallback and does not retry a broken worker', async () => {
    const search = new BotSearch();
    const answer = vi.fn();
    search.search(createGame(3), { difficulty: 'master' }, answer);
    const worker = TestWorker.instances[0]!;
    worker.dispatchEvent(new Event('error', { cancelable: true }));
    await vi.runAllTimersAsync();
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(chooseMove).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      difficulty: 'master', timeBudgetMs: 24,
    }));
    expect(answer).toHaveBeenCalledOnce();
    search.search(createGame(3), {}, answer);
    await vi.runAllTimersAsync();
    expect(TestWorker.instances).toHaveLength(1);
    expect(answer).toHaveBeenCalledTimes(2);
    search.dispose();
  });

  it('cancels a fallback before it runs or delivers an answer', async () => {
    vi.stubGlobal('Worker', undefined);
    const search = new BotSearch();
    const answer = vi.fn();
    const cancel = search.search(createGame(3), {}, answer);
    cancel();
    await vi.runAllTimersAsync();
    expect(chooseMove).not.toHaveBeenCalled();
    expect(answer).not.toHaveBeenCalled();
  });

  it('terminates the previous search when a new position supersedes it', () => {
    const search = new BotSearch();
    const stale = vi.fn();
    search.search(createGame(3), {}, stale);
    const first = TestWorker.instances[0]!;
    const answer = vi.fn();
    search.search(createGame(3), {}, answer);
    expect(first.terminate).toHaveBeenCalledOnce();
    first.answer();
    TestWorker.instances[1]!.answer();
    expect(stale).not.toHaveBeenCalled();
    expect(answer).toHaveBeenCalledOnce();
    search.dispose();
  });
});

describe('suggestion lifecycle', () => {
  it('only starts on request, ignores duplicate requests, and cancels on a changed position', () => {
    const game = createGame(3, X);
    const { result, rerender, unmount } = renderHook(({ game }) => useSuggestion(game), {
      initialProps: { game },
    });
    expect(TestWorker.instances).toHaveLength(0);
    act(() => { result.current.suggest(); result.current.suggest(); });
    expect(TestWorker.instances).toHaveLength(1);
    const worker = TestWorker.instances[0]!;
    expect(worker.postMessage).toHaveBeenCalledOnce();
    expect(result.current.thinking).toBe(true);
    rerender({ game: applyMove(game, 0)! });
    expect(worker.terminate).toHaveBeenCalledOnce();
    act(() => worker.answer());
    expect(result.current.suggestion).toBeNull();
    expect(result.current.thinking).toBe(false);
    unmount();
  });

  it('stops suggestion work when the tab is hidden', () => {
    const game = createGame(3, X);
    const hook = renderHook(() => useSuggestion(game));
    act(() => hook.result.current.suggest());
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(TestWorker.instances[0]!.terminate).toHaveBeenCalledOnce();
    expect(hook.result.current.thinking).toBe(false);
    hook.unmount();
  });
});

describe('opponent lifecycle', () => {
  it('stops background work and resumes the same turn without applying a stale move', () => {
    const game = createGame(3, O);
    const onMove = vi.fn();
    const { unmount } = renderHook(() => useBotOpponent({ game, botPlayer: O, difficulty: 'master', onMove }));
    const worker = TestWorker.instances[0]!;
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(worker.terminate).toHaveBeenCalledOnce();
    act(() => { worker.answer(); vi.advanceTimersByTime(2000); });
    expect(onMove).not.toHaveBeenCalled();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    const resumed = TestWorker.instances[1]!;
    act(() => resumed.answer());
    act(() => vi.advanceTimersByTime(1099));
    expect(onMove).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onMove).toHaveBeenCalledExactlyOnceWith(4);
    unmount();
    expect(resumed.terminate).toHaveBeenCalledOnce();
  });
});
