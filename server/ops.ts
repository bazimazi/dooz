import { statSync } from 'node:fs';
import type { Hono } from 'hono';
import { AccountData } from './account-data.js';
import { Backups, backupOptionsFromEnv } from './backup.js';
import { Correspondence } from './correspondence.js';
import type { Accounts } from './db/accounts.js';
import type { Db } from './db/database.js';
import type { Matches } from './db/matches.js';
import { Friends } from './friends.js';
import type { Lobby } from './lobby.js';
import { log } from './log.js';
import { createAdminApi, Moderation } from './moderation.js';
import { Notifier } from './notices.js';
import { restoreLiveRooms, saveLiveRooms } from './persistence.js';
import { parsePushHosts, PushService, vapidFromEnv } from './push.js';
import { Social } from './social.js';
import { Telemetry } from './telemetry.js';

/**
 * Wires the social and operations layers into a running server.
 *
 * One call from `main.ts` installs friends and presence, challenges,
 * correspondence games, Web Push, moderation and the admin API, account
 * recovery/export/deletion, cloud saves, telemetry, backups and live-room
 * persistence - so the entry point stays a list of steps, and every piece
 * here can still be constructed on its own in a test.
 *
 * Everything that has to happen on a timer runs on its own unref'd intervals,
 * so none of it can hold the process open or slow the lobby's one-second tick.
 */

export interface OpsOptions {
  readonly app: Hono;
  readonly db: Db;
  readonly accounts: Accounts;
  readonly matches: Matches;
  readonly lobby: Lobby;
  readonly env: NodeJS.ProcessEnv;
  readonly dataFile: string;
  readonly trustProxy: boolean;
}

export interface Ops {
  /**
   * Tell any player about anything - `notify(accountId, { kind, title, body,
   * url })` - over the socket, the in-app inbox, or Web Push, whichever reaches
   * them. Exposed for tournaments and anything else that needs it.
   */
  readonly notifier: Notifier;
  readonly moderation: Moderation;
  readonly push: PushService;
  /** Extra numbers for `/health`. */
  metrics(): Record<string, unknown>;
  /** Write live games down. Call before closing sockets on shutdown. */
  persistRooms(): void;
  stop(): void;
}

const SWEEP_INTERVAL_MS = 60_000;
const TELEMETRY_SWEEP_INTERVAL_MS = 3_600_000;

export function installOps(options: OpsOptions): Ops {
  const { app, db, accounts, matches, lobby, env, trustProxy } = options;
  const startedAt = Date.now();

  const moderation = new Moderation(db, accounts);
  const push = new PushService(db, vapidFromEnv(env), {
    allowedHosts: parsePushHosts(env['PUSH_HOSTS']),
  });
  const notifier = new Notifier({
    push,
    live: (accountId, notice) => lobby.notify(accountId, { type: 'notice', notice }),
  });
  const friends = new Friends(db);
  const correspondence = new Correspondence({ db, accounts, matches, friends, notifier });
  const social = new Social({
    accounts,
    friends,
    notifier,
    correspondence,
    push,
    presence: (accountId) => {
      const activity = lobby.activity(accountId);
      if (!activity.online) return 'offline';
      if (activity.live) return 'playing';
      return activity.queued ? 'queue' : 'online';
    },
    isMuted: (accountId) => moderation.isMuted(accountId),
    openRoom: (session, config) => lobby.openPrivateRoom(session, config),
  });
  const accountData = new AccountData({
    db,
    accounts,
    matches,
    correspondence,
    trustProxy,
    evict: (accountId) => lobby.evict(accountId, 'unauthorized', 'This account was deleted.'),
  });
  const telemetry = new Telemetry(db, {
    trustProxy,
    retentionDays: positive(env['TELEMETRY_RETENTION_DAYS'], 30),
  });
  const backupOptions = backupOptionsFromEnv(env, options.dataFile);
  const backups = backupOptions ? new Backups(db, backupOptions) : null;

  lobby.social = {
    refuse: (accountId) => moderation.banMessage(accountId),
    isMuted: (accountId) => moderation.isMuted(accountId),
    challenge: (session, accountId, config) => social.challenge(session, accountId, config),
  };

  // The ban guard goes in front of every API route; banned accounts keep only
  // export and deletion.
  app.use('/api/*', moderation.banGuard());
  app.route('/', social.routes());
  app.route('/', accountData.routes());
  app.route('/', telemetry.routes());
  app.route(
    '/',
    createAdminApi({
      token: env['ADMIN_TOKEN'],
      moderation,
      accounts,
      matches,
      db,
      trustProxy,
      evict: (accountId, message) => lobby.evict(accountId, 'banned', message),
      extend: (admin) => {
        admin.get('/admin/telemetry', (c) => {
          const days = Math.min(90, Math.max(1, Number(c.req.query('days') ?? 7) || 7));
          return c.json(telemetry.summary(days));
        });
        admin.post('/admin/backups', async (c) => {
          if (!backups) return c.json({ error: 'Backups are off' }, 409);
          try {
            return c.json({ file: await backups.run() }, 201);
          } catch {
            return c.json({ error: 'Backup failed - see the server log' }, 500);
          }
        });
        admin.get('/admin/backups', (c) =>
          c.json({ status: backups?.status() ?? null, files: backups?.list() ?? [] }),
        );
      },
    }),
  );

  if (!push.enabled) log.info('push.disabled', { reason: 'VAPID keys not set' });
  backups?.start();

  // Games that were in progress when the last process stopped.
  try {
    restoreLiveRooms(db, lobby);
  } catch (error) {
    log.exception('rooms.restore.failed', error);
  }

  const timers = [
    setInterval(() => {
      guard('correspondence.sweep', () => correspondence.sweep());
      guard('notices.sweep', () => notifier.sweep());
    }, SWEEP_INTERVAL_MS),
    setInterval(
      () => guard('telemetry.sweep', () => telemetry.sweep()),
      TELEMETRY_SWEEP_INTERVAL_MS,
    ),
  ];
  for (const timer of timers) timer.unref();

  return {
    notifier,
    moderation,
    push,
    metrics: () => ({
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      memoryMb: Math.round(process.memoryUsage().rss / 1_048_576),
      databaseMb: fileMb(options.dataFile),
      correspondenceActive: correspondence.activeCount(),
      push: push.stats(),
      notices: notifier.stats(),
      telemetry: telemetry.metrics(),
      backup: backups
        ? (({ lastAt, lastError, count }) => ({ lastAt, lastError, count }))(backups.status())
        : null,
    }),
    persistRooms: () => {
      try {
        saveLiveRooms(db, lobby);
      } catch (error) {
        log.exception('rooms.save.failed', error);
      }
    },
    stop: () => {
      for (const timer of timers) clearInterval(timer);
      backups?.stop();
    },
  };
}

function guard(step: string, work: () => void): void {
  try {
    work();
  } catch (error) {
    log.exception(`${step}.failed`, error);
  }
}

function positive(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function fileMb(file: string): number | null {
  if (file === ':memory:') return null;
  try {
    return Math.round((statSync(file).size / 1_048_576) * 10) / 10;
  } catch {
    return null;
  }
}
