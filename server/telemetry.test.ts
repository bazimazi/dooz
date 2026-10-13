import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type Db, openDatabase } from './db/database.js';
import { scrub, Telemetry } from './telemetry.js';

let db: Db;
let clock: number;
let telemetry: Telemetry;
let app: ReturnType<Telemetry['routes']>;

beforeEach(() => {
  clock = Date.UTC(2026, 9, 13, 12);
  db = openDatabase(':memory:');
  telemetry = new Telemetry(db, { now: () => clock, batchesPerMinute: 5, maxEventsPerDay: 3 });
  app = telemetry.routes();
});
afterEach(() => db.close());

function batch(events: unknown[]) {
  return JSON.stringify({ v: 1, app: { version: '0.3.0', platform: 'web' }, events });
}

function post(body: string, contentType = 'text/plain') {
  return app.request('/api/telemetry', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
  });
}

describe('telemetry', () => {
  it('stores events and counts them in the daily rollup', async () => {
    const response = await post(
      batch([
        { kind: 'event', name: 'session.start', at: clock },
        { kind: 'event', name: 'game.start', at: clock, data: { mode: 'classic', kind: 'bot' } },
        { kind: 'event', name: 'game.start', at: clock, data: { mode: 'gomoku-15', kind: 'bot' } },
      ]),
    );
    expect(response.status).toBe(204);

    const rollup = db
      .prepare<[], { name: string; count: number }>(
        'SELECT name, count FROM telemetry_daily ORDER BY name',
      )
      .all();
    expect(rollup).toEqual([
      { name: 'game.start', count: 2 },
      { name: 'session.start', count: 1 },
    ]);
    expect(telemetry.metrics()['events24h']).toBe(3);
  });

  it('keeps counting in the rollup once the daily raw cap is reached', async () => {
    const events = Array.from({ length: 5 }, () => ({ kind: 'event', name: 'tap', at: clock }));
    await post(batch(events));
    expect(
      db.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM telemetry_events').get()?.n,
    ).toBe(3);
    expect(
      db.prepare<[], { count: number }>('SELECT count FROM telemetry_daily').get()?.count,
    ).toBe(5);
  });

  it('groups errors by fingerprint and scrubs what could identify someone', async () => {
    const error = (line: number) => ({
      kind: 'error',
      name: 'TypeError',
      at: clock,
      message: `Cannot read x of undefined at index ${line} for ada@example.com`,
      stack: `TypeError: boom\n    at render (https://dooz.example/assets/app.js?token=secret:${line}:7)`,
      source: 'window',
    });
    await post(batch([error(10), error(99)]));
    const rows = db
      .prepare<[], { count: number; message: string; stack: string }>(
        'SELECT count, message, stack FROM telemetry_errors',
      )
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.count).toBe(2);
    expect(rows[0]?.message).not.toContain('ada@example.com');
    expect(rows[0]?.stack).not.toContain('secret');
  });

  it('rejects malformed, oversized and over-eager batches', async () => {
    expect((await post('not json')).status).toBe(400);
    expect((await post(batch([{ kind: 'event', name: 'Bad Name!', at: 1 }]))).status).toBe(400);
    expect(
      (await post(batch([{ kind: 'event', name: 'x', at: 1, data: { nested: { a: 1 } } }]))).status,
    ).toBe(400);
    expect(
      (await post(batch([{ kind: 'event', name: 'x', at: 1, data: { s: 'y'.repeat(40_000) } }])))
        .status,
    ).toBe(413);

    for (let i = 0; i < 5; i++) await post(batch([{ kind: 'event', name: 'x', at: 1 }]));
    expect((await post(batch([{ kind: 'event', name: 'x', at: 1 }]))).status).toBe(429);
  });

  it('expires raw events but keeps the rollup', async () => {
    await post(batch([{ kind: 'event', name: 'x', at: clock }]));
    clock += 31 * 86_400_000;
    telemetry.sweep();
    expect(
      db.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM telemetry_events').get()?.n,
    ).toBe(0);
    expect(
      db.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM telemetry_daily').get()?.n,
    ).toBe(1);
  });

  it('scrub strips queries, emails and long tokens', () => {
    expect(scrub('see https://a.example/p?code=ABC#x and mail me@x.io key ' + 'k'.repeat(40))).toBe(
      'see https://a.example/p and mail <email> key <id>',
    );
  });
});
