import { modeById } from '@/game/engine';
import { afterEach, describe, expect, it } from 'vitest';
import { AntiCheat, analysable, THRESHOLDS } from './anticheat.js';
import type { AnalyseJob, EngineJob, SideAnalysis } from './engine/jobs.js';
import { type EngineRunner, InlineEngine } from './engine/pool.js';
import { Seasons } from './seasons.js';
import {
  type Client,
  CONFIGS,
  createHarness,
  currentSnapshot,
  type Harness,
} from './test-support.js';

let harness: Harness | null = null;
afterEach(() => {
  harness?.close();
  harness = null;
});

function setup(engine: EngineRunner = new InlineEngine()) {
  const h = createHarness();
  harness = h;
  const antiCheat = new AntiCheat(h.db, engine, {
    now: () => h.now(),
    budgetMs: 5,
    maxPositions: 4,
  });
  h.lobby.use(antiCheat);
  return { h, antiCheat };
}

function side(positions: number, matched: number, timeCv = 0.8): SideAnalysis {
  return {
    player: 1,
    positions,
    matched,
    topRate: positions ? matched / positions : 0,
    meanMs: 2000,
    timeCv,
  };
}

/**
 * Queue two players for ranked until they are matched, waiting out
 * recent-opponent avoidance and, as their ratings drift apart, the band.
 */
function rankedGame(h: Harness, a: Client, b: Client): void {
  a.clear();
  b.clear();
  a.send({ type: 'queue', config: CONFIGS.grid6, ranked: true });
  b.send({ type: 'queue', config: CONFIGS.grid6, ranked: true });
  for (let wait = 0; wait < 5 && !a.last('matched'); wait++) h.advance(12_000);
  if (!a.last('matched')) throw new Error('not matched');
}

describe('analysable', () => {
  it('skips boards small enough to know by heart', () => {
    expect(analysable(modeById('classic').config)).toBe(false);
    expect(analysable(modeById('grid-6').config)).toBe(true);
    expect(analysable(modeById('ultimate').config)).toBe(true);
  });
});

describe('engine agreement', () => {
  it('waits for enough positions before judging anyone', () => {
    const { h, antiCheat } = setup();
    const { account } = h.accounts.create('Quick', 'fox');
    antiCheat.ingest('m1', account.id, 'grid-6', side(20, 20));
    expect(antiCheat.flagsFor(account.id)).toEqual([]);
  });

  it('flags near-perfect agreement across many games as high, and quarantines', () => {
    const { h, antiCheat } = setup();
    const { account } = h.accounts.create('Engine', 'fox');
    for (let game = 0; game < 4; game++) {
      antiCheat.ingest(`m${game}`, account.id, 'grid-6', side(20, 19));
    }
    const [flag] = antiCheat.flagsFor(account.id);
    expect(flag).toMatchObject({ kind: 'engine', severity: 'high', status: 'open' });
    expect(flag!.detail['games']).toBeGreaterThanOrEqual(3);
    expect(antiCheat.isQuarantined(account.id)).toBe(true);
  });

  it('needs machine-even timing as well before flagging merely strong play', () => {
    const { h, antiCheat } = setup();
    const human = h.accounts.create('Human', 'fox').account;
    const script = h.accounts.create('Script', 'fox').account;
    for (let game = 0; game < 4; game++) {
      antiCheat.ingest(`h${game}`, human.id, 'grid-6', side(20, 17, 0.9));
      antiCheat.ingest(`s${game}`, script.id, 'grid-6', side(20, 17, 0.1));
    }
    expect(antiCheat.flagsFor(human.id)).toEqual([]);
    expect(antiCheat.flagsFor(script.id)[0]).toMatchObject({ severity: 'medium' });
    expect(antiCheat.isQuarantined(script.id)).toBe(false);
  });

  it('does not stack duplicate flags, but escalates one', () => {
    const { h, antiCheat } = setup();
    const { account } = h.accounts.create('Escalate', 'fox');
    for (let game = 0; game < 4; game++) {
      antiCheat.ingest(`a${game}`, account.id, 'grid-6', side(20, 17, 0.1));
    }
    for (let game = 0; game < 8; game++) {
      antiCheat.ingest(`b${game}`, account.id, 'grid-6', side(20, 20, 0.1));
    }
    const flags = antiCheat.flagsFor(account.id);
    expect(flags).toHaveLength(1);
    expect(flags[0]!.severity).toBe('high');
  });

  it('analyses a finished ranked game on a worker, off the lobby’s call stack', async () => {
    const jobs: EngineJob[] = [];
    const inline = new InlineEngine();
    const spy: EngineRunner = {
      load: 0,
      run: (job) => {
        jobs.push(job);
        return inline.run(job);
      },
      close: async () => {},
    };
    const { h, antiCheat } = setup(spy);
    const a = h.join('Ada');
    const b = h.join('Bob');
    rankedGame(h, a, b);

    // Play out a dozen quiet moves, then resign.
    const order = [0, 35, 5, 30, 12, 23, 17, 18, 2, 33, 7, 28];
    for (const move of order) {
      const you = a.last('matched')!.you;
      const mover = currentSnapshot(a)!.currentPlayer === you ? a : b;
      mover.send({ type: 'move', index: move });
    }
    a.send({ type: 'resign' });
    expect(jobs).toHaveLength(1);
    expect((jobs[0] as AnalyseJob).moves).toHaveLength(order.length);

    await antiCheat.idle();
    const rows = h.db
      .prepare<[], { account_id: string }>('SELECT account_id FROM anticheat_games')
      .all();
    expect(rows.map((row) => row.account_id).toSorted()).toEqual(
      [a.accountId, b.accountId].toSorted(),
    );
  });

  it('leaves casual games and short games alone', () => {
    const jobs: EngineJob[] = [];
    const { h } = setup({
      load: 0,
      run: (job) => {
        jobs.push(job);
        return new Promise(() => {});
      },
      close: async () => {},
    });
    const a = h.join('Ada');
    const b = h.join('Bob');
    a.send({ type: 'queue', config: CONFIGS.grid6, ranked: false });
    b.send({ type: 'queue', config: CONFIGS.grid6, ranked: false });
    a.send({ type: 'resign' });
    rankedGame(h, a, b);
    a.send({ type: 'resign' });
    expect(jobs).toEqual([]);
  });
});

describe('win trading', () => {
  it('flags a pair that keeps playing with one side always winning', () => {
    const { h, antiCheat } = setup();
    const feeder = h.join('Feeder');
    const farmer = h.join('Farmer');
    for (let game = 0; game < THRESHOLDS.tradingGames; game++) {
      rankedGame(h, feeder, farmer);
      // Make a few moves so it is not also a fast resignation.
      for (const move of [0, 35, 5, 30, 12]) {
        const you = feeder.last('matched')!.you;
        const mover = currentSnapshot(feeder)!.currentPlayer === you ? feeder : farmer;
        mover.send({ type: 'move', index: move });
      }
      feeder.send({ type: 'resign' });
    }

    const kinds = (id: string) => antiCheat.flagsFor(id).map((flag) => flag.kind);
    expect(kinds(feeder.accountId)).toContain('win-trading');
    expect(kinds(farmer.accountId)).toContain('win-trading');
    expect(antiCheat.flagsFor(farmer.accountId)[0]!.relatedId).toBe(feeder.accountId);
  });
});

describe('fast resignations', () => {
  it('flags an account throwing ranked games, high when they all go to one account', () => {
    const { h, antiCheat } = setup();
    const thrower = h.join('Thrower');
    const taker = h.join('Taker');
    for (let game = 0; game < THRESHOLDS.fastResignCount; game++) {
      rankedGame(h, thrower, taker);
      thrower.send({ type: 'resign' });
    }
    const flag = antiCheat
      .flagsFor(thrower.accountId)
      .find((entry) => entry.kind === 'fast-resign');
    expect(flag).toMatchObject({ severity: 'high', relatedId: taker.accountId });
  });
});

describe('moderation', () => {
  it('lists open flags, high first, and ends the quarantine when resolved', () => {
    const { h, antiCheat } = setup();
    const seasons = new Seasons(h.db, { now: () => h.now() });
    const { account } = h.accounts.create('Suspect', 'fox');
    const medium = h.accounts.create('Maybe', 'fox').account;
    for (let game = 0; game < 4; game++) {
      antiCheat.ingest(`m${game}`, account.id, 'grid-6', side(20, 20));
      antiCheat.ingest(`n${game}`, medium.id, 'grid-6', side(20, 17, 0.1));
    }
    for (let game = 0; game < 5; game++) {
      h.accounts.recordResult(
        account.id,
        'grid-6',
        'win',
        { rating: 1500, rd: 60, volatility: 0.06 },
        true,
        seasons.seasonId(),
      );
    }

    const open = antiCheat.openFlags();
    expect(open.map((flag) => flag.severity)).toEqual(['high', 'medium']);
    expect(seasons.rankOf(account.id, 'grid-6', seasons.seasonId())).toBeNull();

    expect(antiCheat.resolve(open[0]!.id, 'cleared', 'mod-1', 'Strong player')).toBe(true);
    expect(antiCheat.resolve(open[0]!.id, 'actioned', 'mod-1')).toBe(false);
    expect(antiCheat.isQuarantined(account.id)).toBe(false);
    expect(seasons.rankOf(account.id, 'grid-6', seasons.seasonId())).toBe(1);
    expect(antiCheat.flagsFor(account.id)[0]).toMatchObject({
      status: 'cleared',
      reviewedBy: 'mod-1',
      note: 'Strong player',
    });
  });
});
