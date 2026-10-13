import { type GameConfig, isGameConfig, modeForConfig } from '@/game/engine';
import { accountIdSchema, type PublicProfile } from '@/protocol';
import {
  correspondenceMoveSchema,
  createCorrespondenceSchema,
  type Friend,
  friendRequestSchema,
  type FriendsResponse,
  pushSubscriptionSchema,
} from '@/protocol/social';
import { type Context, Hono } from 'hono';
import { FixedWindowLimiter, readJson } from './api.js';
import { accountOf } from './auth.js';
import type { CorrespondenceError, Correspondence } from './correspondence.js';
import type { AccountRow, Accounts } from './db/accounts.js';
import { toPublicProfile } from './db/accounts.js';
import type { Friends } from './friends.js';
import { log } from './log.js';
import type { Notifier } from './notices.js';
import type { PushService } from './push.js';
import type { Presence } from './social-hooks.js';
import type { Session } from './types.js';

/**
 * Friends, presence, challenges, correspondence games and push subscriptions:
 * the HTTP routes, and the one socket message (`challenge`) that needs a seat.
 *
 * Every route is authenticated with the account token. Presence is only ever
 * shown to accepted friends, and anything one player can do to another -
 * request, challenge, invite - is refused across a block and rate limited, so
 * none of it can be turned into a way to pester somebody.
 */

export interface SocialOptions {
  readonly accounts: Accounts;
  readonly friends: Friends;
  readonly notifier: Notifier;
  readonly correspondence: Correspondence;
  readonly push: PushService;
  /** Where an account is according to the lobby (socket, queue, game). */
  readonly presence: (accountId: string) => Presence;
  /** Whether the account is barred from contacting other players. */
  readonly isMuted?: (accountId: string) => boolean;
  /**
   * Open a private room with this session seated, as `createRoom` does, and
   * return its code; `null` if it could not (the session is told why).
   */
  readonly openRoom?: (session: Session, config: GameConfig) => string | null;
  readonly now?: () => number;
}

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

export class Social {
  private readonly now: () => number;
  /** Friend requests per sender, so a list cannot be carpet-bombed. */
  private readonly requestLimiter: FixedWindowLimiter;
  /** Challenges and invitations per sender. */
  private readonly challengeLimiter: FixedWindowLimiter;
  /** Searches per account: a name search is the one way to enumerate players. */
  private readonly searchLimiter: FixedWindowLimiter;
  /** Check-ins per account; the client polls every 20 seconds while visible. */
  private readonly pulseLimiter: FixedWindowLimiter;
  /** Writes of any other kind per account. */
  private readonly writeLimiter: FixedWindowLimiter;

  constructor(private readonly options: SocialOptions) {
    this.now = options.now ?? Date.now;
    this.requestLimiter = new FixedWindowLimiter(30, HOUR_MS, this.now);
    this.challengeLimiter = new FixedWindowLimiter(12, MINUTE_MS, this.now);
    this.searchLimiter = new FixedWindowLimiter(30, MINUTE_MS, this.now);
    this.pulseLimiter = new FixedWindowLimiter(20, MINUTE_MS, this.now);
    this.writeLimiter = new FixedWindowLimiter(120, MINUTE_MS, this.now);
  }

  /** Presence as a friend sees it: the lobby's view, or "online" if the app checked in lately. */
  presenceOf(accountId: string): Presence {
    const fromLobby = this.options.presence(accountId);
    if (fromLobby !== 'offline') return fromLobby;
    return this.options.notifier.isActive(accountId) ? 'online' : 'offline';
  }

  /**
   * The `challenge` socket message: open a private room for the challenger and
   * invite the friend into it. The challenger's screen shows the room as it
   * would any private room; the friend gets a notice with the code.
   */
  challenge(session: Session, targetId: string, config: GameConfig): void {
    const me = session.accountId;
    const account = session.account;
    if (!me || !account) return;
    const refuse = (message: string) =>
      session.transport.send({ type: 'error', code: 'forbidden', message });

    if (this.options.isMuted?.(me)) return refuse('Your account cannot send challenges right now.');
    if (!this.challengeLimiter.hit(me)) {
      session.transport.send({ type: 'error', code: 'rateLimited', message: 'Slow down.' });
      return;
    }
    if (
      !isGameConfig(config) ||
      !this.options.friends.areFriends(me, targetId) ||
      this.options.friends.blockedEitherWay(me, targetId)
    ) {
      return refuse('You can only challenge your friends.');
    }

    const code = this.options.openRoom?.(session, config) ?? null;
    if (!code) return;

    const mode = modeForConfig(config);
    this.options.notifier.notify(targetId, {
      kind: 'challenge',
      title: `${account.displayName} challenges you`,
      body: `${mode?.name ?? 'A custom game'} - join before they give up waiting.`,
      url: `/play/online?mode=${encodeURIComponent(mode?.id ?? 'classic')}&code=${code}`,
      from: toPublicProfile(account, null),
      code,
      config,
    });
    log.info('social.challenge', { from: me, to: targetId, room: code });
  }

  routes(): Hono {
    const app = new Hono();
    const { accounts, friends, notifier, correspondence, push } = this.options;

    const auth = (c: Context): AccountRow | null => accountOf(c, accounts);
    const profileOf = (id: string): PublicProfile | null => {
      const account = accounts.get(id);
      return account ? toPublicProfile(account, null) : null;
    };
    const exists = (id: string) => accounts.get(id) !== null;

    // -----------------------------------------------------------------------
    // Friends
    // -----------------------------------------------------------------------

    app.get('/api/friends', (c) => {
      const me = auth(c);
      if (!me) return c.json({ error: 'Unauthorized' }, 401);

      const listed = (rows: { accountId: string; at: number }[]) =>
        rows.flatMap((row) => {
          const profile = profileOf(row.accountId);
          return profile ? [{ profile, at: row.at }] : [];
        });

      const response: FriendsResponse = {
        code: friends.codeFor(me.id),
        friends: friends.friendsOf(me.id).flatMap((row): Friend[] => {
          const profile = profileOf(row.accountId);
          return profile
            ? [{ profile, presence: this.presenceOf(row.accountId), since: row.since }]
            : [];
        }),
        incoming: listed(friends.incoming(me.id)),
        outgoing: listed(friends.outgoing(me.id)),
        blocked: listed(friends.blocked(me.id)),
      };
      return c.json(response);
    });

    app.get('/api/friends/search', (c) => {
      const me = auth(c);
      if (!me) return c.json({ error: 'Unauthorized' }, 401);
      if (!this.searchLimiter.hit(me.id)) return c.json({ error: 'Slow down' }, 429);

      const query = (c.req.query('q') ?? '').slice(0, 20);
      const results = friends.search(me.id, query, 10).flatMap((id) => {
        const profile = profileOf(id);
        return profile ? [{ profile, relation: friends.relation(me.id, id) }] : [];
      });
      return c.json({ results });
    });

    app.post('/api/friends/requests', async (c) => {
      const me = auth(c);
      if (!me) return c.json({ error: 'Unauthorized' }, 401);
      if (this.options.isMuted?.(me.id)) {
        return c.json({ error: 'Your account cannot send friend requests right now' }, 403);
      }
      if (!this.requestLimiter.hit(me.id)) return c.json({ error: 'Too many requests' }, 429);

      const parsed = friendRequestSchema.safeParse(await readJson(c.req.raw));
      if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);

      const target =
        'code' in parsed.data ? friends.accountForCode(parsed.data.code) : parsed.data.accountId;
      const outcome = target
        ? friends.request(me.id, target, exists)
        : ({ ok: false, reason: 'unknown' } as const);
      if (!outcome.ok) {
        const messages = {
          self: ['That is your own code', 400],
          unknown: ['No player with that code', 404],
          blocked: ['You have blocked this player', 409],
          alreadyFriends: ['You are already friends', 409],
          pending: ['Request already sent', 409],
          limit: ['Too many friends or pending requests', 409],
        } as const;
        const [message, status] = messages[outcome.reason];
        return c.json({ error: message }, status);
      }

      const profile = profileOf(target!)!;
      const mine = toPublicProfile(me, null);
      if (outcome.status === 'sent') {
        notifier.notify(target!, {
          kind: 'friendRequest',
          title: 'Friend request',
          body: `${me.displayName} wants to be friends.`,
          url: '/friends',
          from: mine,
        });
      } else {
        notifier.notify(target!, {
          kind: 'friendAccepted',
          title: 'New friend',
          body: `You and ${me.displayName} are now friends.`,
          url: '/friends',
          from: mine,
        });
      }
      return c.json({ status: outcome.status, profile }, outcome.status === 'sent' ? 201 : 200);
    });

    app.post('/api/friends/requests/:id/accept', (c) => {
      const me = auth(c);
      if (!me) return c.json({ error: 'Unauthorized' }, 401);
      const from = accountIdSchema.safeParse(c.req.param('id'));
      if (!from.success) return c.json({ error: 'Not found' }, 404);
      if (!friends.accept(me.id, from.data)) {
        return c.json({ error: 'No such request, or a friends list is full' }, 409);
      }
      notifier.notify(from.data, {
        kind: 'friendAccepted',
        title: 'Friend request accepted',
        body: `You and ${me.displayName} are now friends.`,
        url: '/friends',
        from: toPublicProfile(me, null),
      });
      return c.json({ ok: true });
    });

    /** Decline an incoming request or withdraw an outgoing one. */
    app.delete('/api/friends/requests/:id', (c) => {
      const me = auth(c);
      if (!me) return c.json({ error: 'Unauthorized' }, 401);
      const other = accountIdSchema.safeParse(c.req.param('id'));
      if (!other.success) return c.json({ error: 'Not found' }, 404);
      friends.dismiss(me.id, other.data);
      return c.json({ ok: true });
    });

    app.delete('/api/friends/:id', (c) => {
      const me = auth(c);
      if (!me) return c.json({ error: 'Unauthorized' }, 401);
      const other = accountIdSchema.safeParse(c.req.param('id'));
      if (!other.success) return c.json({ error: 'Not found' }, 404);
      friends.remove(me.id, other.data);
      return c.json({ ok: true });
    });

    app.post('/api/friends/:id/block', (c) => {
      const me = auth(c);
      if (!me) return c.json({ error: 'Unauthorized' }, 401);
      if (!this.writeLimiter.hit(me.id)) return c.json({ error: 'Slow down' }, 429);
      const other = accountIdSchema.safeParse(c.req.param('id'));
      if (!other.success || !exists(other.data)) return c.json({ error: 'Not found' }, 404);
      if (!friends.block(me.id, other.data)) return c.json({ error: 'Cannot block' }, 409);
      return c.json({ ok: true });
    });

    app.delete('/api/friends/:id/block', (c) => {
      const me = auth(c);
      if (!me) return c.json({ error: 'Unauthorized' }, 401);
      const other = accountIdSchema.safeParse(c.req.param('id'));
      if (!other.success) return c.json({ error: 'Not found' }, 404);
      friends.unblock(me.id, other.data);
      return c.json({ ok: true });
    });

    /** Turn a challenge down, so the challenger is not left waiting. */
    app.post('/api/friends/:id/decline-challenge', (c) => {
      const me = auth(c);
      if (!me) return c.json({ error: 'Unauthorized' }, 401);
      const other = accountIdSchema.safeParse(c.req.param('id'));
      if (!other.success || !friends.areFriends(me.id, other.data)) {
        return c.json({ error: 'Not found' }, 404);
      }
      if (!this.challengeLimiter.hit(me.id)) return c.json({ error: 'Slow down' }, 429);
      notifier.notify(
        other.data,
        {
          kind: 'challengeDeclined',
          title: 'Challenge declined',
          body: `${me.displayName} cannot play right now.`,
          from: toPublicProfile(me, null),
        },
        { push: false },
      );
      return c.json({ ok: true });
    });

    /**
     * The app checking in: anything that arrived meanwhile, and the counts the
     * home screen badges. Also what keeps the account "online" for friends
     * while the app is open without a game socket.
     */
    app.get('/api/social/pulse', (c) => {
      const me = auth(c);
      if (!me) return c.json({ error: 'Unauthorized' }, 401);
      if (!this.pulseLimiter.hit(me.id)) return c.json({ error: 'Slow down' }, 429);
      return c.json({
        notices: notifier.drain(me.id),
        incomingRequests: friends.incomingCount(me.id),
        correspondenceTurns: correspondence.turnsWaiting(me.id),
      });
    });

    // -----------------------------------------------------------------------
    // Push
    // -----------------------------------------------------------------------

    app.get('/api/push/key', (c) => c.json({ publicKey: push.publicKey }));

    app.post('/api/push/subscriptions', async (c) => {
      const me = auth(c);
      if (!me) return c.json({ error: 'Unauthorized' }, 401);
      if (!push.enabled)
        return c.json({ error: 'Notifications are not set up on this server' }, 503);
      if (!this.writeLimiter.hit(me.id)) return c.json({ error: 'Slow down' }, 429);

      const parsed = pushSubscriptionSchema.safeParse(await readJson(c.req.raw));
      if (!parsed.success) return c.json({ error: 'Invalid subscription' }, 400);
      const result = push.subscribe(me.id, parsed.data);
      if (result === 'host') return c.json({ error: 'Unsupported push service' }, 400);
      if (result === 'invalid') return c.json({ error: 'Invalid subscription keys' }, 400);
      return c.json({ ok: true }, 201);
    });

    app.delete('/api/push/subscriptions', async (c) => {
      const me = auth(c);
      if (!me) return c.json({ error: 'Unauthorized' }, 401);
      const body = (await readJson(c.req.raw)) as { endpoint?: unknown } | null;
      if (typeof body?.endpoint !== 'string' || body.endpoint.length > 1024) {
        return c.json({ error: 'Invalid request' }, 400);
      }
      push.unsubscribe(me.id, body.endpoint);
      return c.json({ ok: true });
    });

    // -----------------------------------------------------------------------
    // Correspondence
    // -----------------------------------------------------------------------

    app.get('/api/correspondence', (c) => {
      const me = auth(c);
      if (!me) return c.json({ error: 'Unauthorized' }, 401);
      return c.json({ games: correspondence.list(me.id) });
    });

    app.get('/api/correspondence/:id', (c) => {
      const me = auth(c);
      if (!me) return c.json({ error: 'Unauthorized' }, 401);
      const id = gameIdOf(c);
      const game = id ? correspondence.get(me.id, id) : null;
      if (!game) return c.json({ error: 'Not found' }, 404);
      return c.json({ game });
    });

    app.post('/api/correspondence', async (c) => {
      const me = auth(c);
      if (!me) return c.json({ error: 'Unauthorized' }, 401);
      if (this.options.isMuted?.(me.id)) {
        return c.json({ error: 'Your account cannot send invitations right now' }, 403);
      }
      if (!this.challengeLimiter.hit(me.id)) return c.json({ error: 'Slow down' }, 429);
      const parsed = createCorrespondenceSchema.safeParse(await readJson(c.req.raw));
      if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);

      const result = correspondence.invite(
        me.id,
        parsed.data.opponentId,
        parsed.data.config,
        parsed.data.daysPerMove,
      );
      return result.ok
        ? c.json({ game: result.value }, 201)
        : correspondenceFailure(c, result.error);
    });

    const action =
      (
        run: (
          me: string,
          id: string,
          body: unknown,
        ) => ReturnType<Correspondence['accept']> | ReturnType<Correspondence['decline']>,
      ) =>
      async (c: Context) => {
        const me = auth(c);
        if (!me) return c.json({ error: 'Unauthorized' }, 401);
        if (!this.writeLimiter.hit(me.id)) return c.json({ error: 'Slow down' }, 429);
        const id = gameIdOf(c);
        if (!id) return c.json({ error: 'Not found' }, 404);
        const result = run(me.id, id, await readJson(c.req.raw));
        if (!result.ok) return correspondenceFailure(c, result.error);
        return c.json({ game: result.value ?? correspondence.get(me.id, id) });
      };

    app.post(
      '/api/correspondence/:id/accept',
      action((me, id) => correspondence.accept(me, id)),
    );
    app.post(
      '/api/correspondence/:id/decline',
      action((me, id) => correspondence.decline(me, id)),
    );
    app.post(
      '/api/correspondence/:id/resign',
      action((me, id) => correspondence.resign(me, id)),
    );
    app.post(
      '/api/correspondence/:id/move',
      action((me, id, body) => {
        const parsed = correspondenceMoveSchema.safeParse(body);
        if (!parsed.success) return { ok: false, error: 'illegalMove' };
        return correspondence.move(me, id, parsed.data.index, parsed.data.ply);
      }),
    );

    return app;
  }
}

/** A correspondence refusal as an HTTP answer. */
function correspondenceFailure(c: Context, error: CorrespondenceError) {
  const map = {
    notFound: ['Not found', 404],
    notFriends: ['You can only invite friends', 403],
    limit: ['Too many games in progress', 409],
    badConfig: ['That is not a game we know how to run', 400],
    notYourTurn: ['It is not your turn', 409],
    illegalMove: ['That move is not allowed here', 409],
    stale: ['The game has moved on - refresh and try again', 409],
    over: ['This game is over', 409],
    forbidden: ['Not allowed', 403],
  } as const;
  const [message, status] = map[error];
  return c.json({ error: message, code: error }, status);
}

/** The game id in the path, if it is shaped like one. */
function gameIdOf(c: Context): string | null {
  const id = c.req.param('id') ?? '';
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}
