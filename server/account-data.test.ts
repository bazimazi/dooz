import { authHeader } from '@/protocol';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AccountData, generateRecoveryCode } from './account-data.js';
import { Correspondence } from './correspondence.js';
import { Friends } from './friends.js';
import { Notifier } from './notices.js';
import { PushService } from './push.js';
import { CONFIGS, createHarness, type Harness, playMoves } from './test-support.js';

let harness: Harness;
let data: AccountData;
let friends: Friends;
let correspondence: Correspondence;
let app: Hono;

beforeEach(() => {
  harness = createHarness();
  friends = new Friends(harness.db, () => harness.now());
  const notifier = new Notifier({ now: () => harness.now() });
  correspondence = new Correspondence({
    db: harness.db,
    accounts: harness.accounts,
    matches: harness.matches,
    friends,
    notifier,
    now: () => harness.now(),
    random: () => 0.1,
  });
  data = new AccountData({
    db: harness.db,
    accounts: harness.accounts,
    matches: harness.matches,
    correspondence,
    now: () => harness.now(),
    evict: (accountId) => harness.lobby.evict(accountId, 'unauthorized', 'Deleted.'),
  });
  app = new Hono();
  app.route('/', data.routes());
});

afterEach(() => harness.close());

async function call(
  path: string,
  init: RequestInit & { auth?: { accountId: string; token: string } } = {},
) {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  if (init.auth) headers.set('authorization', authHeader(init.auth.accountId, init.auth.token));
  const response = await app.request(path, { ...init, headers });
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
  };
}

function makeAccount(name: string) {
  const { account, token } = harness.accounts.create(name, 'fox');
  return { accountId: account.id, token };
}

describe('recovery codes', () => {
  it('look like XXXX-XXXX-XXXX from the unambiguous alphabet', () => {
    expect(generateRecoveryCode()).toMatch(
      /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/,
    );
  });

  it('are shown once, stored hashed, and each signs in exactly once', async () => {
    const ada = makeAccount('Ada');
    const issued = await call('/api/account/recovery-codes', { method: 'POST', auth: ada });
    expect(issued.headers.get('cache-control')).toBe('no-store');
    const codes = issued.body['codes'] as string[];
    expect(codes).toHaveLength(8);

    const stored = harness.db
      .prepare<[], { code_hash: string }>('SELECT code_hash FROM recovery_codes')
      .all()
      .map((row) => row.code_hash);
    for (const code of codes) expect(stored.join(' ')).not.toContain(code.replace(/-/g, ''));

    // Lower case and without dashes is accepted, as a person might type it.
    const recovered = await call('/api/account/recover', {
      method: 'POST',
      body: JSON.stringify({
        displayName: 'ada',
        code: codes[0]!.toLowerCase().replace(/-/g, ' '),
      }),
    });
    expect(recovered.status).toBe(200);
    expect(recovered.body['remaining']).toBe(7);

    // The new token works; the old one was rotated out.
    const token = recovered.body['token'] as string;
    expect(harness.accounts.authenticate(ada.accountId, token)?.id).toBe(ada.accountId);
    expect(harness.accounts.authenticate(ada.accountId, ada.token)).toBeNull();

    const reused = await call('/api/account/recover', {
      method: 'POST',
      body: JSON.stringify({ displayName: 'Ada', code: codes[0] }),
    });
    expect(reused.status).toBe(401);
  });

  it('give the same answer for an unknown name and a wrong code, and lock a guessed name', async () => {
    makeAccount('Ada');
    const unknown = await call('/api/account/recover', {
      method: 'POST',
      body: JSON.stringify({ displayName: 'Nobody', code: 'AAAA-BBBB-CCCC' }),
    });
    const wrong = await call('/api/account/recover', {
      method: 'POST',
      body: JSON.stringify({ displayName: 'Ada', code: 'AAAA-BBBB-CCCC' }),
    });
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);

    for (let i = 0; i < 6; i++) {
      await call('/api/account/recover', {
        method: 'POST',
        body: JSON.stringify({ displayName: 'Ada', code: 'AAAA-BBBB-CCCC' }),
      });
    }
    const locked = await call('/api/account/recover', {
      method: 'POST',
      body: JSON.stringify({ displayName: 'Ada', code: 'AAAA-BBBB-CCCC' }),
    });
    expect(locked.status).toBe(429);
  });

  it('a new set retires the old one', async () => {
    const ada = makeAccount('Ada');
    const first = (await call('/api/account/recovery-codes', { method: 'POST', auth: ada })).body[
      'codes'
    ] as string[];
    await call('/api/account/recovery-codes', { method: 'POST', auth: ada });
    expect(data.recover('Ada', first[0]!.replace(/-/g, ''))).toBeNull();
    expect((await call('/api/account/recovery-codes', { auth: ada })).body['remaining']).toBe(8);
  });
});

describe('export', () => {
  it('returns everything about the account without its secrets', async () => {
    const ada = harness.join('Ada');
    const bob = harness.join('Bob');
    friends.request(ada.accountId, bob.accountId, () => true);
    friends.accept(bob.accountId, ada.accountId);
    ada.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    bob.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    playMoves(ada, bob, [0, 3, 1, 4, 2]);
    data.issueRecoveryCodes(ada.accountId);
    data.putCloudSave(ada.accountId, { v: 1, progress: { xp: 10 } });

    const exported = await call('/api/account/export', {
      auth: { accountId: ada.accountId, token: ada.token },
    });
    expect(exported.status).toBe(200);
    expect(exported.headers.get('content-disposition')).toContain('attachment');
    const body = exported.body;
    expect((body['account'] as Record<string, unknown>)['display_name']).toBe('Ada');
    expect(body['matches']).toHaveLength(1);
    const tables = body['tables'] as Record<string, Record<string, unknown>[]>;
    expect(tables['friendships']?.length).toBe(2);
    expect(tables['stats']?.length).toBeGreaterThan(0);
    expect(tables['cloud_saves']?.length).toBe(1);

    const text = JSON.stringify(body);
    expect(text).not.toContain('token_hash');
    expect(text).not.toContain('password_hash');
    expect(text).not.toContain('code_hash');
    expect(text).not.toContain(ada.token);
  });
});

describe('deletion', () => {
  it('requires the name typed again', async () => {
    const ada = makeAccount('Ada');
    const refused = await call('/api/account', {
      method: 'DELETE',
      auth: ada,
      body: JSON.stringify({ confirm: 'Bob' }),
    });
    expect(refused.status).toBe(400);
    expect(harness.accounts.get(ada.accountId)).not.toBeNull();
  });

  it('resolves games, then removes the account and everything keyed to it', async () => {
    const ada = harness.join('Ada');
    const bob = harness.join('Bob');
    friends.request(ada.accountId, bob.accountId, () => true);
    friends.accept(bob.accountId, ada.accountId);
    const invite = correspondence.invite(ada.accountId, bob.accountId, CONFIGS.classic, 1);
    const game = correspondence.accept(bob.accountId, invite.ok ? invite.value.id : '');
    ada.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    bob.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    data.putCloudSave(ada.accountId, { v: 1, progress: { xp: 10 } });

    const deleted = await call('/api/account', {
      method: 'DELETE',
      auth: { accountId: ada.accountId, token: ada.token },
      body: JSON.stringify({ confirm: 'ADA' }),
    });
    expect(deleted.status).toBe(204);

    // The live game was resigned in Bob's favour, and the socket closed.
    expect(bob.last('result')?.result.reason).toBe('resign');
    expect(ada.closed).toBe(true);
    // The correspondence game was forfeited, then went with the account.
    expect(game.ok).toBe(true);
    expect(harness.accounts.get(ada.accountId)).toBeNull();
    const count = (sql: string) =>
      harness.db.prepare<[string], { n: number }>(sql).get(ada.accountId)?.n ?? 0;
    expect(count('SELECT COUNT(*) AS n FROM friendships WHERE account_id = ?')).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM friendships WHERE friend_id = ?')).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM cloud_saves WHERE account_id = ?')).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM stats WHERE account_id = ?')).toBe(0);

    // Bob's history keeps the match, with Ada as a former player.
    const history = harness.matches.recentFor(bob.accountId, 10, (id) => harness.accounts.get(id));
    expect(history.some((match) => match.opponent.displayName === 'Former player')).toBe(true);
    expect(harness.accounts.statsFor(bob.accountId, 'classic').won).toBe(2);
  });
});

describe('cloud save', () => {
  it('starts empty, merges each upload, and bumps the revision', async () => {
    const ada = makeAccount('Ada');
    expect((await call('/api/cloud-save', { auth: ada })).body).toEqual({
      revision: 0,
      data: null,
      updatedAt: null,
    });

    const first = await call('/api/cloud-save', {
      method: 'PUT',
      auth: ada,
      body: JSON.stringify({
        data: { v: 1, progress: { journey: { 'pip-1': 3 }, puzzles: ['a'] } },
      }),
    });
    expect(first.body['revision']).toBe(1);

    // A second device with different progress loses nothing.
    const second = await call('/api/cloud-save', {
      method: 'PUT',
      auth: ada,
      body: JSON.stringify({
        data: { v: 1, progress: { journey: { 'pip-1': 1, 'mo-1': 2 }, puzzles: ['b'] } },
      }),
    });
    expect(second.body['revision']).toBe(2);
    expect(second.body['data']).toEqual({
      v: 1,
      progress: { journey: { 'pip-1': 3, 'mo-1': 2 }, puzzles: ['a', 'b'] },
    });
  });

  it('refuses oversized and malformed saves', async () => {
    const ada = makeAccount('Ada');
    const huge = await call('/api/cloud-save', {
      method: 'PUT',
      auth: ada,
      body: JSON.stringify({ data: { v: 1, progress: { blob: 'x'.repeat(70 * 1024) } } }),
    });
    expect(huge.status).toBe(413);
    const bad = await call('/api/cloud-save', { method: 'PUT', auth: ada, body: '[1,2,3]' });
    expect(bad.status).toBe(400);
    expect((await call('/api/cloud-save', { method: 'PUT', body: '{}' })).status).toBe(401);
  });
});

// Push subscriptions are keyed to the account too; deleting it removes them.
describe('deletion and devices', () => {
  it('takes push subscriptions with the account', () => {
    const ada = makeAccount('Ada');
    const push = new PushService(harness.db, null);
    harness.db
      .prepare(
        'INSERT INTO push_subscriptions (endpoint, account_id, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run('https://fcm.googleapis.com/x', ada.accountId, 'k', 'a', 1);
    expect(push.count(ada.accountId)).toBe(1);
    data.deleteAccount(ada.accountId);
    expect(push.count(ada.accountId)).toBe(0);
  });
});
