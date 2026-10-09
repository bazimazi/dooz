import { modeById } from '@/game/engine';
import { type ClientMessage, PROTOCOL_VERSION, type ServerMessage } from '@/protocol';
import { Accounts } from './db/accounts.js';
import { type Db, openDatabase } from './db/database.js';
import { Matches } from './db/matches.js';
import { Lobby, type LobbyOptions } from './lobby.js';
import type { Session, Transport } from './types.js';

/**
 * A lobby wired to an in-memory database, plus a fake client for driving it.
 *
 * The clock is a plain number the test moves by hand. Everything time-dependent
 * in the lobby reads it - the clocks, the abandon timer, the matchmaking bands,
 * the rate limiter - so a test can make a minute pass in one statement and
 * nothing in the suite has to wait for real time.
 */
export interface Harness {
  readonly lobby: Lobby;
  readonly accounts: Accounts;
  readonly matches: Matches;
  readonly db: Db;
  /** Move the clock forward and let the lobby act on it. */
  advance(ms: number): void;
  now(): number;
  /** A connected, authenticated client. */
  join(displayName?: string): Client;
  /** A connected client that has not sent `hello`. */
  connect(): Client;
  close(): void;
}

export interface Client {
  readonly session: Session;
  readonly accountId: string;
  readonly token: string;
  readonly sent: ServerMessage[];
  send(message: ClientMessage): void;
  /** Every message of a type, oldest first. */
  all<T extends ServerMessage['type']>(type: T): Extract<ServerMessage, { type: T }>[];
  /** The most recent message of a type, or `undefined`. */
  last<T extends ServerMessage['type']>(type: T): Extract<ServerMessage, { type: T }> | undefined;
  clear(): void;
  drop(): void;
  closed: boolean;
}

export function createHarness(options: LobbyOptions = {}): Harness {
  let clock = 1_700_000_000_000;
  const now = () => clock;

  const db = openDatabase(':memory:');
  const accounts = new Accounts(db, now);
  const matches = new Matches(db);
  const lobby = new Lobby(accounts, matches, {
    now,
    // Fixed so a test that cares which player opens can say so.
    random: () => 0.1,
    ...options,
  });

  let nextName = 0;

  function connect(): Client {
    const sent: ServerMessage[] = [];
    const client: Client = {
      session: undefined as unknown as Session,
      accountId: '',
      token: '',
      sent,
      send: (message) => lobby.handle(client.session, message),
      all: (type) => sent.filter((message) => message.type === type) as never,
      last: (type) => sent.toReversed().find((message) => message.type === type) as never,
      clear: () => {
        sent.length = 0;
      },
      drop: () => lobby.disconnect(client.session),
      closed: false,
    };

    const transport: Transport = {
      send: (message) => sent.push(message),
      close: () => {
        client.closed = true;
      },
    };

    (client as { session: Session }).session = lobby.connect(transport);
    return client;
  }

  function join(displayName?: string): Client {
    const client = connect();
    const name = displayName ?? `Tester${String(nextName++).padStart(3, '0')}`;
    const { account, token } = accounts.create(name, 'fox');

    (client as { accountId: string }).accountId = account.id;
    (client as { token: string }).token = token;

    client.send({ type: 'hello', version: PROTOCOL_VERSION, accountId: account.id, token });
    return client;
  }

  return {
    lobby,
    accounts,
    matches,
    db,
    now,
    advance: (ms) => {
      clock += ms;
      lobby.tick();
    },
    join,
    connect,
    close: () => db.close(),
  };
}

/** The config for a named mode, for tests that do not care about the numbers. */
export const CONFIGS = {
  classic: modeById('classic').config,
  grid6: modeById('grid-6').config,
  ultimate: modeById('ultimate').config,
  misere: modeById('misere').config,
  gravity: modeById('gravity').config,
  vanish: modeById('vanish').config,
};

/**
 * The newest board `client` has been shown.
 *
 * Both `matched` and `state` carry one, and either can be the most recent - a
 * rematch sends `matched` after a run of `state`s - so this walks backwards
 * rather than preferring one type.
 */
export function currentSnapshot(client: Client) {
  for (let index = client.sent.length - 1; index >= 0; index--) {
    const message = client.sent[index];
    if (message?.type === 'state' || message?.type === 'matched') return message.snapshot;
  }
  return undefined;
}

/** The payload of the newest `result` message, which is nested one deep. */
export function resultOf(client: Client) {
  return client.last('result')?.result;
}

/** Every result payload a client has been sent, oldest first. */
export function resultsOf(client: Client) {
  return client.all('result').map((message) => message.result);
}

/** Play `moves` in order, each from whichever client is to move. */
export function playMoves(a: Client, b: Client, moves: readonly number[]): void {
  for (const move of moves) {
    const you = a.last('matched')?.you;
    const snapshot = currentSnapshot(a);
    if (!snapshot || you === undefined || you === null) throw new Error('No game in progress');
    const mover = snapshot.currentPlayer === you ? a : b;
    mover.send({ type: 'move', index: move });
  }
}
