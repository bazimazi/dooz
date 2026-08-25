import {
  applyMove,
  type BoardSize,
  createGame,
  type GameState,
  O,
  type Player,
  randomStartingPlayer,
  X,
} from '@dooz/engine';
import {
  type ClientMessage,
  type ErrorCode,
  PROTOCOL_VERSION,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type ServerMessage,
  type Snapshot,
} from '@dooz/protocol';
import type { Room, Seat, Session, Transport } from './types.js';

export interface LobbyOptions {
  /** Injectable clock so tests can advance time without waiting. */
  now?: () => number;
  random?: () => number;
  newId?: () => string;
  /** How long a seat is held open for a disconnected player, in milliseconds. */
  reconnectGraceMs?: number;
  /** Token bucket: burst size and refill rate for inbound messages. */
  messageBurst?: number;
  messagesPerSecond?: number;
}

const DEFAULT_RECONNECT_GRACE_MS = 45_000;
const DEFAULT_MESSAGE_BURST = 30;
const DEFAULT_MESSAGES_PER_SECOND = 10;

/**
 * Matchmaking and authoritative game state for every online game in progress.
 *
 * The server never accepts a board from a client, only a cell index, and
 * re-derives the next state itself. That is the reason the engine is a shared
 * package: both sides run identical rules, but only this side is believed.
 */
export class Lobby {
  private readonly sessions = new Map<string, Session>();
  private readonly rooms = new Map<string, Room>();
  /** Clients waiting for a public game, keyed by the board size they asked for. */
  private readonly queues = new Map<BoardSize, string[]>();

  private readonly now: () => number;
  private readonly random: () => number;
  private readonly newId: () => string;
  private readonly reconnectGraceMs: number;
  private readonly messageBurst: number;
  private readonly messagesPerSecond: number;

  constructor(options: LobbyOptions = {}) {
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.newId = options.newId ?? (() => crypto.randomUUID());
    this.reconnectGraceMs = options.reconnectGraceMs ?? DEFAULT_RECONNECT_GRACE_MS;
    this.messageBurst = options.messageBurst ?? DEFAULT_MESSAGE_BURST;
    this.messagesPerSecond = options.messagesPerSecond ?? DEFAULT_MESSAGES_PER_SECOND;
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
      name: 'Player',
      transport,
      roomCode: null,
      connected: true,
      tokens: this.messageBurst,
      lastRefill: this.now(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  disconnect(session: Session): void {
    session.connected = false;
    this.sessions.delete(session.id);
    this.removeFromQueues(session.id);

    const room = session.roomCode ? this.rooms.get(session.roomCode) : undefined;
    if (!room) return;

    const seat = room.seats.find((candidate) => candidate.clientId === session.id);
    if (seat) seat.connected = false;

    // The seat is held rather than freed, so a dropped connection (a phone
    // locking its screen, a tunnel switching networks) does not end the game.
    if (room.seats.every((candidate) => !candidate.connected)) {
      room.vacantSince = this.now();
    }
    this.announcePresence(room, session.id);
  }

  /** Drop rooms whose players have all been gone longer than the grace period. */
  sweep(): void {
    const cutoff = this.now() - this.reconnectGraceMs;
    for (const [code, room] of this.rooms) {
      if (room.vacantSince !== null && room.vacantSince <= cutoff) this.rooms.delete(code);
    }
  }

  handle(session: Session, message: ClientMessage): void {
    if (!this.consumeToken(session)) {
      this.fail(session, 'rateLimited', 'Slow down.');
      return;
    }

    switch (message.type) {
      case 'hello':
        this.onHello(session, message);
        return;
      case 'quickMatch':
        this.onQuickMatch(session, message.boardSize);
        return;
      case 'createRoom':
        this.onCreateRoom(session, message.boardSize);
        return;
      case 'joinRoom':
        this.onJoinRoom(session, message.code);
        return;
      case 'setName':
        this.onSetName(session, message.name);
        return;
      case 'leave':
        this.onLeave(session);
        return;
      case 'move':
        this.onMove(session, message.index);
        return;
      case 'rematch':
        this.onRematch(session);
        return;
      case 'ping':
        session.transport.send({ type: 'pong' });
        return;
    }
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  private onHello(session: Session, message: Extract<ClientMessage, { type: 'hello' }>): void {
    if (message.version !== PROTOCOL_VERSION) {
      this.fail(session, 'versionMismatch', 'Please reload to get the latest version.');
      session.transport.close();
      return;
    }

    if (message.name) session.name = message.name;

    // A returning client keeps its old id so it can slide back into its seat.
    if (message.clientId && message.clientId !== session.id) {
      this.sessions.delete(session.id);
      session.id = message.clientId;
      this.sessions.set(session.id, session);
    }

    session.transport.send({
      type: 'welcome',
      clientId: session.id,
      version: PROTOCOL_VERSION,
    });

    this.resumeRoom(session);
  }

  private onQuickMatch(session: Session, boardSize: BoardSize): void {
    this.onLeave(session, { silent: true });

    const queue = this.queues.get(boardSize) ?? [];
    this.queues.set(boardSize, queue);

    // Skip over anyone who dropped off while waiting.
    let opponent: Session | undefined;
    while (queue.length > 0 && !opponent) {
      const candidateId = queue.shift();
      if (candidateId === undefined || candidateId === session.id) continue;
      const candidate = this.sessions.get(candidateId);
      if (candidate?.connected) opponent = candidate;
    }

    if (!opponent) {
      queue.push(session.id);
      session.transport.send({ type: 'searching', boardSize });
      return;
    }

    const room = this.openRoom(boardSize, true);
    this.seat(room, opponent);
    this.seat(room, session);
    this.announceMatch(room);
  }

  private onCreateRoom(session: Session, boardSize: BoardSize): void {
    this.onLeave(session, { silent: true });
    const room = this.openRoom(boardSize, false);
    this.seat(room, session);
    session.transport.send({ type: 'roomCreated', code: room.code, boardSize });
  }

  private onJoinRoom(session: Session, code: string): void {
    const room = this.rooms.get(code);
    if (!room) {
      this.fail(session, 'roomNotFound', 'No game with that code.');
      return;
    }

    const existing = room.seats.find((seat) => seat.clientId === session.id);
    if (existing) {
      // Reconnecting into a seat that is still being held open.
      existing.connected = true;
      existing.name = session.name;
      session.roomCode = room.code;
      room.vacantSince = null;
      this.sendMatched(room, session);
      this.announcePresence(room, session.id);
      return;
    }

    if (room.seats.length >= 2) {
      this.fail(session, 'roomFull', 'That game already has two players.');
      return;
    }

    this.onLeave(session, { silent: true });
    this.seat(room, session);
    this.announceMatch(room);
  }

  private onSetName(session: Session, name: string): void {
    session.name = name;

    const room = session.roomCode ? this.rooms.get(session.roomCode) : undefined;
    const seat = room?.seats.find((candidate) => candidate.clientId === session.id);
    if (!room || !seat) return;

    seat.name = name;
    this.announcePresence(room, session.id);
  }

  private onLeave(session: Session, options: { silent?: boolean } = {}): void {
    this.removeFromQueues(session.id);

    const room = session.roomCode ? this.rooms.get(session.roomCode) : undefined;
    session.roomCode = null;
    if (!room) return;

    room.seats = room.seats.filter((seat) => seat.clientId !== session.id);

    if (room.seats.length === 0) {
      this.rooms.delete(room.code);
      return;
    }

    // Leaving deliberately ends the game for the other player; unlike a dropped
    // connection there is nothing left to wait for.
    if (!options.silent) this.broadcast(room, { type: 'opponentLeft' });
    this.rooms.delete(room.code);
    for (const seat of room.seats) {
      const other = this.sessions.get(seat.clientId);
      if (other) other.roomCode = null;
    }
  }

  private onMove(session: Session, index: number): void {
    const room = session.roomCode ? this.rooms.get(session.roomCode) : undefined;
    if (!room || room.seats.length < 2) {
      this.fail(session, 'notInRoom', 'You are not in a game.');
      return;
    }

    const seat = room.seats.find((candidate) => candidate.clientId === session.id);
    if (!seat) {
      this.fail(session, 'notInRoom', 'You are not in a game.');
      return;
    }

    if (room.game.status !== 'playing' || room.game.currentPlayer !== seat.player) {
      this.fail(session, 'notYourTurn', 'It is not your turn.');
      return;
    }

    const next = applyMove(room.game, index);
    if (!next) {
      this.fail(session, 'illegalMove', 'That square is taken.');
      return;
    }

    room.game = next;
    this.broadcast(room, { type: 'state', snapshot: toSnapshot(next) });
  }

  private onRematch(session: Session): void {
    const room = session.roomCode ? this.rooms.get(session.roomCode) : undefined;
    if (!room || room.seats.length < 2) {
      this.fail(session, 'notInRoom', 'You are not in a game.');
      return;
    }

    const seat = room.seats.find((candidate) => candidate.clientId === session.id);
    if (!seat) return;
    seat.wantsRematch = true;

    if (!room.seats.every((candidate) => candidate.wantsRematch)) {
      this.broadcast(room, { type: 'rematchOffered' }, session.id);
      return;
    }

    for (const candidate of room.seats) candidate.wantsRematch = false;
    room.game = createGame(room.boardSize, randomStartingPlayer(this.random));
    this.broadcast(room, { type: 'state', snapshot: toSnapshot(room.game) });
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private openRoom(boardSize: BoardSize, isPublic: boolean): Room {
    const room: Room = {
      code: this.generateCode(),
      boardSize,
      isPublic,
      seats: [],
      game: createGame(boardSize, randomStartingPlayer(this.random)),
      vacantSince: null,
    };
    this.rooms.set(room.code, room);
    return room;
  }

  private seat(room: Room, session: Session): Seat {
    // X is always the first seat, so whoever opened the room leads.
    const player: Player = room.seats.length === 0 ? X : O;
    const seat: Seat = {
      clientId: session.id,
      name: session.name,
      player,
      connected: true,
      wantsRematch: false,
    };
    room.seats.push(seat);
    session.roomCode = room.code;
    room.vacantSince = null;
    return seat;
  }

  private announceMatch(room: Room): void {
    for (const seat of room.seats) {
      const session = this.sessions.get(seat.clientId);
      if (session) this.sendMatched(room, session);
    }
  }

  private sendMatched(room: Room, session: Session): void {
    const seat = room.seats.find((candidate) => candidate.clientId === session.id);
    const other = room.seats.find((candidate) => candidate.clientId !== session.id);
    if (!seat) return;

    session.transport.send({
      type: 'matched',
      code: room.code,
      you: seat.player,
      opponent: {
        name: other?.name ?? 'Opponent',
        connected: other?.connected ?? false,
      },
      snapshot: toSnapshot(room.game),
    });
  }

  /** After a reconnect, put the client straight back into whatever it was in. */
  private resumeRoom(session: Session): void {
    for (const room of this.rooms.values()) {
      const seat = room.seats.find((candidate) => candidate.clientId === session.id);
      if (!seat) continue;

      seat.connected = true;
      seat.name = session.name;
      session.roomCode = room.code;
      room.vacantSince = null;
      this.sendMatched(room, session);
      this.announcePresence(room, session.id);
      return;
    }
  }

  /** Tell everyone but  how that seat now looks. */
  private announcePresence(room: Room, clientId: string): void {
    const seat = room.seats.find((candidate) => candidate.clientId === clientId);
    if (!seat) return;
    this.broadcast(
      room,
      { type: 'opponentPresence', opponent: { name: seat.name, connected: seat.connected } },
      clientId,
    );
  }

  private broadcast(room: Room, message: ServerMessage, exceptClientId?: string): void {
    for (const seat of room.seats) {
      if (seat.clientId === exceptClientId) continue;
      this.sessions.get(seat.clientId)?.transport.send(message);
    }
  }

  private fail(session: Session, code: ErrorCode, message: string): void {
    session.transport.send({ type: 'error', code, message });
  }

  private removeFromQueues(clientId: string): void {
    for (const [size, queue] of this.queues) {
      const filtered = queue.filter((id) => id !== clientId);
      if (filtered.length !== queue.length) this.queues.set(size, filtered);
    }
  }

  private generateCode(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        const pick = Math.min(
          Math.floor(this.random() * ROOM_CODE_ALPHABET.length),
          ROOM_CODE_ALPHABET.length - 1,
        );
        code += ROOM_CODE_ALPHABET[pick];
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
}

export function toSnapshot(game: GameState): Snapshot {
  return {
    size: game.size,
    board: [...game.board],
    currentPlayer: game.currentPlayer,
    status: game.status,
    winner: game.winner,
    winLine: game.winLine ? [...game.winLine] : null,
    lastMove: game.lastMove,
  };
}
