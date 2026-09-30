import { authHeader, PROTOCOL_VERSION } from '@dooz/protocol';
import type { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApi } from './api.js';
import { Accounts } from './db/accounts.js';
import { type Db, openDatabase } from './db/database.js';
import { Matches } from './db/matches.js';
import { PLACEMENT_GAMES } from './rating.js';

let db: Db;
let accounts: Accounts;
let matches: Matches;
let api: Hono;
let clock = 1_700_000_000_000;

beforeEach(() => {
  clock = 1_700_000_000_000;
  db = openDatabase(':memory:');
  accounts = new Accounts(db, () => clock);
  matches = new Matches(db);
  api = createApi({
    accounts,
    matches,
    db,
    now: () => clock,
    health: () => ({ sessions: 0, rooms: 0, queued: 0 }),
  });
});

afterEach(() => db.close());

async function call(
  path: string,
  init: RequestInit & { auth?: { accountId: string; token: string } } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  if (init.auth) headers.set('authorization', authHeader(init.auth.accountId, init.auth.token));

  const response = await api.request(path, { ...init, headers });
  const text = await response.text();
  return { status: response.status, body: text ? (JSON.parse(text) as never) : {} };
}

/** A fresh account with credentials, via the public route. */
async function signUp(displayName?: string) {
  const { body } = await call('/api/accounts', {
    method: 'POST',
    body: JSON.stringify(displayName ? { displayName } : {}),
  });
  return body as unknown as {
    accountId: string;
    token: string;
    profile: { displayName: string };
  };
}

describe('health', () => {
  it('reports the protocol version', async () => {
    const { status, body } = await call('/health');
    expect(status).toBe(200);
    expect(body['status']).toBe('ok');
    expect(body['version']).toBe(PROTOCOL_VERSION);
  });
});

describe('modes', () => {
  it('lists every mode with its rules', async () => {
    const { body } = await call('/api/modes');
    const modes = body['modes'] as { id: string; rules: string[]; config: unknown }[];

    expect(modes.length).toBeGreaterThan(4);
    expect(modes.every((mode) => mode.rules.length > 0)).toBe(true);
    expect(modes.some((mode) => mode.id === 'ultimate')).toBe(true);
  });
});

describe('account creation', () => {
  it('issues credentials and a profile', async () => {
    const { status, body } = await call('/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ displayName: 'Ada' }),
    });

    expect(status).toBe(201);
    expect(body['accountId']).toHaveLength(36);
    expect(body['token']).toHaveLength(43);
    expect((body['profile'] as { displayName: string }).displayName).toBe('Ada');
  });

  it('rejects a name the rules do not allow', async () => {
    for (const displayName of ['a', ' ', 'x'.repeat(40), 'bad‮name', 'two  spaces']) {
      const { status } = await call('/api/accounts', {
        method: 'POST',
        body: JSON.stringify({ displayName }),
      });
      expect(status).toBe(400);
    }
  });

  it('rate-limits a flood of sign-ups from one address', async () => {
    const api2 = createApi({
      accounts,
      matches,
      db,
      now: () => clock,
      signupsPerHour: 2,
      health: () => ({ sessions: 0, rooms: 0, queued: 0 }),
    });

    const make = () =>
      api2.request('/api/accounts', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
        body: '{}',
      });

    expect((await make()).status).toBe(201);
    expect((await make()).status).toBe(201);
    expect((await make()).status).toBe(429);
  });
});

describe('profile', () => {
  it('refuses to answer without credentials', async () => {
    expect((await call('/api/profile')).status).toBe(401);
    expect((await call('/api/matches')).status).toBe(401);
  });

  it('refuses a malformed authorization header', async () => {
    for (const header of ['', 'Bearer', 'Bearer nope', 'Basic abc', 'Bearer .token']) {
      const response = await api.request('/api/profile', { headers: { authorization: header } });
      expect(response.status).toBe(401);
    }
  });

  it('returns the account behind a valid token', async () => {
    const ada = await signUp('Ada');
    const { status, body } = await call('/api/profile', { auth: ada });

    expect(status).toBe(200);
    expect((body['profile'] as { displayName: string }).displayName).toBe('Ada');
  });

  it('never returns a token or a password hash', async () => {
    const ada = await signUp('Ada');
    accounts.claim(ada.accountId, 'correct horse battery');
    const { body } = await call('/api/profile', { auth: ada });

    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain(ada.token);
    expect(serialised).not.toContain('scrypt$');
  });

  it('renames an account', async () => {
    const ada = await signUp('Ada');
    const { status, body } = await call('/api/profile', {
      method: 'PATCH',
      auth: ada,
      body: JSON.stringify({ displayName: 'Ada L', avatar: 'owl' }),
    });

    expect(status).toBe(200);
    expect((body['profile'] as { displayName: string; avatar: string }).displayName).toBe('Ada L');
  });

  it('refuses a rename onto a name in use', async () => {
    await signUp('Taken');
    const ada = await signUp('Ada');

    const { status } = await call('/api/profile', {
      method: 'PATCH',
      auth: ada,
      body: JSON.stringify({ displayName: 'Taken' }),
    });
    expect(status).toBe(409);
  });

  it('exposes another player publicly without their private fields', async () => {
    const ada = await signUp('Ada');
    const { status, body } = await call(`/api/players/${ada.accountId}`);

    expect(status).toBe(200);
    expect(JSON.stringify(body)).not.toContain(ada.token);
    expect((body['profile'] as { displayName: string }).displayName).toBe('Ada');
  });

  it('404s for a player who does not exist', async () => {
    const { status } = await call('/api/players/00000000-0000-4000-8000-000000000000');
    expect(status).toBe(404);
  });
});

describe('claim and login', () => {
  it('attaches a password and then signs in with it', async () => {
    const ada = await signUp('Ada');

    const claimed = await call('/api/accounts/claim', {
      method: 'POST',
      auth: ada,
      body: JSON.stringify({ password: 'correct horse battery' }),
    });
    expect(claimed.status).toBe(200);

    const login = await call('/api/accounts/login', {
      method: 'POST',
      body: JSON.stringify({ displayName: 'Ada', password: 'correct horse battery' }),
    });
    expect(login.status).toBe(200);
    expect(login.body['accountId']).toBe(ada.accountId);
    expect(login.body['token']).not.toBe(ada.token);
  });

  it('refuses a short password', async () => {
    const ada = await signUp('Ada');
    const { status } = await call('/api/accounts/claim', {
      method: 'POST',
      auth: ada,
      body: JSON.stringify({ password: 'short' }),
    });
    expect(status).toBe(400);
  });

  it('gives the same answer for a wrong password and an unknown name', async () => {
    const ada = await signUp('Ada');
    await call('/api/accounts/claim', {
      method: 'POST',
      auth: ada,
      body: JSON.stringify({ password: 'correct horse battery' }),
    });

    const wrong = await call('/api/accounts/login', {
      method: 'POST',
      body: JSON.stringify({ displayName: 'Ada', password: 'not the password' }),
    });
    const missing = await call('/api/accounts/login', {
      method: 'POST',
      body: JSON.stringify({ displayName: 'Nobody', password: 'not the password' }),
    });

    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(wrong.body).toEqual(missing.body);
  });
});

describe('leaderboard', () => {
  async function seed(name: string, rating: number, played: number) {
    const account = await signUp(name);
    for (let game = 0; game < played; game++) {
      accounts.recordResult(account.accountId, 'classic', 'win', rating);
    }
    return account;
  }

  it('lists settled accounts in rating order', async () => {
    await seed('Top', 1800, PLACEMENT_GAMES);
    await seed('Middle', 1400, PLACEMENT_GAMES);
    await seed('Rookie', 2400, 1);

    const { body } = await call('/api/leaderboard?mode=classic');
    const entries = body['entries'] as { rank: number; profile: { displayName: string } }[];

    expect(entries.map((entry) => entry.profile.displayName)).toEqual(['Top', 'Middle']);
    expect(entries[0]?.rank).toBe(1);
  });

  it('caps the limit whatever is asked for', async () => {
    for (let index = 0; index < 5; index++) await seed(`P${index}`, 1300, PLACEMENT_GAMES);
    const { body } = await call('/api/leaderboard?mode=classic&limit=99999');
    expect((body['entries'] as unknown[]).length).toBeLessThanOrEqual(100);
  });

  it('survives a nonsense limit', async () => {
    const { status } = await call('/api/leaderboard?mode=classic&limit=abc');
    expect(status).toBe(200);
  });

  it('returns an empty ladder rather than an error for an unknown mode', async () => {
    const { status, body } = await call('/api/leaderboard?mode=not-a-mode');
    expect(status).toBe(200);
    expect(body['entries']).toEqual([]);
  });
});

describe('matches', () => {
  function recordMatch(xId: string, oId: string) {
    return matches.record({
      mode: 'classic',
      config: { variant: 'classic', size: 3, winLength: 3 },
      kind: 'ranked',
      xId,
      oId,
      startingPlayer: 1,
      moves: [0, 3, 1, 4, 2],
      moveTimesMs: [100, 200, 100, 300, 150],
      winner: 1,
      reason: 'line',
      playedAt: clock,
      durationMs: 850,
      rating: { x: { before: 1200, after: 1216 }, o: { before: 1200, after: 1184 } },
    });
  }

  it('lists a players own matches from their point of view', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    recordMatch(ada.accountId, bob.accountId);

    const fromAda = await call('/api/matches', { auth: ada });
    const fromBob = await call('/api/matches', { auth: bob });

    const adaMatch = (fromAda.body['matches'] as { outcome: string; ratingDelta: number }[])[0]!;
    const bobMatch = (fromBob.body['matches'] as { outcome: string; ratingDelta: number }[])[0]!;

    expect(adaMatch.outcome).toBe('win');
    expect(adaMatch.ratingDelta).toBe(16);
    expect(bobMatch.outcome).toBe('loss');
    expect(bobMatch.ratingDelta).toBe(-16);
  });

  it('returns a replayable record', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    const matchId = recordMatch(ada.accountId, bob.accountId);

    const { status, body } = await call(`/api/matches/${matchId}`);
    expect(status).toBe(200);
    expect(body['moves']).toEqual([0, 3, 1, 4, 2]);
    expect(body['startingPlayer']).toBe(1);
    expect((body['players'] as { x: { displayName: string } }).x.displayName).toBe('Ada');
  });

  it('404s for a match that does not exist', async () => {
    const { status } = await call('/api/matches/00000000-0000-4000-8000-000000000000');
    expect(status).toBe(404);
  });
});

describe('reports', () => {
  it('accepts a report from a player who was in the match', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    const matchId = matches.record({
      mode: 'classic',
      config: { variant: 'classic', size: 3, winLength: 3 },
      kind: 'casual',
      xId: ada.accountId,
      oId: bob.accountId,
      startingPlayer: 1,
      moves: [0],
      moveTimesMs: [10],
      winner: null,
      reason: 'draw',
      playedAt: clock,
      durationMs: 10,
      rating: null,
    });

    const { status } = await call('/api/reports', {
      method: 'POST',
      auth: ada,
      body: JSON.stringify({ matchId, reason: 'name' }),
    });
    expect(status).toBe(201);
  });

  it('refuses a report about a match the reporter was not in', async () => {
    const ada = await signUp('Ada');
    const bob = await signUp('Bob');
    const cat = await signUp('Cat');
    const matchId = matches.record({
      mode: 'classic',
      config: { variant: 'classic', size: 3, winLength: 3 },
      kind: 'casual',
      xId: ada.accountId,
      oId: bob.accountId,
      startingPlayer: 1,
      moves: [0],
      moveTimesMs: [10],
      winner: null,
      reason: 'draw',
      playedAt: clock,
      durationMs: 10,
      rating: null,
    });

    const { status } = await call('/api/reports', {
      method: 'POST',
      auth: cat,
      body: JSON.stringify({ matchId, reason: 'cheating' }),
    });
    expect(status).toBe(403);
  });

  it('refuses an unauthenticated report', async () => {
    const { status } = await call('/api/reports', {
      method: 'POST',
      body: JSON.stringify({ matchId: 'x', reason: 'other' }),
    });
    expect(status).toBe(401);
  });
});

describe('malformed input', () => {
  it('does not crash on an empty or broken body', async () => {
    for (const body of ['', '{', 'null', '[]', '"string"']) {
      const response = await api.request('/api/accounts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
      expect([201, 400]).toContain(response.status);
    }
  });
});
