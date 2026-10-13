import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Correspondence, DAY_MS, INVITE_TTL_MS } from './correspondence.js';
import { Accounts } from './db/accounts.js';
import { type Db, openDatabase } from './db/database.js';
import { Matches } from './db/matches.js';
import { Friends } from './friends.js';
import { Notifier } from './notices.js';
import { CONFIGS } from './test-support.js';

let db: Db;
let clock: number;
let accounts: Accounts;
let matches: Matches;
let friends: Friends;
let notifier: Notifier;
let games: Correspondence;
let ada: string;
let bob: string;

beforeEach(() => {
  clock = 1_700_000_000_000;
  db = openDatabase(':memory:');
  accounts = new Accounts(db, () => clock);
  matches = new Matches(db);
  friends = new Friends(db, () => clock);
  notifier = new Notifier({ now: () => clock });
  // X (the inviter) always opens, so the tests can script the moves.
  games = new Correspondence({
    db,
    accounts,
    matches,
    friends,
    notifier,
    now: () => clock,
    random: () => 0.1,
  });
  ada = accounts.create('Ada', 'fox').account.id;
  bob = accounts.create('Bob', 'owl').account.id;
  friends.request(ada, bob, () => true);
  friends.accept(bob, ada);
});

afterEach(() => db.close());

function started() {
  const invited = games.invite(ada, bob, CONFIGS.classic, 1);
  if (!invited.ok) throw new Error(invited.error);
  const accepted = games.accept(bob, invited.value.id);
  if (!accepted.ok) throw new Error(accepted.error);
  return accepted.value;
}

function kinds(accountId: string) {
  return notifier.drain(accountId).map((notice) => notice.kind);
}

describe('correspondence games', () => {
  it('only invites friends', () => {
    const eve = accounts.create('Eve', 'cat').account.id;
    expect(games.invite(ada, eve, CONFIGS.classic, 1)).toEqual({ ok: false, error: 'notFriends' });
    friends.block(bob, ada);
    expect(games.invite(ada, bob, CONFIGS.classic, 1)).toEqual({ ok: false, error: 'notFriends' });
  });

  it('invites, notifies, and starts on acceptance with the opener to move', () => {
    const invited = games.invite(ada, bob, CONFIGS.classic, 2);
    expect(invited.ok && invited.value.status).toBe('invited');
    expect(kinds(bob)).toEqual(['correspondenceInvite']);

    // Only the invitee accepts.
    expect(invited.ok && games.accept(ada, invited.value.id)).toEqual({
      ok: false,
      error: 'forbidden',
    });

    const game = started();
    expect(game.status).toBe('active');
    expect(game.moveWindowMs).toBe(DAY_MS);
    expect(game.deadlineAt).toBe(clock + DAY_MS);
    // Bob accepted; Ada is X and opens, so she is told it is her move.
    expect(kinds(ada)).toContain('correspondenceTurn');
    expect(games.get(ada, game.id)?.yourTurn).toBe(true);
    expect(games.get(bob, game.id)?.yourTurn).toBe(false);
  });

  it('plays moves in turn, refuses stale and out-of-turn ones, and scores the result', () => {
    const game = started();
    expect(games.move(bob, game.id, 0, 0)).toEqual({ ok: false, error: 'notYourTurn' });
    expect(games.move(ada, game.id, 0, 0).ok).toBe(true);
    // A retry of the same move arrives with a stale ply.
    expect(games.move(ada, game.id, 0, 0)).toEqual({ ok: false, error: 'stale' });
    expect(games.move(bob, game.id, 0, 1)).toEqual({ ok: false, error: 'illegalMove' });

    // X: 0, 1, 2 across the top; O: 3, 4.
    for (const [who, cell, ply] of [
      [bob, 3, 1],
      [ada, 1, 2],
      [bob, 4, 3],
      [ada, 2, 4],
    ] as const) {
      const result = games.move(who, game.id, cell, ply);
      expect(result.ok).toBe(true);
    }

    const finished = games.get(ada, game.id)!;
    expect(finished.status).toBe('finished');
    expect(finished.result).toMatchObject({ winner: 1, reason: 'line' });
    expect(finished.result?.matchId).toBeTruthy();

    // Casual: counted, but no rating moved.
    const stats = accounts.statsFor(ada, 'classic');
    expect(stats.won).toBe(1);
    expect(stats.rankedPlayed).toBe(0);
    expect(matches.find(finished.result!.matchId!, ada, (id) => accounts.get(id))?.kind).toBe(
      'casual',
    );
    expect(games.move(bob, game.id, 5, 5)).toEqual({ ok: false, error: 'over' });
  });

  it('loses the player to move on time, from the sweep or a late move', () => {
    const game = started();
    clock += DAY_MS + 1;
    expect(games.move(ada, game.id, 0, 0)).toEqual({ ok: false, error: 'over' });
    expect(games.get(bob, game.id)?.result).toMatchObject({ winner: 2, reason: 'timeout' });

    const second = started();
    games.move(ada, second.id, 4, 0);
    clock += DAY_MS + 1;
    games.sweep();
    expect(games.get(ada, second.id)?.result).toMatchObject({ winner: 1, reason: 'timeout' });
  });

  it('reminds once before the deadline on longer windows', () => {
    const invited = games.invite(ada, bob, CONFIGS.classic, 2);
    games.accept(bob, invited.ok ? invited.value.id : '');
    notifier.drain(ada);
    clock += 2 * DAY_MS - 6 * 3600_000;
    games.sweep();
    games.sweep();
    expect(kinds(ada).filter((kind) => kind === 'correspondenceTurn')).toHaveLength(1);
  });

  it('lapses unanswered invitations', () => {
    const invited = games.invite(ada, bob, CONFIGS.classic, 1);
    clock += INVITE_TTL_MS + 1;
    games.sweep();
    expect(games.get(ada, invited.ok ? invited.value.id : '')?.status).toBe('expired');
  });

  it('resigns, declines, and forfeits everything for a departing account', () => {
    const game = started();
    expect(games.resign(bob, game.id).ok).toBe(true);
    expect(games.get(ada, game.id)?.result).toMatchObject({ winner: 1, reason: 'resign' });

    const pending = games.invite(ada, bob, CONFIGS.classic, 1);
    expect(games.decline(bob, pending.ok ? pending.value.id : '').ok).toBe(true);

    const live = started();
    const invite = games.invite(bob, ada, CONFIGS.classic, 3);
    games.forfeitAll(ada);
    expect(games.get(bob, live.id)?.result).toMatchObject({ winner: 2, reason: 'resign' });
    expect(games.get(bob, invite.ok ? invite.value.id : '')?.status).toBe('declined');
  });

  it('lists open games first and hides other people’s games', () => {
    const eve = accounts.create('Eve', 'cat').account.id;
    const game = started();
    expect(games.list(ada).map((entry) => entry.id)).toEqual([game.id]);
    expect(games.get(eve, game.id)).toBeNull();
    expect(games.move(eve, game.id, 0, 0)).toEqual({ ok: false, error: 'notFound' });
    expect(games.turnsWaiting(ada)).toBe(1);
    expect(games.turnsWaiting(bob)).toBe(0);
  });

  it('survives a restart: the state is only in the database', () => {
    const game = started();
    games.move(ada, game.id, 4, 0);
    const reopened = new Correspondence({
      db,
      accounts,
      matches,
      friends,
      notifier,
      now: () => clock,
    });
    const view = reopened.get(bob, game.id)!;
    expect(view.snapshot.moves).toEqual([4]);
    expect(view.yourTurn).toBe(true);
  });
});
