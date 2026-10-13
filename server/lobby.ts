import { randomInt, randomUUID } from 'node:crypto';
import {
  applyMove,
  type BotDifficulty,
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
  replay,
  startingPlayerOf,
  withSeed,
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
import type {
  Activity,
  ArrangedMatch,
  BotBackfillOptions,
  LiveGame,
  LobbyExtension,
} from './lobby-hooks.js';
import { log } from './log.js';
import { Matchmaker, type QueueEntry } from './matchmaker.js';
import type { PersistedRoom, SocialHooks } from './social-hooks.js';
import {
  type GlickoInput,
  isProvisional,
  PLACEMENT_GAMES,
  type RatingOutcome,
  updateRatings,
} from './rating.js';
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
  /** How long a connection may stay open without completing `hello`. */
  helloTimeoutMs?: number;
  /** Token bucket: burst size and refill rate for inbound messages. */
  messageBurst?: number;
  messagesPerSecond?: number;
  /** Hard ceilings, so one client cannot grow the maps without bound. */
  maxSessions?: number;
  maxRooms?: number;
  maxSpectatorsPerRoom?: number;
  /** Turn timers off entirely, which private rooms may want. */
  clocksEnabled?: boolean;
  /** Offer a server bot to a player who has waited too long. Off when absent. */
  bots?: BotBackfillOptions;
}

const DEFAULT_RECONNECT_GRACE_MS = 45_000;
const DEFAULT_ABANDON_AFTER_MS = 60_000;
const DEFAULT_HELLO_TIMEOUT_MS = 10_000;
const DEFAULT_MESSAGE_BURST = 30;
const DEFAULT_MESSAGES_PER_SECOND = 10;
const DEFAULT_MAX_SESSIONS = 5000;
const DEFAULT_MAX_ROOMS = 2000;
const DEFAULT_MAX_SPECTATORS = 50;
/** Plies a spectator of a rated game is kept behind the live position. See `watcherSnapshot`. */
export const SPECTATOR_LAG_PLIES = 2;

/** Emotes get their own, far tighter bucket than ordinary messages. */
const EMOTE_BURST = 3;
const EMOTES_PER_SECOND = 0.34;

export { ratingBand } from './matchmaker.js';

/** Glicko-2 input from a stored row. */
function glickoOf(stats: {
  ratingExact: number;
  rd: number;
  volatility: number;
  ratedAt: number | null;
}): GlickoInput {
  return {
    rating: stats.ratingExact,
    rd: stats.rd,
    volatility: stats.volatility,
    ratedAt: stats.ratedAt,
  };
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
  /** Waiting players, by rule set and ladder, indexed by rating. */
  private readonly matchmaker = new Matchmaker();
  /** Seasons, bots, tournaments, anti-cheat: whatever has been plugged in. */
  private readonly extensions: LobbyExtension[] = [];
  /** Moderation, friends and live-room persistence plug in here (`social-hooks.ts`). */
  social: SocialHooks = {};
  private readonly bots: BotBackfillOptions | null;

  private readonly now: () => number;
  private readonly random: () => number;
  private readonly newId: () => string;
  private readonly reconnectGraceMs: number;
  private readonly abandonAfterMs: number;
  private readonly helloTimeoutMs: number;
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
    this.helloTimeoutMs = options.helloTimeoutMs ?? DEFAULT_HELLO_TIMEOUT_MS;
    this.messageBurst = options.messageBurst ?? DEFAULT_MESSAGE_BURST;
    this.messagesPerSecond = options.messagesPerSecond ?? DEFAULT_MESSAGES_PER_SECOND;
    this.maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS;
    this.maxRooms = options.maxRooms ?? DEFAULT_MAX_ROOMS;
    this.maxSpectators = options.maxSpectatorsPerRoom ?? DEFAULT_MAX_SPECTATORS;
    this.clocksEnabled = options.clocksEnabled ?? true;
    this.bots = options.bots ?? null;
  }

  /** Plug in a competitive system. See `lobby-hooks.ts`. */
  use(extension: LobbyExtension): void {
    this.extensions.push(extension);
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
    return this.matchmaker.size;
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
      connectedAt: this.now(),
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
    this.stopWatching(session);

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
    // A bot is always there, so it never keeps a room open on its own.
    if (room.seats.every((candidate) => !candidate.connected || candidate.bot)) {
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
    this.closeUnintroduced();
    this.flushQueues();
    this.checkClocks();
    this.checkAbandoned();
    this.sweepRooms();
    const now = this.now();
    for (const extension of this.extensions) {
      try {
        extension.tick?.(now);
      } catch (error) {
        log.exception('lobby.extension.tick', error);
      }
    }
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
        this.onQueue(session, message.config, message.ranked, message.bots ?? true);
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
      case 'challenge':
        if (this.social.challenge)
          this.social.challenge(session, message.accountId, message.config);
        else this.fail(session, 'forbidden', 'Challenges are not available here.');
        return;
      case 'berserk':
        this.onBerserk(session);
        return;
      case 'tournamentJoin':
      case 'tournamentLeave':
      case 'tournamentCreate':
      case 'tournamentStart':
        this.delegate(session, message);
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

    // A suspended account is told why and closed. Checked only after the
    // credentials, so the answer says nothing to someone who does not hold them.
    const refusal = this.social.refuse?.(account.id) ?? null;
    if (refusal) {
      log.warn('auth.refused', { sessionId: session.id, accountId: account.id });
      this.fail(session, 'banned', refusal);
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
      previous.connected = false;
      this.sessions.delete(previous.id);
      this.removeFromQueues(previous.id);
      // The socket's own close event will find this session already replaced
      // and do nothing, so anything it was watching has to be let go here.
      this.stopWatching(previous);
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

    const room = this.roomOf(session.accountId);
    const seat = room?.seats.find((candidate) => candidate.accountId === session.accountId);
    if (!room || !seat) return;

    // Whoever is to move has been losing time to a clock they could not see.
    // It kept running on purpose - a disconnection is not a pause button, or
    // it would be the cheapest way out of a lost position there is.
    this.rejoin(room, seat, session);
    log.info('room.resume', { accountId: session.accountId, room: room.code });
  }

  /** Put `session` back into a seat that was held open for it. */
  private rejoin(room: Room, seat: Seat, session: Session): void {
    seat.connected = true;
    seat.disconnectedAt = null;
    if (session.account) seat.account = session.account;
    session.roomCode = room.code;
    room.vacantSince = null;

    // A host who dropped while still waiting for a friend goes back to
    // waiting. A `matched` for a room with one seat in it would show them a
    // board with nobody on the other side of it.
    if (room.seats.length < 2) {
      session.transport.send({ type: 'roomCreated', code: room.code, config: room.config });
      this.announceSeats(room);
      return;
    }

    this.sendMatched(room, session);
    if (room.result) session.transport.send({ type: 'result', result: room.result });
    this.announceSeats(room);

    // Anything the opponent asked for while this side was away still stands,
    // and the banner for it went to a socket that is no longer there.
    const other = room.seats.find((candidate) => candidate.accountId !== seat.accountId);
    if (this.isLive(room)) {
      if (other?.offeredDraw) session.transport.send({ type: 'drawOffered' });
    } else if (other?.wantsRematch) {
      session.transport.send({ type: 'rematchOffered' });
    }
  }

  // ---------------------------------------------------------------------------
  // Matchmaking
  // ---------------------------------------------------------------------------

  private onQueue(session: Session, config: GameConfig, ranked: boolean, bots = true): void {
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

    const modeKey = this.modeKeyFor(config);
    const rating = this.accounts.statsFor(session.accountId, modeKey).rating;
    const entry: QueueEntry = {
      sessionId: session.id,
      accountId: session.accountId,
      rating,
      joinedAt: this.now(),
      bots,
    };

    const opponent = this.matchmaker.find(config, ranked, entry, this.now(), (candidate) =>
      this.waiting(candidate),
    );
    if (!opponent) {
      this.matchmaker.add(config, ranked, entry);
      const waiting = this.matchmaker.poolSize(config, ranked);
      session.transport.send({
        type: 'searching',
        config,
        ranked,
        queued: waiting,
        botAt: this.botAt(entry, ranked),
      });
      log.info('queue.join', {
        accountId: session.accountId,
        mode: modeKey,
        ranked,
        rating,
        waiting,
      });
      return;
    }

    this.matchmaker.remove(opponent.sessionId);
    this.pair(config, ranked, opponent, entry);
  }

  /** Whether a queue entry's connection is still there to be matched. */
  private waiting(entry: QueueEntry): boolean {
    return this.sessions.get(entry.sessionId)?.connected === true;
  }

  /** When a bot will be offered to `entry`, or `null` if never. */
  private botAt(entry: QueueEntry, ranked: boolean): number | null {
    if (!this.bots || !entry.bots) return null;
    const after = ranked ? this.bots.rankedAfterMs : this.bots.casualAfterMs;
    return after === null ? null : entry.joinedAt + after;
  }

  /**
   * Re-run matchmaking for everyone waiting, now that the bands have widened,
   * and offer a bot to whoever has waited past the backfill time.
   *
   * The longest waiter in each queue is matched first: a casual game takes
   * them outright, a ranked one only inside a band that widens with whichever
   * of the two has waited longer (see `Matchmaker`).
   */
  private flushQueues(): void {
    const now = this.now();
    for (const pool of this.matchmaker.allPools()) {
      // A snapshot: pairing removes entries, and a bot that could not be
      // given puts one back.
      for (const entry of Array.from(pool.order)) {
        // Paired, or dropped, earlier in this same sweep.
        if (!this.matchmaker.has(entry.sessionId)) continue;
        if (!this.waiting(entry)) {
          this.matchmaker.remove(entry.sessionId);
          continue;
        }

        const partner = this.matchmaker.find(pool.config, pool.ranked, entry, now, (candidate) =>
          this.waiting(candidate),
        );
        if (partner) {
          this.matchmaker.remove(entry.sessionId);
          this.matchmaker.remove(partner.sessionId);
          this.pair(pool.config, pool.ranked, partner, entry);
          continue;
        }

        const botAt = this.botAt(entry, pool.ranked);
        if (botAt !== null && now >= botAt) {
          this.matchmaker.remove(entry.sessionId);
          this.pairWithBot(pool.config, pool.ranked, entry);
        }
      }
    }
  }

  /**
   * Seat a player who has waited long enough opposite a server bot.
   *
   * Always unrated, whichever queue it came from, and the bot's seat says what
   * it is: nobody should find out afterwards that the opponent they thought
   * they had beaten was a program.
   */
  private pairWithBot(config: GameConfig, ranked: boolean, entry: QueueEntry): void {
    const session = this.sessions.get(entry.sessionId);
    if (!session) return;

    const pick = this.bots?.provider.pick(entry.rating, config) ?? null;
    if (!pick) {
      // No bot to give. Keep waiting for a person, without asking again.
      this.matchmaker.add(config, ranked, { ...entry, bots: false });
      return;
    }

    const room = this.openRoom(config, 'casual');
    if (!room) {
      this.fail(session, 'serverFull', 'The server is busy. Try again in a moment.');
      return;
    }

    this.seat(room, session);
    this.seatBot(room, pick.account, pick.difficulty, pick.rating);
    this.beginGame(room);
    log.info('match.bot', {
      room: room.code,
      mode: room.mode,
      fromRanked: ranked,
      difficulty: pick.difficulty,
      waitedMs: this.now() - entry.joinedAt,
    });
  }

  private seatBot(
    room: Room,
    account: AccountRow,
    difficulty: BotDifficulty,
    rating: number,
  ): void {
    room.seats.push({
      accountId: account.id,
      player: room.seats.length === 0 ? X : O,
      account,
      connected: true,
      wantsRematch: false,
      offeredDraw: false,
      mayOfferDraw: false,
      ratingBefore: rating,
      disconnectedAt: null,
      bot: difficulty,
    });
  }

  private pair(config: GameConfig, ranked: boolean, first: QueueEntry, second: QueueEntry): void {
    const firstSession = this.sessions.get(first.sessionId);
    const secondSession = this.sessions.get(second.sessionId);
    if (!firstSession || !secondSession) {
      // Both entries are already out of the queue. Whoever is still here goes
      // back to the front of it, keeping the wait they had already put in.
      const survivor = firstSession ? first : secondSession ? second : null;
      if (survivor) this.requeue(config, ranked, survivor);
      return;
    }

    const room = this.openRoom(config, ranked ? 'ranked' : 'casual');
    if (!room) {
      // Neither is in the queue any more, so both have to be told; one left
      // silently waiting would sit on a "searching" screen for ever.
      for (const session of [firstSession, secondSession]) {
        this.fail(session, 'serverFull', 'The server is busy. Try again in a moment.');
      }
      return;
    }

    this.seat(room, firstSession);
    this.seat(room, secondSession);
    this.matchmaker.recordPairing(first.accountId, second.accountId);
    this.beginGame(room);
    log.info('match.start', {
      room: room.code,
      mode: room.mode,
      kind: room.kind,
      ratingGap: Math.abs(first.rating - second.rating),
    });
  }

  private requeue(config: GameConfig, ranked: boolean, entry: QueueEntry): void {
    // The entry keeps its original `joinedAt`, so the wait already put in counts.
    if (!this.matchmaker.has(entry.sessionId)) this.matchmaker.add(config, ranked, entry);
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

      this.rejoin(room, existing, session);
      return;
    }

    if (room.seats.length >= 2) {
      this.fail(session, 'roomFull', 'That game already has two players.');
      return;
    }

    // A host whose connection has dropped is not there to play. Starting the
    // game anyway would run their clock and then award it on abandonment to a
    // guest who has done nothing but turn up, so the room is treated as gone
    // until the host is back.
    if (room.seats.some((seat) => !seat.connected)) {
      this.fail(session, 'roomNotFound', 'The host of that game is not here right now.');
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
    if (room.result) session.transport.send({ type: 'result', result: room.result });
    this.announceSpectators(room);
  }

  /**
   * Walk out of whatever this session is in.
   *
   * `silent` is for a session that is leaving in order to do something else -
   * queue, open a room, join or watch another - and is about to be told about
   * that instead. It keeps the frames about the old room away from the leaver,
   * whose screen has already moved on; the opponent is told either way, since
   * from their side of the board it makes no difference why the other player
   * went.
   */
  private onLeave(session: Session, options: { silent?: boolean } = {}): void {
    this.removeFromQueues(session.id);
    this.stopWatching(session);

    const room = session.roomCode ? this.rooms.get(session.roomCode) : undefined;
    session.roomCode = null;
    if (!room) return;

    // Walking out of a game in progress is a resignation, not an exit: a player
    // who is losing must not be able to escape the result by closing the tab.
    if (this.isLive(room)) {
      const seat = room.seats.find((candidate) => candidate.accountId === session.accountId);
      if (seat) {
        this.settle(
          room,
          { winner: opponentOf(seat.player), reason: 'resign' },
          options.silent ? (session.accountId ?? undefined) : undefined,
        );
      }
    }

    room.seats = room.seats.filter((seat) => seat.accountId !== session.accountId);

    if (room.seats.length === 0) {
      this.closeRoom(room);
      return;
    }

    this.broadcast(room, { type: 'opponentLeft' });
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
    this.applySeatMove(found.room, found.seat, index, session);
  }

  /**
   * Play a move for a bot seat, if the game is still the one it was computed
   * for. `game` is the state the bot was shown: any move or new game since
   * replaces the room's state object, so a stale answer is simply dropped.
   */
  playFor(code: string, accountId: string, index: number, game: GameState): boolean {
    const room = this.rooms.get(code);
    const seat = room?.seats.find(
      (candidate) => candidate.accountId === accountId && candidate.bot,
    );
    if (!room || !seat || room.game !== game) return false;
    return this.applySeatMove(room, seat, index, null);
  }

  /** The move itself, for a person (`session`) or a bot (`null`). */
  private applySeatMove(room: Room, seat: Seat, index: number, session: Session | null): boolean {
    const fail = (code: ErrorCode, message: string) => {
      if (session) this.fail(session, code, message);
      return false;
    };

    if (room.seats.length < 2) return fail('notInRoom', 'You are not in a game.');

    // `settled` and a finished board are not the same thing: a match decided on
    // time, by resignation or by abandonment leaves a board that is still
    // mid-game. Without this check those boards would keep accepting moves
    // after the result had already been recorded.
    if (room.settled || room.game.status !== 'playing') {
      return fail('notYourTurn', 'This match is over.');
    }
    if (room.game.currentPlayer !== seat.player) {
      return fail('notYourTurn', 'It is not your turn.');
    }

    // The clock is checked before the move, not after: a move that arrives
    // after the flag has fallen is too late, however legal it is.
    if (room.clock?.flagged() === seat.player) {
      this.settle(room, { winner: opponentOf(seat.player), reason: 'timeout' });
      return false;
    }

    const next = applyMove(room.game, index);
    if (!next) return fail('illegalMove', 'That move is not allowed here.');

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
      this.turn(room);
      return true;
    }

    room.clock?.stop();
    this.broadcastState(room);
    this.settle(room, {
      winner: next.winner,
      reason: next.status === 'draw' ? 'draw' : 'line',
    });
    return true;
  }

  /** Tell the extensions a position is waiting for a move. */
  private turn(room: Room): void {
    for (const extension of this.extensions) {
      try {
        extension.turn?.(room);
      } catch (error) {
        log.exception('lobby.extension.turn', error, { room: room.code });
      }
    }
  }

  /** Hand a message the lobby does not handle itself to whichever extension does. */
  private delegate(session: Session, message: ClientMessage): void {
    for (const extension of this.extensions) {
      if (extension.message?.(session, message)) return;
    }
    this.fail(session, 'tournamentUnavailable', 'Tournaments are not running on this server.');
  }

  /**
   * Berserk, in an arena game that allows it: before your first move, give up
   * half your clock and your increment for a bonus point if you win.
   */
  private onBerserk(session: Session): void {
    const found = this.seatOf(session);
    if (!found) return;
    const { room, seat } = found;
    if (!room.tournament?.berserk || !this.isLive(room) || !room.clock) return;

    room.berserk ??= new Set();
    if (room.berserk.has(seat.player)) return;
    const starter = startingPlayerOf(room.game);
    const own = Math.floor((room.game.moves.length + (starter === seat.player ? 1 : 0)) / 2);
    if (own > 0) return;

    room.clock.halve(seat.player);
    room.berserk.add(seat.player);
    const message: ServerMessage = { type: 'berserk', player: seat.player };
    this.broadcast(room, message);
    for (const id of room.spectators) this.sessions.get(id)?.transport.send(message);
    this.broadcastState(room);
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

    // A bot plays on. It answers at once, rather than leaving the offer
    // hanging over a game whose other side will never read it.
    if (found.room.seats.some((candidate) => candidate.bot)) {
      found.seat.mayOfferDraw = false;
      session.transport.send({ type: 'drawDeclined' });
      return;
    }

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
    // A rematch is for a finished game. Asking mid-game is a client bug. The
    // board alone cannot say which that is: a game decided by resignation, on
    // time, by abandonment or by agreement leaves it mid-game for good.
    if (this.isLive(room)) return;
    // A tournament decides who plays whom next, not the two players.
    if (room.tournament) return;

    seat.wantsRematch = true;
    // A bot is always up for another game.
    for (const candidate of room.seats) if (candidate.bot) candidate.wantsRematch = true;
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
    // A muted account's emotes go nowhere. The sender is not told, for the same
    // reason a player muted by their opponent is not.
    if (this.social.isMuted?.(found.seat.accountId)) return;

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

      this.guarded(room, 'timeout', () => {
        this.settle(room, { winner: opponentOf(flagged), reason: 'timeout' });
        log.info('match.timeout', { room: room.code, loser: flagged });
      });
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

      // If both sides have walked away there is nobody here to award it to;
      // `sweepRooms` scores it once the grace period for coming back is over.
      const present = room.seats.find((seat) => seat.accountId !== gone.accountId);
      if (!present?.connected) continue;

      this.guarded(room, 'abandoned', () => {
        this.settle(room, { winner: present.player, reason: 'abandoned' });
        log.info('match.abandoned', { room: room.code, accountId: gone.accountId });
      });
    }
  }

  /** Drop rooms whose players have all been gone longer than the grace period. */
  private sweepRooms(): void {
    const cutoff = this.now() - this.reconnectGraceMs;
    for (const [code, room] of this.rooms) {
      if (room.vacantSince === null || room.vacantSince > cutoff) continue;
      // Scored before it goes, or a game both sides walked away from would
      // vanish from both records - which, for whoever was losing it, is a
      // rating loss avoided by closing the lid.
      if (this.isLive(room)) this.guarded(room, 'deserted', () => this.settleDeserted(room));
      this.closeRoom(room);
      this.rooms.delete(code);
    }
  }

  /**
   * One room's housekeeping failing - the database refusing a write, say -
   * must not stop it for every other room. The step is logged; an unsettled
   * room is tried again on the next tick.
   */
  private guarded(room: Room, step: string, work: () => void): void {
    try {
      work();
    } catch (error) {
      log.exception('room.tick.failed', error, { room: room.code, step });
    }
  }

  /**
   * Score a game both players walked away from.
   *
   * It goes to whoever stayed longer. The first to leave abandoned a game the
   * other was still there to play, which is exactly what `checkAbandoned`
   * punishes when only one side goes; the second leaving afterwards does not
   * undo that. When both dropped at the same instant - the server's own
   * network going, say - there is nobody to hold responsible, so it is a draw
   * rather than a win handed out at random.
   */
  private settleDeserted(room: Room): void {
    const [first, second] = room.seats;
    if (!first || !second) return;

    const firstLeft = first.disconnectedAt ?? this.now();
    const secondLeft = second.disconnectedAt ?? this.now();
    const winner =
      firstLeft === secondLeft ? null : firstLeft > secondLeft ? first.player : second.player;

    this.settle(room, { winner, reason: 'abandoned' });
    log.info('match.deserted', { room: room.code, winner });
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
  private settle(room: Room, outcome: Outcome, quietFor?: string): void {
    if (room.settled) return;

    const x = room.seats.find((seat) => seat.player === X);
    const o = room.seats.find((seat) => seat.player === O);
    if (!x || !o) {
      room.settled = true;
      room.clock?.stop();
      return;
    }

    const ranked = room.kind === 'ranked';
    const score = outcome.winner === null ? 0.5 : outcome.winner === X ? 1 : 0;
    const seasonId = this.seasonId();

    const xStats = this.accounts.statsFor(x.accountId, room.mode);
    const oStats = this.accounts.statsFor(o.accountId, room.mode);

    let rating: MatchResult['rating'] = null;
    let next: RatingOutcome | null = null;
    if (ranked) {
      // Glicko-2: each side's uncertainty - grown by any time away - decides
      // how far this one result moves it.
      next = updateRatings(glickoOf(xStats), glickoOf(oStats), score, this.now());
      rating = {
        x: { before: xStats.rating, after: Math.round(next.x.rating) },
        o: { before: oStats.rating, after: Math.round(next.o.rating) },
      };
    }

    // Casual and private games count towards played/won/lost but never move a
    // rating: mixing them would make the ladder a measure of how much somebody
    // played rather than how well.
    const xOutcome = outcome.winner === null ? 'draw' : outcome.winner === X ? 'win' : 'loss';
    const oOutcome = xOutcome === 'draw' ? 'draw' : xOutcome === 'win' ? 'loss' : 'win';

    // One transaction for every row the result touches. A failure part-way
    // through rolls all of it back and leaves the room unsettled, rather than
    // marking it decided with half a result written - or none at all.
    // A bot's own record is not kept: its strength is set by hand, and a bot
    // collecting wins and achievements would only be noise in the tables.
    const {
      id: matchId,
      xAfter,
      oAfter,
    } = this.accounts.transaction(() => {
      const xRecorded = x.bot
        ? xStats
        : this.accounts.recordResult(
            x.accountId,
            room.mode,
            xOutcome,
            next ? next.x : xStats.rating,
            ranked,
            seasonId,
          );
      const oRecorded = o.bot
        ? oStats
        : this.accounts.recordResult(
            o.accountId,
            room.mode,
            oOutcome,
            next ? next.o : oStats.rating,
            ranked,
            seasonId,
          );

      const id = this.matches.record({
        mode: room.mode,
        // The game's config, not the room's: it carries the seed a replay
        // needs to rebuild the same board.
        config: room.game.config,
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

      if (!x.bot) this.grantAchievements(x.accountId, xRecorded, xOutcome === 'win', room, outcome);
      if (!o.bot) this.grantAchievements(o.accountId, oRecorded, oOutcome === 'win', room, outcome);
      return { id, xAfter: xRecorded, oAfter: oRecorded };
    });

    room.settled = true;
    room.clock?.stop();

    // What the result screen needs for a placement counter and a "still
    // settling" note, on top of the bare before and after.
    if (rating && next) {
      rating = {
        x: {
          ...rating.x,
          rd: Math.round(next.x.rd),
          provisional: isProvisional(next.x.rd),
          seasonPlayed: xAfter.seasonPlayed,
          placementGames: PLACEMENT_GAMES,
        },
        o: {
          ...rating.o,
          rd: Math.round(next.o.rd),
          provisional: isProvisional(next.o.rd),
          seasonPlayed: oAfter.seasonPlayed,
          placementGames: PLACEMENT_GAMES,
        },
      };
    }

    const result: MatchResult = {
      matchId,
      winner: outcome.winner,
      reason: outcome.reason,
      kind: room.kind,
      rating,
    };
    room.result = result;

    this.broadcastState(room, quietFor);
    this.broadcast(room, { type: 'result', result }, quietFor);
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

    for (const extension of this.extensions) {
      try {
        extension.settled?.({ matchId, room, outcome, x, o, result });
      } catch (error) {
        log.exception('lobby.extension.settled', error, { room: room.code, matchId });
      }
    }
  }

  /** The season ranked games currently count towards, if seasons are running. */
  private seasonId(): number | undefined {
    for (const extension of this.extensions) {
      const id = extension.seasonId?.();
      if (id !== undefined) return id;
    }
    return undefined;
  }

  private grantAchievements(
    accountId: string,
    stats: { played: number; won: number; streak: number; rating: number },
    won: boolean,
    room: Room,
    outcome: Outcome,
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
        reason: outcome.reason,
        moveCount: room.game.moves.length,
        winLength: room.config.winLength,
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Room plumbing
  // ---------------------------------------------------------------------------

  private openRoom(config: GameConfig, kind: MatchKind, code?: string): Room | null {
    if (this.rooms.size >= this.maxRooms) return null;

    const room: Room = {
      code: code ?? this.generateCode(),
      config,
      mode: this.modeKeyFor(config),
      kind,
      seats: [],
      // Seeded rule sets lay out their board from the game's own seed, so each
      // game gets a fresh one; the room keeps the mode's unseeded config.
      game: createGame(withSeed(config, this.random), randomStartingPlayer(this.random)),
      clock: null,
      spectators: new Set(),
      vacantSince: null,
      startedAt: this.now(),
      lastMoveAt: this.now(),
      moveTimesMs: [],
      settled: true,
      result: null,
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

    room.game = createGame(withSeed(room.config, this.random), randomStartingPlayer(this.random));
    room.startedAt = this.now();
    room.lastMoveAt = this.now();
    room.moveTimesMs = [];
    room.settled = false;
    room.result = null;

    room.berserk = new Set();
    for (const seat of room.seats) {
      // A bot shows the nominal rating of its level, which never changes.
      if (!seat.bot) seat.ratingBefore = this.accounts.statsFor(seat.accountId, room.mode).rating;
      seat.wantsRematch = false;
      seat.offeredDraw = false;
      seat.mayOfferDraw = !seat.bot;
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
    this.turn(room);
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
    // A mute is about one opponent. Carried into the next room it would hide a
    // stranger's emotes behind a switch the client has already shown as off.
    session.muted = false;
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
      snapshot: seat ? toSnapshot(room.game) : this.watcherSnapshot(room),
      clock: room.clock?.snapshot() ?? null,
      spectators: room.spectators.size,
      tournament: room.tournament ?? null,
      berserk: [...(room.berserk ?? [])],
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

  private broadcastState(room: Room, exceptAccountId?: string): void {
    const clock = room.clock?.snapshot() ?? null;
    const message: ServerMessage = { type: 'state', snapshot: toSnapshot(room.game), clock };
    this.broadcast(room, message, exceptAccountId);
    if (room.spectators.size === 0) return;
    const watched: ServerMessage = { type: 'state', snapshot: this.watcherSnapshot(room), clock };
    for (const id of room.spectators) this.sessions.get(id)?.transport.send(watched);
  }

  /**
   * The position a spectator is shown.
   *
   * A watcher of a rated game could otherwise run an engine on the live
   * position and pass its answer to a player. Showing rated games a couple of
   * plies behind makes any such answer one for a position that no longer
   * exists, at no cost to anyone watching for fun. Casual and private games,
   * and every finished game, are shown as they are.
   */
  private watcherSnapshot(room: Room): Snapshot {
    const rated = room.kind === 'ranked' || Boolean(room.tournament);
    const moves = room.game.moves;
    if (!rated || !this.isLive(room) || moves.length === 0) return toSnapshot(room.game);
    const shown = replay(
      room.game.config,
      startingPlayerOf(room.game),
      moves.slice(0, Math.max(0, moves.length - SPECTATOR_LAG_PLIES)),
    );
    return toSnapshot(shown ?? room.game);
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

  private stopWatching(session: Session): void {
    const watching = session.spectating ? this.rooms.get(session.spectating) : undefined;
    session.spectating = null;
    if (!watching) return;
    watching.spectators.delete(session.id);
    this.announceSpectators(watching);
  }

  /**
   * Close connections that have not introduced themselves in time.
   *
   * Every one costs a socket and a slot under the session ceiling, and one
   * that never sends `hello` could hold both for as long as it answered pings.
   * No error goes with the close: a real client that was merely slow should
   * reconnect as it would after any drop, and the `unauthorized` it would
   * otherwise get tells it to stop trying.
   */
  private closeUnintroduced(): void {
    const cutoff = this.now() - this.helloTimeoutMs;
    for (const session of this.sessions.values()) {
      if (session.accountId || session.connectedAt > cutoff) continue;
      log.info('conn.helloTimeout', { sessionId: session.id });
      session.transport.close();
      this.disconnect(session);
    }
  }

  private removeFromQueues(sessionId: string): void {
    this.matchmaker.remove(sessionId);
  }

  // ---------------------------------------------------------------------------
  // For the competitive extensions
  // ---------------------------------------------------------------------------

  /**
   * Seat two connected players in a game neither queued for - a tournament
   * pairing. Returns the room code, or `null` if either is not free to play.
   *
   * A player still sitting in a finished room is moved out of it; a player in
   * a game that is still going is never pulled out of it.
   */
  arrange(request: ArrangedMatch): string | null {
    if (!isGameConfig(request.config)) return null;
    const sessions: Session[] = [];
    for (const accountId of request.accountIds) {
      const session = this.sessionFor(accountId);
      if (!session?.connected || !session.account) return null;
      const current = session.roomCode ? this.rooms.get(session.roomCode) : undefined;
      if (current && this.isLive(current)) return null;
      sessions.push(session);
    }
    if (sessions.length !== 2 || sessions[0] === sessions[1]) return null;

    const room = this.openRoom(request.config, request.kind);
    if (!room) return null;
    for (const session of sessions) this.onLeave(session, { silent: true });

    room.tournament = request.tournament ?? null;
    for (const session of sessions) this.seat(room, session);
    this.beginGame(room);
    log.info('match.arranged', { room: room.code, tournament: room.tournament?.id ?? null });
    return room.code;
  }

  /** Where an account is right now. */
  activity(accountId: string): Activity {
    const session = this.sessionFor(accountId);
    const room = session?.roomCode ? this.rooms.get(session.roomCode) : undefined;
    return {
      online: session?.connected === true,
      queued: session ? this.matchmaker.has(session.id) : false,
      room: room?.code ?? null,
      live: room ? this.isLive(room) : false,
      finishedAt: room?.settled && room.result ? room.lastMoveAt : null,
    };
  }

  // ---------------------------------------------------------------------------
  // For the social and operations layers (see social-hooks.ts)
  // ---------------------------------------------------------------------------

  /**
   * Open a private room with `session` seated in it, exactly as `createRoom`
   * does, and return its code - or `null` if it could not be opened, in which
   * case the session has already been told why.
   */
  openPrivateRoom(session: Session, config: GameConfig): string | null {
    this.onCreateRoom(session, config);
    const room = session.roomCode ? this.rooms.get(session.roomCode) : undefined;
    return room?.kind === 'private' && room.seats.length === 1 ? room.code : null;
  }

  /**
   * Take an account off the server: resign the game it is in (a ban or a
   * deletion must not leave an opponent waiting out an abandon timer), drop
   * its queue place, and close its connection with `message`.
   */
  evict(accountId: string, code: 'banned' | 'unauthorized', message: string): void {
    const session = this.sessionFor(accountId);
    if (session) {
      this.fail(session, code, message);
      this.onLeave(session, { silent: true });
      session.transport.close();
      this.disconnect(session);
      return;
    }

    // No connection, but perhaps a seat still held open for a reconnect.
    // Closing a room while iterating is safe: a Map visits each entry once.
    for (const room of this.rooms.values()) {
      const seat = room.seats.find((candidate) => candidate.accountId === accountId);
      if (!seat) continue;
      if (this.isLive(room)) {
        this.settle(room, { winner: opponentOf(seat.player), reason: 'resign' }, accountId);
      }
      room.seats = room.seats.filter((candidate) => candidate.accountId !== accountId);
      if (room.seats.length > 0) {
        this.broadcast(room, { type: 'opponentLeft' });
        for (const other of room.seats) {
          const otherSession = this.sessionFor(other.accountId);
          if (otherSession) otherSession.roomCode = null;
        }
      }
      this.closeRoom(room);
    }
  }

  /**
   * Every room worth carrying across a restart, as plain data: games between
   * two people in progress, and private rooms whose host is still waiting.
   * Decided games are already in the match records. Rooms with a bot seat or
   * a tournament pairing are left out: the bot driver and the tournament
   * clock that run them do not survive the restart either.
   */
  exportRooms(): PersistedRoom[] {
    const saved: PersistedRoom[] = [];
    for (const room of this.rooms.values()) {
      const waiting = room.kind === 'private' && room.seats.length === 1;
      if (!waiting && !this.isLive(room)) continue;
      if (room.tournament || room.seats.some((seat) => seat.bot !== undefined)) continue;
      saved.push({
        code: room.code,
        config: room.config,
        gameConfig: room.game.config,
        kind: room.kind,
        startingPlayer: startingPlayerOf(room.game),
        moves: [...room.game.moves],
        moveTimesMs: [...room.moveTimesMs],
        startedAt: room.startedAt,
        seats: room.seats.map((seat) => ({
          accountId: seat.accountId,
          player: seat.player,
          ratingBefore: seat.ratingBefore,
          mayOfferDraw: seat.mayOfferDraw,
        })),
        clock: room.clock?.toJSON() ?? null,
      });
    }
    return saved;
  }

  /**
   * Put a room written down by `exportRooms` back.
   *
   * Every seat comes back disconnected, so the ordinary reconnect flow does the
   * rest: a client's `hello` finds its seat and is put straight back into the
   * game, and a player who never returns is dealt with by the same abandon
   * and sweep rules as any other dropped connection. Refuses anything that
   * does not replay into a real game or names an account that no longer exists.
   */
  importRoom(saved: PersistedRoom): boolean {
    if (this.rooms.has(saved.code) || this.rooms.size >= this.maxRooms) return false;
    if (!isGameConfig(saved.config) || !isGameConfig(saved.gameConfig)) return false;
    if (saved.seats.length < 1 || saved.seats.length > 2) return false;

    const live = saved.seats.length === 2;
    const game = replay(saved.gameConfig, saved.startingPlayer, saved.moves);
    if (!game || (live && game.status !== 'playing')) return false;

    const accounts = saved.seats.map((seat) => this.accounts.get(seat.accountId));
    if (accounts.some((account) => account === null)) return false;
    for (const room of this.rooms.values()) {
      if (room.seats.some((seat) => saved.seats.some((s) => s.accountId === seat.accountId))) {
        return false;
      }
    }

    const room = this.openRoom(saved.config, saved.kind, saved.code);
    if (!room) return false;

    const at = this.now();
    room.game = game;
    room.startedAt = saved.startedAt;
    room.lastMoveAt = at;
    room.moveTimesMs = [...saved.moveTimesMs];
    room.settled = !live;
    room.vacantSince = at;
    room.clock =
      live && saved.clock && this.clocksEnabled ? MatchClock.restore(saved.clock, this.now) : null;
    room.seats = saved.seats.map((seat, index) => ({
      accountId: seat.accountId,
      player: seat.player,
      account: accounts[index]!,
      connected: false,
      wantsRematch: false,
      offeredDraw: false,
      mayOfferDraw: seat.mayOfferDraw,
      ratingBefore: seat.ratingBefore,
      disconnectedAt: at,
    }));
    return true;
  }

  /** Send a message to an account, if it is connected. */
  notify(accountId: string, message: ServerMessage): boolean {
    const session = this.sessionFor(accountId);
    if (!session?.connected) return false;
    session.transport.send(message);
    return true;
  }

  /**
   * Public games in progress, strongest first, for the "watch live" list.
   * Private rooms are never listed: their code is the invitation.
   */
  liveGames(limit = 30): LiveGame[] {
    const games: (LiveGame & { strength: number })[] = [];
    for (const room of this.rooms.values()) {
      if (room.kind === 'private' || !this.isLive(room)) continue;
      const x = room.seats.find((seat) => seat.player === X);
      const o = room.seats.find((seat) => seat.player === O);
      if (!x || !o) continue;
      games.push({
        code: room.code,
        mode: room.mode,
        kind: room.kind,
        config: room.config,
        x: toPublicProfile(x.account, x.ratingBefore),
        o: toPublicProfile(o.account, o.ratingBefore),
        moves: room.game.moves.length,
        spectators: room.spectators.size,
        startedAt: room.startedAt,
        tournament: room.tournament?.name ?? null,
        // Ranked first, then by the stronger player, so the list leads with
        // the games most worth watching.
        strength: (room.kind === 'ranked' ? 10_000 : 0) + Math.max(x.ratingBefore, o.ratingBefore),
      });
    }
    games.sort((a, b) => b.strength - a.strength || a.startedAt - b.startedAt);
    return games.slice(0, Math.max(0, limit)).map(({ strength: _strength, ...game }) => game);
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
    // Per-variant state travels as it is: it is plain data, already derived
    // from the moves, and the schema checks its shape on the way out.
    ...(game.extra ? { extra: structuredClone(game.extra) as Snapshot['extra'] } : {}),
  };
}

export { PLACEMENT_GAMES };
export type { AccountRow, Clock };
