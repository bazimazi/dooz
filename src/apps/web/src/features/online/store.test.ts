import { decodeClientMessage, encode, PROTOCOL_VERSION } from '@dooz/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A stand-in for the browser's WebSocket that never touches the network.
 *
 * It records every socket the store opens, so a test can assert which one the
 * store is actually talking to - which is the whole question behind the stale
 * handler bugs below.
 */
class FakeSocket {
  static readonly opened: FakeSocket[] = [];
  static readonly OPEN = 1;
  static readonly CLOSED = 3;

  readonly OPEN = 1;
  readonly sent: string[] = [];
  readyState = 0;
  closed = false;

  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor(readonly url: string) {
    FakeSocket.opened.push(this);
  }

  addEventListener(type: string, handler: (event: unknown) => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(handler);
    this.listeners.set(type, set);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
    this.readyState = FakeSocket.CLOSED;
    this.emit('close', {});
  }

  /** Drive the socket from the test's side. */
  open() {
    this.readyState = FakeSocket.OPEN;
    this.emit('open', {});
  }

  receive(message: unknown) {
    this.emit('message', { data: encode(message as never) });
  }

  emit(type: string, event: unknown) {
    for (const handler of this.listeners.get(type) ?? []) handler(event);
  }

  /** The decoded frames this socket was asked to send. */
  get messages() {
    return this.sent.map((raw) => decodeClientMessage(raw));
  }
}

vi.stubGlobal('WebSocket', FakeSocket);

const WELCOME = {
  type: 'welcome' as const,
  clientId: '5f6c2a1e-0000-4000-8000-000000000001',
  resumeToken: 'token'.padEnd(43, 'x'),
  version: PROTOCOL_VERSION,
};

async function freshStore() {
  vi.resetModules();
  FakeSocket.opened.length = 0;
  const { useOnlineStore } = await import('./store');
  return useOnlineStore;
}

describe('the online store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('introduces itself with the stored credentials after a drop', async () => {
    const store = await freshStore();
    store.getState().connect();

    const first = FakeSocket.opened[0]!;
    first.open();
    expect(first.messages[0]).toMatchObject({ type: 'hello', version: PROTOCOL_VERSION });
    // Nothing to resume with yet, so no credentials are offered.
    expect(first.messages[0]).not.toHaveProperty('resumeToken');

    first.receive(WELCOME);
    expect(store.getState().clientId).toBe(WELCOME.clientId);

    first.close();
    await vi.advanceTimersByTimeAsync(600);

    const second = FakeSocket.opened[1]!;
    second.open();
    expect(second.messages[0]).toMatchObject({
      type: 'hello',
      clientId: WELCOME.clientId,
      resumeToken: WELCOME.resumeToken,
    });
  });

  /**
   * React's strict mode mounts, unmounts and remounts in a row, so the first
   * socket's `close` lands after the second is already live. The handler used
   * to null out the module-level socket regardless of which one it belonged to,
   * dropping the working connection and scheduling a reconnect on top of it.
   */
  it('ignores a close from a socket it has already replaced', async () => {
    const store = await freshStore();

    store.getState().connect();
    const first = FakeSocket.opened[0]!;
    store.getState().disconnect();
    store.getState().connect();

    const second = FakeSocket.opened[1]!;
    expect(second).not.toBe(first);

    // The first socket finally reports its close, late.
    first.emit('close', {});

    // The live socket is untouched and no reconnect was queued behind it.
    second.open();
    second.receive(WELCOME);
    expect(store.getState().phase).toBe('idle');
    expect(store.getState().reconnecting).toBe(false);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(FakeSocket.opened).toHaveLength(2);
  });

  it('stops reconnecting when the server says the client is too old', async () => {
    const store = await freshStore();
    store.getState().connect();

    const first = FakeSocket.opened[0]!;
    first.open();
    first.receive({
      type: 'error',
      code: 'versionMismatch',
      message: 'Please reload to get the latest version.',
    });
    first.close();

    await vi.advanceTimersByTimeAsync(60_000);

    // Every retry would be refused the same way, so there must not be one.
    expect(FakeSocket.opened).toHaveLength(1);
    expect(store.getState().phase).toBe('offline');
    expect(store.getState().reconnecting).toBe(false);
  });

  it('can reconnect again after a failed connect attempt', async () => {
    const store = await freshStore();

    store.getState().connect();
    FakeSocket.opened[0]!.close();
    await vi.advanceTimersByTimeAsync(600);
    expect(FakeSocket.opened).toHaveLength(2);

    // The reconnect timer has fired; `connect()` must not still think one is
    // pending, or the store can never be revived.
    store.getState().disconnect();
    store.getState().connect();
    expect(FakeSocket.opened).toHaveLength(3);
  });

  it('rejects a snapshot whose board does not match its size', async () => {
    const store = await freshStore();
    store.getState().connect();

    const socket = FakeSocket.opened[0]!;
    socket.open();
    socket.receive(WELCOME);
    socket.receive({
      type: 'state',
      snapshot: {
        size: 9,
        board: [0, 0, 0],
        currentPlayer: 1,
        status: 'playing',
        winner: null,
        winLine: null,
        lastMove: null,
      },
    });

    expect(store.getState().game).toBeNull();
  });
});
