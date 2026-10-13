import { afterEach, describe, expect, it } from 'vitest';
import { BOT_LEVELS, Bots, levelFor } from './bots.js';
import { EngineBusyError, type EngineRunner, InlineEngine } from './engine/pool.js';
import {
  type Client,
  CONFIGS,
  createHarness,
  currentSnapshot,
  type Harness,
} from './test-support.js';

const CASUAL_AFTER = 20_000;

let harness: Harness | null = null;
afterEach(() => {
  harness?.close();
  harness = null;
});

/** A lobby with bot backfill, whose bot moves are played when `drain` is called. */
function setup(engine: EngineRunner = new InlineEngine(), rankedAfterMs: number | null = null) {
  let bots: Bots | null = null;
  const h = createHarness({
    bots: {
      provider: { pick: (rating, config) => bots!.pick(rating, config) },
      casualAfterMs: CASUAL_AFTER,
      rankedAfterMs,
    },
  });
  harness = h;
  const scheduled: (() => void)[] = [];
  bots = new Bots(h.db, h.accounts, engine, {
    schedule: (work) => scheduled.push(work),
    thinkMs: () => 0,
    now: () => h.now(),
    random: () => 0.5,
  });
  bots.attach(h.lobby);
  h.lobby.use(bots);

  /** Let the engine answer and play whatever the bots decided. */
  async function drain(): Promise<void> {
    for (let round = 0; round < 20; round++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      while (scheduled.length) scheduled.shift()!();
    }
  }
  return { h, bots, drain };
}

function botSeat(client: Client) {
  return client.last('matched')?.seats.find((seat) => seat.profile.bot);
}

describe('levelFor', () => {
  it('picks the level nearest the player’s rating', () => {
    expect(levelFor(0).difficulty).toBe('beginner');
    expect(levelFor(1210).difficulty).toBe('medium');
    expect(levelFor(5000).difficulty).toBe('master');
  });

  it('has a level for every difficulty, weakest first', () => {
    const ratings = BOT_LEVELS.map((level) => level.rating);
    expect(ratings).toEqual(ratings.toSorted((a, b) => a - b));
  });
});

describe('bot backfill', () => {
  it('tells the player when a bot will be offered', () => {
    const { h } = setup();
    const a = h.join('Ada');
    a.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    expect(a.last('searching')?.botAt).toBe(h.now() + CASUAL_AFTER);
  });

  it('seats a clearly labelled bot after the wait, unrated', () => {
    const { h } = setup();
    const a = h.join('Ada');
    a.send({ type: 'queue', config: CONFIGS.classic, ranked: false });

    h.advance(CASUAL_AFTER - 1000);
    expect(a.last('matched')).toBeUndefined();

    h.advance(1000);
    const matched = a.last('matched')!;
    expect(matched.kind).toBe('casual');
    const bot = botSeat(a)!;
    expect(bot.profile.bot).toBe(true);
    expect(bot.profile.displayName).toMatch(/Bot/);
    expect(h.lobby.queuedCount).toBe(0);
  });

  it('prefers a person who turns up before the wait is over', () => {
    const { h } = setup();
    const a = h.join('Ada');
    a.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    h.advance(CASUAL_AFTER / 2);
    const b = h.join('Bob');
    b.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    expect(botSeat(a)).toBeUndefined();
    expect(a.last('matched')?.seats.every((seat) => !seat.profile.bot)).toBe(true);
  });

  it('respects a player who asked for people only', () => {
    const { h } = setup();
    const a = h.join('Ada');
    a.send({ type: 'queue', config: CONFIGS.classic, ranked: false, bots: false });
    expect(a.last('searching')?.botAt).toBeNull();
    h.advance(CASUAL_AFTER * 3);
    expect(a.last('matched')).toBeUndefined();
  });

  it('never offers a bot from the ranked queue unless configured to', () => {
    const { h } = setup();
    const a = h.join('Ada');
    a.send({ type: 'queue', config: CONFIGS.grid6, ranked: true });
    h.advance(CASUAL_AFTER * 3);
    expect(a.last('matched')).toBeUndefined();
  });

  it('plays a ranked backfill unrated', async () => {
    const { h, drain } = setup(new InlineEngine(), 30_000);
    const a = h.join('Ada');
    a.send({ type: 'queue', config: CONFIGS.grid6, ranked: true });
    h.advance(30_000);
    expect(a.last('matched')?.kind).toBe('casual');
    a.send({ type: 'resign' });
    await drain();
    expect(a.last('result')?.result.rating).toBeNull();
    expect(h.accounts.statsFor(a.accountId, 'grid-6').rankedPlayed).toBe(0);
  });
});

describe('bot play', () => {
  it('answers every move until the game is over, off the lobby’s own call stack', async () => {
    const { h, drain } = setup();
    const a = h.join('Ada');
    a.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    h.advance(CASUAL_AFTER);

    for (let turn = 0; turn < 9; turn++) {
      await drain();
      const snapshot = currentSnapshot(a)!;
      if (snapshot.status !== 'playing') break;
      const you = a.last('matched')!.you;
      expect(snapshot.currentPlayer).toBe(you);
      const free = snapshot.board.findIndex((cell) => cell === 0);
      a.send({ type: 'move', index: free });
    }
    await drain();

    const result = a.last('result')?.result;
    expect(result).toBeDefined();
    // The bot's record is not kept; the player's is.
    expect(h.accounts.statsFor(a.accountId, 'classic').played).toBe(1);
    expect(h.accounts.statsFor(botSeat(a)!.profile.accountId, 'classic').played).toBe(0);
  });

  it('declines a draw offer at once', () => {
    const { h } = setup();
    const a = h.join('Ada');
    a.send({ type: 'queue', config: CONFIGS.grid6, ranked: false });
    h.advance(CASUAL_AFTER);
    a.send({ type: 'offerDraw' });
    expect(a.last('drawDeclined')).toBeDefined();
  });

  it('agrees to a rematch', async () => {
    const { h, drain } = setup();
    const a = h.join('Ada');
    a.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    h.advance(CASUAL_AFTER);
    a.send({ type: 'resign' });
    await drain();
    a.clear();
    a.send({ type: 'rematch' });
    expect(a.last('matched')).toBeDefined();
    expect(botSeat(a)).toBeDefined();
  });

  it('drops a move computed for a position that has moved on', async () => {
    const { h, drain } = setup();
    const a = h.join('Ada');
    a.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    h.advance(CASUAL_AFTER);
    // Resign before the bot answers: the late answer must not land.
    a.send({ type: 'resign' });
    const moves = currentSnapshot(a)!.moves.length;
    await drain();
    expect(currentSnapshot(a)!.moves.length).toBe(moves);
  });

  it('still moves when the engine pool refuses the job', async () => {
    const busy: EngineRunner = {
      load: 0,
      run: () => Promise.reject(new EngineBusyError()),
      close: async () => {},
    };
    const { h, drain } = setup(busy);
    const a = h.join('Ada');
    a.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    h.advance(CASUAL_AFTER);
    const you = a.last('matched')!.you;
    if (currentSnapshot(a)!.currentPlayer === you) a.send({ type: 'move', index: 4 });
    await drain();
    expect(currentSnapshot(a)!.currentPlayer).toBe(you);
  });

  it('frees the room once the player walks away from a bot', () => {
    const { h } = setup();
    const a = h.join('Ada');
    a.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    h.advance(CASUAL_AFTER);
    expect(h.lobby.roomCount).toBe(1);
    a.drop();
    h.advance(120_000);
    expect(h.lobby.roomCount).toBe(0);
  });

  it('reuses one account per level and never lets anyone sign into it', () => {
    const { h, bots } = setup();
    const first = bots.pick(1200, CONFIGS.classic)!;
    const second = bots.pick(1210, CONFIGS.classic)!;
    expect(first.account.id).toBe(second.account.id);
    expect(first.account.bot).toBe(true);
    const row = h.db
      .prepare<[string], { token_hash: string }>('SELECT token_hash FROM accounts WHERE id = ?')
      .get(first.account.id)!;
    expect(row.token_hash).toBe('!bot');
  });
});
