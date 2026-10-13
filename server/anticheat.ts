import { randomUUID } from 'node:crypto';
import { type GameConfig, O, type Player, startingPlayerOf, X } from '@/game/engine';
import type { Db } from './db/database.js';
import type { SideAnalysis } from './engine/jobs.js';
import type { EngineRunner } from './engine/pool.js';
import type { LobbyExtension, SettledMatch } from './lobby-hooks.js';
import { log } from './log.js';

/**
 * Suspicion, recorded for a person to judge.
 *
 * Three signals, all cheap to compute and all deliberately conservative:
 *
 * - **Engine agreement.** After a ranked game on a board big enough to have
 *   real choices, a worker thread replays it and asks the strongest engine
 *   level what it would have played in each non-trivial position (past the
 *   opening, more than a few legal moves, and not a win or a block anyone
 *   would find). A player who matches it nearly every time, across many games,
 *   and with suspiciously even thinking times, is flagged.
 * - **Win trading.** The same two accounts playing each other over and over
 *   with one of them nearly always winning.
 * - **Fast resignations.** Ranked games thrown in the first couple of moves,
 *   repeatedly - the other half of feeding someone rating.
 *
 * None of it bans anybody. An open high-severity flag keeps the account off
 * leaderboards and out of season rewards (the "quarantine") until a moderator
 * clears or confirms it through the moderation API, which reads and resolves
 * flags with the methods at the bottom of this class.
 */

export type FlagKind = 'engine' | 'win-trading' | 'fast-resign';
export type FlagSeverity = 'medium' | 'high';
export type FlagStatus = 'open' | 'cleared' | 'actioned';

export interface Flag {
  readonly id: string;
  readonly accountId: string;
  readonly kind: FlagKind;
  readonly severity: FlagSeverity;
  readonly score: number;
  readonly detail: Record<string, unknown>;
  readonly relatedId: string | null;
  readonly status: FlagStatus;
  readonly createdAt: number;
  readonly reviewedBy: string | null;
  readonly reviewedAt: number | null;
  readonly note: string | null;
}

export interface AntiCheatOptions {
  readonly now?: () => number;
  /** Search time per analysed position. */
  readonly budgetMs?: number;
  /** Positions searched per side per game. */
  readonly maxPositions?: number;
  /** Analyses allowed in flight at once; beyond it, games are skipped rather than queued. */
  readonly maxInFlight?: number;
}

/** Thresholds. Tuned to be quiet: a false flag costs a real player their ladder spot. */
export const THRESHOLDS = {
  /** Positions needed, across recent games, before engine agreement means anything. */
  minPositions: 60,
  /** Agreement this high, on its own, is flagged high. */
  highTopRate: 0.9,
  /** Agreement this high is flagged medium if the think times are also machine-even. */
  mediumTopRate: 0.8,
  /** Think-time coefficient of variation below which timing looks scripted. */
  evenTimingCv: 0.3,
  /** Games between one pair in the window before their results are looked at. */
  tradingGames: 6,
  /** Share of those one side must have won. */
  tradingShare: 0.85,
  /** At this many games it is high severity. */
  tradingHighGames: 10,
  /** A resignation or walk-out before this many moves counts as thrown. */
  fastResignMoves: 4,
  /** Thrown games in the window before a flag. */
  fastResignCount: 5,
  windowMs: 24 * 60 * 60 * 1000,
  /** How far back engine agreement is aggregated. */
  engineWindowMs: 30 * 24 * 60 * 60 * 1000,
  engineWindowGames: 20,
} as const;

/** Boards small enough to be solved by heart prove nothing about an engine. */
export function analysable(config: GameConfig): boolean {
  return config.variant === 'ultimate' || config.size * config.size >= 36;
}

interface FlagRecord {
  id: string;
  account_id: string;
  kind: string;
  severity: string;
  score: number;
  detail: string;
  related_id: string | null;
  status: string;
  created_at: number;
  reviewed_by: string | null;
  reviewed_at: number | null;
  note: string | null;
}

export class AntiCheat implements LobbyExtension {
  private readonly now: () => number;
  private readonly budgetMs: number;
  private readonly maxPositions: number;
  private readonly maxInFlight: number;
  private inFlight = 0;
  /** Resolves when every analysis started so far has finished. For tests and shutdown. */
  private work: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly db: Db,
    private readonly engine: EngineRunner,
    options: AntiCheatOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.budgetMs = options.budgetMs ?? 60;
    this.maxPositions = options.maxPositions ?? 30;
    this.maxInFlight = options.maxInFlight ?? 8;
  }

  get pending(): number {
    return this.inFlight;
  }

  /** Wait for any analysis in progress. */
  async idle(): Promise<void> {
    await this.work;
  }

  // -------------------------------------------------------------------------
  // Lobby extension
  // -------------------------------------------------------------------------

  settled(match: SettledMatch): void {
    const { room, x, o } = match;
    // Bots, casual and private games are out of scope: nothing rides on them.
    if (room.kind !== 'ranked' || x.bot || o.bot) return;

    this.checkFastResign(match);
    this.checkPair(x.accountId, o.accountId, room.mode);

    if (!analysable(room.config) || room.game.moves.length < 10) return;
    if (this.inFlight >= this.maxInFlight) {
      log.warn('anticheat.skipped', { matchId: match.matchId, reason: 'busy' });
      return;
    }

    this.inFlight++;
    const players: Player[] = [X, O];
    const run = this.engine
      .run({
        type: 'analyse',
        config: room.config,
        startingPlayer: startingPlayerOf(room.game),
        moves: [...room.game.moves],
        moveTimesMs: [...room.moveTimesMs],
        players,
        budgetMs: this.budgetMs,
        maxPositions: this.maxPositions,
      })
      .then((result) => {
        for (const side of result.sides) {
          const accountId = side.player === X ? x.accountId : o.accountId;
          this.ingest(match.matchId, accountId, room.mode, side);
        }
      })
      .catch((error: unknown) => {
        log.warn('anticheat.failed', {
          matchId: match.matchId,
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        this.inFlight--;
      });
    this.work = Promise.all([this.work, run]);
  }

  // -------------------------------------------------------------------------
  // Signals
  // -------------------------------------------------------------------------

  /** Store one side's analysis and re-evaluate the account. */
  ingest(matchId: string, accountId: string, mode: string, side: SideAnalysis): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO anticheat_games
           (match_id, account_id, mode, positions, matched, top_rate, mean_ms, time_cv, analysed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        matchId,
        accountId,
        mode,
        side.positions,
        side.matched,
        side.topRate,
        side.meanMs,
        side.timeCv,
        this.now(),
      );
    this.evaluateEngine(accountId);
  }

  private evaluateEngine(accountId: string): void {
    const rows = this.db
      .prepare<
        [string, number, number],
        { positions: number; matched: number; time_cv: number; match_id: string }
      >(
        `SELECT positions, matched, time_cv, match_id FROM anticheat_games
         WHERE account_id = ? AND analysed_at >= ? ORDER BY analysed_at DESC LIMIT ?`,
      )
      .all(accountId, this.now() - THRESHOLDS.engineWindowMs, THRESHOLDS.engineWindowGames);

    const positions = rows.reduce((sum, row) => sum + row.positions, 0);
    if (positions < THRESHOLDS.minPositions) return;
    const matched = rows.reduce((sum, row) => sum + row.matched, 0);
    const topRate = matched / positions;
    const timing = rows.reduce((sum, row) => sum + row.time_cv, 0) / rows.length;

    let severity: FlagSeverity | null = null;
    if (topRate >= THRESHOLDS.highTopRate) severity = 'high';
    else if (topRate >= THRESHOLDS.mediumTopRate && timing < THRESHOLDS.evenTimingCv) {
      severity = 'medium';
    }
    if (!severity) return;

    this.raise({
      accountId,
      kind: 'engine',
      severity,
      score: topRate,
      detail: {
        games: rows.length,
        positions,
        matched,
        topRate: round(topRate),
        meanTimeCv: round(timing),
        matches: rows.map((row) => row.match_id),
      },
      relatedId: null,
    });
  }

  /** Repeated games between one pair, nearly all won by the same side. */
  checkPair(a: string, b: string, mode: string): void {
    const since = this.now() - THRESHOLDS.windowMs;
    const games = this.db
      .prepare<
        [string, string, string, string, string, number],
        { x_id: string; winner: number | null; id: string }
      >(
        `SELECT x_id, winner, id FROM matches
         WHERE kind = 'ranked' AND mode = ?
           AND ((x_id = ? AND o_id = ?) OR (x_id = ? AND o_id = ?))
           AND played_at >= ?`,
      )
      .all(mode, a, b, b, a, since);
    if (games.length < THRESHOLDS.tradingGames) return;

    let aWins = 0;
    let bWins = 0;
    for (const game of games) {
      if (game.winner === null) continue;
      const xWon = game.winner === 1;
      if ((game.x_id === a) === xWon) aWins++;
      else bWins++;
    }
    const share = Math.max(aWins, bWins) / games.length;
    if (share < THRESHOLDS.tradingShare) return;

    const severity: FlagSeverity = games.length >= THRESHOLDS.tradingHighGames ? 'high' : 'medium';
    const detail = { mode, games: games.length, wins: { [a]: aWins, [b]: bWins } };
    this.raise({ accountId: a, kind: 'win-trading', severity, score: share, detail, relatedId: b });
    this.raise({ accountId: b, kind: 'win-trading', severity, score: share, detail, relatedId: a });
  }

  /** Ranked games thrown almost before they began. */
  private checkFastResign(match: SettledMatch): void {
    const { outcome, room, x, o } = match;
    if (outcome.winner === null) return;
    if (outcome.reason !== 'resign' && outcome.reason !== 'abandoned') return;
    if (room.game.moves.length >= THRESHOLDS.fastResignMoves) return;

    const loser = outcome.winner === X ? o.accountId : x.accountId;
    const since = this.now() - THRESHOLDS.windowMs;
    const thrown = this.db
      .prepare<[string, string, number], { id: string; moves: string; winner_id: string }>(
        `SELECT id, moves, CASE WHEN winner = 1 THEN x_id ELSE o_id END AS winner_id FROM matches
         WHERE kind = 'ranked' AND reason IN ('resign', 'abandoned') AND winner IS NOT NULL
           AND ((x_id = ? AND winner = 2) OR (o_id = ? AND winner = 1)) AND played_at >= ?`,
      )
      .all(loser, loser, since)
      .filter((row) => countMoves(row.moves) < THRESHOLDS.fastResignMoves);
    if (thrown.length < THRESHOLDS.fastResignCount) return;

    const beneficiaries = new Map<string, number>();
    for (const row of thrown)
      beneficiaries.set(row.winner_id, (beneficiaries.get(row.winner_id) ?? 0) + 1);
    const [top, count] = [...beneficiaries].toSorted((p, q) => q[1] - p[1])[0] ?? [null, 0];
    // Throwing games to everyone is tilt; throwing them to one account is feeding.
    const feeding = top !== null && count >= THRESHOLDS.fastResignCount - 1;

    this.raise({
      accountId: loser,
      kind: 'fast-resign',
      severity: feeding ? 'high' : 'medium',
      score: thrown.length,
      detail: { thrown: thrown.length, beneficiary: top, toBeneficiary: count },
      relatedId: feeding ? top : null,
    });
  }

  /** Record a flag unless the same suspicion is already open for this account. */
  private raise(flag: {
    accountId: string;
    kind: FlagKind;
    severity: FlagSeverity;
    score: number;
    detail: Record<string, unknown>;
    relatedId: string | null;
  }): void {
    const open = this.db
      .prepare<[string, string, string | null], { id: string; severity: string }>(
        `SELECT id, severity FROM anticheat_flags
         WHERE account_id = ? AND kind = ? AND status = 'open' AND related_id IS ?`,
      )
      .get(flag.accountId, flag.kind, flag.relatedId);
    if (open) {
      // Escalate in place rather than stacking up duplicates.
      if (open.severity !== 'high' && flag.severity === 'high') {
        this.db
          .prepare('UPDATE anticheat_flags SET severity = ?, score = ?, detail = ? WHERE id = ?')
          .run('high', flag.score, JSON.stringify(flag.detail), open.id);
      }
      return;
    }

    this.db
      .prepare(
        `INSERT INTO anticheat_flags (id, account_id, kind, severity, score, detail, related_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
      )
      .run(
        randomUUID(),
        flag.accountId,
        flag.kind,
        flag.severity,
        flag.score,
        JSON.stringify(flag.detail),
        flag.relatedId,
        this.now(),
      );
    log.warn('anticheat.flag', {
      accountId: flag.accountId,
      kind: flag.kind,
      severity: flag.severity,
    });
  }

  // -------------------------------------------------------------------------
  // Moderation API: for the moderation routes to read and resolve
  // -------------------------------------------------------------------------

  /** Flags awaiting review, newest first. */
  openFlags(limit = 50, offset = 0): Flag[] {
    return this.db
      .prepare<[number, number], FlagRecord>(
        `SELECT * FROM anticheat_flags WHERE status = 'open'
         ORDER BY CASE severity WHEN 'high' THEN 0 ELSE 1 END, created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(Math.min(200, Math.max(1, limit)), Math.max(0, offset))
      .map(toFlag);
  }

  /** Every flag on one account, newest first. */
  flagsFor(accountId: string): Flag[] {
    return this.db
      .prepare<[string], FlagRecord>(
        'SELECT * FROM anticheat_flags WHERE account_id = ? ORDER BY created_at DESC LIMIT 100',
      )
      .all(accountId)
      .map(toFlag);
  }

  /**
   * Close a flag: `cleared` if the suspicion was wrong, `actioned` if a
   * moderator acted on it. Either way the quarantine it caused ends; any
   * sanction is the moderation system's to apply, not this one's.
   */
  resolve(
    flagId: string,
    status: 'cleared' | 'actioned',
    reviewer: string,
    note?: string,
  ): boolean {
    const result = this.db
      .prepare(
        `UPDATE anticheat_flags SET status = ?, reviewed_by = ?, reviewed_at = ?, note = ?
         WHERE id = ? AND status = 'open'`,
      )
      .run(status, reviewer, this.now(), note ?? null, flagId);
    return result.changes > 0;
  }

  /** Kept off leaderboards and out of rewards until reviewed. */
  isQuarantined(accountId: string): boolean {
    return (
      this.db
        .prepare<[string], { id: string }>(
          `SELECT id FROM anticheat_flags WHERE account_id = ? AND status = 'open' AND severity = 'high' LIMIT 1`,
        )
        .get(accountId) !== undefined
    );
  }
}

function toFlag(row: FlagRecord): Flag {
  let detail: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(row.detail);
    if (parsed && typeof parsed === 'object') detail = parsed as Record<string, unknown>;
  } catch {
    detail = {};
  }
  return {
    id: row.id,
    accountId: row.account_id,
    kind: row.kind as FlagKind,
    severity: row.severity as FlagSeverity,
    score: row.score,
    detail,
    relatedId: row.related_id,
    status: row.status as FlagStatus,
    createdAt: row.created_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    note: row.note,
  };
}

function countMoves(raw: string): number {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
