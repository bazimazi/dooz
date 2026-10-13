import { authHeader } from '@/protocol';
import { formatFriendCode } from '@/protocol/social';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Correspondence } from './correspondence.js';
import { Friends } from './friends.js';
import { Notifier } from './notices.js';
import { PushService } from './push.js';
import { Social } from './social.js';
import { CONFIGS, type Client, createHarness, type Harness } from './test-support.js';

let harness: Harness;
let friends: Friends;
let notifier: Notifier;
let social: Social;
let api: Hono;

beforeEach(() => {
  harness = createHarness();
  friends = new Friends(harness.db, () => harness.now());
  notifier = new Notifier({
    now: () => harness.now(),
    live: (accountId, notice) => harness.lobby.notify(accountId, { type: 'notice', notice }),
  });
  const correspondence = new Correspondence({
    db: harness.db,
    accounts: harness.accounts,
    matches: harness.matches,
    friends,
    notifier,
    now: () => harness.now(),
  });
  social = new Social({
    accounts: harness.accounts,
    friends,
    notifier,
    correspondence,
    push: new PushService(harness.db, null),
    presence: (accountId) => {
      const activity = harness.lobby.activity(accountId);
      if (!activity.online) return 'offline';
      if (activity.live) return 'playing';
      return activity.queued ? 'queue' : 'online';
    },
    openRoom: (session, config) => harness.lobby.openPrivateRoom(session, config),
    now: () => harness.now(),
  });
  harness.lobby.social = {
    challenge: (session, accountId, config) => social.challenge(session, accountId, config),
  };
  api = new Hono();
  api.route('/', social.routes());
});

afterEach(() => harness.close());

/** An account with credentials but no socket. */
function makeAccount(name: string) {
  const { account, token } = harness.accounts.create(name, 'owl');
  return { accountId: account.id, token };
}

async function call(
  path: string,
  auth: { accountId: string; token: string },
  init: RequestInit = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  headers.set('authorization', authHeader(auth.accountId, auth.token));
  const response = await api.request(path, { ...init, headers });
  const text = await response.text();
  return { status: response.status, body: text ? (JSON.parse(text) as never) : {} };
}

async function befriend(
  a: { accountId: string; token: string },
  b: { accountId: string; token: string },
) {
  const code = (await call('/api/friends', b)).body['code'] as string;
  const sent = await call('/api/friends/requests', a, {
    method: 'POST',
    body: JSON.stringify({ code: formatFriendCode(code).toLowerCase() }),
  });
  expect(sent.status).toBe(201);
  const accepted = await call(`/api/friends/requests/${a.accountId}/accept`, b, { method: 'POST' });
  expect(accepted.status).toBe(200);
}

describe('friends', () => {
  it('requires a token', async () => {
    const response = await api.request('/api/friends');
    expect(response.status).toBe(401);
  });

  it('adds a friend by code, accepts, and lists both ways', async () => {
    const ada = makeAccount('Ada');
    const bob = makeAccount('Bob');
    await befriend(ada, bob);

    const adaView = (await call('/api/friends', ada)).body;
    const bobView = (await call('/api/friends', bob)).body;
    expect(
      (adaView['friends'] as { profile: { displayName: string } }[])[0]?.profile.displayName,
    ).toBe('Bob');
    expect(
      (bobView['friends'] as { profile: { displayName: string } }[])[0]?.profile.displayName,
    ).toBe('Ada');
    expect(adaView['incoming']).toEqual([]);
    expect(bobView['outgoing']).toEqual([]);
  });

  it('keeps the same friend code for an account', async () => {
    const ada = makeAccount('Ada');
    const first = (await call('/api/friends', ada)).body['code'];
    const second = (await call('/api/friends', ada)).body['code'];
    expect(first).toBe(second);
    expect(String(first)).toMatch(/^[A-Z2-9]{8}$/);
  });

  it('treats asking back as accepting', async () => {
    const ada = makeAccount('Ada');
    const bob = makeAccount('Bob');
    await call('/api/friends/requests', ada, {
      method: 'POST',
      body: JSON.stringify({ accountId: bob.accountId }),
    });
    const back = await call('/api/friends/requests', bob, {
      method: 'POST',
      body: JSON.stringify({ accountId: ada.accountId }),
    });
    expect(back.status).toBe(200);
    expect(back.body['status']).toBe('accepted');
    expect(friends.areFriends(ada.accountId, bob.accountId)).toBe(true);
  });

  it('refuses self, unknown codes and duplicates', async () => {
    const ada = makeAccount('Ada');
    const bob = makeAccount('Bob');
    const own = (await call('/api/friends', ada)).body['code'] as string;
    expect(
      (
        await call('/api/friends/requests', ada, {
          method: 'POST',
          body: JSON.stringify({ code: own }),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call('/api/friends/requests', ada, {
          method: 'POST',
          body: JSON.stringify({ code: 'ZZZZZZZZ' }),
        })
      ).status,
    ).toBe(404);
    await call('/api/friends/requests', ada, {
      method: 'POST',
      body: JSON.stringify({ accountId: bob.accountId }),
    });
    expect(
      (
        await call('/api/friends/requests', ada, {
          method: 'POST',
          body: JSON.stringify({ accountId: bob.accountId }),
        })
      ).status,
    ).toBe(409);
  });

  it('a block cuts the friendship and hides the blocker', async () => {
    const ada = makeAccount('Ada');
    const bob = makeAccount('Bobby');
    await befriend(ada, bob);
    expect(
      (await call(`/api/friends/${bob.accountId}/block`, ada, { method: 'POST' })).status,
    ).toBe(200);

    expect(friends.areFriends(ada.accountId, bob.accountId)).toBe(false);
    // Bob is told nothing more than "no such player".
    const retry = await call('/api/friends/requests', bob, {
      method: 'POST',
      body: JSON.stringify({ accountId: ada.accountId }),
    });
    expect(retry.status).toBe(404);
    const search = await call('/api/friends/search?q=ad', bob);
    expect(search.body['results']).toEqual([]);

    expect(
      (await call(`/api/friends/${bob.accountId}/block`, ada, { method: 'DELETE' })).status,
    ).toBe(200);
    expect((await call('/api/friends/search?q=ad', bob)).body['results']).toHaveLength(1);
  });

  it('searches by name prefix only, with the relation', async () => {
    const ada = makeAccount('Ada');
    makeAccount('Adam');
    makeAccount('Zed Ada');
    const results = (await call('/api/friends/search?q=ad', ada)).body['results'] as {
      profile: { displayName: string };
      relation: string;
    }[];
    expect(results.map((result) => result.profile.displayName)).toEqual(['Adam']);
    expect(results[0]?.relation).toBe('none');
    // Wildcards in the query are literal.
    expect((await call('/api/friends/search?q=%25%25', ada)).body['results']).toEqual([]);
  });

  it('notifies on a request and drains it through the pulse', async () => {
    const ada = makeAccount('Ada');
    const bob = makeAccount('Bob');
    await call('/api/friends/requests', ada, {
      method: 'POST',
      body: JSON.stringify({ accountId: bob.accountId }),
    });
    const pulse = (await call('/api/social/pulse', bob)).body;
    expect(pulse['incomingRequests']).toBe(1);
    expect((pulse['notices'] as { kind: string }[]).map((notice) => notice.kind)).toEqual([
      'friendRequest',
    ]);
    // Drained: the next pulse is empty.
    expect((await call('/api/social/pulse', bob)).body['notices']).toEqual([]);
  });
});

describe('presence', () => {
  it('shows friends as offline, online, queued or playing', async () => {
    const ada = harness.join('Ada');
    const bob = harness.join('Bob');
    const carol = harness.join('Carol');
    const adaAuth = { accountId: ada.accountId, token: ada.token };
    for (const other of [bob, carol]) {
      await befriend(adaAuth, { accountId: other.accountId, token: other.token });
    }

    const presences = async () =>
      Object.fromEntries(
        (
          (await call('/api/friends', adaAuth)).body['friends'] as {
            profile: { displayName: string };
            presence: string;
          }[]
        ).map((friend) => [friend.profile.displayName, friend.presence]),
      );

    expect(await presences()).toEqual({ Bob: 'online', Carol: 'online' });
    bob.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    expect((await presences())['Bob']).toBe('queue');
    carol.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    expect(await presences()).toEqual({ Bob: 'playing', Carol: 'playing' });
    bob.drop();
    expect((await presences())['Bob']).toBe('offline');

    // An app that checks in without a socket counts as online.
    await call('/api/social/pulse', { accountId: bob.accountId, token: bob.token });
    expect((await presences())['Bob']).toBe('online');
  });
});

describe('challenges', () => {
  async function friendsPair(): Promise<[Client, Client]> {
    const ada = harness.join('Ada');
    const bob = harness.join('Bob');
    await befriend(
      { accountId: ada.accountId, token: ada.token },
      { accountId: bob.accountId, token: bob.token },
    );
    ada.clear();
    bob.clear();
    return [ada, bob];
  }

  it('opens a private room and hands the friend its code', async () => {
    const [ada, bob] = await friendsPair();
    ada.send({ type: 'challenge', accountId: bob.accountId, config: CONFIGS.classic });

    const created = ada.last('roomCreated');
    expect(created).toBeDefined();
    const notice = bob.last('notice')?.notice;
    expect(notice).toMatchObject({ kind: 'challenge', code: created!.code });
    expect(notice?.url).toBe(`/play/online?mode=classic&code=${created!.code}`);

    bob.send({ type: 'joinRoom', code: created!.code });
    expect(ada.last('matched')?.kind).toBe('private');
    expect(bob.last('matched')?.kind).toBe('private');
  });

  it('falls back to the inbox when the friend has no socket', async () => {
    const [ada, bob] = await friendsPair();
    bob.drop();
    ada.send({ type: 'challenge', accountId: bob.accountId, config: CONFIGS.classic });
    const pulse = (await call('/api/social/pulse', { accountId: bob.accountId, token: bob.token }))
      .body;
    expect((pulse['notices'] as { kind: string }[])[0]?.kind).toBe('challenge');
  });

  it('refuses strangers', () => {
    const ada = harness.join('Ada');
    const eve = harness.join('Eve');
    ada.send({ type: 'challenge', accountId: eve.accountId, config: CONFIGS.classic });
    expect(ada.last('error')?.code).toBe('forbidden');
    expect(ada.last('roomCreated')).toBeUndefined();
    expect(eve.last('notice')).toBeUndefined();
  });

  it('tells the challenger when the friend declines', async () => {
    const [ada, bob] = await friendsPair();
    ada.send({ type: 'challenge', accountId: bob.accountId, config: CONFIGS.classic });
    const declined = await call(
      `/api/friends/${ada.accountId}/decline-challenge`,
      {
        accountId: bob.accountId,
        token: bob.token,
      },
      { method: 'POST' },
    );
    expect(declined.status).toBe(200);
    expect(ada.last('notice')?.notice.kind).toBe('challengeDeclined');
  });

  it('rate limits challenges', async () => {
    const [ada, bob] = await friendsPair();
    for (let i = 0; i < 20; i++) {
      ada.send({ type: 'challenge', accountId: bob.accountId, config: CONFIGS.classic });
    }
    expect(ada.all('error').some((error) => error.code === 'rateLimited')).toBe(true);
  });
});
