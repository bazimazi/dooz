import type BetterSqlite3 from 'better-sqlite3';
import { DEFAULT_VOLATILITY, rdFromGamesPlayed } from '../rating.js';

/**
 * The competitive layer's schema: Glicko-2 state, seasons, awards,
 * tournaments, anti-cheat and bot accounts.
 *
 * Kept in its own file and appended to the migration list as one step, so it
 * applies atomically with everything it needs and stays out of the way of
 * migrations other parts of the server add.
 */
export function competitiveMigration(db: BetterSqlite3.Database): void {
  db.exec(`
    -- Glicko-2. The integer rating stays as the displayed value; the exact one
    -- keeps sub-point changes from being rounded away game after game.
    ALTER TABLE stats ADD COLUMN rating_exact REAL;
    ALTER TABLE stats ADD COLUMN rd REAL NOT NULL DEFAULT 350;
    ALTER TABLE stats ADD COLUMN volatility REAL NOT NULL DEFAULT ${DEFAULT_VOLATILITY};
    ALTER TABLE stats ADD COLUMN rated_at INTEGER;

    -- The current season's ranked record. Reset in one statement when a
    -- season rolls over; a row whose season_id is stale counts as zero.
    ALTER TABLE stats ADD COLUMN season_id INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE stats ADD COLUMN season_played INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE stats ADD COLUMN season_won INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE stats ADD COLUMN season_lost INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE stats ADD COLUMN season_drawn INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE stats ADD COLUMN season_peak INTEGER NOT NULL DEFAULT 0;

    CREATE INDEX stats_by_season ON stats(mode, season_id, rating DESC);

    -- Bots are real accounts, so their games have records and replays like any
    -- other, but flagged so every view of them can say what they are.
    ALTER TABLE accounts ADD COLUMN bot INTEGER NOT NULL DEFAULT 0;

    CREATE TABLE seasons (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      starts_at  INTEGER NOT NULL,
      ends_at    INTEGER NOT NULL,
      closed_at  INTEGER
    ) STRICT;

    -- Final standings, written once when a season closes.
    CREATE TABLE season_results (
      season_id  INTEGER NOT NULL REFERENCES seasons(id),
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      mode       TEXT NOT NULL,
      rating     INTEGER NOT NULL,
      peak       INTEGER NOT NULL,
      played     INTEGER NOT NULL,
      won        INTEGER NOT NULL,
      lost       INTEGER NOT NULL,
      drawn      INTEGER NOT NULL,
      rank       INTEGER,
      tier       TEXT NOT NULL,
      division   INTEGER,
      PRIMARY KEY (season_id, account_id, mode)
    ) STRICT;

    CREATE INDEX season_results_by_rank ON season_results(season_id, mode, rank);
    CREATE INDEX season_results_by_account ON season_results(account_id, season_id DESC);

    -- Titles and badges, from seasons and tournaments. Written by the server
    -- only; the unique key makes a re-run of a season close a no-op.
    CREATE TABLE competitive_awards (
      id          TEXT PRIMARY KEY,
      account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      source      TEXT NOT NULL,
      source_id   TEXT NOT NULL,
      mode        TEXT NOT NULL,
      badge       TEXT NOT NULL,
      title       TEXT NOT NULL,
      awarded_at  INTEGER NOT NULL,
      UNIQUE (account_id, source, source_id, mode)
    ) STRICT;

    CREATE INDEX competitive_awards_by_account ON competitive_awards(account_id, awarded_at DESC);

    CREATE TABLE tournaments (
      id          TEXT PRIMARY KEY,
      kind        TEXT NOT NULL,
      name        TEXT NOT NULL,
      mode        TEXT NOT NULL,
      config      TEXT NOT NULL,
      starts_at   INTEGER NOT NULL,
      ends_at     INTEGER NOT NULL,
      status      TEXT NOT NULL,
      created_by  TEXT,
      standings   TEXT NOT NULL DEFAULT '[]',
      finished_at INTEGER
    ) STRICT;

    CREATE INDEX tournaments_by_status ON tournaments(status, starts_at);

    -- One row per analysed side of a match.
    CREATE TABLE anticheat_games (
      match_id    TEXT NOT NULL,
      account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      mode        TEXT NOT NULL,
      positions   INTEGER NOT NULL,
      matched     INTEGER NOT NULL,
      top_rate    REAL NOT NULL,
      mean_ms     REAL NOT NULL,
      time_cv     REAL NOT NULL,
      analysed_at INTEGER NOT NULL,
      PRIMARY KEY (match_id, account_id)
    ) STRICT;

    CREATE INDEX anticheat_games_by_account ON anticheat_games(account_id, analysed_at DESC);

    -- Suspicions for a human to review. Nothing here bans anyone: an open
    -- high-severity flag only keeps the account off leaderboards and out of
    -- season rewards until a moderator has looked.
    CREATE TABLE anticheat_flags (
      id          TEXT PRIMARY KEY,
      account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      kind        TEXT NOT NULL,
      severity    TEXT NOT NULL,
      score       REAL NOT NULL,
      detail      TEXT NOT NULL,
      related_id  TEXT,
      status      TEXT NOT NULL DEFAULT 'open',
      created_at  INTEGER NOT NULL,
      reviewed_by TEXT,
      reviewed_at INTEGER,
      note        TEXT
    ) STRICT;

    CREATE INDEX anticheat_flags_by_status ON anticheat_flags(status, created_at DESC);
    CREATE INDEX anticheat_flags_by_account ON anticheat_flags(account_id, status);
  `);

  // Existing Elo ratings carry over as Glicko ratings unchanged - the scales
  // are the same - with a deviation estimated from how many ranked games each
  // one rests on, and the last ranked game as the moment it was last tested.
  const rows = db
    .prepare<[], { account_id: string; mode: string; rating: number; ranked_played: number }>(
      'SELECT account_id, mode, rating, ranked_played FROM stats',
    )
    .all();
  const lastRated = db.prepare<[string, string, string], { at: number | null }>(
    `SELECT MAX(played_at) AS at FROM matches
     WHERE mode = ? AND kind = 'ranked' AND (x_id = ? OR o_id = ?)`,
  );
  const update = db.prepare(
    'UPDATE stats SET rating_exact = ?, rd = ?, rated_at = ? WHERE account_id = ? AND mode = ?',
  );
  for (const row of rows) {
    const at = lastRated.get(row.mode, row.account_id, row.account_id)?.at ?? null;
    update.run(row.rating, rdFromGamesPlayed(row.ranked_played), at, row.account_id, row.mode);
  }
}
