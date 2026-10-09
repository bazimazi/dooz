import { randomInt, randomUUID } from 'node:crypto';
import {
  applyMove,
  clockForConfig,
  configKey,
  createGame,
  type GameConfig,
  type GameState,
  isGameConfig,
  modeForConfig,
  O,
  opponentOf,
  type Player,
  randomStartingPlayer,
  startingPlayerOf,
  X,
} from '@/game/engine';
import {
  type ClientMessage,
  type Clock,
  type Emote,
  type ErrorCode,
  type MatchKind,
  type MatchResult,
  PROTOCOL_VERSION,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type Seat as WireSeat,
  type ServerMessage,
  type Snapshot,
} from '@/protocol';
import { earnedAchievements } from './achievements.js';
import { MatchClock } from './clock.js';
import type { Accounts, AccountRow } from './db/accounts.js';
import { toPublicProfile } from './db/accounts.js';
import type { Matches } from './db/matches.js';
import { log } from './log.js';
import { PLACEMENT_GAMES, updateRatings } from './rating.js';
import type { Outcome, Room, Seat, Session, Transport } from './types.js';

export interface LobbyOptions {
  /** Injectable clock so tests can advance time without waiting. */
  now?: () => number;
  random?: () => number;
  newId?: () => string;
  /** How long a seat is held open for a disconnected player, in milliseconds. */
  reconnectGraceMs?: number;
  /** How long before a disconnected player forfeits a game in progress. */
  abandonAfterMs?: number;
  /** Token bucket: burst size and refill rate for inbound messages. */
  messageBurst?: number;
  messagesPerSecond?: number;
  /** Hard ceilings, so one client cannot grow the maps without bound. */
  maxSessions?: number;
  maxRooms?: number;
  maxSpectatorsPerRoom?: number;
  /** Turn timers off entirely, which private rooms may want. */
  clocksEnabled?: boolean;
}

const DEFAULT_RECONNECT_GRACE_MS = 45_000;
const DEFAULT_ABANDON_AFTER_MS = 60_000;
const DEFAULT_MESSAGE_BURST = 30;
const DEFAULT_MESSAGES_PER_SECOND = 10;
const DEFAULT_MAX_SESSIONS = 5000;
const DEFAULT_MAX_ROOMS = 2000;
const DEFAULT_MAX_SPECTATORS = 50;

/** Emotes get their own, far tighter bucket than ordinary messages. */
const EMOTE_BURST = 3;
const EMOTES_PER_SECOND = 0.34;

/**
 * Ranked matchmaking band, in rating points, after waiting `waitedMs`.
 *
 * It starts narrow enough that the first match is a fair one and widens until
 * it stops mattering, because a perfectly fair match that never happens is
 * worse than a slightly lopsided one that does.
 */
export function ratingBand(waitedMs: number): number {
  if (waitedMs >= 45_000) return Number.POSITIVE_INFINITY;
  return 120 + Math.floor(waitedMs / 6000) * 130;
}

interface QueueEntry {
  sessionId: string;
  accountId: string;
  rating: number;
  joinedAt: number;
}

/**
 * Matchmaking and authoritative game state for every online game in progress.
 *
 * The server never accepts a board from a client, only a cell index, and
 * re-derives the next state itself. That is the reason the engine is a shared
 * package: both sides run identical rules, but only this side is believed.
 *
 * Every rule that decides a result lives here too - who may move, whose clock
 * is running, what a disconnection costs, what a rating changes by - because
 * all of them are worth money to a cheat and none of them can be checked after
 * the fact if the client was trusted for them in the first place.
 */
export class Lobby {
  private readonly sessions = new Map<string, Session>();
  /** Connection currently held by an account, for one-session-per-account. */
  private readonly byAccount = new Map<string, string>();
  private readonly rooms = new Map<string, Room>();
  /** Waiting players, keyed by config plus whether they asked for a ranked game. */
  private readonly queues = new Map<string, QueueEntry[]>();

  private readonly now: () => number;
  private readonly random: () => number;
  private readonly newId: () => string;
  private readonly reconnectGraceMs: number;
  private readonly abandonAfterMs: number;
  private readonly messageBurst: number;
  private readonly messagesPerSecond: number;
  private readonly maxSessions: number;
  private readonly maxRooms: number;
  private readonly maxSpectators: number;
  private readonly clocksEnabled: boolean;

  constructor(
    private readonly accounts: Accounts,
    private readonly matches: Matches,
    options: LobbyOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.newId = options.newId ?? (() => randomUUID());
    this.reconnectGraceMs = options.reconnectGraceMs ?? DEFAULT_RECONNECT_GRACE_MS;
    this.abandonAfterMs = options.abandonAfterMs ?? DEFAULT_ABANDON_AFTER_MS;
    this.messageBurst = options.messageBurst ?? DEFAULT_MESSAGE_BURST;
    this.messagesPerSecond = options.messagesPerSecond ?? DEFAULT_MESSAGES_PER_SECOND;
    this.maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS;
    this.maxRooms = options.maxRooms ?? DEFAULT_MAX_ROOMS;
    this.maxSpectators = options.maxSpectatorsPerRoom ?? DEFAULT_MAX_SPECTATORS;
    this.clocksEnabled = options.clocksEnabled ?? true;
  }

  get atCapacity(): boolean {
    return this.sessions.size >= this.maxSessions;
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  get sessionCount(): number {
    return this.sessions.size;
  }

  get queuedCount(): number {
    let total = 0;
    for (const queue of this.queues.values()) total += queue.length;
    return total;
  }

  connect(transport: Transport): Session {
    const session: Session = {
      id: this.newId(),
      accountId: null,
      account: null,
      transport,
      roomCode: null,
      spectating: null,
      connected: true,
      greeted: false,
      tokens: this.messageBurst,
      lastRefill: this.now(),
      emoteTokens: EMOTE_BURST,
      emoteRefill: this.now(),
      muted: false,
    };
    this.sessions.set(session.id, session);
    log.debug('conn.open', { sessionId: session.id, sessions: this.sessions.size });
    return session;
  }

  disconnect(session: Session): void {
    session.connected = false;

    // A session that has already been replaced by a newer connection for the
    // same account is done, and nothing more: the queue entry and the seat
    // belong to that newer connection now, and tearing either down here would
    // knock a live player out of a game they are in the middle of.
    if (this.sessions.get(session.id) !== session) return;

    this.sessions.delete(session.id);
    if (session.accountId && this.byAccount.get(session.accountId) === session.id) {
      this.byAccount.delete(session.accountId);
    }
    this.removeFromQueues(session.id);

    const watching = session.spectating ? this.rooms.get(session.spectating) : undefined;
    if (watching) {
      watching.spectators.delete(session.id);
      this.announceSpectators(watching);
    }

    const room = session.roomCode ? this.rooms.get(session.roomCode) : undefined;
    log.info('conn.close', {
      sessionId: session.id,
      accountId: session.accountId,
      room: room?.code,
    });
    if (!room || !session.accountId) return;

    const seat = room.seats.find((candidate) => candidate.accountId === session.accountId);
    if (seat) {
      seat.connected = false;
      seat.disconnectedAt = this.now();
      // A rematch or draw asked for before the drop must not be accepted on
      // their behalf while they are not there to see it.
      seat.wantsRematch = false;
      seat.offeredDraw = false;
    }

    // The seat is held rather than freed, so a dropped connection (a phone
    // locking its screen, a tunnel switching networks) does not end the game.
    if (room.seats.every((candidate) => !candidate.connected)) {
      room.vacantSince = this.now();
    }
    this.announceSeats(room);
  }

  /**
   * Periodic housekeeping: clocks, abandoned games, dead rooms, and the
   * widening matchmaking bands.
   *
   * Everything time-dependent is driven from here rather than from its own
   * timer, so a test can make an hour pass in one call and there is one place
   * to look when something expires at the wrong moment.
   */
  tick(): void {
    this.flushQueues();
    this.checkClocks();
    this.checkAbandoned();
    this.sweepRooms();
  }

  handle(session: Session, message: ClientMessage): void {
    if (!this.consumeToken(session)) {
      this.fail(session, 'rateLimited', 'Slow down.');
      return;
    }

    // Nothing but `hello` is accepted before the connection has proved who it
    // is. Without this an unauthenticated socket could queue, join rooms and
    // move - every one of which writes to somebody's record.
    if (message.type !== 'hello' && !session.accountId) {
      this.fail(session, 'unauthorized', 'Introduce yourself first.');
      return;
    }

    switch (message.type) {
      case 'hello':
        this.onHello(session, message);
        return;
      case 'queue':
        this.onQueue(session, message.config, message.ranked);
        return;
      case 'createRoom':
        this.onCreateRoom(session, message.config);
        return;
      case 'joinRoom':
        this.onJoinRoom(session, message.code);
        return;
      case 'spectate':
        this.onSpectate(session, message.code);
        return;
      case 'leave':
        this.onLeave(session);
        return;
      case 'move':
        this.onMove(session, message.index);
        return;
      case 'resign':
        this.onResign(session);
        return;
      case 'offerDraw':
        this.onOfferDraw(session);
        return;
      case 'respondDraw':
        this.onRespondDraw(session, message.accept);
        return;
      case 'rematch':
        this.onRematch(session);
        return;
      case 'emote':
        this.onEmote(session, message.emote);
        return;
      case 'mute':
        session.muted = message.muted;
        return;
      case 'ping':
        session.transport.send({ type: 'pong' });
        return;
    }
  }

  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------

  private onHello(session: Session, message: Extract<ClientMessage, { type: 'hello' }>): void {
    if (message.version !== PROTOCOL_VERSION) {
      this.fail(session, 'versionMismatch', 'Please reload to get the latest version.');
      session.transport.close();
      return;
    }

    // One handshake per connection. A second would let a client swap identity
    // underneath a game already in progress.
    if (session.greeted) {
      this.fail(session, 'badMessage', 'Already introduced.');
      return;
    }
    session.greeted = true;

    const account = this.accounts.authenticate(message.accountId, message.token);
    if (!account) {
      log.warn('auth.failed', { sessionId: session.id, accountId: message.accountId });
      this.fail(session, 'unauthorized', 'Those credentials are not valid.');
      session.transport.close();
      return;
    }

    // An account gets one live connection. A second tab taking over is the
    // desired behaviour for a reconnect after a crash; what must not happen is
    // two sockets both believing they hold the same seat.
    const previousId = this.byAccount.get(account.id);
    const previous = previousId ? this.sessions.get(previousId) : undefined;
    if (previous && previous !== session) {
      previous.transport.send({
        type: 'error',
        code: 'alreadyPlaying',
        message: 'This account was opened somewhere else.',
      });
      previous.transport.close();
      this.sessions.delete(previous.id);
      this.removeFromQueues(previous.id);
    }

    session.accountId = account.id;
    session.account = account;
    this.byAccount.set(account.id, session.id);

    // Whether a seat is waiting is decided before the welcome goes out, so the
    // client can be told in the same frame. It cannot be inferred from the
    // `matched` that follows: that arrives in a later message, and in between
    // the client would believe it was idle and act on it.
    const resuming = this.roomOf(account.id) !== null;

    session.transport.send({
      type: 'welcome',
      version: PROTOCOL_VERSION,
      profile: toPublicProfile(account, null),
      resumed: resuming,
    });
    log.info('auth.ok', { sessionId: session.id, accountId: account.id, resumed: resuming });

    if (resuming) this.resumeRoom(session);
  }

  /** The room this account holds a seat in, if any. */
  private roomOf(accountId: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.seats.some((seat) => seat.accountId === accountId)) return room;
    }
    return null;
  }

  /** After a reconnect, put the client straight back into whatever it was in. */
  private resumeRoom(session: Session): void {
    if (!session.accountId) return;

    for (const room of this.rooms.values()) {
      const seat = room.seats.find((candidate) => candidate.accountId === session.accountId);
      if (!seat) continue;

      seat.connected = true;
      seat.disconnectedAt = null;
      if (session.account) seat.account = session.account;
      session.roomCode = room.code;
      room.vacantSince = null;
      // Whoever is to move has been losing time to a clock they could not see.
      // It kept running on purpose - a disconnection is not a pause button, or
      // it would be the cheapest way out of a lost position there is.
      this.sendMatched(room, session);
      this.announceSeats(room);
      log.info('room.resume', { accountId: session.accountId, room: room.code });
      return;
    }
  }

  // ---------------------------------------------------------------------------
  // Matchmaking
  // ---------------------------------------------------------------------------

  private onQueue(session: Session, config: GameConfig, ranked: boolean): void {
    if (!session.accountId || !session.account) return;
    if (!isGameConfig(config)) {
      this.fail(session, 'badMessage', 'That is not a game we know how to run.');
      return;
    }

    const mode = modeForConfig(config);
    if (ranked && (!mode || !mode.ranked)) {
      this.fail(session, 'notRankable', 'Only the standard modes have a ladder.');
      return;
    }

    this.onLeave(session, { silent: true });

    const key = this.queueKey(config, ranked);
    const queue = this.queues.get(key) ?? [];
    this.queues.set(key, queue);

    const modeKey = this.modeKeyFor(config);
    const rating = this.accounts.statsFor(session.accountId, modeKey).rating;
    const entry: QueueEntry = {
      sessionId: session.id,
      accountId: session.accountId,
      rating,
      joinedAt: this.now(),
    };

    const opponent = this.findOpponent(queue, entry, ranked);
    if (!opponent) {
      queue.push(entry);
      session.transport.send({
        type: 'searching',
        config,
        ranked,
        queued: queue.length,
      });
      log.info('queue.join', {
        accountId: session.accountId,
        mode: modeKey,
        ranked,
        rating,
        waiting: queue.length,
      });
      return;
    }

    this.pair(config, ranked, opponent, entry);
  }

  /**
   * Somebody in `queue` this entry may be matched with, removed from it.
   *
   * A casual game matches the longest waiter outright. A ranked one only
   * matches inside a band that widens with whichever of the two has waited
   * longer, so a player who has been waiting is not held up by a newcomer's
   * narrow band.
   */
  private findOpponent(queue: QueueEntry[], entry: QueueEntry, ranked: boolean): QueueEntry | null {
    for (let index = 0; index < queue.length; index++) {
      const candidate = queue[index]!;
      if (candidate.accountId === entry.accountId) continue;

      const session = this.sessions.get(candidate.sessionId);
      if (!session?.connected) {
        // Dropped while waiting. Drop the entry and keep looking.
        queue.splice(index, 1);
        index--;
        continue;
      }

      if (ranked) {
        const waited = Math.max(this.now() - candidate.joinedAt, this.now() - entry.joinedAt);
        if (Math.abs(candidate.rating - entry.rating) > ratingBand(waited)) continue;
      }

      queue.splice(index, 1);
      return candidate;
    }
    return null;
  }

  /** Re-run matchmaking for everyone waiting, now that the bands have widened. */
  private flushQueues(): void {
    for (const [key, queue] of this.queues) {
      const ranked = key.endsWith(':ranked');
      let index = 0;

      while (index < queue.length) {
        const entry = queue[index]!;
        const session = this.sessions.get(entry.sessionId);
        if (!session?.connected) {
          queue.splice(index, 1);
          continue;
        }

        const rest = queue.slice(index + 1);
        const partner = this.findOpponent(rest, entry, ranked);
        if (!partner) {
          index++;
          continue;
        }

        // `findOpponent` spliced out of the copy, so remove both from the real
        // queue before pairing them.
        queue.splice(index, 1);
        const partnerAt = queue.findIndex((item) => item.sessionId === partner.sessionId);
        if (partnerAt >= 0) queue.splice(partnerAt, 1);

        const config = this.configFromQueueKey(key);
        if (config) this.pair(config, ranked, partner, entry);
      }
    }
  }

  private pair(config: GameConfig, ranked: boolean, first: QueueEntry, second: QueueEntry): void {
    const firstSession = this.sessions.get(first.sessionId);
    const secondSession = this.sessions.get(second.sessionId);
    if (!firstSession || !secondSession) return;

    const room = this.openRoom(config, ranked ? 'ranked' : 'casual');
    if (!room) {
      this.fail(secondSession, 'serverFull', 'The server is busy. Try again in a moment.');
      return;
    }

    this.seat(room, firstSession);
    this.seat(room, secondSession);
    this.beginGame(room);
    log.info('match.start', {
      room: room.code,
      mode: room.mode,
      kind: room.kind,
      ratingGap: Math.abs(first.rating - second.rating),
    });
  }

  private onCreateRoom(session: Session, config: GameConfig): void {
    if (!isGameConfig(config)) {
      this.fail(session, 'badMessage', 'That is not a game we know how to run.');
      return;
    }

    this.onLeave(session, { silent: true });
    const room = this.openRoom(config, 'private');
    if (!room) {
      this.fail(session, 'serverFull', 'The server is busy. Try again in a moment.');
      return;
    }

    this.seat(room, session);
    session.transport.send({ type: 'roomCreated', code: room.code, config });
    log.info('room.create', { room: room.code, accountId: session.accountId });
  }

  private onJoinRoom(session: Session, code: string): void {
    const room = this.rooms.get(code);
    if (!room) {
      this.fail(session, 'roomNotFound', 'No game with that code.');
      return;
    }

    const existing = room.seats.find((seat) => seat.accountId === session.accountId);
    if (existing) {
      // Reconnecting into a seat that is still being held open. Any other room
      // this session occupies has to be vacated first, or it leaves a seat
      // behind there that nothing will ever clear.
      if (session.roomCode !== room.code) this.onLeave(session, { silent: true });

      existing.connected = true;
      existing.disconnectedAt = null;
      if (session.account) existing.account = session.account;
      session.roomCode = room.code;
      room.vacantSince = null;
      this.sendMatched(room, session);
      this.announceSeats(room);
      return;
    }

    if (room.seats.length >= 2) {
      this.fail(session, 'roomFull', 'That game already has two players.');
      return;
    }

    this.onLeave(session, { silent: true });
    this.seat(room, session);
    this.beginGame(room);
    log.info('room.join', { room: room.code, accountId: session.accountId });
  }

  private onSpectate(session: Session, code: string): void {
    const room = this.rooms.get(code);
    if (!room) {
      this.fail(session, 'roomNotFound', 'No game with that code.');
      return;
    }
    if (room.seats.some((seat) => seat.accountId === session.accountId)) {
      // A player cannot watch their own game; that is just playing it.
      this.onJoinRoom(session, code);
      return;
    }
    if (room.spectators.size >= this.maxSpectators) {
      this.fail(session, 'roomFull', 'That game has as many watchers as it will take.');
      return;
    }

    this.onLeave(session, { silent: true });
    room.spectators.add(session.id);
    session.spectating = room.code;
    this.sendMatched(room, session);
    this.announceSpectators(room);
  }

  private onLeave(session: Session, options: { silent?: boolean } = {}): void {
    this.removeFromQueues(session.id);

    const watching = session.spectating ? this.rooms.get(session.spectating) : undefined;
    session.spectating = null;
    if (watching) {
      watching.spectators.delete(session.id);
      this.announceSpectators(watching);
    }

    const room = session.roomCode ? this.rooms.get(session.roomCode) : undefined;
    session.roomCode = null;
    if (!room) return;

    // Walking out of a game in progress is a resignation, not an exit: a player
    // who is losing must not be able to escape the result by closing the tab.
    if (this.isLive(room)) {
      const seat = room.seats.find((candidate) => candidate.accountId === session.accountId);
      if (seat) {
        this.settle(room, { winner: opponentOf(seat.player), reason: 'resign' });
      }
    }

    room.seats = room.seats.filter((seat) => seat.accountId !== session.accountId);

    if (room.seats.length === 0) {
      this.closeRoom(room);
      return;
    }

    if (!options.silent) this.broadcast(room, { type: 'opponentLeft' });
    for (const seat of room.seats) {
      const other = this.sessionFor(seat.accountId);
      if (other) other.roomCode = null;
    }
    this.closeRoom(room);
  }

  // ---------------------------------------------------------------------------
  // Playing
  // ---------------------------------------------------------------------------

  private onMove(session: Session, index: number): void {
    const found = this.seatOf(session);
    if (!found) {
      this.fail(session, 'notInRoom', 'You are not in a game.');
      return;
    }
    const { room, seat } = found;

    if (room.seats.length < 2) {
      this.fail(session, 'notInRoom', 'You are not in a game.');
      return;
    }

    // `settled` and a finished board are not the same thing: a match decided on
    // time, by resignation or by abandonment leaves a board that is still
    // mid-game. Without this check those boards would keep accepting moves
    // after the result had already been recorded.
    if (room.settled || room.game.status !== 'playing') {
      this.fail(session, 'notYourTurn', 'This match is over.');
      return;
    }
    if (room.game.currentPlayer !== seat.player) {
      this.fail(session, 'notYourTurn', 'It is not your turn.');
      return;
    }

    // The clock is checked before the move, not after: a move that arrives
    // after the flag has fallen is too late, however legal it is.
    if (room.clock?.flagged() === seat.player) {
      this.settle(room, { winner: opponentOf(seat.player), reason: 'timeout' });
      return;
    }

    const next = applyMove(room.game, index);
    if (!next) {
      this.fail(session, 'illegalMove', 'That move is not allowed here.');
      return;
    }

    const at = this.now();
    room.moveTimesMs.push(Math.max(0, at - room.lastMoveAt));
    room.lastMoveAt = at;
    room.game = next;

    // Offering a draw and then moving withdraws the offer; so does answering.
    // Moving also earns back the right to offer, which a decline took away.
    for (const candidate of room.seats) candidate.offeredDraw = false;
    seat.mayOfferDraw = true;

    if (next.status === 'playing') {
      room.clock?.moved(seat.player, next.currentPlayer);
      this.broadcastState(room);
      return;
    }

    room.clock?.stop();
    this.broadcastState(room);
    this.settle(room, {
      winner: next.winner,
      reason: next.status === 'draw' ? 'draw' : 'line',
    });
  }

  private onResign(session: Session): void {
    const found = this.seatOf(session);
    if (!found || !this.isLive(found.room)) {
      this.fail(session, 'notInRoom', 'You are not in a game.');
      return;
    }
    this.settle(found.room, { winner: opponentOf(found.seat.player), reason: 'resign' });
  }

  private onOfferDraw(session: Session): void {
    const found = this.seatOf(session);
    if (!found || !this.isLive(found.room)) return;

    // One offer per position. Without this a player who does not want to be
    // playing any more can put the banner back on their opponent's screen as
    // fast as the rate limiter allows, which is often enough to be a weapon.
    if (!found.seat.mayOfferDraw || found.seat.offeredDraw) return;

    found.seat.offeredDraw = true;
    this.broadcast(found.room, { type: 'drawOffered' }, found.seat.accountId);
  }

  private onRespondDraw(session: Session, accept: boolean): void {
    const found = this.seatOf(session);
    if (!found || !this.isLive(found.room)) return;

    const other = found.room.seats.find(
      (candidate) => candidate.accountId !== found.seat.accountId,
    );
    if (!other?.offeredDraw) return;

    other.offeredDraw = false;
    if (!accept) {
      // They must play a move before they may ask again.
      other.mayOfferDraw = false;
      this.broadcast(found.room, { type: 'drawDeclined' }, found.seat.accountId);
      return;
    }
    this.settle(found.room, { winner: null, reason: 'agreed' });
  }

  private onRematch(session: Session): void {
    const found = this.seatOf(session);
    if (!found || found.room.seats.length < 2) {
      this.fail(session, 'notInRoom', 'You are not in a game.');
      return;
    }
    const { room, seat } = found;
    // A rematch is for a finished game. Asking mid-game is a client bug.
    if (room.game.status === 'playing') return;

    seat.wantsRematch = true;
    if (!room.seats.every((candidate) => candidate.wantsRematch)) {
      this.broadcast(room, { type: 'rematchOffered' }, seat.accountId);
      this.announceSeats(room);
      return;
    }

    for (const candidate of room.seats) {
      candidate.wantsRematch = false;
      candidate.offeredDraw = false;
    }
    this.beginGame(room);
    log.info('match.rematch', { room: room.code, mode: room.mode });
  }

  private onEmote(session: Session, emote: Emote): void {
    const found = this.seatOf(session);
    if (!found) return;
    if (!this.consumeEmoteToken(session)) return;

    for (const seat of found.room.seats) {
      if (seat.accountId === found.seat.accountId) continue;
      const other = this.sessionFor(seat.accountId);
      // A muted player simply does not receive them; the sender is not told,
      // because "your opponent muted you" is itself a message worth sending.
      if (other && !other.muted) {
        other.transport.send({ type: 'emote', from: found.seat.player, emote });
      }
    }
    for (const id of found.room.spectators) {
      this.sessions.get(id)?.transport.send({ type: 'emote', from: found.seat.player, emote });
    }
  }

  // ---------------------------------------------------------------------------
  // Timers
  // ---------------------------------------------------------------------------

  private checkClocks(): void {
    for (const room of this.rooms.values()) {
      if (room.settled || !room.clock || room.game.status !== 'playing') continue;
      const flagged = room.clock.flagged();
      if (flagged === null) continue;

      room.clock.stop();
      this.settle(room, { winner: opponentOf(flagged), reason: 'timeout' });
      log.info('match.timeout', { room: room.code, loser: flagged });
    }
  }

  /**
   * Award a game whose loser has been gone too long.
   *
   * Without this a player in a lost position could simply close the lid and
   * leave the game unresolved for ever - and in a ranked ladder an unresolved
   * game is a rating they did not lose.
   */
  private checkAbandoned(): void {
    const cutoff = this.now() - this.abandonAfterMs;

    for (const room of this.rooms.values()) {
      if (room.settled || room.seats.length < 2 || room.game.status !== 'playing') continue;

      const gone = room.seats.find(
        (seat) => !seat.connected && seat.disconnectedAt !== null && seat.disconnectedAt <= cutoff,
      );
      if (!gone) continue;

      // If both sides have walked away there is nobody to award it to.
      const present = room.seats.find((seat) => seat.accountId !== gone.accountId);
      if (!present?.connected) continue;

      this.settle(room, { winner: present.player, reason: 'abandoned' });
      log.info('match.abandoned', { room: room.code, accountId: gone.accountId });
    }
  }

  /** Drop rooms whose players have all been gone longer than the grace period. */
  private sweepRooms(): void {
    const cutoff = this.now() - this.reconnectGraceMs;
    for (const [code, room] of this.rooms) {
      if (room.vacantSince !== null && room.vacantSince <= cutoff) {
        this.closeRoom(room);
        this.rooms.delete(code);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Results
  // ---------------------------------------------------------------------------

  /**
   * Score a finished game exactly once.
   *
   * Everything that ends a match funnels through here - a completed line, a
   * resignation, a flag, an abandonment, an agreed draw - so the rating update,
   * the statistics, the achievements and the stored record cannot get out of
   * step with each other or be applied twice.
   */
  private settle(room: Room, outcome: Outcome): void {
    if (room.settled) return;
    room.settled = true;
    room.clock?.stop();

    const x = room.seats.find((seat) => seat.player === X);
    const o = room.seats.find((seat) => seat.player === O);
    if (!x || !o) return;

    const ranked = room.kind === 'ranked';
    const score = outcome.winner === null ? 0.5 : outcome.winner === X ? 1 : 0;

    const xStats = this.accounts.statsFor(x.accountId, room.mode);
    const oStats = this.accounts.statsFor(o.accountId, room.mode);

    let rating: MatchResult['rating'] = null;
    if (ranked) {
      const next = updateRatings(
        { rating: xStats.rating, played: xStats.played },
        { rating: oStats.rating, played: oStats.played },
        score,
      );
      rating = {
        x: { before: xStats.rating, after: next.x },
        o: { before: oStats.rating, after: next.o },
      };
    }

    // Casual and private games count towards played/won/lost but never move a
    // rating: mixing them would make the ladder a measure of how much somebody
    // played rather than how well.
    const xOutcome = outcome.winner === null ? 'draw' : outcome.winner === X ? 'win' : 'loss';
    const oOutcome = xOutcome === 'draw' ? 'draw' : xOutcome === 'win' ? 'loss' : 'win';

    const xAfter = this.accounts.recordResult(
      x.accountId,
      room.mode,
      xOutcome,
      rating?.x.after ?? xStats.rating,
    );
    const oAfter = this.accounts.recordResult(
      o.accountId,
      room.mode,
      oOutcome,
      rating?.o.after ?? oStats.rating,
    );

    const matchId = this.matches.record({
      mode: room.mode,
      config: room.config,
      kind: room.kind,
      xId: x.accountId,
      oId: o.accountId,
      startingPlayer: startingPlayerOf(room.game),
      moves: room.game.moves,
      moveTimesMs: room.moveTimesMs,
      winner: outcome.winner,
      reason: outcome.reason,
      playedAt: room.startedAt,
      durationMs: Math.max(0, this.now() - room.startedAt),
      rating,
    });

    this.grantAchievements(x.accountId, xAfter, xOutcome === 'win', room);
    this.grantAchievements(o.accountId, oAfter, oOutcome === 'win', room);

    const result: MatchResult = {
      matchId,
      winner: outcome.winner,
      reason: outcome.reason,
      kind: room.kind,
      rating,
    };

    this.broadcastState(room);
    this.broadcast(room, { type: 'result', result });
    for (const id of room.spectators) {
      this.sessions.get(id)?.transport.send({ type: 'result', result });
    }

    log.info('match.end', {
      room: room.code,
      matchId,
      mode: room.mode,
      kind: room.kind,
      reason: outcome.reason,
      winner: outcome.winner,
      moves: room.game.moves.length,
      durationMs: Math.max(0, this.now() - room.startedAt),
    });
  }

  private grantAchievements(
    accountId: string,
    stats: { played: number; won: number; streak: number; rating: number },
    won: boolean,
    room: Room,
  ): void {
    const all = this.accounts.allStats(accountId);
    const totals = all.reduce(
      (sum, entry) => ({
        played: sum.played + entry.played,
        won: sum.won + entry.won,
        best: Math.max(sum.best, entry.rating),
      }),
      { played: 0, won: 0, best: 0 },
    );

    this.accounts.award(
      accountId,
      earnedAchievements({
        totalPlayed: totals.played,
        totalWon: totals.won,
        streak: stats.streak,
        bestRating: totals.best,
        modesPlayed: this.matches.modesPlayed(accountId),
        won,
        moveCount: room.game.moves.length,
        winLength: room.config.winLength,
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Room plumbing
  // ---------------------------------------------------------------------------

  private openRoom(config: GameConfig, kind: MatchKind): Room | null {
    if (this.rooms.size >= this.maxRooms) return null;

    const room: Room = {
      code: this.generateCode(),
      config,
      mode: this.modeKeyFor(config),
      kind,
      seats: [],
      game: createGame(config, randomStartingPlayer(this.random)),
      clock: null,
      spectators: new Set(),
      vacantSince: null,
      startedAt: this.now(),
      lastMoveAt: this.now(),
      moveTimesMs: [],
      settled: true,
    };
    this.rooms.set(room.code, room);
    return room;
  }

  private closeRoom(room: Room): void {
    for (const id of room.spectators) {
      const spectator = this.sessions.get(id);
      if (spectator) {
        spectator.spectating = null;
        spectator.transport.send({ type: 'opponentLeft' });
      }
    }
    room.spectators.clear();
    this.rooms.delete(room.code);
  }

  /** Start, or restart, the game in a full room. */
  private beginGame(room: Room): void {
    if (room.seats.length < 2) return;

    room.game = createGame(room.config, randomStartingPlayer(this.random));
    room.startedAt = this.now();
    room.lastMoveAt = this.now();
    room.moveTimesMs = [];
    room.settled = false;

    for (const seat of room.seats) {
      seat.ratingBefore = this.accounts.statsFor(seat.accountId, room.mode).rating;
      seat.wantsRematch = false;
      seat.offeredDraw = false;
      seat.mayOfferDraw = true;
    }

    if (this.clocksEnabled) {
      const { initialSeconds, incrementSeconds } = clockForConfig(room.config);
      room.clock = new MatchClock(initialSeconds * 1000, incrementSeconds * 1000, this.now);
      room.clock.start(room.game.currentPlayer);
    }

    for (const seat of room.seats) {
      const session = this.sessionFor(seat.accountId);
      if (session) this.sendMatched(room, session);
    }
    for (const id of room.spectators) {
      const session = this.sessions.get(id);
      if (session) this.sendMatched(room, session);
    }
  }

  private seat(room: Room, session: Session): Seat | null {
    if (!session.accountId || !session.account) return null;

    // X is always the first seat, so whoever opened the room leads.
    const player: Player = room.seats.length === 0 ? X : O;
    const seat: Seat = {
      accountId: session.accountId,
      player,
      account: session.account,
      connected: true,
      wantsRematch: false,
      offeredDraw: false,
      mayOfferDraw: true,
      ratingBefore: this.accounts.statsFor(session.accountId, room.mode).rating,
      disconnectedAt: null,
    };
    room.seats.push(seat);
    session.roomCode = room.code;
    room.vacantSince = null;
    return seat;
  }

  private sendMatched(room: Room, session: Session): void {
    const seat = room.seats.find((candidate) => candidate.accountId === session.accountId);

    session.transport.send({
      type: 'matched',
      code: room.code,
      kind: room.kind,
      you: seat?.player ?? null,
      seats: this.wireSeats(room),
      snapshot: toSnapshot(room.game),
      clock: room.clock?.snapshot() ?? null,
      spectators: room.spectators.size,
    });
  }

  private wireSeats(room: Room): WireSeat[] {
    return room.seats.map((seat) => ({
      player: seat.player,
      profile: toPublicProfile(seat.account, seat.ratingBefore),
      connected: seat.connected,
      wantsRematch: seat.wantsRematch,
    }));
  }

  private broadcastState(room: Room): void {
    const message: ServerMessage = {
      type: 'state',
      snapshot: toSnapshot(room.game),
      clock: room.clock?.snapshot() ?? null,
    };
    this.broadcast(room, message);
    for (const id of room.spectators) this.sessions.get(id)?.transport.send(message);
  }

  private announceSeats(room: Room): void {
    const message: ServerMessage = { type: 'seats', seats: this.wireSeats(room) };
    this.broadcast(room, message);
    for (const id of room.spectators) this.sessions.get(id)?.transport.send(message);
  }

  private announceSpectators(room: Room): void {
    const message: ServerMessage = { type: 'spectators', count: room.spectators.size };
    this.broadcast(room, message);
    for (const id of room.spectators) this.sessions.get(id)?.transport.send(message);
  }

  private broadcast(room: Room, message: ServerMessage, exceptAccountId?: string): void {
    for (const seat of room.seats) {
      if (seat.accountId === exceptAccountId) continue;
      this.sessionFor(seat.accountId)?.transport.send(message);
    }
  }

  private fail(session: Session, code: ErrorCode, message: string): void {
    session.transport.send({ type: 'error', code, message });
  }

  /** A room with a match actually in progress, rather than one already decided. */
  private isLive(room: Room): boolean {
    return !room.settled && room.seats.length === 2 && room.game.status === 'playing';
  }

  private seatOf(session: Session): { room: Room; seat: Seat } | null {
    const room = session.roomCode ? this.rooms.get(session.roomCode) : undefined;
    if (!room) return null;
    const seat = room.seats.find((candidate) => candidate.accountId === session.accountId);
    return seat ? { room, seat } : null;
  }

  private sessionFor(accountId: string): Session | undefined {
    const id = this.byAccount.get(accountId);
    return id ? this.sessions.get(id) : undefined;
  }

  private removeFromQueues(sessionId: string): void {
    for (const queue of this.queues.values()) {
      const at = queue.findIndex((entry) => entry.sessionId === sessionId);
      if (at >= 0) queue.splice(at, 1);
    }
  }

  private queueKey(config: GameConfig, ranked: boolean): string {
    return `${configKey(config)}:${ranked ? 'ranked' : 'casual'}`;
  }

  private configFromQueueKey(key: string): GameConfig | null {
    const [variant, size, winLength] = key.split(':');
    const config = {
      variant,
      size: Number(size),
      winLength: Number(winLength),
    };
    return isGameConfig(config) ? config : null;
  }

  /** Ratings and statistics are keyed by mode id, or by config for a custom game. */
  private modeKeyFor(config: GameConfig): string {
    return modeForConfig(config)?.id ?? configKey(config);
  }

  /**
   * A fresh private-room code.
   *
   * Drawn from the CSPRNG rather than the injectable `random`: the code is the
   * only thing keeping an uninvited player out of a private room, and a
   * non-cryptographic generator's state can be recovered from a handful of
   * observed outputs, which would make every later code predictable.
   */
  private generateCode(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('Could not allocate a free room code');
  }

  private consumeToken(session: Session): boolean {
    const now = this.now();
    const refill = ((now - session.lastRefill) / 1000) * this.messagesPerSecond;
    session.tokens = Math.min(this.messageBurst, session.tokens + refill);
    session.lastRefill = now;

    if (session.tokens < 1) return false;
    session.tokens -= 1;
    return true;
  }

  private consumeEmoteToken(session: Session): boolean {
    const now = this.now();
    const refill = ((now - session.emoteRefill) / 1000) * EMOTES_PER_SECOND;
    session.emoteTokens = Math.min(EMOTE_BURST, session.emoteTokens + refill);
    session.emoteRefill = now;

    if (session.emoteTokens < 1) return false;
    session.emoteTokens -= 1;
    return true;
  }
}

export function toSnapshot(game: GameState): Snapshot {
  return {
    config: game.config,
    board: [...game.board],
    currentPlayer: game.currentPlayer,
    status: game.status,
    winner: game.winner,
    winLine: game.winLine ? [...game.winLine] : null,
    lastMove: game.lastMove,
    moves: [...game.moves],
    ultimate: game.ultimate
      ? {
          boards: [...game.ultimate.boards],
          drawn: [...game.ultimate.drawn],
          activeBoard: game.ultimate.activeBoard,
          winBoards: game.ultimate.winBoards
            ? ([...game.ultimate.winBoards] as [number, number, number])
            : null,
        }
      : null,
  };
}

export { PLACEMENT_GAMES };
export type { AccountRow, Clock };
