import { randomUUID } from 'node:crypto';
import { GAME_MODES, RANKED_MODES } from '@dooz/engine';
import {
  type AccountProfile,
  accountProfileSchema,
  claimRequestSchema,
  createAccountRequestSchema,
  type LeaderboardEntry,
  loginRequestSchema,
  parseAuthHeader,
  PROTOCOL_VERSION,
  reportRequestSchema,
  updateProfileRequestSchema,
} from '@dooz/protocol';
import { Hono } from 'hono';
import type { Accounts, AccountRow } from './db/accounts.js';
import { toPublicProfile } from './db/accounts.js';
import type { Db } from './db/database.js';
import type { Matches } from './db/matches.js';
import { log } from './log.js';
import { PLACEMENT_GAMES, rankFor } from './rating.js';

/**
 * The HTTP half of the server.
 *
 * Everything here is either public and read-only (the leaderboard, a shared
 * replay) or authenticated with the same account token the socket uses. The
 * routes never accept a rating, a result or a statistic from a client: those
 * are written only by the lobby, from games it refereed itself.
 */

export interface ApiOptions {
  readonly accounts: Accounts;
  readonly matches: Matches;
  readonly db: Db;
  readonly now?: () => number;
  /** Requests per minute per address for the account-creation routes. */
  readonly signupsPerHour?: number;
  readonly health: () => { sessions: number; rooms: number; queued: number };
}

const MAX_LEADERBOARD = 100;
const MAX_HISTORY = 50;
const DEFAULT_SIGNUPS_PER_HOUR = 20;

export function createApi(options: ApiOptions): Hono {
  const { accounts, matches, db } = options;
  const now = options.now ?? Date.now;
  const app = new Hono();

  /**
   * Account creation is the one unauthenticated write, so it is the one route
   * worth rate limiting by address: without it a script could fill the accounts
   * table, and every name it took is a name a real player cannot have.
   */
  const signups = new Map<string, { count: number; windowStart: number }>();
  const signupLimit = options.signupsPerHour ?? DEFAULT_SIGNUPS_PER_HOUR;

  function allowSignup(address: string): boolean {
    const hour = 3_600_000;
    const entry = signups.get(address);
    if (!entry || now() - entry.windowStart > hour) {
      signups.set(address, { count: 1, windowStart: now() });
      return true;
    }
    if (entry.count >= signupLimit) return false;
    entry.count += 1;
    return true;
  }

  /** The account behind the `Authorization` header, or `null`. */
  function authenticate(header: string | undefined): AccountRow | null {
    const credentials = parseAuthHeader(header);
    if (!credentials) return null;
    return accounts.authenticate(credentials.accountId, credentials.token);
  }

  function fullProfile(account: AccountRow): AccountProfile {
    const stats = accounts.allStats(account.id);
    const best = stats.reduce((top, entry) => Math.max(top, entry.rating), 0);

    return accountProfileSchema.parse({
      ...toPublicProfile(account, best > 0 ? best : null),
      createdAt: account.createdAt,
      claimed: account.claimed,
      stats: stats.map((entry) => ({
        mode: entry.mode,
        rating: entry.rating,
        played: entry.played,
        won: entry.won,
        lost: entry.lost,
        drawn: entry.drawn,
        bestStreak: entry.bestStreak,
        streak: entry.streak,
      })),
      achievements: accounts.achievements(account.id),
    });
  }

  // -------------------------------------------------------------------------
  // Public
  // -------------------------------------------------------------------------

  app.get('/health', (c) => {
    const state = options.health();
    return c.json({ status: 'ok', version: PROTOCOL_VERSION, ...state });
  });

  /** The mode catalogue, so a client can render a picker it did not hard-code. */
  app.get('/api/modes', (c) =>
    c.json({
      modes: GAME_MODES.map((mode) => ({
        id: mode.id,
        name: mode.name,
        tagline: mode.tagline,
        rules: mode.rules,
        config: mode.config,
        group: mode.group,
        ranked: mode.ranked,
        clock: mode.clock,
      })),
    }),
  );

  app.get('/api/leaderboard', (c) => {
    const mode = c.req.query('mode') ?? RANKED_MODES[0]?.id ?? 'classic';
    const requested = Number(c.req.query('limit') ?? 25);
    const limit = Number.isFinite(requested)
      ? Math.min(MAX_LEADERBOARD, Math.max(1, Math.floor(requested)))
      : 25;

    const rows = accounts.leaderboard(mode, limit, PLACEMENT_GAMES);
    const entries: LeaderboardEntry[] = rows.map((row, index) => ({
      rank: index + 1,
      profile: toPublicProfile(row.account, row.stats.rating),
      rating: row.stats.rating,
      played: row.stats.played,
      won: row.stats.won,
      drawn: row.stats.drawn,
      lost: row.stats.lost,
    }));

    return c.json({ mode, placementGames: PLACEMENT_GAMES, entries });
  });

  /**
   * A finished match, for replay.
   *
   * Readable by anyone with the id, which is what makes a replay shareable. The
   * ids are random UUIDs, so this is not an enumerable list of other people's
   * games, and a match record holds nothing private - two display names and the
   * moves both players watched each other make.
   */
  app.get('/api/matches/:id', (c) => {
    const viewer = authenticate(c.req.header('authorization'));
    const record = matches.find(c.req.param('id'), viewer?.id ?? null, (id) => accounts.get(id));
    if (!record) return c.json({ error: 'Not found' }, 404);
    return c.json(record);
  });

  // -------------------------------------------------------------------------
  // Accounts
  // -------------------------------------------------------------------------

  app.post('/api/accounts', async (c) => {
    const address = addressOf(c.req.raw, 'local');
    if (!allowSignup(address)) return c.json({ error: 'Too many accounts from here' }, 429);

    const parsed = createAccountRequestSchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);

    const { account, token } = accounts.create(parsed.data.displayName, parsed.data.avatar);
    log.info('account.create', { accountId: account.id });
    return c.json({ accountId: account.id, token, profile: fullProfile(account) }, 201);
  });

  /** Sign in on another device, for an account that has been given a password. */
  app.post('/api/accounts/login', async (c) => {
    const address = addressOf(c.req.raw, 'local');
    if (!allowSignup(address)) return c.json({ error: 'Too many attempts from here' }, 429);

    const parsed = loginRequestSchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);

    const result = accounts.login(parsed.data.displayName, parsed.data.password);
    if (!result) {
      log.warn('account.login.failed', { name: parsed.data.displayName });
      // Deliberately one message for both "no such name" and "wrong password".
      return c.json({ error: 'Those details did not match an account' }, 401);
    }

    log.info('account.login', { accountId: result.account.id });
    return c.json({
      accountId: result.account.id,
      token: result.token,
      profile: fullProfile(result.account),
    });
  });

  /** Attach a password to the account this token already opens. */
  app.post('/api/accounts/claim', async (c) => {
    const account = authenticate(c.req.header('authorization'));
    if (!account) return c.json({ error: 'Unauthorized' }, 401);

    const parsed = claimRequestSchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: 'Password must be at least 8 characters' }, 400);

    accounts.claim(account.id, parsed.data.password);
    log.info('account.claim', { accountId: account.id });
    const updated = accounts.get(account.id);
    return c.json({ profile: updated ? fullProfile(updated) : fullProfile(account) });
  });

  app.get('/api/profile', (c) => {
    const account = authenticate(c.req.header('authorization'));
    if (!account) return c.json({ error: 'Unauthorized' }, 401);

    const profile = fullProfile(account);
    const ranks = profile.stats.map((entry) => ({
      mode: entry.mode,
      rank: accounts.rankOf(account.id, entry.mode, PLACEMENT_GAMES),
      division: rankFor(entry.rating).name,
    }));
    return c.json({ profile, ranks });
  });

  app.patch('/api/profile', async (c) => {
    const account = authenticate(c.req.header('authorization'));
    if (!account) return c.json({ error: 'Unauthorized' }, 401);

    const parsed = updateProfileRequestSchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);

    const updated = accounts.update(account.id, parsed.data);
    if (!updated) return c.json({ error: 'That name is already taken' }, 409);
    return c.json({ profile: fullProfile(updated) });
  });

  /** Another player's public profile, as shown next to their name in a match. */
  app.get('/api/players/:id', (c) => {
    const account = accounts.get(c.req.param('id'));
    if (!account) return c.json({ error: 'Not found' }, 404);

    const stats = accounts.allStats(account.id);
    const best = stats.reduce((top, entry) => Math.max(top, entry.rating), 0);
    return c.json({
      profile: toPublicProfile(account, best > 0 ? best : null),
      stats: stats.map((entry) => ({
        mode: entry.mode,
        rating: entry.rating,
        played: entry.played,
        won: entry.won,
        lost: entry.lost,
        drawn: entry.drawn,
        bestStreak: entry.bestStreak,
      })),
      achievements: accounts.achievements(account.id),
    });
  });

  app.get('/api/matches', (c) => {
    const account = authenticate(c.req.header('authorization'));
    if (!account) return c.json({ error: 'Unauthorized' }, 401);

    const requested = Number(c.req.query('limit') ?? 20);
    const limit = Number.isFinite(requested)
      ? Math.min(MAX_HISTORY, Math.max(1, Math.floor(requested)))
      : 20;

    return c.json({
      matches: matches.recentFor(account.id, limit, (id) => accounts.get(id)),
    });
  });

  /**
   * Report an opponent.
   *
   * Only a player who was actually in the match may file one, which is what
   * stops the table filling with reports about games the reporter never saw.
   * Nothing acts on these automatically - they are a record for a human to
   * read, and saying otherwise would be pretending to moderate.
   */
  app.post('/api/reports', async (c) => {
    const account = authenticate(c.req.header('authorization'));
    if (!account) return c.json({ error: 'Unauthorized' }, 401);

    const parsed = reportRequestSchema.safeParse(await readJson(c.req.raw));
    if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);

    if (!matches.participated(parsed.data.matchId, account.id)) {
      return c.json({ error: 'You were not in that match' }, 403);
    }

    db.prepare(
      'INSERT INTO reports (id, reporter_id, match_id, reason, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(
      randomUUID(),
      account.id,
      parsed.data.matchId,
      parsed.data.reason,
      parsed.data.detail ?? null,
      now(),
    );

    log.info('report.filed', {
      accountId: account.id,
      matchId: parsed.data.matchId,
      reason: parsed.data.reason,
    });
    return c.json({ ok: true }, 201);
  });

  return app;
}

/**
 * The address a request came from, as far as it can be known.
 *
 * Behind a proxy the socket address is the proxy's, so the forwarded header is
 * preferred when present. It is client-controlled and therefore only good
 * enough for rate limiting, which is all it is used for.
 */
function addressOf(request: Request, fallback: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || fallback;
}

/** Parse a JSON body without throwing on an empty or malformed one. */
async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
