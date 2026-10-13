import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  browserOptedOut,
  flush,
  pendingEvents,
  reportError,
  setTelemetryChoice,
  telemetryEnabled,
  track,
} from './telemetry';

function setDoNotTrack(value: string | null) {
  Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value });
}

beforeEach(() => {
  localStorage.clear();
  setDoNotTrack(null);
  setTelemetryChoice(true);
  // Drain anything an earlier test left queued.
  (pendingEvents() as unknown[]).splice(0);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('telemetry', () => {
  it('is on by default and off when the player says so', () => {
    expect(telemetryEnabled()).toBe(true);
    track('game.start', { mode: 'classic' });
    expect(pendingEvents()).toHaveLength(1);

    setTelemetryChoice(false);
    expect(telemetryEnabled()).toBe(false);
    // Turning it off drops what was waiting, too.
    expect(pendingEvents()).toHaveLength(0);
    track('game.start');
    expect(pendingEvents()).toHaveLength(0);
  });

  it('respects Do Not Track over the setting', () => {
    setDoNotTrack('1');
    expect(browserOptedOut()).toBe(true);
    expect(telemetryEnabled()).toBe(false);
    track('session.start');
    expect(pendingEvents()).toHaveLength(0);
  });

  it('keeps only plain, short fields', () => {
    track('game.start', { mode: 'x'.repeat(300), 'bad key': 1, ok: true });
    const event = pendingEvents()[0];
    expect(event?.kind === 'event' && event.data).toEqual({ mode: 'x'.repeat(100), ok: true });
  });

  it('reports errors scrubbed, and the same one only a few times', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    const error = new TypeError('failed at https://dooz.example/play?code=SECRET for me@mail.com');
    for (let i = 0; i < 5; i++) reportError(error, 'window');
    await flush();

    const bodies = fetch.mock.calls.map(
      (call) =>
        JSON.parse((call as unknown as [string, RequestInit])[1].body as string) as {
          events: { message: string }[];
        },
    );
    const events = bodies.flatMap((body) => body.events);
    expect(events).toHaveLength(3);
    expect(events[0]?.message).not.toContain('SECRET');
    expect(events[0]?.message).not.toContain('me@mail.com');
  });

  it('posts batches as text/plain without credentials', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    track('session.start');
    await flush();
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/telemetry$/);
    expect((init.headers as Record<string, string>)['content-type']).toBe('text/plain');
    expect(init.credentials).toBe('omit');
    const body = JSON.parse(init.body as string) as { v: number; events: unknown[]; app: unknown };
    expect(body.v).toBe(1);
    expect(body.events).toHaveLength(1);
    expect(JSON.stringify(body)).not.toMatch(/accountId|token/);
  });
});
