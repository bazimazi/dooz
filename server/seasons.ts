import { randomUUID } from 'node:crypto';
import { GAME_MODES } from '@/game/engine';
import { type Avatar, AVATARS, type PublicProfile } from '@/protocol';
import { placementFor } from '@/protocol/tiers';
import type { AccountRow } from './db/accounts.js';
import { toPublicProfile } from './db/accounts.js';
import type { Db } from './db/database.js';
import type { LobbyExtension } from './lobby-hooks.js';
import { log } from './log.js';
import {
  currentRd,
  isProvisional,
  LEADERBOARD_MAX_RD,
  PLACEMENT_GAMES,
  rdWithinSql,
  SEASON_RESET_KEEP,
  SEASON_RESET_MIN_RD,
  STARTING_RATING,
} from './rating.js';

/**
 * Seasons: a ladder that starts over, a little, every few weeks.
 *
 * A season is a stretch of time with its own ranked record. When it ends the
 * standings are written down for good, everyone who placed is given a badge
 * for the tier they finished in, and every rating is pulled part of the way
 * back towards the start and made uncertain again (a soft reset), so the first
 * few games of the new season - the placements - move it quickly.
 *
 * Ratings themselves are never wiped. Matchmaking keeps working from the
 * pulled-back number, which is close enough to fair that nobody gets fed to a
 * master in their first game of a new season.
 *
 * The leaderboard for the current season lists players who have finished
 * their placements and whose rating has been tested recently enough to mean
 * something (current RD, inactivity included, at or under
 * `LEADERBOARD_MAX_RD`), ordered by the displayed rating. A conservative
 * rating (rating minus two RDs) was the alternative; it was rejected because
 * the number on the ladder would then not be the number on the player's
 * profile, and explaining why is worse than gating on certainty directly.
 */

export const DEFAULT_SEASON_LENGTH_MS = 8 * 7 * 24 * 60 * 60 * 1000;

export interface SeasonInfo {
  readonly id: number;
  readonly name: string;
  readonly startsAt: number;
  readonly endsAt: number;
  readonly closedAt: number | null;
}

export interface LadderEntry {
  readonly rank: number;
  readonly profile: PublicProfile;
  readonly rating: number;
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  readonly lost: number;
  readonly tier: string;
  readonly label: string;
  readonly peak: number;
}

export interface LadderPage {
  readonly season: SeasonInfo;
  readonly total: number;
  readonly entries: LadderEntry[];
}

export interface SeasonStanding {
  readonly mode: string;
  readonly rating: number;
  readonly rd: number;
  readonly provisional: boolean;
  readonly label: string;
  readonly tier: string;
  readonly progress: number | null;
  readonly seasonPlayed: number;
  readonly placementGames: number;
  readonly rank: number | null;
}

export interface SeasonResult {
  readonly seasonId: number;
  readonly seasonName: string;
  readonly mode: string;
  readonly rating: number;
  readonly peak: number;
  readonly played: number;
  readonly won: number;
  readonly lost: number;
  readonly drawn: number;
  readonly rank: number | null;
  readonly label: string;
  readonly tier: string;
}

export interface Award {
  readonly source: string;
  readonly sourceId: string;
  readonly mode: string;
  readonly badge: string;
  readonly title: string;
  readonly awardedAt: number;
}

export interface SeasonsOptions {
  readonly now?: () => number;
  readonly lengthMs?: number;
}

interface SeasonRecord {
  id: number;
  name: string;
  starts_at: number;
  ends_at: number;
  closed_at: number | null;
}

interface LadderRecord {
  id: string;
  display_name: string;
  avatar: string;
  created_at: number;
  password_hash: string | null;
  bot: number;
  rating: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  peak: number;
  rank?: number;
}

/** An open high-severity anti-cheat flag keeps an account off ladders until reviewed. */
const NOT_QUARANTINED = `NOT EXISTS (
  SELECT 1 FROM anticheat_flags f
  WHERE f.account_id = s.account_id AND f.status = 'open' AND f.severity = 'high'
)`;

const MAX_PAGE = 100;

export class Seasons implements LobbyExtension {
  private readonly now: () => number;
  private readonly lengthMs: number;
  private cached: SeasonInfo | null = null;

  constructor(
    private readonly db: Db,
    options: SeasonsOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.lengthMs = Math.max(60_000, options.lengthMs ?? DEFAULT_SEASON_LENGTH_MS);
  }

  // -------------------------------------------------------------------------
  // Lobby extension
  // -------------------------------------------------------------------------

  seasonId(): number {
    return this.current().id;
  }

  /** Close the season once its time is up. Cheap when it is not. */
  tick(now: number): void {
    const season = this.current();
    if (now >= season.endsAt) this.rollOver(now);
  }

  // -------------------------------------------------------------------------
  // Seasons
  // -------------------------------------------------------------------------

  /** The open season, created - as season 1 - the first time it is asked for. */
  current(): SeasonInfo {
    if (this.cached) return this.cached;
    const open = this.db
      .prepare<[], SeasonRecord>(
        'SELECT * FROM seasons WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1',
      )
      .get();
    this.cached = open ? toSeason(open) : this.open(this.now(), true);
    return this.cached;
  }

  get(id: number): SeasonInfo | null {
    const row = this.db
      .prepare<[number], SeasonRecord>('SELECT * FROM seasons WHERE id = ?')
      .get(id);
    return row ? toSeason(row) : null;
  }

  /** Newest first. */
  list(limit = 24): SeasonInfo[] {
    this.current();
    return this.db
      .prepare<[number], SeasonRecord>('SELECT * FROM seasons ORDER BY id DESC LIMIT ?')
      .all(limit)
      .map(toSeason);
  }

  /**
   * End the current season and open the next: archive, reward, soft reset.
   * One transaction, so a crash half-way leaves the old season open and the
   * next tick simply tries again.
   */
  rollOver(now: number): SeasonInfo {
    const season = this.current();
    const next = this.db.transaction(() => {
      this.archive(season);
      this.db
        .prepare(
          `UPDATE stats SET
             rating_exact = ${STARTING_RATING} + (COALESCE(rating_exact, rating) - ${STARTING_RATING}) * ${SEASON_RESET_KEEP},
             rating = CAST(ROUND(${STARTING_RATING} + (COALESCE(rating_exact, rating) - ${STARTING_RATING}) * ${SEASON_RESET_KEEP}) AS INTEGER),
             rd = MAX(rd, ${SEASON_RESET_MIN_RD})
           WHERE rated_at IS NOT NULL`,
        )
        .run();
      this.db.prepare('UPDATE seasons SET closed_at = ? WHERE id = ?').run(now, season.id);
      // The next season starts where this one was meant to end, unless the
      // server was down for longer than a whole season, in which case now.
      const startsAt = now - season.endsAt < this.lengthMs ? season.endsAt : now;
      return this.insertSeason(season.id + 1, startsAt);
    })();
    this.cached = next;
    log.info('season.rollover', { closed: season.id, opened: next.id });
    return next;
  }

  private open(now: number, carryOver: boolean): SeasonInfo {
    const latest = this.db.prepare<[], { id: number }>('SELECT MAX(id) AS id FROM seasons').get();
    const id = (latest?.id ?? 0) + 1;
    return this.db.transaction(() => {
      const season = this.insertSeason(id, now);
      // The very first season inherits the ranked record that existed before
      // seasons did, so turning them on does not empty the leaderboard.
      if (carryOver && id === 1) {
        this.db
          .prepare(
            `UPDATE stats SET
               season_id = 1,
               season_played = ranked_played,
               season_won = (SELECT COUNT(*) FROM matches m WHERE m.mode = stats.mode AND m.kind = 'ranked'
                 AND ((m.x_id = stats.account_id AND m.winner = 1) OR (m.o_id = stats.account_id AND m.winner = 2))),
               season_lost = (SELECT COUNT(*) FROM matches m WHERE m.mode = stats.mode AND m.kind = 'ranked'
                 AND ((m.x_id = stats.account_id AND m.winner = 2) OR (m.o_id = stats.account_id AND m.winner = 1))),
               season_drawn = (SELECT COUNT(*) FROM matches m WHERE m.mode = stats.mode AND m.kind = 'ranked'
                 AND (m.x_id = stats.account_id OR m.o_id = stats.account_id) AND m.winner IS NULL),
               season_peak = rating
             WHERE ranked_played > 0`,
          )
          .run();
      }
      return season;
    })();
  }

  private insertSeason(id: number, startsAt: number): SeasonInfo {
    const season: SeasonInfo = {
      id,
      name: `Season ${id}`,
      startsAt,
      endsAt: startsAt + this.lengthMs,
      closedAt: null,
    };
    this.db
      .prepare(
        'INSERT INTO seasons (id, name, starts_at, ends_at, closed_at) VALUES (?, ?, ?, ?, NULL)',
      )
      .run(season.id, season.name, season.startsAt, season.endsAt);
    return season;
  }

  /** Write the closing standings and the rewards for them. */
  private archive(season: SeasonInfo): void {
    const rows = this.db
      .prepare<
        [number],
        {
          account_id: string;
          mode: string;
          rating: number;
          played: number;
          won: number;
          lost: number;
          drawn: number;
          peak: number;
          qualified: number;
        }
      >(
        `SELECT s.account_id, s.mode, s.rating, s.season_played AS played, s.season_won AS won,
                s.season_lost AS lost, s.season_drawn AS drawn, s.season_peak AS peak,
                (s.season_played >= ${PLACEMENT_GAMES} AND ${NOT_QUARANTINED}) AS qualified
         FROM stats s JOIN accounts a ON a.id = s.account_id
         WHERE s.season_id = ? AND s.season_played > 0 AND a.bot = 0
         ORDER BY s.mode, s.rating DESC, s.season_played DESC, a.display_name ASC`,
      )
      .all(season.id);

    const insertResult = this.db.prepare(
      `INSERT OR REPLACE INTO season_results
         (season_id, account_id, mode, rating, peak, played, won, lost, drawn, rank, tier, division)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertAward = this.db.prepare(
      `INSERT INTO competitive_awards (id, account_id, source, source_id, mode, badge, title, awarded_at)
       VALUES (?, ?, 'season', ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
    );

    const ranks = new Map<string, number>();
    for (const row of rows) {
      const placement = placementFor(row.rating);
      let rank: number | null = null;
      if (row.qualified) {
        rank = (ranks.get(row.mode) ?? 0) + 1;
        ranks.set(row.mode, rank);
      }
      insertResult.run(
        season.id,
        row.account_id,
        row.mode,
        row.rating,
        Math.max(row.peak, row.rating),
        row.played,
        row.won,
        row.lost,
        row.drawn,
        rank,
        placement.tier,
        placement.division,
      );

      if (rank === null) continue;
      const modeName = GAME_MODES.find((mode) => mode.id === row.mode)?.name ?? row.mode;
      const title =
        rank === 1
          ? `${season.name} Champion · ${modeName}`
          : rank <= 10
            ? `${season.name} Top 10 · ${modeName}`
            : `${season.name} ${placement.tierName} · ${modeName}`;
      insertAward.run(
        randomUUID(),
        row.account_id,
        String(season.id),
        row.mode,
        rank === 1 ? 'season-champion' : rank <= 10 ? 'season-top10' : `season-${placement.tier}`,
        title,
        this.now(),
      );
    }
  }

  // -------------------------------------------------------------------------
  // Ladders
  // -------------------------------------------------------------------------

  /** One page of a season's ladder. The current season is live; a past one is as it closed. */
  ladder(mode: string, seasonId: number, limit: number, offset: number): LadderPage | null {
    const season = this.get(seasonId);
    if (!season) return null;
    const take = clamp(limit, 1, MAX_PAGE);
    const skip = Math.max(0, Math.floor(offset));

    if (season.closedAt === null) {
      const params = this.liveParams(mode, season.id);
      const total =
        this.db
          .prepare<typeof params, { count: number }>(`SELECT COUNT(*) AS count ${this.liveFrom()}`)
          .get(params)?.count ?? 0;
      const rows = this.db
        .prepare<typeof params & { limit: number; offset: number }, LadderRecord>(
          `SELECT a.id, a.display_name, a.avatar, a.created_at, a.password_hash, a.bot,
                  s.rating, s.season_played AS played, s.season_won AS won, s.season_drawn AS drawn,
                  s.season_lost AS lost, s.season_peak AS peak
           ${this.liveFrom()}
           ORDER BY s.rating DESC, s.season_played DESC, a.display_name ASC
           LIMIT @limit OFFSET @offset`,
        )
        .all({ ...params, limit: take, offset: skip });
      return { season, total, entries: rows.map((row, index) => toEntry(row, skip + index + 1)) };
    }

    const total =
      this.db
        .prepare<[number, string], { count: number }>(
          'SELECT COUNT(*) AS count FROM season_results WHERE season_id = ? AND mode = ? AND rank IS NOT NULL',
        )
        .get(season.id, mode)?.count ?? 0;
    const rows = this.db
      .prepare<[number, string, number, number], LadderRecord>(
        `SELECT a.id, a.display_name, a.avatar, a.created_at, a.password_hash, a.bot,
                r.rating, r.played, r.won, r.drawn, r.lost, r.peak, r.rank
         FROM season_results r JOIN accounts a ON a.id = r.account_id
         WHERE r.season_id = ? AND r.mode = ? AND r.rank IS NOT NULL
         ORDER BY r.rank ASC LIMIT ? OFFSET ?`,
      )
      .all(season.id, mode, take, skip);
    return { season, total, entries: rows.map((row) => toEntry(row, row.rank ?? 0)) };
  }

  /** One-based position on a season's ladder, or `null` if not on it. */
  rankOf(accountId: string, mode: string, seasonId: number): number | null {
    const season = this.get(seasonId);
    if (!season) return null;
    if (season.closedAt !== null) {
      return (
        this.db
          .prepare<[number, string, string], { rank: number | null }>(
            'SELECT rank FROM season_results WHERE season_id = ? AND account_id = ? AND mode = ?',
          )
          .get(season.id, accountId, mode)?.rank ?? null
      );
    }
    const params = { ...this.liveParams(mode, season.id), account: accountId };
    const row = this.db
      .prepare<typeof params, { rank: number }>(
        `SELECT rank FROM (
           SELECT s.account_id,
                  ROW_NUMBER() OVER (ORDER BY s.rating DESC, s.season_played DESC, a.display_name ASC) AS rank
           ${this.liveFrom()}
         ) WHERE account_id = @account`,
      )
      .get(params);
    return row?.rank ?? null;
  }

  /** The page of the ladder centred on one account, if it is on it. */
  around(accountId: string, mode: string, seasonId: number, span = 5): LadderPage | null {
    const rank = this.rankOf(accountId, mode, seasonId);
    if (rank === null) return null;
    const offset = Math.max(0, rank - 1 - span);
    return this.ladder(mode, seasonId, span * 2 + 1, offset);
  }

  private liveFrom(): string {
    return `FROM stats s JOIN accounts a ON a.id = s.account_id
      WHERE s.mode = @mode AND s.season_id = @season AND s.season_played >= @placement
        AND a.bot = 0 AND ${rdWithinSql(LEADERBOARD_MAX_RD, '@now')} AND ${NOT_QUARANTINED}`;
  }

  private liveParams(mode: string, season: number) {
    return { mode, season, placement: PLACEMENT_GAMES, now: this.now() };
  }

  // -------------------------------------------------------------------------
  // One player
  // -------------------------------------------------------------------------

  /** Where an account stands this season, mode by mode. */
  standings(accountId: string): SeasonStanding[] {
    const season = this.current();
    const rows = this.db
      .prepare<
        [string],
        {
          mode: string;
          rating: number;
          rd: number;
          volatility: number;
          rated_at: number | null;
          season_id: number;
          season_played: number;
        }
      >(
        `SELECT mode, rating, rd, volatility, rated_at, season_id, season_played
         FROM stats WHERE account_id = ? AND rated_at IS NOT NULL ORDER BY rating DESC`,
      )
      .all(accountId);

    return rows.map((row) => {
      const rd = currentRd(
        { rating: row.rating, rd: row.rd, volatility: row.volatility, ratedAt: row.rated_at },
        this.now(),
      );
      const placement = placementFor(row.rating);
      const played = row.season_id === season.id ? row.season_played : 0;
      return {
        mode: row.mode,
        rating: row.rating,
        rd: Math.round(rd),
        provisional: isProvisional(rd),
        label: placement.label,
        tier: placement.tier,
        progress: placement.progress,
        seasonPlayed: played,
        placementGames: PLACEMENT_GAMES,
        rank: played >= PLACEMENT_GAMES ? this.rankOf(accountId, row.mode, season.id) : null,
      };
    });
  }

  /** Closed seasons an account took part in, newest first. */
  history(accountId: string, limit = 50): SeasonResult[] {
    return this.db
      .prepare<
        [string, number],
        {
          season_id: number;
          name: string;
          mode: string;
          rating: number;
          peak: number;
          played: number;
          won: number;
          lost: number;
          drawn: number;
          rank: number | null;
        }
      >(
        `SELECT r.season_id, s.name, r.mode, r.rating, r.peak, r.played, r.won, r.lost, r.drawn, r.rank
         FROM season_results r JOIN seasons s ON s.id = r.season_id
         WHERE r.account_id = ? ORDER BY r.season_id DESC, r.rating DESC LIMIT ?`,
      )
      .all(accountId, limit)
      .map((row) => {
        const placement = placementFor(row.rating);
        return {
          seasonId: row.season_id,
          seasonName: row.name,
          mode: row.mode,
          rating: row.rating,
          peak: row.peak,
          played: row.played,
          won: row.won,
          lost: row.lost,
          drawn: row.drawn,
          rank: row.rank,
          label: placement.label,
          tier: placement.tier,
        };
      });
  }

  /** Titles and badges an account has been given, newest first. */
  awards(accountId: string, limit = 50): Award[] {
    return this.db
      .prepare<
        [string, number],
        {
          source: string;
          source_id: string;
          mode: string;
          badge: string;
          title: string;
          awarded_at: number;
        }
      >(
        `SELECT source, source_id, mode, badge, title, awarded_at FROM competitive_awards
         WHERE account_id = ? ORDER BY awarded_at DESC LIMIT ?`,
      )
      .all(accountId, limit)
      .map((row) => ({
        source: row.source,
        sourceId: row.source_id,
        mode: row.mode,
        badge: row.badge,
        title: row.title,
        awardedAt: row.awarded_at,
      }));
  }
}

/** Record an award from anywhere else (a tournament). Idempotent per source. */
export function grantAward(
  db: Db,
  award: {
    accountId: string;
    source: string;
    sourceId: string;
    mode: string;
    badge: string;
    title: string;
    at: number;
  },
): void {
  db.prepare(
    `INSERT INTO competitive_awards (id, account_id, source, source_id, mode, badge, title, awarded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
  ).run(
    randomUUID(),
    award.accountId,
    award.source,
    award.sourceId,
    award.mode,
    award.badge,
    award.title,
    award.at,
  );
}

function toSeason(row: SeasonRecord): SeasonInfo {
  return {
    id: row.id,
    name: row.name,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    closedAt: row.closed_at,
  };
}

function toEntry(row: LadderRecord, rank: number): LadderEntry {
  const account: AccountRow = {
    id: row.id,
    displayName: row.display_name,
    avatar: (AVATARS as readonly string[]).includes(row.avatar)
      ? (row.avatar as Avatar)
      : AVATARS[0],
    createdAt: row.created_at,
    claimed: row.password_hash !== null,
    bot: row.bot === 1,
  };
  const placement = placementFor(row.rating);
  return {
    rank,
    profile: toPublicProfile(account, row.rating),
    rating: row.rating,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    tier: placement.tier,
    label: placement.label,
    peak: Math.max(row.peak, row.rating),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : min;
}
