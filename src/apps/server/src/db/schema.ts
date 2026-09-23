import type BetterSqlite3 from 'better-sqlite3';

/**
 * Schema and migrations.
 *
 * Migrations are a numbered list applied in order inside a transaction, with
 * the high-water mark kept in SQLite's own `user_version`. That is the smallest
 * thing that is actually safe: it needs no extra table, it cannot half-apply,
 * and adding a migration is appending to an array.
 */
type Migration = (db: BetterSqlite3.Database) => void;

const MIGRATIONS: readonly Migration[] = [
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
