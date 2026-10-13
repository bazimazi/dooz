import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import {
  TELEMETRY_MAX_BYTES,
  type TelemetryBatch,
  telemetryBatchSchema,
  type TelemetryEvent,
} from '@/protocol/social';
import { Hono } from 'hono';
import { addressOf, FixedWindowLimiter } from './api.js';
import type { Db } from './db/database.js';
import { log } from './log.js';

/**
 * Self-hosted, anonymous telemetry and crash reports.
 *
 * What arrives: a handful of named events (a session started, a game started
 * or finished in a mode, onboarding completed) and client errors with their
 * stack. What does not: an account id, a name, an address, a device id, or any
 * identifier that lasts longer than one app launch. The client also drops it
 * all when the player opts out or the browser sends Do Not Track.
 *
 * Storage is bounded three ways. Raw events are kept for a retention window
 * and capped per day; a daily rollup of counts outlives them; and errors are
 * grouped by a fingerprint, so a crash seen ten thousand times is one row with
 * a count rather than ten thousand rows.
 *
 * The endpoint is unauthenticated - it has to work before an account exists -
 * so it is rate limited per address, size capped before parsing, and parsed
 * against a strict schema like everything else here.
 */

export interface TelemetryOptions {
  readonly now?: () => number;
  readonly trustProxy?: boolean;
  /** Raw events kept, in days. The daily rollup is kept regardless. */
  readonly retentionDays?: number;
  /** Raw events stored per day before only the rollup is counted. */
  readonly maxEventsPerDay?: number;
  /** Batches per address per minute. */
  readonly batchesPerMinute?: number;
}

const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_MAX_EVENTS_PER_DAY = 200_000;
const ERROR_RETENTION_DAYS = 90;
const DAY_MS = 86_400_000;

export class Telemetry {
  private readonly now: () => number;
  private readonly retentionDays: number;
  private readonly maxEventsPerDay: number;
  private readonly limiter: FixedWindowLimiter;
  private storedToday = { day: '', count: 0 };
  private received = 0;
  private rejected = 0;

  constructor(
    private readonly db: Db,
    private readonly options: TelemetryOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;
    this.maxEventsPerDay = options.maxEventsPerDay ?? DEFAULT_MAX_EVENTS_PER_DAY;
    this.limiter = new FixedWindowLimiter(options.batchesPerMinute ?? 20, 60_000, this.now);
  }

  /** Store one validated batch. Returns how many events were accepted. */
  ingest(batch: TelemetryBatch): number {
    const at = this.now();
    const day = new Date(at).toISOString().slice(0, 10);
    if (this.storedToday.day !== day) this.storedToday = { day, count: 0 };

    const rollup = this.db.prepare(
      `INSERT INTO telemetry_daily (day, kind, name, count) VALUES (?, ?, ?, 1)
       ON CONFLICT(day, kind, name) DO UPDATE SET count = count + 1`,
    );
    const insertEvent = this.db.prepare(
      `INSERT INTO telemetry_events (kind, name, data, app_version, platform, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const upsertError = this.db.prepare(
      `INSERT INTO telemetry_errors (fingerprint, message, stack, source, app_version, count, first_seen, last_seen)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(fingerprint) DO UPDATE SET
         count = count + 1, last_seen = excluded.last_seen, app_version = excluded.app_version`,
    );

    this.db.transaction(() => {
      for (const event of batch.events) {
        rollup.run(day, event.kind, event.name);
        if (event.kind === 'error') {
          const stack = scrub(event.stack ?? '');
          const message = scrub(event.message);
          upsertError.run(
            fingerprint(event, stack),
            message,
            stack || null,
            event.source ?? null,
            batch.app.version,
            at,
            at,
          );
          continue;
        }
        if (this.storedToday.count >= this.maxEventsPerDay) continue;
        this.storedToday.count += 1;
        insertEvent.run(
          event.kind,
          event.name,
          event.data ? JSON.stringify(event.data) : null,
          batch.app.version,
          batch.app.platform,
          at,
        );
      }
    })();

    this.received += batch.events.length;
    return batch.events.length;
  }

  /** Drop raw events past the retention window and errors not seen in months. */
  sweep(): void {
    const at = this.now();
    this.db
      .prepare('DELETE FROM telemetry_events WHERE created_at < ?')
      .run(at - this.retentionDays * DAY_MS);
    this.db
      .prepare('DELETE FROM telemetry_errors WHERE last_seen < ?')
      .run(at - ERROR_RETENTION_DAYS * DAY_MS);
  }

  /** Counts for `/health`. Nothing here identifies anyone. */
  metrics(): Record<string, number> {
    const since = this.now() - DAY_MS;
    const count = (sql: string) => this.db.prepare<[number], { n: number }>(sql).get(since)?.n ?? 0;
    return {
      events24h: count('SELECT COUNT(*) AS n FROM telemetry_events WHERE created_at >= ?'),
      errors24h: count(
        'SELECT COALESCE(SUM(count), 0) AS n FROM telemetry_errors WHERE last_seen >= ?',
      ),
      received: this.received,
      rejected: this.rejected,
    };
  }

  /** The admin view: daily rollups and the most frequent recent errors. */
  summary(days: number): Record<string, unknown> {
    const since = new Date(this.now() - days * DAY_MS).toISOString().slice(0, 10);
    return {
      daily: this.db
        .prepare<[string], Record<string, unknown>>(
          'SELECT day, kind, name, count FROM telemetry_daily WHERE day >= ? ORDER BY day DESC, count DESC',
        )
        .all(since),
      errors: this.db
        .prepare<[number], Record<string, unknown>>(
          `SELECT fingerprint, message, stack, source, app_version AS appVersion, count,
                  first_seen AS firstSeen, last_seen AS lastSeen
           FROM telemetry_errors WHERE last_seen >= ? ORDER BY count DESC LIMIT 50`,
        )
        .all(this.now() - days * DAY_MS),
    };
  }

  routes(): Hono {
    const app = new Hono();
    const trustProxy = this.options.trustProxy ?? false;

    app.post('/api/telemetry', async (c) => {
      if (!this.limiter.hit(addressOf(c, trustProxy))) {
        this.rejected += 1;
        return c.body(null, 429);
      }
      const declared = Number(c.req.header('content-length') ?? 0);
      if (declared > TELEMETRY_MAX_BYTES) {
        this.rejected += 1;
        return c.body(null, 413);
      }
      // Read as text whatever the content type: `sendBeacon` posts text/plain
      // to stay clear of a CORS preflight it could not wait for.
      const text = await c.req.text();
      if (Buffer.byteLength(text) > TELEMETRY_MAX_BYTES) {
        this.rejected += 1;
        return c.body(null, 413);
      }

      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
      const parsed = telemetryBatchSchema.safeParse(payload);
      if (!parsed.success) {
        this.rejected += 1;
        return c.json({ error: 'Invalid batch' }, 400);
      }

      try {
        this.ingest(parsed.data);
      } catch (error) {
        log.exception('telemetry.ingest.failed', error);
        return c.body(null, 500);
      }
      return c.body(null, 204);
    });

    return app;
  }
}

/**
 * Strip what could identify a person from an error before it is stored: query
 * strings and fragments from URLs (they can carry room codes and tokens), and
 * anything shaped like an email address or a long opaque token.
 */
export function scrub(text: string): string {
  return text
    .replace(/(https?:\/\/[^\s?#)]+)[?#][^\s)]*/g, '$1')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>')
    .replace(/\b[\w-]{32,}\b/g, '<id>')
    .slice(0, 4000);
}

/**
 * Errors are the same error when they have the same name, message shape and
 * top frame. Numbers are blanked first, so "index 3 out of range" and "index 7
 * out of range" group together, and so do line:column positions that move
 * between builds.
 */
function fingerprint(event: Extract<TelemetryEvent, { kind: 'error' }>, stack: string): string {
  const topFrame =
    stack
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('at ') || line.includes('@')) ?? '';
  const shape = [event.name, event.message, topFrame.replace(/:\d+:\d+/g, '')]
    .join('|')
    .replace(/\d+/g, '#');
  return createHash('sha256').update(shape).digest('base64url').slice(0, 32);
}
