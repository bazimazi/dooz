import { createGame, modeById } from '@/game/engine';
import {
  type ClientMessage,
  encode,
  PROTOCOL_VERSION,
  type ServerMessage,
  type Snapshot,
} from '@/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountStore } from '@/features/account/store';
import { seatsFor, useOnlineStore } from './store';

/**
 * A stand-in for the browser's WebSocket.
 *
 * The store is the one piece of the client with real protocol logic in it -
 * what a frame does to the screen, what a drop does to the room - and none of
 * that is reachable without a socket. This one records what was sent and lets
 * a test push frames back.
 */
class FakeSocket {
  static instances: FakeSocket[] = [];
  static readonly OPEN = 1;

  readyState = 1;
  sent: ClientMessage[] = [];
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  addEventListener(type: string, handler: (event: unknown) => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(handler);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, handler: (event: unknown) => void) {
    this.listeners.get(type)?.delete(handler);
  }

  send(raw: string) {
    this.sent.push(JSON.parse(raw) as ClientMessage);
  }

  close() {
    this.readyState = 3;
    this.emit('close', {});
  }

  /** Drive the handshake the store performs on open. */
  open() {
    this.emit('open', {});
  }

  /** Push a server frame at the store. */
  deliver(message: ServerMessage) {
    this.emit('message', { data: encode(message) });
  }

  private emit(type: string, event: unknown) {
    for (const handler of this.listeners.get(type) ?? []) handler(event);
  }

  static get latest(): FakeSocket {
    const socket = FakeSocket.instances.at(-1);
    if (!socket) throw new Error('No socket was opened');
    return socket;
  }
}

const CLASSIC = modeById('classic').config;

function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  const game = createGame(CLASSIC);
  return {
    config: CLASSIC,
    board: [...game.board],
    currentPlayer: 1,
    status: 'playing',
    winner: null,
    winLine: null,
    lastMove: null,
    moves: [],
    ultimate: null,
    ...overrides,
  };
}

function matched(): Extract<ServerMessage, { type: 'matched' }> {
  return {
    type: 'matched',
    code: 'ABCDEF',
    kind: 'ranked',
    you: 1,
    seats: [
      {
        player: 1,
        profile: { accountId: 'me', displayName: 'Ada', avatar: 'fox', rating: 1200 },
        connected: true,
        wantsRematch: false,
      },
      {
        player: 2,
        profile: { accountId: 'them', displayName: 'Bob', avatar: 'owl', rating: 1210 },
        connected: true,
        wantsRematch: false,
      },
    ],
    snapshot: snapshot(),
    clock: { x: 120_000, o: 120_000, running: 1, incrementMs: 3000, asOf: 1000 },
    spectators: 0,
  };
}

const INITIAL = useOnlineStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeSocket);
  useOnlineStore.setState(INITIAL, true);
  useAccountStore.setState({
    status: 'ready',
    credentials: { accountId: 'me', token: 'x'.repeat(43) },
    profile: null,
    error: null,
  });
});

afterEach(() => {
  useOnlineStore.getState().disconnect();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Connect and complete the handshake. */
function connect() {
  useOnlineStore.getState().connect();
  FakeSocket.latest.open();
  FakeSocket.latest.deliver({
    type: 'welcome',
    version: PROTOCOL_VERSION,
    profile: { accountId: 'me', displayName: 'Ada', avatar: 'fox', rating: null },
    resumed: false,
  });
}

describe('connection', () => {
  it('introduces itself with the stored account credentials', () => {
    connect();

    expect(FakeSocket.latest.sent[0]).toEqual({
      type: 'hello',
      version: PROTOCOL_VERSION,
      accountId: 'me',
      token: 'x'.repeat(43),
    });
    expect(useOnlineStore.getState().phase).toBe('idle');
  });

  it('reconnects after a drop, with a backoff', () => {
    connect();
    expect(FakeSocket.instances).toHaveLength(1);

    FakeSocket.latest.close();
    expect(useOnlineStore.getState().reconnecting).toBe(true);

    vi.advanceTimersByTime(600);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it('stops retrying once the server says the client is not welcome', () => {
    connect();
    FakeSocket.latest.deliver({
      type: 'error',
      code: 'versionMismatch',
      message: 'Please reload.',
    });
    FakeSocket.latest.close();

    vi.advanceTimersByTime(30_000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(useOnlineStore.getState().phase).toBe('offline');
  });

  it('stops retrying when the account was opened elsewhere', () => {
    connect();
    FakeSocket.latest.deliver({
      type: 'error',
      code: 'alreadyPlaying',
      message: 'Opened somewhere else.',
    });
    FakeSocket.latest.close();

    vi.advanceTimersByTime(30_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('keeps the room on screen while reconnecting', () => {
    connect();
    FakeSocket.latest.deliver(matched());
    FakeSocket.latest.close();

    const state = useOnlineStore.getState();
    expect(state.reconnecting).toBe(true);
    expect(state.phase).toBe('playing');
    expect(state.game).not.toBeNull();
  });
});

describe('matchmaking', () => {
  it('sends a queue request and reflects the search', () => {
    connect();
    useOnlineStore.getState().queue(CLASSIC, true);

    expect(FakeSocket.latest.sent.at(-1)).toEqual({
      type: 'queue',
      config: CLASSIC,
      ranked: true,
    });

    FakeSocket.latest.deliver({ type: 'searching', config: CLASSIC, ranked: true, queued: 3 });
    expect(useOnlineStore.getState()).toMatchObject({ phase: 'searching', queued: 3 });
  });

  it('enters the game on a match', () => {
    connect();
    FakeSocket.latest.deliver(matched());

    const state = useOnlineStore.getState();
    expect(state.phase).toBe('playing');
    expect(state.you).toBe(1);
    expect(state.kind).toBe('ranked');
    expect(state.roomCode).toBe('ABCDEF');
    expect(state.seats).toHaveLength(2);
  });

  it('watches without taking a seat', () => {
    connect();
    FakeSocket.latest.deliver({ ...matched(), you: null, spectators: 1 });

    expect(useOnlineStore.getState().phase).toBe('watching');
    expect(useOnlineStore.getState().you).toBeNull();
  });
});

describe('playing', () => {
  it('sends a move as an index and never a board', () => {
    connect();
    FakeSocket.latest.deliver(matched());
    useOnlineStore.getState().play(4);

    expect(FakeSocket.latest.sent.at(-1)).toEqual({ type: 'move', index: 4 });
  });

  it('renders whatever board the server last sent', () => {
    connect();
    FakeSocket.latest.deliver(matched());

    const board = [1, 0, 0, 0, 2, 0, 0, 0, 0] as Snapshot['board'];
    FakeSocket.latest.deliver({
      type: 'state',
      snapshot: snapshot({ board, moves: [0, 4], lastMove: 4, currentPlayer: 1 }),
      clock: { x: 118_000, o: 119_000, running: 1, incrementMs: 3000, asOf: 2000 },
    });

    const state = useOnlineStore.getState();
    expect(state.game?.board).toEqual(board);
    expect(state.game?.moves).toEqual([0, 4]);
    expect(state.clock?.x).toBe(118_000);
  });

  it('keeps the result even though the board still says playing', () => {
    connect();
    FakeSocket.latest.deliver(matched());
    FakeSocket.latest.deliver({
      type: 'result',
      result: {
        matchId: 'm1',
        winner: 2,
        reason: 'timeout',
        kind: 'ranked',
        rating: { x: { before: 1200, after: 1184 }, o: { before: 1210, after: 1226 } },
      },
    });

    const state = useOnlineStore.getState();
    expect(state.game?.status).toBe('playing');
    expect(state.result?.reason).toBe('timeout');
    expect(state.result?.rating?.x.after).toBe(1184);
  });

  it('clears the last result when a rematch starts', () => {
    connect();
    FakeSocket.latest.deliver(matched());
    FakeSocket.latest.deliver({
      type: 'result',
      result: { matchId: 'm1', winner: 1, reason: 'line', kind: 'ranked', rating: null },
    });
    expect(useOnlineStore.getState().result).not.toBeNull();

    FakeSocket.latest.deliver({ type: 'state', snapshot: snapshot(), clock: null });
    expect(useOnlineStore.getState().result).toBeNull();
  });

  it('tracks a draw offer in both directions', () => {
    connect();
    FakeSocket.latest.deliver(matched());

    useOnlineStore.getState().offerDraw();
    expect(useOnlineStore.getState().drawRequested).toBe(true);
    expect(FakeSocket.latest.sent.at(-1)).toEqual({ type: 'offerDraw' });

    FakeSocket.latest.deliver({ type: 'drawDeclined' });
    expect(useOnlineStore.getState().drawRequested).toBe(false);

    FakeSocket.latest.deliver({ type: 'drawOffered' });
    expect(useOnlineStore.getState().drawOffered).toBe(true);

    useOnlineStore.getState().respondDraw(false);
    expect(useOnlineStore.getState().drawOffered).toBe(false);
  });

  it('keeps at most three emotes on screen', () => {
    connect();
    FakeSocket.latest.deliver(matched());

    for (let index = 0; index < 6; index++) {
      FakeSocket.latest.deliver({ type: 'emote', from: 2, emote: 'gg' });
    }
    expect(useOnlineStore.getState().emotes.length).toBeLessThanOrEqual(3);
  });

  it('drops an emote once it has been shown', () => {
    connect();
    FakeSocket.latest.deliver(matched());
    FakeSocket.latest.deliver({ type: 'emote', from: 2, emote: 'nice' });

    const [emote] = useOnlineStore.getState().emotes;
    useOnlineStore.getState().dismissEmote(emote!.id);
    expect(useOnlineStore.getState().emotes).toHaveLength(0);
  });

  it('reports an opponent walking out', () => {
    connect();
    FakeSocket.latest.deliver(matched());
    FakeSocket.latest.deliver({ type: 'opponentLeft' });

    expect(useOnlineStore.getState().phase).toBe('opponentLeft');
  });
});

describe('errors', () => {
  it('returns to the lobby when a room cannot be joined', () => {
    connect();
    useOnlineStore.getState().joinRoom('ZZZZZZ');
    FakeSocket.latest.deliver({
      type: 'error',
      code: 'roomNotFound',
      message: 'No game with that code.',
    });

    const state = useOnlineStore.getState();
    expect(state.phase).toBe('idle');
    expect(state.error).toBe('No game with that code.');
  });

  it('ignores a frame that does not match the protocol', () => {
    connect();
    const before = useOnlineStore.getState().phase;
    FakeSocket.latest.deliver({ type: 'nonsense' } as unknown as ServerMessage);
    expect(useOnlineStore.getState().phase).toBe(before);
  });
});

describe('seatsFor', () => {
  it('finds your seat and the other one', () => {
    const { yours, theirs } = seatsFor(matched().seats, 1);
    expect(yours).toMatchObject({ player: 1 });
    expect(theirs).toMatchObject({ player: 2 });
  });

  it('falls back to board order while watching', () => {
    const { yours, theirs } = seatsFor(matched().seats, null);
    expect(yours).toMatchObject({ player: 1 });
    expect(theirs).toMatchObject({ player: 2 });
  });
});
