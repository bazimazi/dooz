import { randomInt } from 'node:crypto';
import { ROOM_CODE_ALPHABET } from '@/protocol';
import { FRIEND_CODE_LENGTH, MAX_FRIENDS } from '@/protocol/social';
import { nameKey } from './db/accounts.js';
import type { Db } from './db/database.js';

/**
 * The social graph: friend codes, requests, friendships and blocks.
 *
 * A friendship needs both sides to agree, so it starts as a request and only
 * becomes a friendship when the other side accepts (or asks back, which counts
 * as accepting). Friendships are stored in both directions so "my friends" is
 * a single indexed scan.
 *
 * A block is one-sided and silent. The blocked player is not told; they simply
 * cannot find, ask, challenge or invite the person who blocked them, and
 * every existing tie between the two is cut. Telling them would only invite
 * them to try again from a new account.
 */

/** Requests one account may have outstanding at once, so nobody can spam the table. */
export const MAX_OUTGOING_REQUESTS = 50;
/** Requests one account may be sent and leave unanswered before new ones bounce. */
export const MAX_INCOMING_REQUESTS = 100;
export const MAX_BLOCKS = 500;

export type RequestOutcome =
  | { ok: true; status: 'sent' | 'accepted' }
  | {
      ok: false;
      reason: 'self' | 'unknown' | 'blocked' | 'alreadyFriends' | 'pending' | 'limit';
    };

export interface Pending {
  accountId: string;
  at: number;
}

export class Friends {
  /**
   * Whether accounts carry the competitive layer's `bot` flag. Read once
   * rather than assumed, so this repository works on either side of that
   * migration.
   */
  private readonly hasBotColumn: boolean;

  constructor(
    private readonly db: Db,
    private readonly now: () => number = Date.now,
  ) {
    this.hasBotColumn = db
      .prepare<[], { name: string }>('PRAGMA table_info(accounts)')
      .all()
      .some((column) => column.name === 'bot');
  }

  /**
   * This account's friend code, minted on first use.
   *
   * Drawn from the CSPRNG for the same reason room codes are: a predictable
   * code would let anyone walk the list and send requests to every player.
   */
  codeFor(accountId: string): string {
    const existing = this.db
      .prepare<[string], { code: string }>('SELECT code FROM friend_codes WHERE account_id = ?')
      .get(accountId);
    if (existing) return existing.code;

    for (let attempt = 0; attempt < 20; attempt++) {
      let code = '';
      for (let i = 0; i < FRIEND_CODE_LENGTH; i++) {
        code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      }
      const inserted = this.db
        .prepare('INSERT INTO friend_codes (account_id, code) VALUES (?, ?) ON CONFLICT DO NOTHING')
        .run(accountId, code);
      if (inserted.changes > 0) return code;
      // Either the code collided or another request minted one for this account
      // first; in the second case, use theirs.
      const raced = this.db
        .prepare<[string], { code: string }>('SELECT code FROM friend_codes WHERE account_id = ?')
        .get(accountId);
      if (raced) return raced.code;
    }
    throw new Error('Could not allocate a friend code');
  }

  accountForCode(code: string): string | null {
    return (
      this.db
        .prepare<[string], { account_id: string }>(
          'SELECT account_id FROM friend_codes WHERE code = ?',
        )
        .get(code)?.account_id ?? null
    );
  }

  /**
   * Accounts whose name starts with `query`, for "add a friend by name".
   *
   * Prefix rather than substring, so a short query cannot be used to page
   * through everyone, and accounts with a block in either direction never
   * appear. Bots are left out: they cannot answer a friend request.
   */
  search(viewerId: string, query: string, limit: number): string[] {
    const key = nameKey(query);
    if (key.length < 2) return [];
    const pattern = `${key.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
    return this.db
      .prepare<[string, string, string, string, number], { id: string }>(
        `SELECT a.id FROM accounts a
         WHERE a.name_key LIKE ? ESCAPE '\\'
           AND a.id != ?
           AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.account_id = ? AND b.blocked_id = a.id)
           AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.account_id = a.id AND b.blocked_id = ?)
           ${this.hasBotColumn ? 'AND a.bot = 0' : ''}
         ORDER BY a.name_key
         LIMIT ?`,
      )
      .all(pattern, viewerId, viewerId, viewerId, limit)
      .map((row) => row.id);
  }

  areFriends(a: string, b: string): boolean {
    return (
      this.db
        .prepare<[string, string], { since: number }>(
          'SELECT since FROM friendships WHERE account_id = ? AND friend_id = ?',
        )
        .get(a, b) !== undefined
    );
  }

  /** Whether either account has blocked the other. */
  blockedEitherWay(a: string, b: string): boolean {
    return (
      this.db
        .prepare<[string, string, string, string], { one: number }>(
          `SELECT 1 AS one FROM blocks
           WHERE (account_id = ? AND blocked_id = ?) OR (account_id = ? AND blocked_id = ?)`,
        )
        .get(a, b, b, a) !== undefined
    );
  }

  relation(viewer: string, other: string): 'none' | 'friend' | 'incoming' | 'outgoing' {
    if (this.areFriends(viewer, other)) return 'friend';
    if (this.hasRequest(other, viewer)) return 'incoming';
    if (this.hasRequest(viewer, other)) return 'outgoing';
    return 'none';
  }

  /**
   * Ask `to` to be friends.
   *
   * A request towards somebody who has already asked you is an acceptance,
   * which is what two people adding each other at the same moment expect.
   * A block in either direction answers `blocked` to the caller only in the
   * direction they chose: a player who was blocked hears `unknown`, the same
   * as a code that matches nobody, so they cannot tell they were blocked.
   */
  request(from: string, to: string, exists: (id: string) => boolean): RequestOutcome {
    if (from === to) return { ok: false, reason: 'self' };
    if (!exists(to)) return { ok: false, reason: 'unknown' };
    if (this.isBlocking(from, to)) return { ok: false, reason: 'blocked' };
    if (this.isBlocking(to, from)) return { ok: false, reason: 'unknown' };
    if (this.areFriends(from, to)) return { ok: false, reason: 'alreadyFriends' };

    if (this.hasRequest(to, from)) {
      if (!this.accept(from, to)) return { ok: false, reason: 'limit' };
      return { ok: true, status: 'accepted' };
    }
    if (this.hasRequest(from, to)) return { ok: false, reason: 'pending' };

    if (
      this.count('SELECT COUNT(*) AS n FROM friend_requests WHERE from_id = ?', from) >=
        MAX_OUTGOING_REQUESTS ||
      this.count('SELECT COUNT(*) AS n FROM friend_requests WHERE to_id = ?', to) >=
        MAX_INCOMING_REQUESTS ||
      this.friendCount(from) >= MAX_FRIENDS
    ) {
      return { ok: false, reason: 'limit' };
    }

    this.db
      .prepare('INSERT INTO friend_requests (from_id, to_id, created_at) VALUES (?, ?, ?)')
      .run(from, to, this.now());
    return { ok: true, status: 'sent' };
  }

  /** Accept the request `from` sent to `me`. False if there was none or a list is full. */
  accept(me: string, from: string): boolean {
    return this.db.transaction(() => {
      if (!this.hasRequest(from, me)) return false;
      if (this.friendCount(me) >= MAX_FRIENDS || this.friendCount(from) >= MAX_FRIENDS) {
        return false;
      }
      this.db
        .prepare(
          'DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)',
        )
        .run(from, me, me, from);
      const since = this.now();
      const insert = this.db.prepare(
        'INSERT INTO friendships (account_id, friend_id, since) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
      );
      insert.run(me, from, since);
      insert.run(from, me, since);
      return true;
    })();
  }

  /** Decline an incoming request, or withdraw an outgoing one. Both are silent. */
  dismiss(me: string, other: string): boolean {
    const result = this.db
      .prepare(
        'DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)',
      )
      .run(other, me, me, other);
    return result.changes > 0;
  }

  remove(me: string, friend: string): boolean {
    const result = this.db
      .prepare(
        'DELETE FROM friendships WHERE (account_id = ? AND friend_id = ?) OR (account_id = ? AND friend_id = ?)',
      )
      .run(me, friend, friend, me);
    return result.changes > 0;
  }

  /** Block `other`, cutting every tie between the two accounts first. */
  block(me: string, other: string): boolean {
    if (me === other) return false;
    if (this.count('SELECT COUNT(*) AS n FROM blocks WHERE account_id = ?', me) >= MAX_BLOCKS) {
      return false;
    }
    this.db.transaction(() => {
      this.remove(me, other);
      this.dismiss(me, other);
      this.db
        .prepare(
          'INSERT INTO blocks (account_id, blocked_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
        )
        .run(me, other, this.now());
    })();
    return true;
  }

  unblock(me: string, other: string): boolean {
    return (
      this.db.prepare('DELETE FROM blocks WHERE account_id = ? AND blocked_id = ?').run(me, other)
        .changes > 0
    );
  }

  friendsOf(accountId: string): { accountId: string; since: number }[] {
    return this.db
      .prepare<[string, number], { friend_id: string; since: number }>(
        'SELECT friend_id, since FROM friendships WHERE account_id = ? ORDER BY since DESC LIMIT ?',
      )
      .all(accountId, MAX_FRIENDS)
      .map((row) => ({ accountId: row.friend_id, since: row.since }));
  }

  incoming(accountId: string): Pending[] {
    return this.db
      .prepare<[string, number], { from_id: string; created_at: number }>(
        'SELECT from_id, created_at FROM friend_requests WHERE to_id = ? ORDER BY created_at DESC LIMIT ?',
      )
      .all(accountId, MAX_INCOMING_REQUESTS)
      .map((row) => ({ accountId: row.from_id, at: row.created_at }));
  }

  outgoing(accountId: string): Pending[] {
    return this.db
      .prepare<[string, number], { to_id: string; created_at: number }>(
        'SELECT to_id, created_at FROM friend_requests WHERE from_id = ? ORDER BY created_at DESC LIMIT ?',
      )
      .all(accountId, MAX_OUTGOING_REQUESTS)
      .map((row) => ({ accountId: row.to_id, at: row.created_at }));
  }

  blocked(accountId: string): Pending[] {
    return this.db
      .prepare<[string, number], { blocked_id: string; created_at: number }>(
        'SELECT blocked_id, created_at FROM blocks WHERE account_id = ? ORDER BY created_at DESC LIMIT ?',
      )
      .all(accountId, MAX_BLOCKS)
      .map((row) => ({ accountId: row.blocked_id, at: row.created_at }));
  }

  incomingCount(accountId: string): number {
    return this.count('SELECT COUNT(*) AS n FROM friend_requests WHERE to_id = ?', accountId);
  }

  private friendCount(accountId: string): number {
    return this.count('SELECT COUNT(*) AS n FROM friendships WHERE account_id = ?', accountId);
  }

  private isBlocking(blocker: string, blocked: string): boolean {
    return (
      this.db
        .prepare<[string, string], { one: number }>(
          'SELECT 1 AS one FROM blocks WHERE account_id = ? AND blocked_id = ?',
        )
        .get(blocker, blocked) !== undefined
    );
  }

  private hasRequest(from: string, to: string): boolean {
    return (
      this.db
        .prepare<[string, string], { one: number }>(
          'SELECT 1 AS one FROM friend_requests WHERE from_id = ? AND to_id = ?',
        )
        .get(from, to) !== undefined
    );
  }

  private count(sql: string, id: string): number {
    return this.db.prepare<[string], { n: number }>(sql).get(id)?.n ?? 0;
  }
}
