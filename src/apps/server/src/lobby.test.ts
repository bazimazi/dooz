import { O, X } from '@dooz/engine';
import {
  PROTOCOL_VERSION,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type ServerMessage,
} from '@dooz/protocol';
import { beforeEach, describe, expect, it } from 'vitest';
import { Lobby } from './lobby.js';
import type { Session } from './types.js';

/** A connection that records everything sent to it. */
class FakeClient {
  readonly sent: ServerMessage[] = [];
  closed = false;
  session!: Session;

  readonly transport = {
    send: (message: ServerMessage) => {
      this.sent.push(message);
    },
    close: () => {
      this.closed = true;
    },
  };

  /** Messages of one type, newest last. */
  ofType<T extends ServerMessage['type']>(type: T): Extract<ServerMessage, { type: T }>[] {
    return this.sent.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);
  }

  last<T extends ServerMessage['type']>(type: T): Extract<ServerMessage, { type: T }> | undefined {
    return this.ofType(type).at(-1);
  }

  clear(): void {
    this.sent.length = 0;
  }
}

describe('Lobby', () => {
  let clock: number;
  let lobby: Lobby;
  let nextId: number;
  let nextToken: number;

  const advance = (ms: number) => {
    clock += ms;
  };

  const join = (name: string): FakeClient => {
    const client = new FakeClient();
    client.session = lobby.connect(client.transport);
    lobby.handle(client.session, { type: 'hello', version: PROTOCOL_VERSION, name });
    return client;
  };

  /** A new connection presenting the credentials an earlier one was issued. */
  const reconnect = (name: string, credentials: { clientId: string; resumeToken: string }) => {
    const client = new FakeClient();
    client.session = lobby.connect(client.transport);
    lobby.handle(client.session, {
      type: 'hello',
      version: PROTOCOL_VERSION,
      name,
      ...credentials,
    });
    return client;
  };

  /** What a client would have kept from its `welcome`. */
  const credentialsOf = (client: FakeClient) => {
    const welcome = client.last('welcome')!;
    return { clientId: welcome.clientId, resumeToken: welcome.resumeToken };
  };

  beforeEach(() => {
    clock = 1_000_000;
    nextId = 0;
    nextToken = 0;
    lobby = new Lobby({
      now: () => clock,
      // Fixed sequence keeps the starting players deterministic.
      random: () => 0.42,
      newId: () => `client-${++nextId}`,
      // Real tokens are 32 random bytes; these only have to be distinct and the
      // right length for the protocol schema.
      newToken: () => `token-${++nextToken}`.padEnd(43, 'x'),
      reconnectGraceMs: 1000,
    });
  });

  describe('handshake', () => {
    it('welcomes a client and hands back its id and resume token', () => {
      const alice = join('Alice');
      expect(alice.last('welcome')).toEqual({
        type: 'welcome',
        clientId: 'client-1',
        resumeToken: 'token-1'.padEnd(43, 'x'),
        version: PROTOCOL_VERSION,
      });
    });

    it('accepts only one hello per connection', () => {
      const alice = join('Alice');
      alice.clear();
      lobby.handle(alice.session, { type: 'hello', version: PROTOCOL_VERSION, name: 'Alice' });

      expect(alice.last('error')?.code).toBe('badMessage');
      expect(alice.last('welcome')).toBeUndefined();
    });

    it('rejects and closes a client on the wrong protocol version', () => {
      const client = new FakeClient();
      client.session = lobby.connect(client.transport);
      lobby.handle(client.session, { type: 'hello', version: PROTOCOL_VERSION + 1 });

      expect(client.last('error')?.code).toBe('versionMismatch');
      expect(client.closed).toBe(true);
    });
  });

  describe('quick match', () => {
    it('puts the first player in the queue', () => {
      const alice = join('Alice');
      lobby.handle(alice.session, { type: 'quickMatch', boardSize: 3 });

      expect(alice.last('searching')).toEqual({ type: 'searching', boardSize: 3 });
      expect(lobby.queuedCount).toBe(1);
      expect(lobby.roomCount).toBe(0);
    });

    it('pairs the second player and deals X to the one who waited', () => {
      const alice = join('Alice');
      const bob = join('Bob');
      lobby.handle(alice.session, { type: 'quickMatch', boardSize: 6 });
      lobby.handle(bob.session, { type: 'quickMatch', boardSize: 6 });

      const forAlice = alice.last('matched');
      const forBob = bob.last('matched');

      expect(forAlice?.you).toBe(X);
      expect(forBob?.you).toBe(O);
      expect(forAlice?.code).toBe(forBob?.code);
      expect(forAlice?.opponent.name).toBe('Bob');
      expect(forBob?.opponent.name).toBe('Alice');
      expect(forAlice?.snapshot.size).toBe(6);
      expect(lobby.queuedCount).toBe(0);
      expect(lobby.roomCount).toBe(1);
    });

    it('keeps queues for different board sizes apart', () => {
      const alice = join('Alice');
      const bob = join('Bob');
      lobby.handle(alice.session, { type: 'quickMatch', boardSize: 3 });
      lobby.handle(bob.session, { type: 'quickMatch', boardSize: 9 });

      expect(alice.last('matched')).toBeUndefined();
      expect(bob.last('searching')?.boardSize).toBe(9);
      expect(lobby.queuedCount).toBe(2);
    });

    it('does not match a player with themselves', () => {
      const alice = join('Alice');
      lobby.handle(alice.session, { type: 'quickMatch', boardSize: 3 });
      lobby.handle(alice.session, { type: 'quickMatch', boardSize: 3 });

      expect(alice.last('matched')).toBeUndefined();
      expect(lobby.roomCount).toBe(0);
    });

    it('skips a queued player who has since disconnected', () => {
      const ghost = join('Ghost');
      lobby.handle(ghost.session, { type: 'quickMatch', boardSize: 3 });
      lobby.disconnect(ghost.session);

      const bob = join('Bob');
      lobby.handle(bob.session, { type: 'quickMatch', boardSize: 3 });

      expect(bob.last('matched')).toBeUndefined();
      expect(bob.last('searching')).toBeDefined();
    });
  });

  describe('private rooms', () => {
    it('returns a shareable code', () => {
      const alice = join('Alice');
      lobby.handle(alice.session, { type: 'createRoom', boardSize: 3 });

      const created = alice.last('roomCreated');
      expect(created?.code).toMatch(/^[A-Z2-9]{6}$/);
      expect(created?.boardSize).toBe(3);
    });

    it('matches a player who joins with the code', () => {
      const alice = join('Alice');
      lobby.handle(alice.session, { type: 'createRoom', boardSize: 3 });
      const code = alice.last('roomCreated')!.code;

      const bob = join('Bob');
      lobby.handle(bob.session, { type: 'joinRoom', code });

      expect(alice.last('matched')?.you).toBe(X);
      expect(bob.last('matched')?.you).toBe(O);
    });

    it('rejects an unknown code', () => {
      const bob = join('Bob');
      lobby.handle(bob.session, { type: 'joinRoom', code: 'ZZZZZZ' });
      expect(bob.last('error')?.code).toBe('roomNotFound');
    });

    it('rejects a third player', () => {
      const alice = join('Alice');
      lobby.handle(alice.session, { type: 'createRoom', boardSize: 3 });
      const code = alice.last('roomCreated')!.code;

      const bob = join('Bob');
      lobby.handle(bob.session, { type: 'joinRoom', code });

      const carol = join('Carol');
      lobby.handle(carol.session, { type: 'joinRoom', code });

      expect(carol.last('error')?.code).toBe('roomFull');
    });
  });

  describe('playing', () => {
    /** Two matched clients, with `first` holding X. */
    function matchedPair() {
      const alice = join('Alice');
      const bob = join('Bob');
      lobby.handle(alice.session, { type: 'quickMatch', boardSize: 3 });
      lobby.handle(bob.session, { type: 'quickMatch', boardSize: 3 });

      const starting = alice.last('matched')!.snapshot.currentPlayer;
      const first = starting === X ? alice : bob;
      const second = first === alice ? bob : alice;
      alice.clear();
      bob.clear();
      return { alice, bob, first, second };
    }

    it('broadcasts the new state to both players after a legal move', () => {
      const { alice, bob, first } = matchedPair();
      lobby.handle(first.session, { type: 'move', index: 4 });

      const fromAlice = alice.last('state')!.snapshot;
      const fromBob = bob.last('state')!.snapshot;
      expect(fromAlice).toEqual(fromBob);
      expect(fromAlice.board[4]).not.toBe(0);
      expect(fromAlice.lastMove).toBe(4);
    });

    it('refuses a move made out of turn', () => {
      const { second } = matchedPair();
      lobby.handle(second.session, { type: 'move', index: 0 });

      expect(second.last('error')?.code).toBe('notYourTurn');
      expect(second.last('state')).toBeUndefined();
    });

    it('refuses a move onto an occupied square', () => {
      const { first, second } = matchedPair();
      lobby.handle(first.session, { type: 'move', index: 0 });
      lobby.handle(second.session, { type: 'move', index: 0 });

      expect(second.last('error')?.code).toBe('illegalMove');
    });

    it('refuses moves from a client that is not in a game', () => {
      const drifter = join('Drifter');
      lobby.handle(drifter.session, { type: 'move', index: 0 });
      expect(drifter.last('error')?.code).toBe('notInRoom');
    });

    it('plays a full game through to a win and then locks the board', () => {
      const { alice, bob, first, second } = matchedPair();
      // First takes the top row; second answers in the middle row.
      const script = [
        [first, 0],
        [second, 3],
        [first, 1],
        [second, 4],
        [first, 2],
      ] as const;
      for (const [client, index] of script) {
        lobby.handle(client.session, { type: 'move', index });
      }

      const final = alice.last('state')!.snapshot;
      expect(final.status).toBe('won');
      expect(final.winLine).toEqual([0, 1, 2]);

      bob.clear();
      lobby.handle(second.session, { type: 'move', index: 5 });
      expect(bob.last('error')?.code).toBe('notYourTurn');
    });
  });

  describe('rematch', () => {
    function finishedGame() {
      const alice = join('Alice');
      const bob = join('Bob');
      lobby.handle(alice.session, { type: 'quickMatch', boardSize: 3 });
      lobby.handle(bob.session, { type: 'quickMatch', boardSize: 3 });
      const starting = alice.last('matched')!.snapshot.currentPlayer;
      const first = starting === X ? alice : bob;
      const second = first === alice ? bob : alice;
      for (const [client, index] of [
        [first, 0],
        [second, 3],
        [first, 1],
        [second, 4],
        [first, 2],
      ] as const) {
        lobby.handle(client.session, { type: 'move', index });
      }
      alice.clear();
      bob.clear();
      return { alice, bob };
    }

    it('tells the other player that a rematch was offered', () => {
      const { alice, bob } = finishedGame();
      lobby.handle(alice.session, { type: 'rematch' });

      expect(bob.last('rematchOffered')).toBeDefined();
      expect(bob.last('state')).toBeUndefined();
    });

    it('resets the board once both players agree', () => {
      const { alice, bob } = finishedGame();
      lobby.handle(alice.session, { type: 'rematch' });
      lobby.handle(bob.session, { type: 'rematch' });

      const fresh = alice.last('state')!.snapshot;
      expect(fresh.status).toBe('playing');
      expect(fresh.board.every((cell) => cell === 0)).toBe(true);
      expect(bob.last('state')!.snapshot).toEqual(fresh);
    });
  });

  describe('presence and reconnection', () => {
    function matchedPair() {
      const alice = join('Alice');
      const bob = join('Bob');
      lobby.handle(alice.session, { type: 'quickMatch', boardSize: 3 });
      lobby.handle(bob.session, { type: 'quickMatch', boardSize: 3 });
      return { alice, bob };
    }

    it('tells the opponent when a player drops', () => {
      const { alice, bob } = matchedPair();
      bob.clear();
      lobby.disconnect(alice.session);

      expect(bob.last('opponentPresence')).toEqual({
        type: 'opponentPresence',
        opponent: { name: 'Alice', connected: false },
      });
    });

    it('holds the seat and restores the game on reconnect', () => {
      const { alice, bob } = matchedPair();
      const code = alice.last('matched')!.code;
      const before = alice.last('matched')!.snapshot;
      const credentials = credentialsOf(alice);
      lobby.disconnect(alice.session);

      const returning = reconnect('Alice', credentials);

      const restored = returning.last('matched');
      expect(restored?.code).toBe(code);
      expect(restored?.snapshot).toEqual(before);
      expect(bob.last('opponentPresence')?.opponent).toEqual({ name: 'Alice', connected: true });
    });

    it('clears a rematch request made just before the player dropped', () => {
      const { alice, bob } = matchedPair();
      lobby.handle(alice.session, { type: 'rematch' });
      lobby.disconnect(alice.session);
      bob.clear();

      // Bob agreeing must not be enough on its own now that Alice is gone.
      lobby.handle(bob.session, { type: 'rematch' });
      expect(bob.last('state')).toBeUndefined();
    });

    it('lets a player who deliberately leaves end the game', () => {
      const { alice, bob } = matchedPair();
      bob.clear();
      lobby.handle(alice.session, { type: 'leave' });

      expect(bob.last('opponentLeft')).toBeDefined();
      expect(lobby.roomCount).toBe(0);
    });

    it('sweeps a room away once the grace period expires', () => {
      const { alice, bob } = matchedPair();
      lobby.disconnect(alice.session);
      lobby.disconnect(bob.session);
      expect(lobby.roomCount).toBe(1);

      advance(999);
      lobby.sweep();
      expect(lobby.roomCount).toBe(1);

      advance(2);
      lobby.sweep();
      expect(lobby.roomCount).toBe(0);
    });
  });

  describe('seat credentials', () => {
    function seatedPair() {
      const alice = join('Alice');
      const bob = join('Bob');
      lobby.handle(alice.session, { type: 'quickMatch', boardSize: 3 });
      lobby.handle(bob.session, { type: 'quickMatch', boardSize: 3 });
      return { alice, bob };
    }

    it('refuses a seat to a client that knows the id but not the token', () => {
      const { alice } = seatedPair();
      const { clientId } = credentialsOf(alice);
      lobby.disconnect(alice.session);

      const impostor = reconnect('Mallory', {
        clientId,
        resumeToken: 'wrong-token'.padEnd(43, 'x'),
      });

      expect(impostor.last('matched')).toBeUndefined();
      expect(impostor.last('welcome')?.clientId).not.toBe(clientId);
    });

    it('refuses a seat that a live connection is still holding', () => {
      const { alice, bob } = seatedPair();
      const credentials = credentialsOf(alice);

      // A second tab of the same browser: same credentials, Alice still online.
      const secondTab = reconnect('Alice', credentials);

      expect(secondTab.last('matched')).toBeUndefined();
      expect(secondTab.last('welcome')?.clientId).not.toBe(credentials.clientId);

      // And Alice keeps the seat: her moves still reach Bob.
      bob.clear();
      lobby.handle(alice.session, { type: 'move', index: 0 });
      expect(bob.last('state')).toBeDefined();
    });

    it('does not let a superseded session take the seat offline', () => {
      const alice = join('Alice');
      const bob = join('Bob');
      lobby.handle(alice.session, { type: 'quickMatch', boardSize: 3 });
      lobby.handle(bob.session, { type: 'quickMatch', boardSize: 3 });

      const credentials = credentialsOf(alice);
      lobby.disconnect(alice.session);
      const returning = reconnect('Alice', credentials);
      bob.clear();

      // Alice's original socket closes only now, well after the reconnect.
      lobby.disconnect(alice.session);

      // The seat belongs to the new connection, which is online and can play.
      expect(bob.last('opponentPresence')?.opponent.connected).not.toBe(false);
      lobby.handle(returning.session, { type: 'move', index: 0 });
      expect(bob.last('error')).toBeUndefined();
      expect(bob.last('state')).toBeDefined();
    });

    it('does not let a superseded session evict the one that replaced it', () => {
      const alice = join('Alice');
      const credentials = credentialsOf(alice);
      lobby.disconnect(alice.session);

      const returning = reconnect('Alice', credentials);
      expect(lobby.sessionCount).toBe(1);

      // The old socket finally closes. It must not take the new one with it.
      lobby.disconnect(alice.session);
      expect(lobby.sessionCount).toBe(1);
      expect(returning.session.connected).toBe(true);
    });

    it('issues a code drawn from the room alphabet', () => {
      const alice = join('Alice');
      lobby.handle(alice.session, { type: 'createRoom', boardSize: 3 });

      const code = alice.last('roomCreated')!.code;
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect(code.split('').every((character) => ROOM_CODE_ALPHABET.includes(character))).toBe(
        true,
      );
    });
  });

  describe('capacity', () => {
    it('refuses to open a room once the ceiling is reached', () => {
      lobby = new Lobby({
        now: () => clock,
        random: () => 0.42,
        newId: () => `client-${++nextId}`,
        newToken: () => `token-${++nextToken}`.padEnd(43, 'x'),
        maxRooms: 1,
      });

      const first = join('First');
      lobby.handle(first.session, { type: 'createRoom', boardSize: 3 });
      expect(lobby.roomCount).toBe(1);

      const second = join('Second');
      lobby.handle(second.session, { type: 'createRoom', boardSize: 3 });

      expect(second.last('error')?.code).toBe('serverFull');
      expect(second.last('roomCreated')).toBeUndefined();
      expect(lobby.roomCount).toBe(1);
    });

    it('reports capacity so the transport can refuse the handshake', () => {
      lobby = new Lobby({ maxSessions: 1, newId: () => `client-${++nextId}` });
      expect(lobby.atCapacity).toBe(false);

      join('Only');
      expect(lobby.atCapacity).toBe(true);
    });
  });

  describe('display names', () => {
    it('reaches the opponent when it changes mid-game', () => {
      const alice = join('Alice');
      const bob = join('Bob');
      lobby.handle(alice.session, { type: 'quickMatch', boardSize: 3 });
      lobby.handle(bob.session, { type: 'quickMatch', boardSize: 3 });
      bob.clear();

      lobby.handle(alice.session, { type: 'setName', name: 'Alicia' });

      expect(bob.last('opponentPresence')?.opponent).toEqual({
        name: 'Alicia',
        connected: true,
      });
      expect(alice.last('opponentPresence')).toBeUndefined();
    });

    it('is accepted outside a room and used for the next match', () => {
      const alice = join('Alice');
      lobby.handle(alice.session, { type: 'setName', name: 'Alicia' });

      const bob = join('Bob');
      lobby.handle(alice.session, { type: 'quickMatch', boardSize: 3 });
      lobby.handle(bob.session, { type: 'quickMatch', boardSize: 3 });

      expect(bob.last('matched')?.opponent.name).toBe('Alicia');
    });
  });

  describe('rate limiting', () => {
    it('rejects a client that floods past its burst allowance', () => {
      lobby = new Lobby({
        now: () => clock,
        random: () => 0.42,
        newId: () => `client-${++nextId}`,
        messageBurst: 3,
        messagesPerSecond: 1,
      });
      const alice = join('Alice');

      for (let i = 0; i < 5; i++) lobby.handle(alice.session, { type: 'ping' });
      expect(alice.last('error')?.code).toBe('rateLimited');
    });

    it('lets the bucket refill over time', () => {
      lobby = new Lobby({
        now: () => clock,
        random: () => 0.42,
        newId: () => `client-${++nextId}`,
        messageBurst: 2,
        messagesPerSecond: 1,
      });
      const alice = join('Alice');
      for (let i = 0; i < 4; i++) lobby.handle(alice.session, { type: 'ping' });
      expect(alice.last('error')?.code).toBe('rateLimited');

      alice.clear();
      advance(2000);
      lobby.handle(alice.session, { type: 'ping' });
      expect(alice.last('pong')).toBeDefined();
      expect(alice.last('error')).toBeUndefined();
    });
  });
});
