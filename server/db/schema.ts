import type BetterSqlite3 from 'better-sqlite3';
import { competitiveMigration } from './competitive-schema.js';

/**
 * Schema and migrations.
 *
 * Migrations are a numbered list applied in order inside a transaction, with
 * the high-water mark kept in SQLite's own `user_version`. That is the smallest
 * thing that is actually safe: it needs no extra table, it cannot half-apply,
 * and adding a migration is appending to an array.
 */
type Migration = (db: BetterSqlite3.Database) => void;

/** Exported so a test can re-run one step on its own. */
export const MIGRATIONS: readonly Migration[] = [
  (db) => {
    db.exec(`
      CREATE TABLE accounts (
        id            TEXT PRIMARY KEY,
        display_name  TEXT NOT NULL,
        -- Lower-cased copy with its own unique index: two players called
        -- "Ada" and "ada" are indistinguishable across a board, so the
        -- namespace is case-insensitive even though the name displays as typed.
        name_key      TEXT NOT NULL UNIQUE,
        avatar        TEXT NOT NULL,
        token_hash    TEXT NOT NULL,
        password_hash TEXT,
        created_at    INTEGER NOT NULL,
        last_seen_at  INTEGER NOT NULL
      ) STRICT;

      CREATE TABLE stats (
        account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        mode        TEXT NOT NULL,
        rating      INTEGER NOT NULL,
        played      INTEGER NOT NULL DEFAULT 0,
        won         INTEGER NOT NULL DEFAULT 0,
        lost        INTEGER NOT NULL DEFAULT 0,
        drawn       INTEGER NOT NULL DEFAULT 0,
        streak      INTEGER NOT NULL DEFAULT 0,
        best_streak INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (account_id, mode)
      ) STRICT;

      -- The leaderboard reads this the other way round from everything else,
      -- so it gets an index of its own.
      CREATE INDEX stats_by_rating ON stats(mode, rating DESC, played DESC);

      CREATE TABLE matches (
        id              TEXT PRIMARY KEY,
        mode            TEXT NOT NULL,
        config          TEXT NOT NULL,
        kind            TEXT NOT NULL,
        x_id            TEXT NOT NULL,
        o_id            TEXT NOT NULL,
        starting_player INTEGER NOT NULL,
        moves           TEXT NOT NULL,
        move_times      TEXT NOT NULL,
        winner          INTEGER,
        reason          TEXT NOT NULL,
        played_at       INTEGER NOT NULL,
        duration_ms     INTEGER NOT NULL,
        x_rating_before INTEGER,
        x_rating_after  INTEGER,
        o_rating_before INTEGER,
        o_rating_after  INTEGER
      ) STRICT;

      CREATE INDEX matches_by_x ON matches(x_id, played_at DESC);
      CREATE INDEX matches_by_o ON matches(o_id, played_at DESC);

      CREATE TABLE achievements (
        account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        id          TEXT NOT NULL,
        unlocked_at INTEGER NOT NULL,
        PRIMARY KEY (account_id, id)
      ) STRICT;

      CREATE TABLE reports (
        id          TEXT PRIMARY KEY,
        reporter_id TEXT NOT NULL,
        match_id    TEXT NOT NULL,
        reason      TEXT NOT NULL,
        detail      TEXT,
        created_at  INTEGER NOT NULL
      ) STRICT;

      CREATE INDEX reports_by_match ON reports(match_id);
    `);
  },
  (db) => {
    // Ranked games counted on their own, for the K-factor and the placement
    // threshold; `played` keeps counting every game for the profile. Existing
    // rows are backfilled from the match records, which hold every ranked game
    // that was ever scored.
    db.exec(`
      ALTER TABLE stats ADD COLUMN ranked_played INTEGER NOT NULL DEFAULT 0;

      UPDATE stats SET ranked_played = (
        SELECT COUNT(*) FROM matches m
        WHERE m.mode = stats.mode
          AND m.kind = 'ranked'
          AND (m.x_id = stats.account_id OR m.o_id = stats.account_id)
      );
    `);
  },
  (db) => {
    // Social, persistence and operations: friends, correspondence games, push
    // subscriptions, moderation, account recovery, cloud saves, telemetry and
    // the live-room snapshot a deploy hands to the next process.
    //
    // Every table keyed by an account references it with ON DELETE CASCADE, so
    // deleting an account (a GDPR request) takes its social graph, devices and
    // saves with it rather than leaving orphans behind.
    //
    // Written to be re-runnable (IF NOT EXISTS, column checks), so a database
    // wound back to an earlier version - as a migration test does - can be
    // brought forward again over tables that are already there.
    const reportColumns = new Set(
      (db.prepare('PRAGMA table_info(reports)').all() as { name: string }[]).map(
        (column) => column.name,
      ),
    );
    if (!reportColumns.has('resolved_at'))
      db.exec('ALTER TABLE reports ADD COLUMN resolved_at INTEGER');
    if (!reportColumns.has('resolution')) db.exec('ALTER TABLE reports ADD COLUMN resolution TEXT');

    db.exec(`
      CREATE TABLE IF NOT EXISTS friend_codes (
        account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        code       TEXT NOT NULL UNIQUE
      ) STRICT;

      CREATE TABLE IF NOT EXISTS friend_requests (
        from_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        to_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (from_id, to_id)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS friend_requests_by_to ON friend_requests(to_id, created_at DESC);

      -- Stored in both directions, so "my friends" is one indexed range scan.
      CREATE TABLE IF NOT EXISTS friendships (
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        friend_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        since      INTEGER NOT NULL,
        PRIMARY KEY (account_id, friend_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS blocks (
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        blocked_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (account_id, blocked_id)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS blocks_by_blocked ON blocks(blocked_id);

      CREATE TABLE IF NOT EXISTS correspondence_games (
        id              TEXT PRIMARY KEY,
        mode            TEXT NOT NULL,
        config          TEXT NOT NULL,
        x_id            TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        o_id            TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        inviter_id      TEXT NOT NULL,
        -- invited | active | finished | declined | expired
        status          TEXT NOT NULL,
        starting_player INTEGER NOT NULL,
        moves           TEXT NOT NULL,
        move_times      TEXT NOT NULL,
        move_window_ms  INTEGER NOT NULL,
        deadline_at     INTEGER NOT NULL,
        reminded        INTEGER NOT NULL DEFAULT 0,
        created_at      INTEGER NOT NULL,
        updated_at      INTEGER NOT NULL,
        winner          INTEGER,
        reason          TEXT,
        match_id        TEXT
      ) STRICT;
      CREATE INDEX IF NOT EXISTS correspondence_by_x ON correspondence_games(x_id, status);
      CREATE INDEX IF NOT EXISTS correspondence_by_o ON correspondence_games(o_id, status);
      CREATE INDEX IF NOT EXISTS correspondence_by_deadline ON correspondence_games(status, deadline_at);

      CREATE TABLE IF NOT EXISTS push_subscriptions (
        endpoint        TEXT PRIMARY KEY,
        account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        p256dh          TEXT NOT NULL,
        auth            TEXT NOT NULL,
        created_at      INTEGER NOT NULL,
        last_success_at INTEGER
      ) STRICT;
      CREATE INDEX IF NOT EXISTS push_by_account ON push_subscriptions(account_id);

      CREATE TABLE IF NOT EXISTS sanctions (
        id         TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        -- mute | ban
        kind       TEXT NOT NULL,
        reason     TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        -- NULL for a permanent sanction.
        expires_at INTEGER,
        revoked_at INTEGER
      ) STRICT;
      CREATE INDEX IF NOT EXISTS sanctions_by_account ON sanctions(account_id, kind);

      CREATE INDEX IF NOT EXISTS reports_by_time ON reports(created_at DESC);

      CREATE TABLE IF NOT EXISTS recovery_codes (
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        code_hash  TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        used_at    INTEGER,
        PRIMARY KEY (account_id, code_hash)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS cloud_saves (
        account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        revision   INTEGER NOT NULL,
        data       TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;

      -- Telemetry carries no account id and no address: a stream of anonymous
      -- events, a daily rollup that outlives them, and errors grouped by
      -- fingerprint so one crash seen a thousand times is one row.
      CREATE TABLE IF NOT EXISTS telemetry_events (
        id          INTEGER PRIMARY KEY,
        kind        TEXT NOT NULL,
        name        TEXT NOT NULL,
        data        TEXT,
        app_version TEXT,
        platform    TEXT,
        created_at  INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS telemetry_events_by_time ON telemetry_events(created_at);

      CREATE TABLE IF NOT EXISTS telemetry_daily (
        day   TEXT NOT NULL,
        kind  TEXT NOT NULL,
        name  TEXT NOT NULL,
        count INTEGER NOT NULL,
        PRIMARY KEY (day, kind, name)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS telemetry_errors (
        fingerprint TEXT PRIMARY KEY,
        message     TEXT NOT NULL,
        stack       TEXT,
        source      TEXT,
        app_version TEXT,
        count       INTEGER NOT NULL,
        first_seen  INTEGER NOT NULL,
        last_seen   INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS telemetry_errors_by_seen ON telemetry_errors(last_seen DESC);

      -- Rooms in play when the previous process shut down, restored on boot.
      CREATE TABLE IF NOT EXISTS live_rooms (
        code     TEXT PRIMARY KEY,
        state    TEXT NOT NULL,
        saved_at INTEGER NOT NULL
      ) STRICT;
    `);
  },
  // Glicko-2, seasons, awards, tournaments, anti-cheat and bot accounts.
  competitiveMigration,
];

export function migrate(db: BetterSqlite3.Database): void {
  const current = db.pragma('user_version', { simple: true }) as number;

  for (let version = current; version < MIGRATIONS.length; version++) {
    const migration = MIGRATIONS[version];
    if (!migration) continue;
    db.transaction(() => {
      migration(db);
      // Pragmas cannot be parameterised, hence the interpolation; the value is
      // a loop counter rather than anything that came from outside.
      db.pragma(`user_version = ${version + 1}`);
    })();
  }
}

export const SCHEMA_VERSION = MIGRATIONS.length;
