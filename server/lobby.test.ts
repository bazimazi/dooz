import { modeById, X } from '@/game/engine';
import { PROTOCOL_VERSION } from '@/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type Client,
  CONFIGS,
  createHarness,
  currentSnapshot,
  type Harness,
  playMoves,
  resultOf,
  resultsOf,
} from './test-support.js';

let harness: Harness | null = null;

function newHarness(...args: Parameters<typeof createHarness>): Harness {
  harness?.close();
  harness = createHarness(...args);
  return harness;
}

afterEach(() => {
  harness?.close();
  harness = null;
});

/** Two clients matched into a casual game, ready to move. */
function matched(h: Harness, config = CONFIGS.classic): { a: Client; b: Client } {
  const a = h.join('Ada');
  const b = h.join('Bob');
  a.send({ type: 'queue', config, ranked: false });
  b.send({ type: 'queue', config, ranked: false });
  return { a, b };
}

/** The client whose turn it is, and the one waiting. */
function toMove(a: Client, b: Client): { mover: Client; waiter: Client } {
  const snapshot = currentSnapshot(a)!;
  const you = a.last('matched')!.you;
  return snapshot.currentPlayer === you ? { mover: a, waiter: b } : { mover: b, waiter: a };
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

describe('hello', () => {
  it('welcomes a client with valid credentials', () => {
    const h = newHarness();
    const client = h.join('Ada');

    const welcome = client.last('welcome');
    expect(welcome?.version).toBe(PROTOCOL_VERSION);
    expect(welcome?.profile.displayName).toBe('Ada');
    expect(client.closed).toBe(false);
  });

  it('refuses an unknown account and closes the socket', () => {
    const h = newHarness();
    const client = h.connect();

    client.send({
      type: 'hello',
      version: PROTOCOL_VERSION,
      accountId: '00000000-0000-4000-8000-000000000000',
      token: 'x'.repeat(43),
    });

    expect(client.last('error')?.code).toBe('unauthorized');
    expect(client.closed).toBe(true);
  });

  it('refuses a token that belongs to another account', () => {
    const h = newHarness();
    const ada = h.join('Ada');
    const stranger = h.connect();
    const { account } = h.accounts.create('Bob', 'owl');

    stranger.send({
      type: 'hello',
      version: PROTOCOL_VERSION,
      accountId: account.id,
      token: ada.token,
    });

    expect(stranger.last('error')?.code).toBe('unauthorized');
  });

  it('refuses a protocol version it cannot speak', () => {
    const h = newHarness();
    const client = h.connect();
    const { account, token } = h.accounts.create('Ada', 'fox');

    client.send({ type: 'hello', version: PROTOCOL_VERSION + 1, accountId: account.id, token });

    expect(client.last('error')?.code).toBe('versionMismatch');
    expect(client.closed).toBe(true);
  });

  it('accepts hello only once per connection', () => {
    const h = newHarness();
    const client = h.join('Ada');
    client.clear();

    client.send({
      type: 'hello',
      version: PROTOCOL_VERSION,
      accountId: client.accountId,
      token: client.token,
    });

    expect(client.last('error')?.code).toBe('badMessage');
  });

  it('rejects everything else before hello', () => {
    const h = newHarness();
    const client = h.connect();

    client.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    client.send({ type: 'move', index: 0 });

    expect(client.all('error').map((error) => error.code)).toEqual([
      'unauthorized',
      'unauthorized',
    ]);
  });

  it('hands the account to the newest connection and evicts the old one', () => {
    const h = newHarness();
    const first = h.join('Ada');
    const second = h.connect();

    second.send({
      type: 'hello',
      version: PROTOCOL_VERSION,
      accountId: first.accountId,
      token: first.token,
    });

    expect(first.last('error')?.code).toBe('alreadyPlaying');
    expect(first.closed).toBe(true);
    expect(second.last('welcome')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Matchmaking
// ---------------------------------------------------------------------------

describe('matchmaking', () => {
  it('queues the first player and matches the second', () => {
    const h = newHarness();
    const a = h.join('Ada');
    a.send({ type: 'queue', config: CONFIGS.classic, ranked: false });

    expect(a.last('searching')?.queued).toBe(1);
    expect(a.last('matched')).toBeUndefined();

    const b = h.join('Bob');
    b.send({ type: 'queue', config: CONFIGS.classic, ranked: false });

    expect(a.last('matched')).toBeDefined();
    expect(b.last('matched')).toBeDefined();
    expect(a.last('matched')?.you).not.toBe(b.last('matched')?.you);
    expect(a.last('matched')?.code).toBe(b.last('matched')?.code);
  });

  it('does not match players who asked for different games', () => {
    const h = newHarness();
    const a = h.join('Ada');
    const b = h.join('Bob');

    a.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    b.send({ type: 'queue', config: CONFIGS.grid6, ranked: false });

    expect(a.last('matched')).toBeUndefined();
    expect(b.last('matched')).toBeUndefined();
  });

  it('keeps ranked and casual queues apart', () => {
    const h = newHarness();
    const a = h.join('Ada');
    const b = h.join('Bob');

    a.send({ type: 'queue', config: CONFIGS.classic, ranked: true });
    b.send({ type: 'queue', config: CONFIGS.classic, ranked: false });

    expect(a.last('matched')).toBeUndefined();
    expect(b.last('matched')).toBeUndefined();
  });

  it('refuses a ranked game in a mode with no ladder', () => {
    const h = newHarness();
    const a = h.join('Ada');

    a.send({
      type: 'queue',
      config: { variant: 'classic', size: 7, winLength: 4 },
      ranked: true,
    });

    expect(a.last('error')?.code).toBe('notRankable');
  });

  it('will not match ratings far apart until the band has widened', () => {
    const h = newHarness();
    const a = h.join('Ada');
    const b = h.join('Bob');

    // Put 600 points between them, which no opening band covers.
    h.accounts.recordResult(a.accountId, 'classic', 'win', 1800);
    h.accounts.recordResult(b.accountId, 'classic', 'loss', 1100);

    a.send({ type: 'queue', config: CONFIGS.classic, ranked: true });
    b.send({ type: 'queue', config: CONFIGS.classic, ranked: true });
    expect(a.last('matched')).toBeUndefined();

    // After the band has grown past the gap, the periodic sweep pairs them.
    h.advance(46_000);
    expect(a.last('matched')).toBeDefined();
    expect(b.last('matched')).toBeDefined();
  });

  it('skips over a player who dropped while waiting', () => {
    const h = newHarness();
    const gone = h.join('Ghost');
    gone.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    gone.drop();

    const a = h.join('Ada');
    a.send({ type: 'queue', config: CONFIGS.classic, ranked: false });

    expect(a.last('matched')).toBeUndefined();
    expect(a.last('searching')).toBeDefined();
  });

  it('never matches an account with itself', () => {
    const h = newHarness();
    const a = h.join('Ada');
    a.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    a.send({ type: 'queue', config: CONFIGS.classic, ranked: false });

    expect(a.last('matched')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Private rooms
// ---------------------------------------------------------------------------

describe('private rooms', () => {
  it('creates a room and lets a friend join by code', () => {
    const h = newHarness();
    const host = h.join('Ada');
    host.send({ type: 'createRoom', config: CONFIGS.classic });

    const code = host.last('roomCreated')!.code;
    expect(code).toMatch(/^[A-Z2-9]{6}$/);

    const guest = h.join('Bob');
    guest.send({ type: 'joinRoom', code });

    expect(host.last('matched')?.kind).toBe('private');
    expect(guest.last('matched')?.kind).toBe('private');
  });

  it('refuses a third player', () => {
    const h = newHarness();
    const host = h.join('Ada');
    host.send({ type: 'createRoom', config: CONFIGS.classic });
    const code = host.last('roomCreated')!.code;

    h.join('Bob').send({ type: 'joinRoom', code });
    const third = h.join('Cat');
    third.send({ type: 'joinRoom', code });

    expect(third.last('error')?.code).toBe('roomFull');
  });

  it('refuses an unknown code', () => {
    const h = newHarness();
    const client = h.join('Ada');
    client.send({ type: 'joinRoom', code: 'ZZZZZZ' });

    expect(client.last('error')?.code).toBe('roomNotFound');
  });

  it('never makes a private game ranked', () => {
    const h = newHarness();
    const host = h.join('Ada');
    host.send({ type: 'createRoom', config: CONFIGS.classic });
    const code = host.last('roomCreated')!.code;
    const guest = h.join('Bob');
    guest.send({ type: 'joinRoom', code });

    const { mover, waiter } = toMove(host, guest);
    playMoves(mover, waiter, [0, 3, 1, 4, 2]);

    expect(resultOf(host)?.kind).toBe('private');
    expect(resultOf(host)?.rating).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Playing
// ---------------------------------------------------------------------------

describe('moves', () => {
  it('applies a legal move and sends both players the new board', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover } = toMove(a, b);

    mover.send({ type: 'move', index: 4 });

    expect(currentSnapshot(a)!.board[4]).not.toBe(0);
    expect(currentSnapshot(b)!.board[4]).toBe(currentSnapshot(a)!.board[4]);
  });

  it('refuses a move from the player who is not to move', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { waiter } = toMove(a, b);

    waiter.send({ type: 'move', index: 0 });

    expect(waiter.last('error')?.code).toBe('notYourTurn');
  });

  it('refuses a move onto an occupied square', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover, waiter } = toMove(a, b);

    mover.send({ type: 'move', index: 4 });
    waiter.send({ type: 'move', index: 4 });

    expect(waiter.last('error')?.code).toBe('illegalMove');
  });

  it('refuses a move off the end of the board', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover } = toMove(a, b);

    mover.send({ type: 'move', index: 9999 });

    expect(mover.last('error')?.code).toBe('illegalMove');
  });

  it('refuses a duplicate of the move just played', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover, waiter } = toMove(a, b);

    mover.send({ type: 'move', index: 4 });
    mover.send({ type: 'move', index: 4 });

    expect(mover.last('error')?.code).toBe('notYourTurn');
    expect(currentSnapshot(waiter)!.moves).toEqual([4]);
  });

  it('refuses a move from somebody not in a game', () => {
    const h = newHarness();
    const client = h.join('Ada');
    client.send({ type: 'move', index: 0 });

    expect(client.last('error')?.code).toBe('notInRoom');
  });

  it('freezes the game once it is won', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover, waiter } = toMove(a, b);

    playMoves(mover, waiter, [0, 3, 1, 4, 2]);

    const snapshot = currentSnapshot(a)!;
    expect(snapshot.status).toBe('won');
    mover.clear();
    mover.send({ type: 'move', index: 5 });
    expect(mover.last('error')).toBeDefined();
  });

  it('enforces the forced-board rule in Ultimate', () => {
    const h = newHarness();
    const { a, b } = matched(h, CONFIGS.ultimate);
    const { mover, waiter } = toMove(a, b);

    // Board 4 cell 0 sends the opponent to board 0.
    mover.send({ type: 'move', index: 30 });
    expect(currentSnapshot(a)!.ultimate?.activeBoard).toBe(0);

    waiter.send({ type: 'move', index: 40 });
    expect(waiter.last('error')?.code).toBe('illegalMove');

    waiter.send({ type: 'move', index: 1 });
    expect(currentSnapshot(a)!.board[1]).not.toBe(0);
  });

  it('gives misere games to the player who did not make the line', () => {
    const h = newHarness();
    const { a, b } = matched(h, CONFIGS.misere);
    const { mover, waiter } = toMove(a, b);

    playMoves(mover, waiter, [0, 3, 1, 4, 2]);

    const snapshot = currentSnapshot(a)!;
    const opener = mover.last('matched')!.you;
    expect(snapshot.status).toBe('won');
    expect(snapshot.winner).not.toBe(opener);
  });

  it('refuses a gravity move that would float', () => {
    const h = newHarness();
    const { a, b } = matched(h, CONFIGS.gravity);
    const { mover, waiter } = toMove(a, b);

    // Row 0 of an empty 7x7 board has nothing under it.
    mover.send({ type: 'move', index: 3 });
    expect(mover.last('error')?.code).toBe('illegalMove');

    // The floor of the same column is fine, and the square above it opens.
    mover.send({ type: 'move', index: 45 });
    waiter.send({ type: 'move', index: 38 });
    expect(currentSnapshot(a)!.board[38]).not.toBe(0);
  });

  it('lifts the oldest mark in a vanish game, on the server', () => {
    const h = newHarness();
    const { a, b } = matched(h, CONFIGS.vanish);
    const { mover, waiter } = toMove(a, b);

    // Six marks down, then the opener's fourth lifts its first (square 0).
    playMoves(mover, waiter, [0, 4, 2, 1, 7, 3, 5]);
    const snapshot = currentSnapshot(a)!;
    expect(snapshot.status).toBe('playing');
    expect(snapshot.board[0]).toBe(0);
    expect(snapshot.board.filter((cell) => cell !== 0)).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// Ending a game
// ---------------------------------------------------------------------------

describe('results', () => {
  it('reports a win with the reason and the match id', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover, waiter } = toMove(a, b);

    playMoves(mover, waiter, [0, 3, 1, 4, 2]);

    const result = resultOf(a)!;
    expect(result.reason).toBe('line');
    expect(result.winner).toBe(mover.last('matched')!.you);
    expect(result.matchId).toHaveLength(36);
    expect(resultOf(b)?.matchId).toBe(result.matchId);
  });

  it('scores a game exactly once', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover, waiter } = toMove(a, b);

    playMoves(mover, waiter, [0, 3, 1, 4, 2]);
    // Anything that might settle it again must be ignored.
    mover.send({ type: 'resign' });
    h.advance(120_000);

    expect(resultsOf(a)).toHaveLength(1);
    expect(h.accounts.statsFor(a.accountId, 'classic').played).toBe(1);
  });

  it('awards a resignation to the opponent', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover, waiter } = toMove(a, b);

    mover.send({ type: 'resign' });

    expect(resultOf(a)?.reason).toBe('resign');
    expect(resultOf(a)?.winner).toBe(waiter.last('matched')!.you);
  });

  it('treats walking out of a live game as a resignation', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover, waiter } = toMove(a, b);

    mover.send({ type: 'leave' });

    expect(resultOf(waiter)?.reason).toBe('resign');
    expect(resultOf(waiter)?.winner).toBe(waiter.last('matched')!.you);
  });

  it('draws by agreement, and only after both sides agree', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover, waiter } = toMove(a, b);

    mover.send({ type: 'offerDraw' });
    expect(waiter.last('drawOffered')).toBeDefined();
    expect(resultOf(a)).toBeUndefined();

    waiter.send({ type: 'respondDraw', accept: true });
    expect(resultOf(a)?.reason).toBe('agreed');
    expect(resultOf(a)?.winner).toBeNull();
  });

  it('lets a draw offer be declined', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover, waiter } = toMove(a, b);

    mover.send({ type: 'offerDraw' });
    waiter.send({ type: 'respondDraw', accept: false });

    expect(mover.last('drawDeclined')).toBeDefined();
    expect(resultOf(a)).toBeUndefined();
  });

  it('refuses a second draw offer until the offerer has moved again', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover, waiter } = toMove(a, b);

    mover.send({ type: 'offerDraw' });
    waiter.send({ type: 'respondDraw', accept: false });
    waiter.clear();

    // Asking again straight away must not put the banner back up.
    mover.send({ type: 'offerDraw' });
    expect(waiter.last('drawOffered')).toBeUndefined();

    // Playing a move earns the right back.
    mover.send({ type: 'move', index: 0 });
    waiter.send({ type: 'move', index: 1 });
    mover.send({ type: 'offerDraw' });
    expect(waiter.last('drawOffered')).toBeDefined();
  });

  it('ignores an acceptance nobody offered', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { waiter } = toMove(a, b);

    waiter.send({ type: 'respondDraw', accept: true });

    expect(resultOf(a)).toBeUndefined();
  });

  it('records the match so it can be replayed', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover, waiter } = toMove(a, b);

    playMoves(mover, waiter, [0, 3, 1, 4, 2]);
    const matchId = resultOf(a)!.matchId;

    const record = h.matches.find(matchId, a.accountId, (id) => h.accounts.get(id));
    expect(record?.moves).toEqual([0, 3, 1, 4, 2]);
    expect(record?.mode).toBe('classic');
    expect(record?.moveTimesMs).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// Clocks
// ---------------------------------------------------------------------------

describe('clocks', () => {
  it('runs the clock of whoever is to move', () => {
    const h = newHarness();
    const { a } = matched(h);

    const clock = a.last('matched')!.clock!;
    expect(clock.running).toBe(currentSnapshot(a)!.currentPlayer);
    expect(clock.x).toBe(modeById('classic').clock.initialSeconds * 1000);
  });

  it('deducts thinking time and adds the increment on a move', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover } = toMove(a, b);
    const initial = a.last('matched')!.clock!;

    h.advance(10_000);
    mover.send({ type: 'move', index: 4 });

    const after = a.last('state')!.clock!;
    const side = mover.last('matched')!.you === X ? 'x' : 'o';
    const increment = modeById('classic').clock.incrementSeconds * 1000;
    expect(after[side]).toBe(initial[side] - 10_000 + increment);
    expect(after.running).not.toBe(mover.last('matched')!.you);
  });

  it('awards the game when a clock runs out', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { waiter } = toMove(a, b);

    h.advance(modeById('classic').clock.initialSeconds * 1000 + 1000);

    expect(resultOf(a)?.reason).toBe('timeout');
    expect(resultOf(a)?.winner).toBe(waiter.last('matched')!.you);
  });

  it('refuses a move that arrives after the flag has fallen', () => {
    const h = newHarness();
    const { a, b } = matched(h, CONFIGS.classic);
    const { mover, waiter } = toMove(a, b);

    h.advance(modeById('classic').clock.initialSeconds * 1000 + 1000);
    mover.send({ type: 'move', index: 4 });

    // A match decided on time leaves a board that is still mid-game, so the
    // board's own status is not what closes it - the result is.
    expect(mover.last('error')?.code).toBe('notYourTurn');
    expect(currentSnapshot(waiter)!.board.every((cell) => cell === 0)).toBe(true);
  });

  it('keeps the clock running through a disconnection', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover, waiter } = toMove(a, b);

    mover.drop();
    h.advance(modeById('classic').clock.initialSeconds * 1000 + 1000);

    expect(resultOf(waiter)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Ratings and statistics
// ---------------------------------------------------------------------------

describe('ratings', () => {
  it('moves both ratings in a ranked game, and by opposite amounts', () => {
    const h = newHarness();
    const a = h.join('Ada');
    const b = h.join('Bob');
    a.send({ type: 'queue', config: CONFIGS.classic, ranked: true });
    b.send({ type: 'queue', config: CONFIGS.classic, ranked: true });

    const { mover, waiter } = toMove(a, b);
    playMoves(mover, waiter, [0, 3, 1, 4, 2]);

    const rating = resultOf(a)!.rating!;
    expect(rating).not.toBeNull();
    const winnerIsX = resultOf(a)!.winner === X;
    const winner = winnerIsX ? rating.x : rating.o;
    const loser = winnerIsX ? rating.o : rating.x;

    expect(winner.after).toBeGreaterThan(winner.before);
    expect(loser.after).toBeLessThan(loser.before);
    expect(winner.after - winner.before).toBe(loser.before - loser.after);
  });

  it('leaves ratings alone in a casual game but still counts it', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover, waiter } = toMove(a, b);

    playMoves(mover, waiter, [0, 3, 1, 4, 2]);

    expect(resultOf(a)?.rating).toBeNull();
    const stats = h.accounts.statsFor(a.accountId, 'classic');
    expect(stats.played).toBe(1);
    expect(stats.rating).toBe(1200);
  });

  it('counts wins, losses and draws separately', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover, waiter } = toMove(a, b);

    playMoves(mover, waiter, [0, 3, 1, 4, 2]);

    const winner = h.accounts.statsFor(mover.accountId, 'classic');
    const loser = h.accounts.statsFor(waiter.accountId, 'classic');
    expect(winner.won).toBe(1);
    expect(winner.streak).toBe(1);
    expect(loser.lost).toBe(1);
    expect(loser.streak).toBe(0);
  });

  it('unlocks an achievement on a first win', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover, waiter } = toMove(a, b);

    playMoves(mover, waiter, [0, 3, 1, 4, 2]);

    const unlocked = h.accounts.achievements(mover.accountId).map((entry) => entry.id);
    expect(unlocked).toContain('first-win');
    // Five moves on a 3x3 board is as fast as a win can be.
    expect(unlocked).toContain('sharpshooter');
  });
});

// ---------------------------------------------------------------------------
// Reconnection and abandonment
// ---------------------------------------------------------------------------

describe('reconnection', () => {
  it('tells a fresh connection whether a seat is waiting for it', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover } = toMove(a, b);

    // A connection with nothing to come back to is idle and should act on
    // whatever the player asked for.
    expect(h.join('Cat').last('welcome')?.resumed).toBe(false);

    const accountId = mover.accountId;
    const token = mover.token;
    mover.drop();

    const back = h.connect();
    back.send({ type: 'hello', version: PROTOCOL_VERSION, accountId, token });

    // A reconnect has a game on the way, and must not be treated as idle: a
    // client that queues here abandons the game it was about to rejoin.
    expect(back.last('welcome')?.resumed).toBe(true);
    expect(back.last('matched')).toBeDefined();
  });

  it('holds the seat and puts a returning player back in the game', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover, waiter } = toMove(a, b);
    mover.send({ type: 'move', index: 4 });

    const accountId = mover.accountId;
    const token = mover.token;
    mover.drop();
    expect(waiter.last('seats')?.seats.some((seat) => !seat.connected)).toBe(true);

    const back = h.connect();
    back.send({ type: 'hello', version: PROTOCOL_VERSION, accountId, token });

    const resumed = back.last('matched');
    expect(resumed).toBeDefined();
    expect(resumed?.snapshot.board[4]).not.toBe(0);
    expect(resumed?.you).toBeDefined();
  });

  it('awards the game once a player has been gone too long', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover, waiter } = toMove(a, b);

    mover.drop();
    h.advance(61_000);

    expect(resultOf(waiter)?.reason).toBe('abandoned');
    expect(resultOf(waiter)?.winner).toBe(waiter.last('matched')!.you);
  });

  it('does not award a game when both players have gone', () => {
    const h = newHarness();
    const { a, b } = matched(h);

    a.drop();
    b.drop();
    h.advance(61_000);

    expect(resultOf(a)).toBeUndefined();
    expect(resultOf(b)).toBeUndefined();
  });

  it('drops a room once everyone has been gone past the grace period', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    expect(h.lobby.roomCount).toBe(1);

    a.drop();
    b.drop();
    h.advance(120_000);

    expect(h.lobby.roomCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Rematch
// ---------------------------------------------------------------------------

describe('rematch', () => {
  it('resets the board once both players have asked', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover, waiter } = toMove(a, b);
    playMoves(mover, waiter, [0, 3, 1, 4, 2]);

    a.send({ type: 'rematch' });
    expect(b.last('rematchOffered')).toBeDefined();
    expect(currentSnapshot(a)!.status).toBe('won');

    b.send({ type: 'rematch' });
    const fresh = currentSnapshot(a)!;
    expect(fresh.status).toBe('playing');
    expect(fresh.board.every((cell) => cell === 0)).toBe(true);
  });

  it('starts a fresh clock for the rematch', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover, waiter } = toMove(a, b);
    h.advance(20_000);
    playMoves(mover, waiter, [0, 3, 1, 4, 2]);

    a.send({ type: 'rematch' });
    b.send({ type: 'rematch' });

    const clock = a.last('matched')!.clock!;
    expect(clock.x).toBe(modeById('classic').clock.initialSeconds * 1000);
    expect(clock.o).toBe(modeById('classic').clock.initialSeconds * 1000);
  });

  it('scores the rematch as its own match', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const first = toMove(a, b);
    playMoves(first.mover, first.waiter, [0, 3, 1, 4, 2]);

    a.send({ type: 'rematch' });
    b.send({ type: 'rematch' });

    const second = toMove(a, b);
    playMoves(second.mover, second.waiter, [0, 3, 1, 4, 2]);

    expect(resultsOf(a)).toHaveLength(2);
    expect(resultsOf(a)[0]!.matchId).not.toBe(resultsOf(a)[1]!.matchId);
    expect(h.accounts.statsFor(a.accountId, 'classic').played).toBe(2);
  });

  it('does not reset the board on a rematch asked for mid-game', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    const { mover } = toMove(a, b);
    mover.send({ type: 'move', index: 4 });

    a.send({ type: 'rematch' });
    b.send({ type: 'rematch' });

    expect(currentSnapshot(a)!.board[4]).not.toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Spectating and emotes
// ---------------------------------------------------------------------------

describe('spectating', () => {
  it('shows a watcher the game without giving them a seat', () => {
    const h = newHarness();
    const host = h.join('Ada');
    host.send({ type: 'createRoom', config: CONFIGS.classic });
    const code = host.last('roomCreated')!.code;
    const guest = h.join('Bob');
    guest.send({ type: 'joinRoom', code });

    const watcher = h.join('Cat');
    watcher.send({ type: 'spectate', code });

    expect(watcher.last('matched')?.you).toBeNull();
    expect(host.last('spectators')?.count).toBe(1);

    watcher.send({ type: 'move', index: 0 });
    expect(watcher.last('error')?.code).toBe('notInRoom');
  });

  it('sends watchers every move', () => {
    const h = newHarness();
    const host = h.join('Ada');
    host.send({ type: 'createRoom', config: CONFIGS.classic });
    const code = host.last('roomCreated')!.code;
    const guest = h.join('Bob');
    guest.send({ type: 'joinRoom', code });
    const watcher = h.join('Cat');
    watcher.send({ type: 'spectate', code });
    watcher.clear();

    const { mover } = toMove(host, guest);
    mover.send({ type: 'move', index: 4 });

    expect(watcher.last('state')?.snapshot.board[4]).not.toBe(0);
  });
});

describe('emotes', () => {
  it('passes an emote to the opponent', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    b.clear();

    a.send({ type: 'emote', emote: 'gg' });

    expect(b.last('emote')?.emote).toBe('gg');
    expect(b.last('emote')?.from).toBe(a.last('matched')!.you);
  });

  it('withholds emotes from a player who muted', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    b.send({ type: 'mute', muted: true });
    b.clear();

    a.send({ type: 'emote', emote: 'hurry' });

    expect(b.last('emote')).toBeUndefined();
  });

  it('rate-limits a player spamming emotes', () => {
    const h = newHarness();
    const { a, b } = matched(h);
    b.clear();

    for (let i = 0; i < 10; i++) a.send({ type: 'emote', emote: 'hello' });

    // The bucket holds three; the rest are dropped rather than delivered.
    expect(b.all('emote').length).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Abuse
// ---------------------------------------------------------------------------

describe('limits', () => {
  it('rate-limits a flood of messages', () => {
    const h = newHarness({ messageBurst: 5, messagesPerSecond: 0 });
    const client = h.join('Ada');

    for (let i = 0; i < 20; i++) client.send({ type: 'ping' });

    expect(client.all('error').some((error) => error.code === 'rateLimited')).toBe(true);
    expect(client.all('pong').length).toBeLessThanOrEqual(5);
  });

  it('refuses to open more rooms than it will hold', () => {
    const h = newHarness({ maxRooms: 1 });
    const first = h.join('Ada');
    first.send({ type: 'createRoom', config: CONFIGS.classic });

    const second = h.join('Bob');
    second.send({ type: 'createRoom', config: CONFIGS.classic });

    expect(second.last('error')?.code).toBe('serverFull');
  });

  it('reports capacity once the session ceiling is reached', () => {
    const h = newHarness({ maxSessions: 1 });
    h.join('Ada');
    expect(h.lobby.atCapacity).toBe(true);
  });

  it('rejects a game config the rules cannot run', () => {
    const h = newHarness();
    const client = h.join('Ada');

    client.send({
      type: 'queue',
      config: { variant: 'ultimate', size: 6, winLength: 3 },
      ranked: false,
    });

    expect(client.last('error')?.code).toBe('badMessage');
  });
});
