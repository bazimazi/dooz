import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { MAX_RD, rdFromGamesPlayed } from '../rating.js';
import { competitiveMigration } from './competitive-schema.js';
import { MIGRATIONS } from './schema.js';

describe('competitive migration', () => {
  it('keeps every Elo rating and estimates its deviation from games played', () => {
    const db = new Database(':memory:');
    try {
      // Bring a database up to just before this migration.
      const index = MIGRATIONS.indexOf(competitiveMigration);
      expect(index).toBeGreaterThan(0);
      for (const migration of MIGRATIONS.slice(0, index)) migration(db);

      db.exec(`
        INSERT INTO accounts (id, display_name, name_key, avatar, token_hash, password_hash, created_at, last_seen_at)
        VALUES ('a', 'Veteran', 'veteran', 'fox', 'x', NULL, 1, 1), ('b', 'Newbie', 'newbie', 'owl', 'y', NULL, 1, 1);
        INSERT INTO stats (account_id, mode, rating, played, ranked_played) VALUES
          ('a', 'grid-6', 1640, 120, 80),
          ('b', 'grid-6', 1200, 3, 0);
        INSERT INTO matches (id, mode, config, kind, x_id, o_id, starting_player, moves, move_times, reason, played_at, duration_ms)
        VALUES ('m', 'grid-6', '{}', 'ranked', 'a', 'gone', 1, '[]', '[]', 'resign', 5000, 1);
      `);

      competitiveMigration(db);

      const rows = db
        .prepare<
          [],
          {
            account_id: string;
            rating: number;
            rating_exact: number;
            rd: number;
            rated_at: number | null;
            bot: number;
          }
        >(
          `SELECT s.account_id, s.rating, s.rating_exact, s.rd, s.rated_at, a.bot
           FROM stats s JOIN accounts a ON a.id = s.account_id ORDER BY s.account_id`,
        )
        .all();
      expect(rows[0]).toMatchObject({
        rating: 1640,
        rating_exact: 1640,
        rd: rdFromGamesPlayed(80),
        rated_at: 5000,
        bot: 0,
      });
      expect(rows[1]).toMatchObject({ rating: 1200, rd: MAX_RD, rated_at: null });
      expect(rows[0]!.rd).toBeLessThan(100);
    } finally {
      db.close();
    }
  });
});
