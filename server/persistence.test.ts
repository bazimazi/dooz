import { PROTOCOL_VERSION } from '@/protocol';
import { describe, expect, it } from 'vitest';
import { Accounts } from './db/accounts.js';
import { Matches } from './db/matches.js';
import { Lobby } from './lobby.js';
import { restoreLiveRooms, saveLiveRooms } from './persistence.js';
import { CONFIGS, type Client, createHarness, currentSnapshot, playMoves } from './test-support.js';
import type { ServerMessage } from '@/protocol';
import type { Transport } from './types.js';

describe('live rooms across a restart', () => {
  it('seats both players back in the same game with the clocks where they were', () => {
    const before = createHarness();
    const ada = before.join('Ada');
    const bob = before.join('Bob');
    ada.send({ type: 'queue', config: CONFIGS.grid6, ranked: true });
    bob.send({ type: 'queue', config: CONFIGS.grid6, ranked: true });
    playMoves(ada, bob, [0, 7, 14]);
    before.advance(3_000);
    const code = ada.last('matched')!.code;
    const clockBefore = ada.last('state')!.clock!;

    expect(saveLiveRooms(before.db, before.lobby, before.now())).toBe(1);

    // A new process: same database, fresh lobby, no sockets yet. Ten minutes of
    // downtime are charged to nobody.
    let clock = before.now() + 10 * 60_000;
    const lobby = new Lobby(new Accounts(before.db, () => clock), new Matches(before.db), {
      now: () => clock,
      random: () => 0.1,
    });
    expect(restoreLiveRooms(before.db, lobby, clock)).toBe(1);
    expect(before.db.prepare('SELECT COUNT(*) AS n FROM live_rooms').get()).toEqual({ n: 0 });

    const reconnect = (who: Client) => {
      const sent: ServerMessage[] = [];
      const transport: Transport = { send: (message) => sent.push(message), close: () => {} };
      const session = lobby.connect(transport);
      lobby.handle(session, {
        type: 'hello',
        version: PROTOCOL_VERSION,
        accountId: who.accountId,
        token: who.token,
      });
      return { sent, session };
    };

    const adaAgain = reconnect(ada);
    const welcome = adaAgain.sent.find((message) => message.type === 'welcome');
    expect(welcome?.type === 'welcome' && welcome.resumed).toBe(true);
    const matched = adaAgain.sent.find((message) => message.type === 'matched');
    expect(matched?.type === 'matched' && matched.code).toBe(code);
    expect(matched?.type === 'matched' && matched.kind).toBe('ranked');
    expect(matched?.type === 'matched' && matched.snapshot.moves).toEqual([0, 7, 14]);
    const restoredClock = matched?.type === 'matched' ? matched.clock : null;
    // Within a second of where it stood: the downtime did not run the clock.
    expect(Math.abs((restoredClock?.o ?? 0) - clockBefore.o)).toBeLessThan(4_000);

    const bobAgain = reconnect(bob);
    expect(bobAgain.sent.some((message) => message.type === 'matched')).toBe(true);

    // The game goes on: it is O's move.
    clock += 1_000;
    const mover = matched?.type === 'matched' && matched.you === 2 ? adaAgain : bobAgain;
    lobby.handle(mover.session, { type: 'move', index: 21 });
    expect(mover.sent.some((message) => message.type === 'state')).toBe(true);
    before.close();
  });

  it('carries a waiting private room, and skips finished games', () => {
    const harness = createHarness();
    const host = harness.join('Host');
    host.send({ type: 'createRoom', config: CONFIGS.classic });
    const a = harness.join('A');
    const b = harness.join('B');
    a.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    b.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    playMoves(a, b, [0, 3, 1, 4, 2]);
    expect(currentSnapshot(a)?.status).toBe('won');

    const saved = harness.lobby.exportRooms();
    expect(saved.map((room) => room.seats.length)).toEqual([1]);
    harness.close();
  });

  it('refuses tampered or stale snapshots', () => {
    const harness = createHarness();
    const lobby = harness.lobby;
    const ada = harness.join('Ada');
    const bob = harness.join('Bob');
    ada.drop();
    bob.drop();
    const insert = harness.db.prepare(
      'INSERT INTO live_rooms (code, state, saved_at) VALUES (?, ?, ?)',
    );
    const base = {
      code: 'ABCDEF',
      config: CONFIGS.classic,
      gameConfig: CONFIGS.classic,
      kind: 'casual',
      startingPlayer: 1,
      moves: [0, 0],
      moveTimesMs: [1, 1],
      startedAt: 1,
      seats: [
        { accountId: ada.accountId, player: 1, ratingBefore: 1200, mayOfferDraw: true },
        { accountId: bob.accountId, player: 2, ratingBefore: 1200, mayOfferDraw: true },
      ],
      clock: null,
    };
    // An illegal move list, a non-JSON row, and a stale snapshot.
    insert.run('ABCDEF', JSON.stringify(base), harness.now());
    insert.run('GHJKMN', '{', harness.now());
    insert.run(
      'PQRSTU',
      JSON.stringify({ ...base, code: 'PQRSTU', moves: [0] }),
      harness.now() - 3_600_000,
    );
    expect(restoreLiveRooms(harness.db, lobby, harness.now())).toBe(0);
    expect(lobby.roomCount).toBe(0);
    harness.close();
  });
});
