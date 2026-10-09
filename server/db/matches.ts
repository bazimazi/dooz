import { randomUUID } from 'node:crypto';
import { describeConfig, type GameConfig, isGameConfig } from '@/game/engine';
import type { EndReason, MatchKind, MatchRecord, MatchSummary, PublicProfile } from '@/protocol';
import type { AccountRow } from './accounts.js';
import { toPublicProfile } from './accounts.js';
import type { Db } from './database.js';

/**
 * Finished matches.
 *
 * A match is stored as its rules, its opener and its move list - never as a
 * sequence of boards. That is what makes a replay exact rather than
 * approximate: the client re-runs the same engine over the same moves and gets
 * the same positions by construction, and a 15x15 game costs a few hundred
 * bytes instead of a few hundred boards.
 */

export interface MatchInput {
  readonly mode: string;
  readonly config: GameConfig;
  readonly kind: MatchKind;
  readonly xId: string;
  readonly oId: string;
  readonly startingPlayer: 1 | 2;
  readonly moves: readonly number[];
  readonly moveTimesMs: readonly number[];
  readonly winner: 1 | 2 | null;
  readonly reason: EndReason;
  readonly playedAt: number;
  readonly durationMs: number;
  readonly rating: {
    readonly x: { before: number; after: number };
    readonly o: { before: number; after: number };
  } | null;
}

interface MatchRecordRow {
  id: string;
  mode: string;
  config: string;
  kind: string;
  x_id: string;
  o_id: string;
  starting_player: number;
  moves: string;
  move_times: string;
  winner: number | null;
  reason: string;
  played_at: number;
  duration_ms: number;
  x_rating_before: number | null;
  x_rating_after: number | null;
  o_rating_before: number | null;
  o_rating_after: number | null;
}

export class Matches {
  constructor(private readonly db: Db) {}

  record(match: MatchInput): string {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO matches (
           id, mode, config, kind, x_id, o_id, starting_player, moves, move_times,
           winner, reason, played_at, duration_ms,
           x_rating_before, x_rating_after, o_rating_before, o_rating_after
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        match.mode,
        JSON.stringify(match.config),
        match.kind,
        match.xId,
        match.oId,
        match.startingPlayer,
        JSON.stringify(match.moves),
        JSON.stringify(match.moveTimesMs),
        match.winner,
        match.reason,
        match.playedAt,
        match.durationMs,
        match.rating?.x.before ?? null,
        match.rating?.x.after ?? null,
        match.rating?.o.before ?? null,
        match.rating?.o.after ?? null,
      );
    return id;
  }

  /** Recent matches for an account, newest first, as that account saw them. */
  recentFor(
    accountId: string,
    limit: number,
    lookup: (id: string) => AccountRow | null,
  ): MatchSummary[] {
    const rows = this.db
      .prepare<[string, string, number], MatchRecordRow>(
        `SELECT * FROM matches WHERE x_id = ? OR o_id = ? ORDER BY played_at DESC LIMIT ?`,
      )
      .all(accountId, accountId, limit);

    return rows
      .map((row) => this.toSummary(row, accountId, lookup))
      .filter((summary): summary is MatchSummary => summary !== null);
  }

  /** A full match, for replay. `viewer` decides whose point of view it is told from. */
  find(
    matchId: string,
    viewer: string | null,
    lookup: (id: string) => AccountRow | null,
  ): MatchRecord | null {
    const row = this.db
      .prepare<[string], MatchRecordRow>('SELECT * FROM matches WHERE id = ?')
      .get(matchId);
    if (!row) return null;

    // With no viewer - a shared replay link - the game is told from X's side,
    // which is a point of view rather than a claim about who was watching.
    const summary = this.toSummary(row, viewer ?? row.x_id, lookup);
    if (!summary) return null;

    const config = parseConfig(row.config);
    if (!config) return null;

    return {
      ...summary,
      config,
      startingPlayer: row.starting_player === 2 ? 2 : 1,
      moves: parseNumbers(row.moves),
      moveTimesMs: parseNumbers(row.move_times),
      players: {
        x: profileOf(row.x_id, lookup, row.x_rating_after),
        o: profileOf(row.o_id, lookup, row.o_rating_after),
      },
      winner: row.winner === 1 ? 1 : row.winner === 2 ? 2 : null,
    };
  }

  /** Whether an account actually took part in a match. Gates report and replay. */
  participated(matchId: string, accountId: string): boolean {
    const row = this.db
      .prepare<[string, string, string], { id: string }>(
        'SELECT id FROM matches WHERE id = ? AND (x_id = ? OR o_id = ?)',
      )
      .get(matchId, accountId, accountId);
    return row !== undefined;
  }

  /** Distinct modes an account has played, for the all-rounder achievement. */
  modesPlayed(accountId: string): Set<string> {
    const rows = this.db
      .prepare<[string], { mode: string }>('SELECT DISTINCT mode FROM stats WHERE account_id = ?')
      .all(accountId);
    return new Set(rows.map((row) => row.mode));
  }

  private toSummary(
    row: MatchRecordRow,
    viewer: string,
    lookup: (id: string) => AccountRow | null,
  ): MatchSummary | null {
    const config = parseConfig(row.config);
    if (!config) return null;

    const viewerIsX = row.x_id === viewer;
    const opponentId = viewerIsX ? row.o_id : row.x_id;
    const viewerMark = viewerIsX ? 1 : 2;

    const outcome: 'win' | 'loss' | 'draw' =
      row.winner === null ? 'draw' : row.winner === viewerMark ? 'win' : 'loss';

    const before = viewerIsX ? row.x_rating_before : row.o_rating_before;
    const after = viewerIsX ? row.x_rating_after : row.o_rating_after;

    return {
      matchId: row.id,
      mode: row.mode,
      config,
      kind: row.kind as MatchKind,
      opponent: profileOf(opponentId, lookup, viewerIsX ? row.o_rating_after : row.x_rating_after),
      outcome,
      reason: row.reason as EndReason,
      ratingDelta: before !== null && after !== null ? after - before : null,
      playedAt: row.played_at,
      durationMs: row.duration_ms,
      moveCount: parseNumbers(row.moves).length,
    };
  }
}

function profileOf(
  accountId: string,
  lookup: (id: string) => AccountRow | null,
  rating: number | null,
): PublicProfile {
  const account = lookup(accountId);
  if (account) return toPublicProfile(account, rating);

  // A deleted account still has to render in somebody else's history.
  return { accountId, displayName: 'Former player', avatar: 'ghost', rating };
}

function parseConfig(raw: string): GameConfig | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isGameConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseNumbers(raw: string): number[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'number') : [];
  } catch {
    return [];
  }
}

/** The mode label a match should be filed under. */
export { describeConfig as describeMatchConfig };
