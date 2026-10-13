import { describe, expect, it, vi } from 'vitest';
import { ACTIVE_WINDOW_MS, Notifier } from './notices.js';
import type { PushService } from './push.js';

function fakePush() {
  const send = vi.fn(async () => 1);
  return { push: { enabled: true, send } as unknown as PushService, send };
}

const notice = { kind: 'system' as const, title: 'Hello', body: 'World' };

describe('notifier', () => {
  it('prefers the live socket and keeps the inbox for when there is none', () => {
    let clock = 1_000;
    const live = new Set(['online']);
    const notifier = new Notifier({ now: () => clock, live: (id) => live.has(id) });

    notifier.notify('online', notice);
    notifier.notify('offline', notice);
    expect(notifier.drain('online')).toEqual([]);
    const drained = notifier.drain('offline');
    expect(drained).toHaveLength(1);
    expect(drained[0]).toMatchObject({ ...notice, at: 1_000 });
    expect(notifier.drain('offline')).toEqual([]);

    // Inbox entries expire.
    notifier.notify('offline', notice);
    clock += 16 * 60_000;
    expect(notifier.drain('offline')).toEqual([]);
  });

  it('pushes only to players who are neither connected nor looking at the app', () => {
    let clock = 0;
    const { push, send } = fakePush();
    const notifier = new Notifier({ now: () => clock, push, live: (id) => id === 'socket' });

    notifier.notify('socket', notice);
    expect(send).not.toHaveBeenCalled();

    notifier.heartbeat('polling');
    notifier.notify('polling', notice);
    expect(send).not.toHaveBeenCalled();

    clock += ACTIVE_WINDOW_MS + 1;
    notifier.notify('polling', notice);
    expect(send).toHaveBeenCalledTimes(1);

    notifier.notify('away', notice, { push: false });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('bounds each inbox', () => {
    const notifier = new Notifier();
    for (let i = 0; i < 30; i++) notifier.notify('a', { ...notice, title: `n${i}` });
    const drained = notifier.drain('a');
    expect(drained).toHaveLength(20);
    expect(drained[0]?.title).toBe('n10');
  });

  it('retracts notices that are no longer true', () => {
    const notifier = new Notifier();
    notifier.notify('a', { ...notice, kind: 'challenge', code: 'ABCDEF' });
    notifier.notify('a', notice);
    notifier.retract('a', (entry) => entry.code === 'ABCDEF');
    expect(notifier.drain('a').map((entry) => entry.kind)).toEqual(['system']);
  });
});
