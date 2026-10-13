import { randomInt } from 'node:crypto';
import {
  type GameConfig,
  isGameConfig,
  modeForConfig,
  configKey,
  RANKED_MODES,
  X,
} from '@/game/engine';
import {
  type ClientMessage,
  type PublicProfile,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type ServerMessage,
  type Tournament as WireTournament,
  type TournamentKind,
} from '@/protocol';
import type { Accounts, AccountRow } from './db/accounts.js';
import { toPublicProfile } from './db/accounts.js';
import type { Db } from './db/database.js';
import type { Activity, ArrangedMatch, LobbyExtension, SettledMatch } from './lobby-hooks.js';
import { log } from './log.js';
import { grantAward } from './seasons.js';
import type { Session } from './types.js';

/**
 * Tournaments: scheduled arenas for everyone, and private brackets for friends.
 *
 * **Arena.** A fixed window (30 minutes by default) on a published schedule.
 * Anyone may join at any time while it runs; whoever is free is paired with
 * somebody near them in the standings as soon as a game ends, so nobody waits
 * for a round to finish. A win is 2 points, a draw 1. Two wins in a row put a
 * player on fire, and while on fire wins and draws count double. Going
 * berserk - half your clock, no increment - before your first move adds a
 * point to a win of at least seven moves. Games are unrated: a tournament
 * rewards tempo and nerve as much as strength, and berserk would otherwise be
 * a way to farm rating.
 *
 * **Bracket.** A private single-elimination event a player creates and shares
 * by code, for 4, 8 or 16. Seeds come from rating; the top seeds get byes when
 * the field is not a power of two. A drawn match is replayed, twice at most,
 * and then the higher seed goes through. A player who does not turn up for a
 * match within a minute and a half forfeits it.
 *
 * Everything is bounded: players per event, open brackets per host and in
 * total, standings pushed per update. Standings are written to the database as
 * they change, so a restart loses no points - though a bracket in progress is
 * closed, since the games it was waiting on went with the process.
 */

const DEFAULT_ARENA_EVERY_MS = 3 * 60 * 60 * 1000;
const DEFAULT_ARENA_LENGTH_MS = 30 * 60 * 1000;
const DEFAULT_ANNOUNCE_MS = 2 * 60 * 60 * 1000;
/** After the clock runs out, games in progress get this long to finish and still count. */
const FINISH_GRACE_MS = 10 * 60 * 1000;
/** Pause after a game before the next pairing, so the result can be seen. */
const REST_MS = 6000;
const ARENA_MAX_PLAYERS = 300;
const MAX_OPEN_BRACKETS = 200;
/** A bracket nobody started is closed after this. */
const BRACKET_EXPIRY_MS = 60 * 60 * 1000;
const NO_SHOW_MS = 90_000;
const MAX_REPLAYS = 2;
/** Minimum moves for berserk's bonus point, so it cannot be farmed by quick resignations. */
const BERSERK_MIN_MOVES = 7;
/** Standings sent with a push; the REST view has the full top 100. */
const PUSH_STANDINGS = 20;
const PUSH_INTERVAL_MS = 2000;
const SAVE_INTERVAL_MS = 10_000;
/** Finished events kept in memory for the listing. */
const KEEP_FINISHED_MS = 6 * 60 * 60 * 1000;
/** A finished bracket is only of interest to its players for a few minutes; it stays in the database. */
const KEEP_FINISHED_BRACKET_MS = 10 * 60 * 1000;
/** One new bracket per host per this long, so create-and-abandon cannot flood the table. */
const BRACKET_COOLDOWN_MS = 30_000;
/** Ceiling on remembered bracket creators. */
const MAX_COOLDOWNS = 10_000;

/** What tournaments need from the lobby. */
export interface TournamentHost {
  arrange(request: ArrangedMatch): string | null;
  activity(accountId: string): Activity;
  notify(accountId: string, message: ServerMessage): boolean;
}

/** Called once per tournament as it starts, with the ids of everyone entered. */
export type StartListener = (
  event: { readonly id: string; readonly name: string; readonly kind: 'arena' | 'bracket' },
  accountIds: readonly string[],
) => void;

export interface TournamentsOptions {
  readonly now?: () => number;
  /** Turn the arena schedule off (tests, or a server that only wants brackets). */
  readonly arenas?: boolean;
  readonly arenaEveryMs?: number;
  readonly arenaLengthMs?: number;
  readonly announceMs?: number;
}

interface Participant {
  readonly accountId: string;
  account: AccountRow;
  rating: number;
  score: number;
  played: number;
  won: number;
  drawn: number;
  /** Consecutive wins. Two or more is "on fire". */
  streak: number;
  active: boolean;
  lastOpponent: string | null;
  restUntil: number;
  /** Bracket seed, 1 is best. */
  seed: number;
}

interface BracketMatch {
  a: string | null;
  b: string | null;
  winner: 1 | 2 | null;
  code: string | null;
  replays: number;
  /** When both players became known, for the no-show rule. */
  readySince: number | null;
}

interface Event {
  readonly id: string;
  readonly kind: TournamentKind;
  readonly name: string;
  readonly mode: string;
  readonly config: GameConfig;
  status: 'scheduled' | 'running' | 'finished';
  startsAt: number;
  endsAt: number;
  readonly maxPlayers: number;
  readonly berserk: boolean;
  readonly hostId: string | null;
  readonly participants: Map<string, Participant>;
  /** Games in progress, by room code. */
  readonly games: Map<string, { readonly round: number; readonly index: number } | null>;
  bracket: BracketMatch[][] | null;
  finishedAt: number | null;
  /** Changed since participants were last told. */
  unpushed: boolean;
  /** Changed since it was last written down. */
  unsaved: boolean;
  lastPush: number;
  lastSave: number;
}

interface StoredStanding {
  accountId: string;
  rating: number;
  score: number;
  played: number;
  won: number;
  drawn: number;
  streak: number;
}

export class Tournaments implements LobbyExtension {
  private host: TournamentHost | null = null;
  private readonly events = new Map<string, Event>();
  /** When each host last created a bracket. Pruned as it grows. */
  private readonly lastCreated = new Map<string, number>();
  private readonly now: () => number;
  private readonly arenas: boolean;
  private readonly arenaEveryMs: number;
  private readonly arenaLengthMs: number;
  private readonly announceMs: number;
  private startListener: StartListener | null = null;

  constructor(
    private readonly db: Db,
    private readonly accounts: Accounts,
    options: TournamentsOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.arenas = options.arenas ?? true;
    this.arenaEveryMs = options.arenaEveryMs ?? DEFAULT_ARENA_EVERY_MS;
    this.arenaLengthMs = options.arenaLengthMs ?? DEFAULT_ARENA_LENGTH_MS;
    this.announceMs = options.announceMs ?? DEFAULT_ANNOUNCE_MS;
    this.restore();
  }

  attach(host: TournamentHost): void {
    this.host = host;
  }

  /**
   * Hear when a tournament starts, with everyone entered at that moment.
   *
   * The push channel lives in the ops layer, which is built after this one,
   * so it subscribes here rather than being passed in.
   */
  onStarted(listener: StartListener): void {
    this.startListener = listener;
  }

  private announceStart(event: Event): void {
    if (!this.startListener || event.participants.size === 0) return;
    try {
      this.startListener({ id: event.id, name: event.name, kind: event.kind }, [
        ...event.participants.keys(),
      ]);
    } catch (error) {
      log.exception('tournament.start.notify.failed', error, { id: event.id });
    }
  }

  // -------------------------------------------------------------------------
  // Reading
  // -------------------------------------------------------------------------

  /** Public arenas - upcoming, running and recently finished - for the listing. */
  list(viewerId: string | null): WireTournament[] {
    const live = [...this.events.values()]
      .filter((event) => event.kind === 'arena' || (viewerId && event.participants.has(viewerId)))
      .toSorted((a, b) => statusOrder(a) - statusOrder(b) || a.startsAt - b.startsAt);
    const shown = new Set(live.map((event) => event.id));

    // Finished arenas that have dropped out of memory still belong on the list.
    const past = this.db
      .prepare<[], StoredEventRow>(
        `SELECT * FROM tournaments WHERE kind = 'arena' AND status = 'finished'
         ORDER BY ends_at DESC LIMIT 10`,
      )
      .all()
      .filter((row) => !shown.has(row.id))
      .map((row) => this.fromRow(row, 10))
      .filter((event): event is Event => event !== null);

    return [...live, ...past].slice(0, 40).map((event) => this.toWire(event, viewerId, 100));
  }

  /** One tournament by id. Private brackets are found by anyone who has the code. */
  get(id: string, viewerId: string | null): WireTournament | null {
    const event = this.events.get(id) ?? this.load(id);
    return event ? this.toWire(event, viewerId, 100) : null;
  }

  // -------------------------------------------------------------------------
  // Lobby extension
  // -------------------------------------------------------------------------

  message(session: Session, message: ClientMessage): boolean {
    if (!session.accountId || !session.account) return false;
    switch (message.type) {
      case 'tournamentJoin':
        this.join(session, message.id);
        return true;
      case 'tournamentLeave':
        this.leave(session.accountId, message.id);
        return true;
      case 'tournamentCreate':
        this.createBracket(session, message.config, message.size);
        return true;
      case 'tournamentStart':
        this.startBracket(session, message.id);
        return true;
      default:
        return false;
    }
  }

  tick(now: number): void {
    if (this.arenas) this.scheduleArenas(now);
    // A snapshot: finishing an event can drop it from the map.
    for (const event of Array.from(this.events.values())) {
      try {
        this.advance(event, now);
      } catch (error) {
        log.exception('tournament.tick.failed', error, { id: event.id });
      }
    }
  }

  settled(match: SettledMatch): void {
    const tag = match.room.tournament;
    if (!tag) return;
    const event = this.events.get(tag.id);
    if (!event || !event.games.has(match.room.code)) return;
    const slot = event.games.get(match.room.code) ?? null;
    event.games.delete(match.room.code);

    const x = event.participants.get(match.x.accountId);
    const o = event.participants.get(match.o.accountId);
    if (!x || !o) return;
    const winner = match.outcome.winner;

    if (event.kind === 'arena') {
      const moves = match.room.game.moves.length;
      const berserk = match.room.berserk ?? new Set();
      this.score(
        x,
        winner === null ? 'draw' : winner === X ? 'win' : 'loss',
        berserk.has(X),
        moves,
      );
      this.score(
        o,
        winner === null ? 'draw' : winner === X ? 'loss' : 'win',
        berserk.has(2),
        moves,
      );
      x.lastOpponent = o.accountId;
      o.lastOpponent = x.accountId;
      x.restUntil = o.restUntil = this.now() + REST_MS;
    } else if (slot && event.bracket) {
      const game = event.bracket[slot.round]?.[slot.index];
      if (game) {
        game.code = null;
        if (winner === null) {
          game.replays++;
          // Out of replays: the higher seed goes through.
          if (game.replays > MAX_REPLAYS) game.winner = this.higherSeed(event, game);
        } else {
          const winnerId = winner === X ? x.accountId : o.accountId;
          game.winner = winnerId === game.a ? 1 : 2;
        }
        for (const participant of [x, o]) participant.played++;
        if (winner !== null) (winner === X ? x : o).won++;
      }
    }
    changed(event);
  }

  // -------------------------------------------------------------------------
  // Joining and leaving
  // -------------------------------------------------------------------------

  private join(session: Session, id: string): void {
    const accountId = session.accountId!;
    const event = this.events.get(id);
    if (!event || event.status === 'finished') {
      this.refuse(session, 'That tournament is not open.');
      return;
    }

    const existing = event.participants.get(accountId);
    if (existing) {
      existing.active = true;
      existing.account = session.account!;
    } else {
      if (event.kind === 'bracket' && event.status !== 'scheduled') {
        this.refuse(session, 'That bracket has already started.');
        return;
      }
      if (event.participants.size >= event.maxPlayers) {
        this.refuse(session, 'That tournament is full.');
        return;
      }
      event.participants.set(accountId, {
        accountId,
        account: session.account!,
        rating: this.accounts.statsFor(accountId, event.mode).rating,
        score: 0,
        played: 0,
        won: 0,
        drawn: 0,
        streak: 0,
        active: true,
        lastOpponent: null,
        restUntil: 0,
        seed: 0,
      });
    }
    changed(event);
    this.push(event, accountId);
    log.info('tournament.join', { id, accountId });

    if (event.kind === 'bracket' && event.status === 'scheduled') {
      if (event.participants.size >= event.maxPlayers) this.beginBracket(event);
    }
  }

  private leave(accountId: string, id: string): void {
    const event = this.events.get(id);
    const participant = event?.participants.get(accountId);
    if (!event || !participant) return;

    if (event.kind === 'bracket' && event.status === 'scheduled') {
      event.participants.delete(accountId);
      if (accountId === event.hostId) this.finish(event, 'host left');
    } else {
      // Points scored stay on the board; the player is simply not paired again.
      participant.active = false;
      if (event.bracket) this.forfeit(event, accountId);
    }
    changed(event);
    this.push(event, accountId);
  }

  private createBracket(session: Session, config: GameConfig, size: number): void {
    if (!isGameConfig(config) || ![4, 8, 16].includes(size)) {
      this.refuse(session, 'That bracket cannot be created.');
      return;
    }
    const open = [...this.events.values()].filter(
      (event) => event.kind === 'bracket' && event.status !== 'finished',
    );
    if (open.length >= MAX_OPEN_BRACKETS) {
      this.refuse(session, 'Too many brackets are running. Try again later.');
      return;
    }
    // One open bracket per host: enough to play with friends, not enough to spam.
    if (open.some((event) => event.hostId === session.accountId)) {
      this.refuse(session, 'You already have a bracket open.');
      return;
    }
    const last = this.lastCreated.get(session.accountId!);
    if (last !== undefined && this.now() - last < BRACKET_COOLDOWN_MS) {
      this.refuse(session, 'Wait a moment before creating another bracket.');
      return;
    }
    this.lastCreated.delete(session.accountId!);
    this.lastCreated.set(session.accountId!, this.now());
    while (this.lastCreated.size > MAX_COOLDOWNS) {
      const oldest = this.lastCreated.keys().next().value;
      if (oldest === undefined) break;
      this.lastCreated.delete(oldest);
    }

    const now = this.now();
    const mode = modeForConfig(config);
    const event = this.create({
      kind: 'bracket',
      name: `${session.account!.displayName}'s bracket`,
      mode: mode?.id ?? configKey(config),
      config,
      startsAt: now,
      endsAt: now + BRACKET_EXPIRY_MS,
      maxPlayers: size,
      berserk: false,
      hostId: session.accountId,
    });
    this.join(session, event.id);
  }

  private startBracket(session: Session, id: string): void {
    const event = this.events.get(id);
    if (!event || event.kind !== 'bracket' || event.hostId !== session.accountId) {
      this.refuse(session, 'Only the host can start this bracket.');
      return;
    }
    if (event.status !== 'scheduled' || event.participants.size < 2) {
      this.refuse(session, 'A bracket needs at least two players to start.');
      return;
    }
    this.beginBracket(event);
  }

  private refuse(session: Session, message: string): void {
    session.transport.send({ type: 'error', code: 'tournamentUnavailable', message });
  }

  // -------------------------------------------------------------------------
  // Running
  // -------------------------------------------------------------------------

  private advance(event: Event, now: number): void {
    if (event.status === 'scheduled') {
      if (event.kind === 'arena' && now >= event.startsAt) {
        event.status = 'running';
        changed(event);
        log.info('tournament.start', { id: event.id });
        this.announceStart(event);
      } else if (event.kind === 'bracket' && now >= event.endsAt) {
        this.finish(event, 'expired');
      }
    }

    if (event.status === 'running') {
      if (event.kind === 'arena') {
        if (now < event.endsAt) this.pairArena(event, now);
        else if (event.games.size === 0 || now >= event.endsAt + FINISH_GRACE_MS) {
          this.finish(event, 'time');
        }
      } else {
        this.runBracket(event, now);
      }
    }

    if (event.status === 'finished') {
      const keep = event.kind === 'bracket' ? KEEP_FINISHED_BRACKET_MS : KEEP_FINISHED_MS;
      if (event.finishedAt !== null && now - event.finishedAt > keep) {
        this.events.delete(event.id);
      }
      return;
    }

    // Changes are batched: one push every couple of seconds at most, and one
    // write every ten, however many games finished in between.
    if (event.unpushed && now - event.lastPush >= PUSH_INTERVAL_MS) {
      event.lastPush = now;
      event.unpushed = false;
      for (const id of event.participants.keys()) this.push(event, id);
    }
    if (event.unsaved && now - event.lastSave >= SAVE_INTERVAL_MS) this.save(event);
  }

  /** Pair everyone free, nearest in the standings first, avoiding an immediate rematch. */
  private pairArena(event: Event, now: number): void {
    const host = this.host;
    if (!host) return;
    const free = [...event.participants.values()].filter((participant) => {
      if (!participant.active || now < participant.restUntil) return false;
      const activity = host.activity(participant.accountId);
      return activity.online && !activity.live && !activity.queued;
    });
    free.sort((a, b) => b.score - a.score || b.rating - a.rating);

    while (free.length >= 2) {
      const first = free.shift()!;
      let index = free.findIndex((candidate) => candidate.accountId !== first.lastOpponent);
      if (index < 0) index = 0;
      const second = free.splice(index, 1)[0]!;
      const code = host.arrange({
        config: event.config,
        kind: 'casual',
        accountIds: [first.accountId, second.accountId],
        tournament: { id: event.id, name: event.name, berserk: event.berserk },
      });
      if (code) {
        event.games.set(code, null);
        changed(event);
      }
    }
  }

  private score(
    participant: Participant,
    result: 'win' | 'draw' | 'loss',
    berserk: boolean,
    moves: number,
  ): void {
    const onFire = participant.streak >= 2;
    participant.played++;
    if (result === 'win') {
      participant.won++;
      participant.score += (onFire ? 4 : 2) + (berserk && moves >= BERSERK_MIN_MOVES ? 1 : 0);
      participant.streak++;
    } else {
      if (result === 'draw') {
        participant.drawn++;
        participant.score += onFire ? 2 : 1;
      }
      participant.streak = 0;
    }
  }

  private beginBracket(event: Event): void {
    const players = [...event.participants.values()].toSorted((a, b) => b.rating - a.rating);
    players.forEach((player, index) => {
      player.seed = index + 1;
    });

    // Standard seeding: 1 meets the lowest seed, and the top two can only meet
    // in the final. Empty slots are byes, which fall to the top seeds.
    let size = 2;
    while (size < players.length) size *= 2;
    const order = seedOrder(size);
    const first: BracketMatch[] = [];
    for (let index = 0; index < size; index += 2) {
      const a = players[order[index]! - 1]?.accountId ?? null;
      const b = players[order[index + 1]! - 1]?.accountId ?? null;
      first.push({
        a,
        b,
        winner: a && !b ? 1 : !a && b ? 2 : null,
        code: null,
        replays: 0,
        readySince: a && b ? this.now() : null,
      });
    }
    const rounds: BracketMatch[][] = [first];
    for (let count = first.length / 2; count >= 1; count /= 2) {
      rounds.push(
        Array.from({ length: count }, () => ({
          a: null,
          b: null,
          winner: null,
          code: null,
          replays: 0,
          readySince: null,
        })),
      );
    }

    event.bracket = rounds;
    event.status = 'running';
    event.startsAt = this.now();
    event.endsAt = this.now() + 6 * 60 * 60 * 1000;
    changed(event);
    this.save(event);
    log.info('tournament.bracket.start', { id: event.id, players: players.length });
    this.announceStart(event);
  }

  private runBracket(event: Event, now: number): void {
    const host = this.host;
    if (!event.bracket || !host) return;

    // Carry winners forward.
    for (let round = 0; round + 1 < event.bracket.length; round++) {
      event.bracket[round]!.forEach((game, index) => {
        if (game.winner === null) return;
        const next = event.bracket![round + 1]![Math.floor(index / 2)]!;
        const winnerId = game.winner === 1 ? game.a : game.b;
        const side = index % 2 === 0 ? 'a' : 'b';
        if (next[side] !== winnerId) {
          next[side] = winnerId;
          changed(event);
        }
        if (next.a && next.b && next.readySince === null) next.readySince = now;
      });
    }

    const final = event.bracket.at(-1)?.[0];
    if (final?.winner !== null && final?.winner !== undefined) {
      this.finish(event, 'complete');
      return;
    }

    for (const [round, games] of event.bracket.entries()) {
      games.forEach((game, index) => {
        if (game.winner !== null || game.code !== null || !game.a || !game.b) return;
        const a = host.activity(game.a);
        const b = host.activity(game.b);
        const freeA = a.online && !a.live;
        const freeB = b.online && !b.live;
        if (freeA && freeB) {
          const code = host.arrange({
            config: event.config,
            kind: 'private',
            accountIds: [game.a, game.b],
            tournament: { id: event.id, name: event.name, berserk: false },
          });
          if (code) {
            game.code = code;
            event.games.set(code, { round, index });
            changed(event);
          }
          return;
        }
        // Whoever has not shown up in time forfeits; if neither has, seeding decides.
        if (game.readySince !== null && now - game.readySince >= NO_SHOW_MS) {
          game.winner = freeA && !freeB ? 1 : freeB && !freeA ? 2 : this.higherSeed(event, game);
          changed(event);
        }
      });
    }

    if (now >= event.endsAt) this.finish(event, 'time');
  }

  private forfeit(event: Event, accountId: string): void {
    for (const games of event.bracket ?? []) {
      for (const game of games) {
        if (game.winner !== null) continue;
        if (game.a === accountId && game.b) game.winner = 2;
        else if (game.b === accountId && game.a) game.winner = 1;
      }
    }
  }

  private higherSeed(event: Event, game: BracketMatch): 1 | 2 {
    const seedA = (game.a && event.participants.get(game.a)?.seed) || Number.POSITIVE_INFINITY;
    const seedB = (game.b && event.participants.get(game.b)?.seed) || Number.POSITIVE_INFINITY;
    return seedA <= seedB ? 1 : 2;
  }

  private finish(event: Event, why: string): void {
    if (event.status === 'finished') return;
    event.status = 'finished';
    event.finishedAt = this.now();
    changed(event);

    const standings = this.standings(event);
    const awarded =
      event.kind === 'bracket'
        ? standings.slice(0, why === 'complete' ? 1 : 0)
        : standings.filter((entry) => entry.played > 0).slice(0, 3);
    awarded.forEach((entry, index) => {
      grantAward(this.db, {
        accountId: entry.accountId,
        source: 'tournament',
        sourceId: event.id,
        mode: event.mode,
        badge:
          event.kind === 'bracket'
            ? 'bracket-winner'
            : (['arena-gold', 'arena-silver', 'arena-bronze'][index] ?? 'arena'),
        title: index === 0 ? `Winner · ${event.name}` : `#${index + 1} · ${event.name}`,
        at: this.now(),
      });
    });

    this.save(event);
    for (const id of event.participants.keys()) this.push(event, id);
    log.info('tournament.finish', { id: event.id, why, players: event.participants.size });
  }

  /** Arenas on the schedule that are due to be announced. */
  private scheduleArenas(now: number): void {
    const first = Math.ceil((now - this.arenaLengthMs) / this.arenaEveryMs);
    const last = Math.floor((now + this.announceMs) / this.arenaEveryMs);
    for (let slot = first; slot <= last; slot++) {
      const startsAt = slot * this.arenaEveryMs;
      if (startsAt + this.arenaLengthMs <= now) continue;
      const exists = [...this.events.values()].some(
        (event) => event.kind === 'arena' && event.startsAt === startsAt,
      );
      if (exists || this.storedArenaAt(startsAt)) continue;

      const mode = RANKED_MODES[Math.abs(slot) % Math.max(1, RANKED_MODES.length)];
      if (!mode) return;
      const hour = new Date(startsAt).toISOString().slice(11, 16);
      this.create({
        kind: 'arena',
        name: `${mode.name} Arena ${hour} UTC`,
        mode: mode.id,
        config: mode.config,
        startsAt,
        endsAt: startsAt + this.arenaLengthMs,
        maxPlayers: ARENA_MAX_PLAYERS,
        berserk: true,
        hostId: null,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Plumbing
  // -------------------------------------------------------------------------

  /** Create and store a tournament. Exposed for tests and admin tools. */
  create(spec: {
    kind: TournamentKind;
    name: string;
    mode: string;
    config: GameConfig;
    startsAt: number;
    endsAt: number;
    maxPlayers: number;
    berserk: boolean;
    hostId: string | null;
  }): Event {
    const event: Event = {
      ...spec,
      id: this.freeId(),
      status: 'scheduled',
      participants: new Map(),
      games: new Map(),
      bracket: null,
      finishedAt: null,
      unpushed: false,
      unsaved: false,
      lastPush: 0,
      lastSave: 0,
    };
    this.events.set(event.id, event);
    this.db
      .prepare(
        `INSERT INTO tournaments (id, kind, name, mode, config, starts_at, ends_at, status, created_by, standings)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]')`,
      )
      .run(
        event.id,
        event.kind,
        event.name,
        event.mode,
        JSON.stringify(event.config),
        event.startsAt,
        event.endsAt,
        event.status,
        event.hostId,
      );
    log.info('tournament.create', { id: event.id, kind: event.kind, startsAt: event.startsAt });
    return event;
  }

  private save(event: Event): void {
    event.lastSave = this.now();
    event.unsaved = false;
    const standings: StoredStanding[] = [...event.participants.values()].map((participant) => ({
      accountId: participant.accountId,
      rating: participant.rating,
      score: participant.score,
      played: participant.played,
      won: participant.won,
      drawn: participant.drawn,
      streak: participant.streak,
    }));
    this.db
      .prepare(
        `UPDATE tournaments SET status = ?, starts_at = ?, ends_at = ?, standings = ?, finished_at = ?
         WHERE id = ?`,
      )
      .run(
        event.status,
        event.startsAt,
        event.endsAt,
        JSON.stringify(standings),
        event.finishedAt,
        event.id,
      );
  }

  /** Pick up after a restart: arenas resume with their points; brackets are closed. */
  private restore(): void {
    const rows = this.db
      .prepare<[], StoredEventRow>(`SELECT * FROM tournaments WHERE status != 'finished'`)
      .all();
    for (const row of rows) {
      const event = this.fromRow(row);
      if (!event) continue;
      if (event.kind === 'bracket') {
        this.events.set(event.id, event);
        this.finish(event, 'restart');
        continue;
      }
      this.events.set(event.id, event);
    }
  }

  private load(id: string): Event | null {
    const row = this.db
      .prepare<[string], StoredEventRow>('SELECT * FROM tournaments WHERE id = ?')
      .get(id);
    return row ? this.fromRow(row, 100) : null;
  }

  /**
   * A stored event. `limit` caps how many participants are looked up, best
   * first: a listing of past arenas needs the podium, not three hundred rows.
   */
  private fromRow(row: StoredEventRow, limit = Number.POSITIVE_INFINITY): Event | null {
    let config: unknown;
    let stored: unknown;
    try {
      config = JSON.parse(row.config);
      stored = JSON.parse(row.standings);
    } catch {
      return null;
    }
    if (!isGameConfig(config) || !Array.isArray(stored)) return null;

    const participants = new Map<string, Participant>();
    // Stored JSON is read back as untrusted: every field is checked.
    const best = (stored as unknown[])
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
      .toSorted((a, b) => (Number(b['score']) || 0) - (Number(a['score']) || 0))
      .slice(0, limit);
    for (const entry of best) {
      const accountId = entry['accountId'];
      const account = typeof accountId === 'string' ? this.accounts.get(accountId) : null;
      if (!account) continue;
      participants.set(account.id, {
        accountId: account.id,
        account,
        rating: Number(entry['rating']) || 0,
        score: Number(entry['score']) || 0,
        played: Number(entry['played']) || 0,
        won: Number(entry['won']) || 0,
        drawn: Number(entry['drawn']) || 0,
        streak: Number(entry['streak']) || 0,
        // Nobody is paired until they come back and say so.
        active: false,
        lastOpponent: null,
        restUntil: 0,
        seed: 0,
      });
    }

    return {
      id: row.id,
      kind: row.kind === 'bracket' ? 'bracket' : 'arena',
      name: row.name,
      mode: row.mode,
      config,
      status:
        row.status === 'running' ? 'running' : row.status === 'finished' ? 'finished' : 'scheduled',
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      maxPlayers: row.kind === 'bracket' ? 16 : ARENA_MAX_PLAYERS,
      berserk: row.kind === 'arena',
      hostId: row.created_by,
      participants,
      games: new Map(),
      bracket: null,
      finishedAt: row.finished_at,
      unpushed: false,
      unsaved: false,
      lastPush: 0,
      lastSave: 0,
    };
  }

  private storedArenaAt(startsAt: number): boolean {
    return (
      this.db
        .prepare<[number], { id: string }>(
          `SELECT id FROM tournaments WHERE kind = 'arena' AND starts_at = ? LIMIT 1`,
        )
        .get(startsAt) !== undefined
    );
  }

  private freeId(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      let id = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        id += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      }
      if (!this.events.has(id) && !this.load(id)) return id;
    }
    throw new Error('Could not allocate a tournament id');
  }

  private standings(event: Event): Participant[] {
    return [...event.participants.values()].toSorted((a, b) => {
      if (event.kind === 'bracket')
        return progress(event, b) - progress(event, a) || a.seed - b.seed;
      return b.score - a.score || b.won - a.won || a.played - b.played || b.rating - a.rating;
    });
  }

  private push(event: Event, accountId: string): void {
    this.host?.notify(accountId, {
      type: 'tournament',
      tournament: this.toWire(event, accountId, PUSH_STANDINGS),
    });
  }

  private toWire(event: Event, viewerId: string | null, limit: number): WireTournament {
    const ordered = this.standings(event);
    const profile = (id: string | null): PublicProfile | null => {
      const participant = id ? event.participants.get(id) : undefined;
      return participant ? toPublicProfile(participant.account, participant.rating) : null;
    };
    const entries = ordered.map((participant, index) => ({
      rank: index + 1,
      profile: toPublicProfile(participant.account, participant.rating),
      score: participant.score,
      played: participant.played,
      won: participant.won,
      fire: event.kind === 'arena' && participant.streak >= 2,
      active: participant.active,
    }));
    let shown = entries.slice(0, limit);
    // A player always sees their own row, even below the cut.
    const own = viewerId
      ? entries.find((entry) => entry.profile.accountId === viewerId)
      : undefined;
    if (own && !shown.includes(own)) shown = [...shown.slice(0, Math.max(0, limit - 1)), own];

    return {
      id: event.id,
      kind: event.kind,
      name: event.name.slice(0, 60),
      mode: event.mode.slice(0, 80),
      config: event.config,
      status: event.status,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      players: event.participants.size,
      maxPlayers: event.maxPlayers,
      berserk: event.berserk,
      joined: viewerId !== null && event.participants.get(viewerId)?.active === true,
      hostId: event.hostId,
      standings: shown,
      bracket: event.bracket
        ? event.bracket.map((games) =>
            games.map((game) => ({
              a: profile(game.a),
              b: profile(game.b),
              winner: game.winner,
              code: game.code,
            })),
          )
        : null,
    };
  }
}

interface StoredEventRow {
  id: string;
  kind: string;
  name: string;
  mode: string;
  config: string;
  starts_at: number;
  ends_at: number;
  status: string;
  created_by: string | null;
  standings: string;
  finished_at: number | null;
}

function changed(event: Event): void {
  event.unpushed = true;
  event.unsaved = true;
}

function statusOrder(event: Event): number {
  return event.status === 'running' ? 0 : event.status === 'scheduled' ? 1 : 2;
}

/** How far a participant got in a bracket: rounds won. */
function progress(event: Event, participant: Participant): number {
  let won = 0;
  for (const games of event.bracket ?? []) {
    for (const game of games) {
      const side = game.a === participant.accountId ? 1 : game.b === participant.accountId ? 2 : 0;
      if (side && game.winner === side) won++;
    }
  }
  return won;
}

/**
 * Bracket slot order for `size` seeds, so 1 and 2 are in opposite halves, 1-4
 * in different quarters, and so on: [1, 8, 4, 5, 2, 7, 3, 6] for eight.
 */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const next = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, next - seed]);
  }
  return order;
}
