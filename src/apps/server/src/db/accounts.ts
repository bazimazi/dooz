import { Buffer } from 'node:buffer';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { type Avatar, AVATARS, type PublicProfile } from '@dooz/protocol';
import { STARTING_RATING } from '../rating.js';
import type { Db } from './database.js';

/**
 * Accounts, credentials and per-mode statistics.
 *
 * Two kinds of secret live here and they are handled differently on purpose.
 *
 * The **token** is 32 bytes from the CSPRNG, so there is nothing to brute-force
 * and a single SHA-256 is enough: it exists to stop a database read turning
 * into a set of working credentials, not to slow an attacker who is guessing.
 *
 * The **password** is chosen by a person and therefore guessable, so it goes
 * through scrypt with a per-account salt. Both are compared in constant time -
 * a byte-by-byte comparison on a hash leaks how much of it was right.
 */

export interface AccountRow {
  id: string;
  displayName: string;
  avatar: Avatar;
  createdAt: number;
  claimed: boolean;
}

export interface ModeStats {
  mode: string;
  rating: number;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  streak: number;
  bestStreak: number;
}

const TOKEN_BYTES = 32;
const SCRYPT_KEYLEN = 64;
const SALT_BYTES = 16;

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64');
}

function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('base64')}$${derived.toString('base64')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, expected] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !expected) return false;

  const derived = scryptSync(password, Buffer.from(salt, 'base64'), SCRYPT_KEYLEN);
  return constantTimeEquals(derived, Buffer.from(expected, 'base64'));
}

function constantTimeEquals(a: Buffer, b: Buffer): boolean {
  // `timingSafeEqual` throws on a length mismatch, so the lengths are compared
  // first. Short-circuiting on that is safe: both are fixed-width digests.
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Case-insensitive key for the name namespace. */
function nameKey(displayName: string): string {
  return displayName.trim().toLocaleLowerCase('en-US');
}

interface AccountRecord {
  id: string;
  display_name: string;
  name_key: string;
  avatar: string;
  token_hash: string;
  password_hash: string | null;
  created_at: number;
  last_seen_at: number;
}

interface StatsRecord {
  mode: string;
  rating: number;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  streak: number;
  best_streak: number;
}

export class Accounts {
  constructor(
    private readonly db: Db,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Create an account and issue its token.
   *
   * The name is taken as asked for when it is free, and suffixed when it is
   * not, because a person opening the app for the first time should not be
   * made to negotiate for a name before they can play. The caller is told what
   * they actually got.
   */
  create(
    displayName: string | undefined,
    avatar: Avatar | undefined,
  ): {
    account: AccountRow;
    token: string;
  } {
    const token = generateToken();
    const id = randomUUID();
    const timestamp = this.now();
    const chosenAvatar = avatar ?? this.randomAvatar();
    const name = this.freeName(displayName ?? this.randomName());

    this.db
      .prepare(
        `INSERT INTO accounts (id, display_name, name_key, avatar, token_hash, password_hash, created_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
      )
      .run(id, name, nameKey(name), chosenAvatar, hashToken(token), timestamp, timestamp);

    return {
      account: {
        id,
        displayName: name,
        avatar: chosenAvatar,
        createdAt: timestamp,
        claimed: false,
      },
      token,
    };
  }

  /**
   * The account these credentials open, or `null`.
   *
   * The token hash is always computed and always compared, even when the id
   * matches nothing, so a request for a non-existent account takes the same
   * work as one for a real account with the wrong token.
   */
  authenticate(accountId: string, token: string): AccountRow | null {
    const row = this.db
      .prepare<[string], AccountRecord>('SELECT * FROM accounts WHERE id = ?')
      .get(accountId);

    const presented = Buffer.from(hashToken(token));
    const stored = Buffer.from(row?.token_hash ?? hashToken('absent'));
    const matches = constantTimeEquals(presented, stored);

    if (!row || !matches) return null;
    this.touch(row.id);
    return toAccountRow(row);
  }

  /** Log in with a name and password, for an account that has been claimed. */
  login(displayName: string, password: string): { account: AccountRow; token: string } | null {
    const row = this.db
      .prepare<[string], AccountRecord>('SELECT * FROM accounts WHERE name_key = ?')
      .get(nameKey(displayName));

    // Verify against a dummy hash when there is no such account, so a missing
    // name and a wrong password cost the same and cannot be told apart.
    const stored = row?.password_hash ?? DUMMY_PASSWORD_HASH;
    const ok = verifyPassword(password, stored);
    if (!row?.password_hash || !ok) return null;

    // Logging in issues a fresh token and retires the old one, so a device that
    // has been signed out cannot keep playing on a token it still holds.
    const token = generateToken();
    this.db
      .prepare('UPDATE accounts SET token_hash = ?, last_seen_at = ? WHERE id = ?')
      .run(hashToken(token), this.now(), row.id);

    return { account: toAccountRow(row), token };
  }

  /** Attach a password, so the account can be recovered on another device. */
  claim(accountId: string, password: string): boolean {
    const result = this.db
      .prepare('UPDATE accounts SET password_hash = ? WHERE id = ?')
      .run(hashPassword(password), accountId);
    return result.changes > 0;
  }

  get(accountId: string): AccountRow | null {
    const row = this.db
      .prepare<[string], AccountRecord>('SELECT * FROM accounts WHERE id = ?')
      .get(accountId);
    return row ? toAccountRow(row) : null;
  }

  /**
   * Rename or restyle an account.
   *
   * Returns `false` when the name is already taken, rather than silently
   * suffixing it: unlike account creation this is a deliberate choice the
   * player made, so they should be told it did not happen.
   */
  update(accountId: string, changes: { displayName?: string; avatar?: Avatar }): AccountRow | null {
    const existing = this.get(accountId);
    if (!existing) return null;

    if (changes.displayName !== undefined) {
      const key = nameKey(changes.displayName);
      const clash = this.db
        .prepare<[string, string], { id: string }>(
          'SELECT id FROM accounts WHERE name_key = ? AND id != ?',
        )
        .get(key, accountId);
      if (clash) return null;

      this.db
        .prepare('UPDATE accounts SET display_name = ?, name_key = ? WHERE id = ?')
        .run(changes.displayName, key, accountId);
    }

    if (changes.avatar !== undefined) {
      this.db.prepare('UPDATE accounts SET avatar = ? WHERE id = ?').run(changes.avatar, accountId);
    }

    return this.get(accountId);
  }

  touch(accountId: string): void {
    this.db.prepare('UPDATE accounts SET last_seen_at = ? WHERE id = ?').run(this.now(), accountId);
  }

  // -------------------------------------------------------------------------
  // Statistics
  // -------------------------------------------------------------------------

  /** Stats for one mode, created at the starting rating if this is the first. */
  statsFor(accountId: string, mode: string): ModeStats {
    const row = this.db
      .prepare<[string, string], StatsRecord>(
        'SELECT mode, rating, played, won, lost, drawn, streak, best_streak FROM stats WHERE account_id = ? AND mode = ?',
      )
      .get(accountId, mode);

    if (row) return toModeStats(row);
    return {
      mode,
      rating: STARTING_RATING,
      played: 0,
      won: 0,
      lost: 0,
      drawn: 0,
      streak: 0,
      bestStreak: 0,
    };
  }

  allStats(accountId: string): ModeStats[] {
    return this.db
      .prepare<[string], StatsRecord>(
        'SELECT mode, rating, played, won, lost, drawn, streak, best_streak FROM stats WHERE account_id = ? ORDER BY played DESC',
      )
      .all(accountId)
      .map(toModeStats);
  }

  /**
   * Record a result against a mode.
   *
   * `rating` is passed in rather than computed here because both players' new
   * ratings have to be derived from both old ones before either is written; the
   * repository's job is to store the answer, not to decide it.
   */
  recordResult(
    accountId: string,
    mode: string,
    outcome: 'win' | 'loss' | 'draw',
    rating: number,
  ): ModeStats {
    const before = this.statsFor(accountId, mode);
    // A streak counts consecutive wins and is reset - not decremented - by
    // anything else, so "three in a row" means what a player thinks it means.
    const streak = outcome === 'win' ? Math.max(0, before.streak) + 1 : 0;

    const next: ModeStats = {
      mode,
      rating,
      played: before.played + 1,
      won: before.won + (outcome === 'win' ? 1 : 0),
      lost: before.lost + (outcome === 'loss' ? 1 : 0),
      drawn: before.drawn + (outcome === 'draw' ? 1 : 0),
      streak,
      bestStreak: Math.max(before.bestStreak, streak),
    };

    this.db
      .prepare(
        `INSERT INTO stats (account_id, mode, rating, played, won, lost, drawn, streak, best_streak)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(account_id, mode) DO UPDATE SET
           rating = excluded.rating, played = excluded.played, won = excluded.won,
           lost = excluded.lost, drawn = excluded.drawn, streak = excluded.streak,
           best_streak = excluded.best_streak`,
      )
      .run(
        accountId,
        mode,
        next.rating,
        next.played,
        next.won,
        next.lost,
        next.drawn,
        next.streak,
        next.bestStreak,
      );

    return next;
  }

  // -------------------------------------------------------------------------
  // Achievements
  // -------------------------------------------------------------------------

  award(accountId: string, ids: readonly string[]): void {
    if (ids.length === 0) return;
    const statement = this.db.prepare(
      'INSERT INTO achievements (account_id, id, unlocked_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
    );
    const timestamp = this.now();
    this.db.transaction(() => {
      for (const id of ids) statement.run(accountId, id, timestamp);
    })();
  }

  achievements(accountId: string): { id: string; unlockedAt: number }[] {
    return this.db
      .prepare<[string], { id: string; unlocked_at: number }>(
        'SELECT id, unlocked_at FROM achievements WHERE account_id = ? ORDER BY unlocked_at',
      )
      .all(accountId)
      .map((row) => ({ id: row.id, unlockedAt: row.unlocked_at }));
  }

  // -------------------------------------------------------------------------
  // Leaderboard
  // -------------------------------------------------------------------------

  leaderboard(
    mode: string,
    limit: number,
    minimumGames: number,
  ): { account: AccountRow; stats: ModeStats }[] {
    const rows = this.db
      .prepare<[string, number, number], AccountRecord & StatsRecord>(
        `SELECT a.*, s.mode, s.rating, s.played, s.won, s.lost, s.drawn, s.streak, s.best_streak
         FROM stats s JOIN accounts a ON a.id = s.account_id
         WHERE s.mode = ? AND s.played >= ?
         ORDER BY s.rating DESC, s.played DESC, a.display_name ASC
         LIMIT ?`,
      )
      .all(mode, minimumGames, limit);

    return rows.map((row) => ({ account: toAccountRow(row), stats: toModeStats(row) }));
  }

  /** One-based position in a mode's ladder, or `null` if not ranked yet. */
  rankOf(accountId: string, mode: string, minimumGames: number): number | null {
    const own = this.db
      .prepare<[string, string], StatsRecord>(
        'SELECT mode, rating, played, won, lost, drawn, streak, best_streak FROM stats WHERE account_id = ? AND mode = ?',
      )
      .get(accountId, mode);
    if (!own || own.played < minimumGames) return null;

    const ahead = this.db
      .prepare<[string, number, number], { count: number }>(
        'SELECT COUNT(*) AS count FROM stats WHERE mode = ? AND played >= ? AND rating > ?',
      )
      .get(mode, minimumGames, own.rating);

    return (ahead?.count ?? 0) + 1;
  }

  private freeName(preferred: string): string {
    let candidate = preferred;
    for (let attempt = 0; attempt < 50; attempt++) {
      const clash = this.db
        .prepare<[string], { id: string }>('SELECT id FROM accounts WHERE name_key = ?')
        .get(nameKey(candidate));
      if (!clash) return candidate;
      const suffix = String(randomBytes(2).readUInt16BE() % 10_000).padStart(3, '0');
      // Keep inside the protocol's length cap even after suffixing.
      candidate = `${preferred.slice(0, 15)}${suffix}`;
    }
    return `Player${randomUUID().slice(0, 8)}`;
  }

  private randomAvatar(): Avatar {
    return AVATARS[randomBytes(1)[0]! % AVATARS.length]!;
  }

  private randomName(): string {
    const number = randomBytes(2).readUInt16BE() % 10_000;
    return `Player${String(number).padStart(4, '0')}`;
  }
}

/**
 * A fixed hash to verify against when no account matched.
 *
 * Computed once at module load from a value nobody can present, so the "no such
 * name" path does the same scrypt work as the "wrong password" path.
 */
const DUMMY_PASSWORD_HASH = hashPassword(randomBytes(32).toString('base64url'));

function toAccountRow(row: AccountRecord): AccountRow {
  return {
    id: row.id,
    displayName: row.display_name,
    avatar: (AVATARS as readonly string[]).includes(row.avatar)
      ? (row.avatar as Avatar)
      : AVATARS[0],
    createdAt: row.created_at,
    claimed: row.password_hash !== null,
  };
}

function toModeStats(row: StatsRecord): ModeStats {
  return {
    mode: row.mode,
    rating: row.rating,
    played: row.played,
    won: row.won,
    lost: row.lost,
    drawn: row.drawn,
    streak: row.streak,
    bestStreak: row.best_streak,
  };
}

/** The public view of an account, with its rating in one mode when relevant. */
export function toPublicProfile(account: AccountRow, rating: number | null): PublicProfile {
  return {
    accountId: account.id,
    displayName: account.displayName,
    avatar: account.avatar,
    rating,
  };
}
