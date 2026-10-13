import { randomUUID } from 'node:crypto';
import {
  applyMove,
  configKey,
  type GameConfig,
  type GameState,
  isGameConfig,
  modeForConfig,
  O,
  opponentOf,
  type Player,
  randomStartingPlayer,
  replay,
  X,
} from '@/game/engine';
import type { EndReason } from '@/protocol';
import type { CorrespondenceGame } from '@/protocol/social';
import type { Accounts } from './db/accounts.js';
import { toPublicProfile } from './db/accounts.js';
import type { Db } from './db/database.js';
import type { Matches } from './db/matches.js';
import type { Friends } from './friends.js';
import { toSnapshot } from './lobby.js';
import { log } from './log.js';
import type { Notifier } from './notices.js';

/**
 * Correspondence games: one move a day, or every few days, between friends.
 *
 * Nothing about them lives in memory. The game is its config, its opener and
 * its move list in SQLite, rebuilt through the same engine as every other game
 * whenever it is read, so they survive restarts and deploys by construction
 * and the server can hold thousands without noticing.
 *
 * They are always casual: a game played over days invites help from a book, an
 * engine or a friend, and none of that can be ruled out, so no rating rides on
 * one. Results still count towards played/won/lost and land in the match
 * history with a replay, like any other game.
 *
 * Every move has a deadline. The player to move who lets it pass loses on
 * time; a reminder goes out once, half a day before.
 */

export const DAY_MS = 86_400_000;
/** How long an invitation waits for an answer. */
export const INVITE_TTL_MS = 7 * DAY_MS;
/** Games one account may have running or pending at once. */
export const MAX_OPEN_GAMES = 30;
/** Finished games returned with the list, newest first. */
const RECENT_FINISHED = 20;
/** How long before a deadline the player to move is reminded. */
const REMINDER_BEFORE_MS = 12 * 3600_000;

type Status = CorrespondenceGame['status'];

interface Row {
  id: string;
  mode: string;
  config: string;
  x_id: string;
  o_id: string;
  inviter_id: string;
  status: Status;
  starting_player: number;
  moves: string;
  move_times: string;
  move_window_ms: number;
  deadline_at: number;
  reminded: number;
  created_at: number;
  updated_at: number;
  winner: number | null;
  reason: string | null;
  match_id: string | null;
}

export type CorrespondenceError =
  | 'notFound'
  | 'notFriends'
  | 'limit'
  | 'badConfig'
  | 'notYourTurn'
  | 'illegalMove'
  | 'stale'
  | 'over'
  | 'forbidden';

export type Result<T> = { ok: true; value: T } | { ok: false; error: CorrespondenceError };

export interface CorrespondenceOptions {
  readonly db: Db;
  readonly accounts: Accounts;
  readonly matches: Matches;
  readonly friends: Friends;
  readonly notifier: Notifier;
  readonly now?: () => number;
  readonly random?: () => number;
}

export class Correspondence {
  private readonly db: Db;
  private readonly accounts: Accounts;
  private readonly matches: Matches;
  private readonly friends: Friends;
  private readonly notifier: Notifier;
  private readonly now: () => number;
  private readonly random: () => number;

  constructor(options: CorrespondenceOptions) {
    this.db = options.db;
    this.accounts = options.accounts;
    this.matches = options.matches;
    this.friends = options.friends;
    this.notifier = options.notifier;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
  }

  /** Invite a friend. The inviter plays X; who opens is drawn when it is accepted. */
  invite(
    from: string,
    to: string,
    config: GameConfig,
    daysPerMove: 1 | 2 | 3,
  ): Result<CorrespondenceGame> {
    if (!isGameConfig(config)) return { ok: false, error: 'badConfig' };
    if (!this.friends.areFriends(from, to) || this.friends.blockedEitherWay(from, to)) {
      return { ok: false, error: 'notFriends' };
    }
    if (this.openCount(from) >= MAX_OPEN_GAMES || this.openCount(to) >= MAX_OPEN_GAMES) {
      return { ok: false, error: 'limit' };
    }

    const id = randomUUID();
    const at = this.now();
    this.db
      .prepare(
        `INSERT INTO correspondence_games (
           id, mode, config, x_id, o_id, inviter_id, status, starting_player,
           moves, move_times, move_window_ms, deadline_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'invited', ?, '[]', '[]', ?, ?, ?, ?)`,
      )
      .run(
        id,
        modeForConfig(config)?.id ?? configKey(config),
        JSON.stringify(config),
        from,
        to,
        from,
        X,
        daysPerMove * DAY_MS,
        at + INVITE_TTL_MS,
        at,
        at,
      );

    const inviter = this.accounts.get(from);
    this.notifier.notify(to, {
      kind: 'correspondenceInvite',
      title: 'Correspondence invitation',
      body: `${inviter?.displayName ?? 'A friend'} invited you to a game at ${daysPerMove} ${daysPerMove === 1 ? 'day' : 'days'} a move.`,
      url: `/correspondence/${id}`,
      ...(inviter ? { from: toPublicProfile(inviter, null) } : {}),
    });
    log.info('correspondence.invite', { id, from, to, daysPerMove });
    return { ok: true, value: this.view(this.row(id)!, from)! };
  }

  /** Accept an invitation. Only the invitee may. */
  accept(me: string, id: string): Result<CorrespondenceGame> {
    const row = this.row(id);
    if (!row || !this.isPlayer(row, me)) return { ok: false, error: 'notFound' };
    if (row.status !== 'invited') return { ok: false, error: 'over' };
    if (row.inviter_id === me) return { ok: false, error: 'forbidden' };

    const at = this.now();
    const opener = randomStartingPlayer(this.random);
    this.db
      .prepare(
        `UPDATE correspondence_games
         SET status = 'active', starting_player = ?, deadline_at = ?, updated_at = ?, reminded = 0
         WHERE id = ? AND status = 'invited'`,
      )
      .run(opener, at + row.move_window_ms, at, id);

    const updated = this.row(id)!;
    this.announceTurn(updated);
    log.info('correspondence.accept', { id });
    return { ok: true, value: this.view(updated, me)! };
  }

  /** Decline an invitation, or withdraw one you sent. */
  decline(me: string, id: string): Result<null> {
    const row = this.row(id);
    if (!row || !this.isPlayer(row, me)) return { ok: false, error: 'notFound' };
    if (row.status !== 'invited') return { ok: false, error: 'over' };
    this.db
      .prepare(
        "UPDATE correspondence_games SET status = 'declined', updated_at = ? WHERE id = ? AND status = 'invited'",
      )
      .run(this.now(), id);
    return { ok: true, value: null };
  }

  /**
   * Play a move.
   *
   * `ply` is how many moves the client saw. A retry of a move that already
   * landed, or a move made against a position that has since changed, is
   * refused as `stale` rather than being applied to a board the player was not
   * looking at.
   */
  move(me: string, id: string, index: number, ply: number): Result<CorrespondenceGame> {
    const outcome = this.db.transaction((): Result<Row> => {
      const row = this.row(id);
      if (!row || !this.isPlayer(row, me)) return { ok: false, error: 'notFound' };
      if (row.status !== 'active') return { ok: false, error: 'over' };

      const game = this.gameOf(row);
      if (!game) return { ok: false, error: 'over' };
      if (game.moves.length !== ply) return { ok: false, error: 'stale' };

      const player = this.playerOf(row, me);
      if (game.currentPlayer !== player) return { ok: false, error: 'notYourTurn' };

      // A move after the deadline is too late, however legal it is - the same
      // rule a live clock applies.
      if (this.now() > row.deadline_at) {
        this.settle(row, game, { winner: opponentOf(player), reason: 'timeout' });
        return { ok: false, error: 'over' };
      }

      const next = applyMove(game, index);
      if (!next) return { ok: false, error: 'illegalMove' };

      const at = this.now();
      const times = parseNumbers(row.move_times);
      times.push(Math.max(0, at - row.updated_at));
      this.db
        .prepare(
          `UPDATE correspondence_games
           SET moves = ?, move_times = ?, deadline_at = ?, updated_at = ?, reminded = 0
           WHERE id = ?`,
        )
        .run(JSON.stringify(next.moves), JSON.stringify(times), at + row.move_window_ms, at, id);

      const updated = this.row(id)!;
      if (next.status !== 'playing') {
        this.settle(updated, next, {
          winner: next.winner,
          reason: next.status === 'draw' ? 'draw' : 'line',
        });
      }
      return { ok: true, value: this.row(id)! };
    })();

    if (!outcome.ok) return outcome;
    if (outcome.value.status === 'active') this.announceTurn(outcome.value);
    return { ok: true, value: this.view(outcome.value, me)! };
  }

  resign(me: string, id: string): Result<CorrespondenceGame> {
    const row = this.row(id);
    if (!row || !this.isPlayer(row, me)) return { ok: false, error: 'notFound' };
    if (row.status !== 'active') return { ok: false, error: 'over' };
    const game = this.gameOf(row);
    if (!game) return { ok: false, error: 'over' };

    this.settle(row, game, { winner: opponentOf(this.playerOf(row, me)), reason: 'resign' });
    return { ok: true, value: this.view(this.row(id)!, me)! };
  }

  get(me: string, id: string): CorrespondenceGame | null {
    const row = this.row(id);
    if (!row || !this.isPlayer(row, me)) return null;
    return this.view(row, me);
  }

  /** Open games and invitations, then the most recent finished ones. */
  list(me: string): CorrespondenceGame[] {
    const open = this.db
      .prepare<[string, string], Row>(
        `SELECT * FROM correspondence_games
         WHERE (x_id = ? OR o_id = ?) AND status IN ('invited', 'active')
         ORDER BY deadline_at ASC`,
      )
      .all(me, me);
    const finished = this.db
      .prepare<[string, string, number], Row>(
        `SELECT * FROM correspondence_games
         WHERE (x_id = ? OR o_id = ?) AND status IN ('finished', 'declined', 'expired')
         ORDER BY updated_at DESC LIMIT ?`,
      )
      .all(me, me, RECENT_FINISHED);
    return [...open, ...finished]
      .map((row) => this.view(row, me))
      .filter((game): game is CorrespondenceGame => game !== null);
  }

  /** Games waiting on this account's move, for the badge on the home screen. */
  turnsWaiting(me: string): number {
    return this.list(me).filter((game) => game.status === 'active' && game.yourTurn).length;
  }

  activeCount(): number {
    return (
      this.db
        .prepare<[], { n: number }>(
          "SELECT COUNT(*) AS n FROM correspondence_games WHERE status = 'active'",
        )
        .get()?.n ?? 0
    );
  }

  /**
   * Resign every game an account is in. Used before deleting an account, so
   * its opponents get their result instead of a game that silently vanishes.
   */
  forfeitAll(accountId: string): void {
    const rows = this.db
      .prepare<[string, string], Row>(
        `SELECT * FROM correspondence_games
         WHERE (x_id = ? OR o_id = ?) AND status IN ('invited', 'active')`,
      )
      .all(accountId, accountId);
    for (const row of rows) {
      if (row.status === 'invited') {
        this.decline(accountId, row.id);
        continue;
      }
      this.resign(accountId, row.id);
    }
  }

  /**
   * Deadlines: lapse old invitations, flag the player to move who ran out of
   * time, and remind the ones about to. Called from the server tick; cheap,
   * because both scans use the status-and-deadline index.
   */
  sweep(): void {
    const at = this.now();
    this.db
      .prepare(
        "UPDATE correspondence_games SET status = 'expired', updated_at = ? WHERE status = 'invited' AND deadline_at < ?",
      )
      .run(at, at);

    const overdue = this.db
      .prepare<[number], Row>(
        "SELECT * FROM correspondence_games WHERE status = 'active' AND deadline_at < ? LIMIT 200",
      )
      .all(at);
    for (const row of overdue) {
      try {
        const game = this.gameOf(row);
        if (!game) continue;
        this.settle(row, game, { winner: opponentOf(game.currentPlayer), reason: 'timeout' });
        log.info('correspondence.timeout', { id: row.id });
      } catch (error) {
        log.exception('correspondence.sweep.failed', error, { id: row.id });
      }
    }

    const soon = this.db
      .prepare<[number], Row>(
        "SELECT * FROM correspondence_games WHERE status = 'active' AND reminded = 0 AND deadline_at < ? LIMIT 200",
      )
      .all(at + REMINDER_BEFORE_MS);
    for (const row of soon) {
      // A window shorter than the reminder lead would remind on every move.
      if (row.move_window_ms <= REMINDER_BEFORE_MS) continue;
      const game = this.gameOf(row);
      if (!game) continue;
      this.db.prepare('UPDATE correspondence_games SET reminded = 1 WHERE id = ?').run(row.id);
      const mover = game.currentPlayer === X ? row.x_id : row.o_id;
      this.notifier.notify(mover, {
        kind: 'correspondenceTurn',
        title: 'Your move is nearly due',
        body: `Less than ${Math.round(REMINDER_BEFORE_MS / 3600_000)} hours left to move against ${this.nameOf(mover === row.x_id ? row.o_id : row.x_id)}.`,
        url: `/correspondence/${row.id}`,
      });
    }
  }

  // ---------------------------------------------------------------------------

  /**
   * Score a finished game once, in one transaction with its stats and record.
   * The `status = 'active'` guard on the update is what makes it once: a sweep
   * and a move racing to settle the same game cannot both get past it.
   */
  private settle(
    row: Row,
    game: GameState,
    outcome: { winner: Player | null; reason: EndReason },
  ): void {
    const config = parseConfig(row.config);
    if (!config) return;
    const xOutcome = outcome.winner === null ? 'draw' : outcome.winner === X ? 'win' : 'loss';
    const oOutcome = xOutcome === 'draw' ? 'draw' : xOutcome === 'win' ? 'loss' : 'win';

    const settled = this.db.transaction(() => {
      const claimed = this.db
        .prepare(
          `UPDATE correspondence_games SET status = 'finished', winner = ?, reason = ?, updated_at = ?
           WHERE id = ? AND status = 'active'`,
        )
        .run(outcome.winner, outcome.reason, this.now(), row.id);
      if (claimed.changes === 0) return false;

      for (const [accountId, result] of [
        [row.x_id, xOutcome],
        [row.o_id, oOutcome],
      ] as const) {
        const stats = this.accounts.statsFor(accountId, row.mode);
        this.accounts.recordResult(accountId, row.mode, result, stats.rating, false);
      }

      const matchId = this.matches.record({
        mode: row.mode,
        config,
        kind: 'casual',
        xId: row.x_id,
        oId: row.o_id,
        startingPlayer: row.starting_player === O ? O : X,
        moves: game.moves,
        moveTimesMs: parseNumbers(row.move_times),
        winner: outcome.winner,
        reason: outcome.reason,
        playedAt: row.created_at,
        durationMs: Math.max(0, this.now() - row.created_at),
        rating: null,
      });
      this.db
        .prepare('UPDATE correspondence_games SET match_id = ? WHERE id = ?')
        .run(matchId, row.id);
      return true;
    })();
    if (!settled) return;

    for (const accountId of [row.x_id, row.o_id]) {
      const won = outcome.winner !== null && (accountId === row.x_id ? X : O) === outcome.winner;
      const lost = outcome.winner !== null && !won;
      this.notifier.notify(accountId, {
        kind: 'correspondenceResult',
        title: won
          ? 'You won a correspondence game'
          : lost
            ? 'Correspondence game lost'
            : 'Correspondence game drawn',
        body: `Against ${this.nameOf(accountId === row.x_id ? row.o_id : row.x_id)}: ${describeReason(outcome.reason)}.`,
        url: `/correspondence/${row.id}`,
      });
    }
    log.info('correspondence.end', { id: row.id, reason: outcome.reason, winner: outcome.winner });
  }

  /** Tell whoever is to move that it is their turn. */
  private announceTurn(row: Row): void {
    const game = this.gameOf(row);
    if (!game || game.status !== 'playing') return;
    const mover = game.currentPlayer === X ? row.x_id : row.o_id;
    const other = mover === row.x_id ? row.o_id : row.x_id;
    this.notifier.notify(mover, {
      kind: 'correspondenceTurn',
      title: 'Your move',
      body:
        game.moves.length === 0
          ? `Your game against ${this.nameOf(other)} has started. You open.`
          : `${this.nameOf(other)} has moved.`,
      url: `/correspondence/${row.id}`,
    });
  }

  private view(row: Row, me: string): CorrespondenceGame | null {
    const game = this.gameOf(row);
    if (!game) return null;
    const you = this.playerOf(row, me);
    const opponentId = you === X ? row.o_id : row.x_id;
    const opponent = this.accounts.get(opponentId);
    const rating = this.accounts.statsFor(opponentId, row.mode).rating;

    return {
      id: row.id,
      mode: row.mode,
      status: row.status,
      you,
      opponent: opponent
        ? toPublicProfile(opponent, rating)
        : { accountId: opponentId, displayName: 'Former player', avatar: 'ghost', rating: null },
      invitedByYou: row.inviter_id === me,
      snapshot: toSnapshot(game),
      yourTurn: row.status === 'active' && game.status === 'playing' && game.currentPlayer === you,
      moveWindowMs: row.move_window_ms,
      deadlineAt: row.deadline_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      result:
        row.status === 'finished' && row.reason
          ? {
              winner: row.winner === X ? X : row.winner === O ? O : null,
              reason: row.reason as EndReason,
              matchId: row.match_id,
            }
          : null,
    };
  }

  private gameOf(row: Row): GameState | null {
    const config = parseConfig(row.config);
    if (!config) return null;
    return replay(config, row.starting_player === O ? O : X, parseNumbers(row.moves));
  }

  private row(id: string): Row | null {
    return (
      this.db.prepare<[string], Row>('SELECT * FROM correspondence_games WHERE id = ?').get(id) ??
      null
    );
  }

  private isPlayer(row: Row, accountId: string): boolean {
    return row.x_id === accountId || row.o_id === accountId;
  }

  private playerOf(row: Row, accountId: string): Player {
    return row.x_id === accountId ? X : O;
  }

  private openCount(accountId: string): number {
    return (
      this.db
        .prepare<[string, string], { n: number }>(
          `SELECT COUNT(*) AS n FROM correspondence_games
           WHERE (x_id = ? OR o_id = ?) AND status IN ('invited', 'active')`,
        )
        .get(accountId, accountId)?.n ?? 0
    );
  }

  private nameOf(accountId: string): string {
    return this.accounts.get(accountId)?.displayName ?? 'your opponent';
  }
}

function describeReason(reason: EndReason): string {
  switch (reason) {
    case 'line':
      return 'a line was completed';
    case 'draw':
      return 'the board filled up';
    case 'resign':
      return 'by resignation';
    case 'timeout':
      return 'on time';
    case 'abandoned':
      return 'by abandonment';
    case 'agreed':
      return 'by agreement';
    default:
      return 'game over';
  }
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
    return Array.isArray(parsed)
      ? parsed.filter((value): value is number => typeof value === 'number')
      : [];
  } catch {
    return [];
  }
}
