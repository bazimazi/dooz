import { authHeader, PROTOCOL_VERSION } from '@/protocol';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApi } from './api.js';
import { createAdminApi, MIN_ADMIN_TOKEN_LENGTH, Moderation, tokenMatches } from './moderation.js';
import { CONFIGS, createHarness, type Harness, playMoves } from './test-support.js';

const TOKEN = 'a-very-long-admin-token-for-tests-0123456789';

let harness: Harness;
let moderation: Moderation;
let app: Hono;

beforeEach(() => {
  harness = createHarness();
  moderation = new Moderation(harness.db, harness.accounts, () => harness.now());
  harness.lobby.social = {
    refuse: (accountId) => moderation.banMessage(accountId),
    isMuted: (accountId) => moderation.isMuted(accountId),
  };
  app = new Hono();
  app.use('/api/*', moderation.banGuard());
  app.route(
    '/',
    createApi({
      accounts: harness.accounts,
      matches: harness.matches,
      db: harness.db,
      now: () => harness.now(),
      health: () => ({ sessions: 0, rooms: 0, queued: 0 }),
    }),
  );
  app.route(
    '/',
    createAdminApi({
      token: TOKEN,
      moderation,
      accounts: harness.accounts,
      matches: harness.matches,
      db: harness.db,
      now: () => harness.now(),
      evict: (accountId, message) => harness.lobby.evict(accountId, 'banned', message),
    }),
  );
});

afterEach(() => harness.close());

async function admin(path: string, init: RequestInit = {}, token = TOKEN) {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  headers.set('authorization', `Bearer ${token}`);
  const response = await app.request(path, { ...init, headers });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
  };
}

describe('admin authentication', () => {
  it('compares tokens without leaking length', () => {
    expect(tokenMatches(TOKEN, TOKEN)).toBe(true);
    expect(tokenMatches(TOKEN.slice(0, -1), TOKEN)).toBe(false);
    expect(tokenMatches('', TOKEN)).toBe(false);
  });

  it('refuses a wrong token and locks out a guessing address', async () => {
    expect((await admin('/admin/reports', {}, 'wrong')).status).toBe(401);
    for (let i = 0; i < 25; i++) await admin('/admin/reports', {}, `wrong-${i}`);
    expect((await admin('/admin/reports')).status).toBe(429);
  });

  it('does not exist without a long enough token', async () => {
    const bare = createAdminApi({
      token: 'x'.repeat(MIN_ADMIN_TOKEN_LENGTH - 1),
      moderation,
      accounts: harness.accounts,
      matches: harness.matches,
      db: harness.db,
    });
    const response = await bare.request('/admin/reports', {
      headers: { authorization: `Bearer ${'x'.repeat(MIN_ADMIN_TOKEN_LENGTH - 1)}` },
    });
    expect(response.status).toBe(404);
  });
});

describe('reports and sanctions', () => {
  function playedMatch() {
    const ada = harness.join('Ada');
    const rude = harness.join('Rude');
    ada.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    rude.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    playMoves(ada, rude, [0, 3, 1, 4, 2]);
    const matchId = ada.last('result')!.result.matchId;
    return { ada, rude, matchId };
  }

  it('lists a report with both players and the match, then resolves it', async () => {
    const { ada, rude, matchId } = playedMatch();
    const filed = await app.request('/api/reports', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: authHeader(ada.accountId, ada.token),
      },
      body: JSON.stringify({ matchId, reason: 'name', detail: 'Offensive name' }),
    });
    expect(filed.status).toBe(201);

    const { body } = await admin('/admin/reports');
    const reports = body['reports'] as {
      id: string;
      reported: { accountId: string; reportsAgainst: number };
      match: { matchId: string };
    }[];
    expect(reports).toHaveLength(1);
    expect(reports[0]?.reported.accountId).toBe(rude.accountId);
    expect(reports[0]?.reported.reportsAgainst).toBe(1);
    expect(reports[0]?.match.matchId).toBe(matchId);

    expect((await admin(`/admin/matches/${matchId}`)).body['moves']).toEqual([0, 3, 1, 4, 2]);

    const resolved = await admin(`/admin/reports/${reports[0]!.id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution: 'Renamed' }),
    });
    expect(resolved.status).toBe(200);
    expect(((await admin('/admin/reports')).body['reports'] as unknown[]).length).toBe(0);
    expect(
      ((await admin('/admin/reports?status=resolved')).body['reports'] as unknown[]).length,
    ).toBe(1);
  });

  it('a ban closes the live connection, resigns the game, and refuses hello', async () => {
    const ada = harness.join('Ada');
    const cheat = harness.join('Cheat');
    ada.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    cheat.send({ type: 'queue', config: CONFIGS.classic, ranked: false });

    const banned = await admin(`/admin/accounts/${cheat.accountId}/sanctions`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'ban', hours: 24, reason: 'Engine use' }),
    });
    expect(banned.status).toBe(201);
    expect(cheat.closed).toBe(true);
    expect(cheat.last('error')?.code).toBe('banned');
    expect(ada.last('result')?.result.reason).toBe('resign');

    const again = harness.connect();
    again.send({
      type: 'hello',
      version: PROTOCOL_VERSION,
      accountId: cheat.accountId,
      token: cheat.token,
    });
    expect(again.last('error')?.code).toBe('banned');
    expect(again.last('error')?.message).toMatch(/suspended until/);
    expect(again.last('welcome')).toBeUndefined();

    // The ban expires on its own.
    harness.advance(25 * 3600_000);
    const later = harness.connect();
    later.send({
      type: 'hello',
      version: PROTOCOL_VERSION,
      accountId: cheat.accountId,
      token: cheat.token,
    });
    expect(later.last('welcome')).toBeDefined();
  });

  it('a ban resigns a game whose seat is only being held for a reconnect', async () => {
    const ada = harness.join('Ada');
    const gone = harness.join('Gone');
    ada.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    gone.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    gone.drop();

    await admin(`/admin/accounts/${gone.accountId}/sanctions`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'ban', reason: 'Abuse' }),
    });
    expect(ada.last('result')?.result.reason).toBe('resign');
    expect(ada.last('opponentLeft')).toBeDefined();
    expect(harness.lobby.roomCount).toBe(0);
  });

  it('a banned account keeps only export and deletion on the API', async () => {
    const { account, token } = harness.accounts.create('Banned', 'fox');
    moderation.sanction(account.id, 'ban', null, 'Abuse');
    const headers = { authorization: authHeader(account.id, token) };
    expect((await app.request('/api/profile', { headers })).status).toBe(403);
    // A stranger holding only the id learns nothing.
    const forged = { authorization: authHeader(account.id, 'x'.repeat(43)) };
    expect((await app.request('/api/profile', { headers: forged })).status).toBe(401);
  });

  it('a mute silences emotes but not play, and can be revoked', async () => {
    const ada = harness.join('Ada');
    const loud = harness.join('Loud');
    ada.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    loud.send({ type: 'queue', config: CONFIGS.classic, ranked: false });

    const { body } = await admin(`/admin/accounts/${loud.accountId}/sanctions`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'mute', reason: 'Spam' }),
    });
    loud.send({ type: 'emote', emote: 'gg' });
    expect(ada.last('emote')).toBeUndefined();
    expect(loud.closed).toBe(false);

    const sanctionId = (body['sanction'] as { id: string }).id;
    expect((await admin(`/admin/sanctions/${sanctionId}`, { method: 'DELETE' })).status).toBe(200);
    harness.advance(10_000);
    loud.send({ type: 'emote', emote: 'gg' });
    expect(ada.last('emote')?.emote).toBe('gg');
  });

  it('renames an account to a neutral name, or a chosen one', async () => {
    const { account } = harness.accounts.create('Badname', 'fox');
    const renamed = await admin(`/admin/accounts/${account.id}/rename`, {
      method: 'POST',
      body: '{}',
    });
    expect((renamed.body['account'] as { displayName: string }).displayName).toMatch(
      /^Player\d{6}$/,
    );
    const chosen = await admin(`/admin/accounts/${account.id}/rename`, {
      method: 'POST',
      body: JSON.stringify({ displayName: 'Fresh Start' }),
    });
    expect((chosen.body['account'] as { displayName: string }).displayName).toBe('Fresh Start');
  });

  it('shows an account with its sanctions and the anti-cheat flags when present', async () => {
    const { account } = harness.accounts.create('Suspect', 'fox');
    moderation.sanction(account.id, 'mute', 1, 'Spam');
    const { body } = await admin(`/admin/accounts/${account.id}`);
    expect((body['sanctions'] as unknown[]).length).toBe(1);
    expect(Array.isArray(body['flags']) || body['flags'] === null).toBe(true);

    const flags = await admin('/admin/flags');
    expect(flags.body['available']).toBe(moderation.hasFlags());
    const search = await admin('/admin/accounts?q=sus');
    expect((search.body['accounts'] as { displayName: string }[])[0]?.displayName).toBe('Suspect');
  });
});

describe('name filter on the account routes', () => {
  it('replaces an offensive name at sign-up and refuses one on rename', async () => {
    const created = await app.request('/api/accounts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'Sh1tHead' }),
    });
    const body = (await created.json()) as {
      accountId: string;
      token: string;
      profile: { displayName: string };
    };
    expect(body.profile.displayName).toMatch(/^Player/);

    const renamed = await app.request('/api/profile', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: authHeader(body.accountId, body.token),
      },
      body: JSON.stringify({ displayName: 'Admin' }),
    });
    expect(renamed.status).toBe(400);
  });
});
