import { Buffer } from 'node:buffer';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { accountIdSchema, displayNameSchema, parseAuthHeader } from '@/protocol';
import { type Context, Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { addressOf, FixedWindowLimiter, readJson } from './api.js';
import type { AccountRow, Accounts } from './db/accounts.js';
import { nameKey } from './db/accounts.js';
import type { Db } from './db/database.js';
import type { Matches } from './db/matches.js';
import { log } from './log.js';
import { nameProblem } from './name-filter.js';

/**
 * Moderation: acting on reports.
 *
 * Players file reports (`POST /api/reports`); a human reads them here through
 * an admin API protected by `ADMIN_TOKEN`, and can mute, suspend or rename an
 * account. Nothing is automatic - the competitive layer's anti-cheat flags and
 * the name filter only put things in front of a moderator, they never punish
 * on their own.
 *
 * A **mute** stops an account reaching other players: its emotes go nowhere,
 * and it cannot send friend requests, challenges or invitations. It can still
 * play. A **ban** refuses the account at `hello` and on every API route except
 * the two that GDPR says it must keep: exporting its data and deleting it.
 * Either can be temporary or permanent, and revoked.
 */

export type SanctionKind = 'mute' | 'ban';

export interface Sanction {
  id: string;
  accountId: string;
  kind: SanctionKind;
  reason: string;
  createdAt: number;
  expiresAt: number | null;
  revokedAt: number | null;
}

interface SanctionRow {
  id: string;
  account_id: string;
  kind: SanctionKind;
  reason: string;
  created_at: number;
  expires_at: number | null;
  revoked_at: number | null;
}

interface ReportRow {
  id: string;
  reporter_id: string;
  match_id: string;
  reason: string;
  detail: string | null;
  created_at: number;
  resolved_at: number | null;
  resolution: string | null;
}

const MAX_SANCTION_HOURS = 24 * 365 * 5;

export class Moderation {
  constructor(
    private readonly db: Db,
    private readonly accounts: Accounts,
    private readonly now: () => number = Date.now,
  ) {}

  /** The sanction of this kind in force right now, longest-lasting first. */
  active(accountId: string, kind: SanctionKind): Sanction | null {
    const row = this.db
      .prepare<[string, string, number], SanctionRow>(
        `SELECT * FROM sanctions
         WHERE account_id = ? AND kind = ? AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > ?)
         ORDER BY expires_at IS NULL DESC, expires_at DESC LIMIT 1`,
      )
      .get(accountId, kind, this.now());
    return row ? toSanction(row) : null;
  }

  isBanned(accountId: string): boolean {
    return this.active(accountId, 'ban') !== null;
  }

  isMuted(accountId: string): boolean {
    return this.active(accountId, 'mute') !== null || this.isBanned(accountId);
  }

  /** What a banned player is told, or `null` when they are not banned. */
  banMessage(accountId: string): string | null {
    const ban = this.active(accountId, 'ban');
    if (!ban) return null;
    return ban.expiresAt === null
      ? 'This account has been suspended.'
      : `This account is suspended until ${new Date(ban.expiresAt).toISOString().slice(0, 16).replace('T', ' ')} UTC.`;
  }

  sanction(accountId: string, kind: SanctionKind, hours: number | null, reason: string): Sanction {
    const at = this.now();
    const row: SanctionRow = {
      id: randomUUID(),
      account_id: accountId,
      kind,
      reason,
      created_at: at,
      expires_at: hours === null ? null : at + Math.round(hours * 3_600_000),
      revoked_at: null,
    };
    this.db
      .prepare(
        'INSERT INTO sanctions (id, account_id, kind, reason, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(row.id, row.account_id, row.kind, row.reason, row.created_at, row.expires_at);
    log.info('moderation.sanction', { accountId, kind, hours, sanctionId: row.id });
    return toSanction(row);
  }

  revoke(sanctionId: string): boolean {
    const changed =
      this.db
        .prepare('UPDATE sanctions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
        .run(this.now(), sanctionId).changes > 0;
    if (changed) log.info('moderation.revoke', { sanctionId });
    return changed;
  }

  sanctionsFor(accountId: string): Sanction[] {
    return this.db
      .prepare<[string], SanctionRow>(
        'SELECT * FROM sanctions WHERE account_id = ? ORDER BY created_at DESC',
      )
      .all(accountId)
      .map(toSanction);
  }

  reports(status: 'open' | 'resolved' | 'all', limit: number, offset: number): ReportRow[] {
    const where =
      status === 'open'
        ? 'WHERE resolved_at IS NULL'
        : status === 'resolved'
          ? 'WHERE resolved_at IS NOT NULL'
          : '';
    return this.db
      .prepare<[number, number], ReportRow>(
        `SELECT * FROM reports ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(limit, offset);
  }

  resolveReport(reportId: string, resolution: string): boolean {
    return (
      this.db
        .prepare('UPDATE reports SET resolved_at = ?, resolution = ? WHERE id = ?')
        .run(this.now(), resolution, reportId).changes > 0
    );
  }

  /** Reports filed about matches this account played, by somebody else. */
  reportsAgainst(accountId: string): number {
    return (
      this.db
        .prepare<[string, string, string], { n: number }>(
          `SELECT COUNT(*) AS n FROM reports r JOIN matches m ON m.id = r.match_id
           WHERE (m.x_id = ? OR m.o_id = ?) AND r.reporter_id != ?`,
        )
        .get(accountId, accountId, accountId)?.n ?? 0
    );
  }

  /**
   * Replace an account's name with a neutral one, for a name the filter
   * missed. The player can choose again; the filter checks whatever they pick.
   */
  forceRename(accountId: string, requested?: string): AccountRow | null {
    if (requested !== undefined) return this.accounts.update(accountId, { displayName: requested });
    for (let attempt = 0; attempt < 20; attempt++) {
      const number = randomBytes(3).readUIntBE(0, 3) % 1_000_000;
      const name = `Player${String(number).padStart(6, '0')}`;
      const renamed = this.accounts.update(accountId, { displayName: name });
      if (renamed) return renamed;
    }
    return null;
  }

  /** Whether the competitive layer's anti-cheat table exists in this database. */
  hasFlags(): boolean {
    return (
      this.db
        .prepare<[], { name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'anticheat_flags'",
        )
        .get() !== undefined
    );
  }

  flags(status: string, limit: number): Record<string, unknown>[] {
    if (!this.hasFlags()) return [];
    return this.db
      .prepare<[string, number], Record<string, unknown>>(
        'SELECT * FROM anticheat_flags WHERE status = ? ORDER BY created_at DESC LIMIT ?',
      )
      .all(status, limit);
  }

  reviewFlag(flagId: string, status: 'dismissed' | 'confirmed', note: string | null): boolean {
    if (!this.hasFlags()) return false;
    return (
      this.db
        .prepare(
          "UPDATE anticheat_flags SET status = ?, reviewed_by = 'admin', reviewed_at = ?, note = ? WHERE id = ?",
        )
        .run(status, this.now(), note, flagId).changes > 0
    );
  }

  /**
   * A middleware that refuses a banned account on every API route but data
   * export and deletion.
   *
   * The ban is looked up first, by the id in the header alone, so ordinary
   * traffic costs one indexed read; only a banned id has its token verified,
   * which keeps the refusal from telling a stranger who is banned.
   */
  banGuard(): MiddlewareHandler {
    return async (c, next) => {
      const credentials = parseAuthHeader(c.req.header('authorization'));
      if (credentials && this.isBanned(credentials.accountId)) {
        const path = new URL(c.req.url).pathname;
        const exempt =
          (c.req.method === 'GET' && path === '/api/account/export') ||
          (c.req.method === 'DELETE' && path === '/api/account');
        if (!exempt && this.accounts.authenticate(credentials.accountId, credentials.token)) {
          return c.json(
            { error: this.banMessage(credentials.accountId) ?? 'Suspended', banned: true },
            403,
          );
        }
      }
      await next();
    };
  }
}

function toSanction(row: SanctionRow): Sanction {
  return {
    id: row.id,
    accountId: row.account_id,
    kind: row.kind,
    reason: row.reason,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

// ---------------------------------------------------------------------------
// Admin API
// ---------------------------------------------------------------------------

/** Shorter than this and a token is guessable, so the admin API stays off. */
export const MIN_ADMIN_TOKEN_LENGTH = 24;

export interface AdminOptions {
  readonly token: string | undefined;
  readonly moderation: Moderation;
  readonly accounts: Accounts;
  readonly matches: Matches;
  readonly db: Db;
  readonly trustProxy?: boolean;
  readonly now?: () => number;
  /** Kick a sanctioned account off the server (resigning its live game). */
  readonly evict?: (accountId: string, message: string) => void;
  /** More admin routes (telemetry, backups) mounted behind the same check. */
  readonly extend?: (app: Hono) => void;
}

/** Hash both sides first so the comparison is constant-time and length-blind. */
export function tokenMatches(presented: string, expected: string): boolean {
  const a = createHash('sha256').update(presented).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

const sanctionRequestSchema = z.object({
  kind: z.enum(['mute', 'ban']),
  /** Omitted or null for permanent. */
  hours: z.number().positive().max(MAX_SANCTION_HOURS).nullable().optional(),
  reason: z.string().trim().min(1).max(300),
});

const resolveRequestSchema = z.object({ resolution: z.string().trim().min(1).max(300) });
const renameRequestSchema = z.object({ displayName: displayNameSchema.optional() });
const flagReviewSchema = z.object({
  status: z.enum(['dismissed', 'confirmed']),
  note: z.string().max(300).optional(),
});

export function createAdminApi(options: AdminOptions): Hono {
  const app = new Hono();
  const { moderation, accounts, matches } = options;
  const now = options.now ?? Date.now;
  const token =
    options.token && options.token.length >= MIN_ADMIN_TOKEN_LENGTH ? options.token : null;
  const failures = new FixedWindowLimiter(20, 15 * 60_000, now);

  // Without a token the admin API does not exist, rather than existing with
  // no lock on it.
  app.use('/admin/*', async (c, next) => {
    if (!token) return c.json({ error: 'Not found' }, 404);
    const address = addressOf(c, options.trustProxy ?? false);
    if (failures.exhausted(address)) return c.json({ error: 'Too many attempts' }, 429);

    const header = c.req.header('authorization') ?? '';
    const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!tokenMatches(presented, token)) {
      failures.hit(address);
      log.warn('admin.auth.failed', { address });
      return c.json({ error: 'Unauthorized' }, 401);
    }
    await next();
  });

  const lookup = (id: string) => accounts.get(id);

  app.get('/admin/reports', (c) => {
    const status = c.req.query('status');
    const filter = status === 'resolved' || status === 'all' ? status : 'open';
    const limit = clamp(Number(c.req.query('limit') ?? 50), 1, 200);
    const offset = clamp(Number(c.req.query('offset') ?? 0), 0, 1_000_000);

    const reports = moderation.reports(filter, limit, offset).map((report) => {
      const match = matches.find(report.match_id, null, lookup);
      const reporter = accounts.get(report.reporter_id);
      // The reported player is whichever side of the match did not file it.
      const reported = match
        ? [match.players.x, match.players.o].find(
            (player) => player.accountId !== report.reporter_id,
          )
        : undefined;
      return {
        id: report.id,
        reason: report.reason,
        detail: report.detail,
        createdAt: report.created_at,
        resolvedAt: report.resolved_at,
        resolution: report.resolution,
        reporter: reporter ? accountView(reporter) : { accountId: report.reporter_id },
        reported: reported
          ? {
              ...reported,
              reportsAgainst: moderation.reportsAgainst(reported.accountId),
              muted: moderation.isMuted(reported.accountId),
              banned: moderation.isBanned(reported.accountId),
            }
          : null,
        match: match
          ? {
              matchId: match.matchId,
              mode: match.mode,
              kind: match.kind,
              reason: match.reason,
              playedAt: match.playedAt,
              moveCount: match.moveCount,
            }
          : null,
      };
    });
    return c.json({ reports });
  });

  app.post('/admin/reports/:id/resolve', async (c) => {
    const parsed = resolveRequestSchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);
    if (!moderation.resolveReport(c.req.param('id'), parsed.data.resolution)) {
      return c.json({ error: 'Not found' }, 404);
    }
    log.info('admin.report.resolve', { reportId: c.req.param('id') });
    return c.json({ ok: true });
  });

  app.get('/admin/matches/:id', (c) => {
    const record = matches.find(c.req.param('id'), null, lookup);
    if (!record) return c.json({ error: 'Not found' }, 404);
    return c.json(record);
  });

  /** Accounts by name prefix, for finding the one a player complained about. */
  app.get('/admin/accounts', (c) => {
    const key = nameKey((c.req.query('q') ?? '').slice(0, 20));
    if (key.length < 1) return c.json({ accounts: [] });
    const rows = options.db
      .prepare<[string], { id: string }>(
        "SELECT id FROM accounts WHERE name_key LIKE ? ESCAPE '\\' ORDER BY name_key LIMIT 25",
      )
      .all(`${key.replace(/[\\%_]/g, (character) => `\\${character}`)}%`);
    return c.json({
      accounts: rows.flatMap((row) => {
        const account = accounts.get(row.id);
        return account ? [accountView(account)] : [];
      }),
    });
  });

  app.get('/admin/accounts/:id', (c) => {
    const id = idParam(c);
    const account = id ? accounts.get(id) : null;
    if (!account) return c.json({ error: 'Not found' }, 404);
    return c.json({
      account: accountView(account),
      sanctions: moderation.sanctionsFor(account.id),
      reportsAgainst: moderation.reportsAgainst(account.id),
      flags: moderation.hasFlags()
        ? options.db
            .prepare<[string], Record<string, unknown>>(
              'SELECT * FROM anticheat_flags WHERE account_id = ? ORDER BY created_at DESC LIMIT 50',
            )
            .all(account.id)
        : null,
      recentMatches: matches.recentFor(account.id, 20, lookup),
    });
  });

  app.post('/admin/accounts/:id/sanctions', async (c) => {
    const id = idParam(c);
    const account = id ? accounts.get(id) : null;
    if (!account) return c.json({ error: 'Not found' }, 404);
    const parsed = sanctionRequestSchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);

    const sanction = moderation.sanction(
      account.id,
      parsed.data.kind,
      parsed.data.hours ?? null,
      parsed.data.reason,
    );
    if (sanction.kind === 'ban') {
      options.evict?.(account.id, moderation.banMessage(account.id) ?? 'Suspended.');
    }
    return c.json({ sanction }, 201);
  });

  app.delete('/admin/sanctions/:id', (c) => {
    if (!moderation.revoke(c.req.param('id'))) return c.json({ error: 'Not found' }, 404);
    return c.json({ ok: true });
  });

  app.post('/admin/accounts/:id/rename', async (c) => {
    const id = idParam(c);
    if (!id || !accounts.get(id)) return c.json({ error: 'Not found' }, 404);
    const parsed = renameRequestSchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);
    const renamed = moderation.forceRename(id, parsed.data.displayName);
    if (!renamed) return c.json({ error: 'That name is taken' }, 409);
    log.info('admin.rename', { accountId: id });
    return c.json({ account: accountView(renamed) });
  });

  /** The competitive layer's anti-cheat suspicions, when it is installed. */
  app.get('/admin/flags', (c) => {
    const status = (c.req.query('status') ?? 'open').slice(0, 20);
    const limit = clamp(Number(c.req.query('limit') ?? 50), 1, 200);
    return c.json({ available: moderation.hasFlags(), flags: moderation.flags(status, limit) });
  });

  app.post('/admin/flags/:id/review', async (c) => {
    const parsed = flagReviewSchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);
    if (!moderation.reviewFlag(c.req.param('id'), parsed.data.status, parsed.data.note ?? null)) {
      return c.json({ error: 'Not found' }, 404);
    }
    return c.json({ ok: true });
  });

  options.extend?.(app);
  return app;
}

/** An account as a moderator sees it, with why its name would be refused. */
function accountView(account: AccountRow) {
  return {
    accountId: account.id,
    displayName: account.displayName,
    avatar: account.avatar,
    createdAt: account.createdAt,
    claimed: account.claimed,
    bot: account.bot === true,
    nameProblem: nameProblem(account.displayName),
  };
}

function idParam(c: Context): string | null {
  const parsed = accountIdSchema.safeParse(c.req.param('id'));
  return parsed.success ? parsed.data : null;
}

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : min;
}
