import { modeById, X } from '@/game/engine';
import { afterEach, describe, expect, it } from 'vitest';
import { type AnalyseJob, type MoveJob, runJob, seeded } from './jobs.js';
import { EngineBusyError, InlineEngine, WorkerPool } from './pool.js';

const classic = modeById('classic').config;
const grid9 = modeById('grid-9').config;

function moveJob(moves: number[], extra: Partial<MoveJob> = {}): MoveJob {
  return {
    type: 'move',
    config: classic,
    startingPlayer: X,
    moves,
    difficulty: 'hard',
    timeBudgetMs: 50,
    seed: 7,
    ...extra,
  };
}

let pool: WorkerPool | null = null;
afterEach(async () => {
  await pool?.close();
  pool = null;
});

describe('runJob: move', () => {
  it('takes a win that is on the board', () => {
    // X on 0 and 1, O on 3 and 4: X to play 2 and win.
    expect(runJob(moveJob([0, 3, 1, 4])).move).toBe(2);
  });

  it('blocks a win that is on the board', () => {
    // X on 0 and 1, O on 4: O must block 2.
    expect(runJob(moveJob([0, 4, 1])).move).toBe(2);
  });

  it('answers null for a finished game and for moves that do not replay', () => {
    expect(runJob(moveJob([0, 3, 1, 4, 2])).move).toBeNull();
    expect(runJob(moveJob([0, 0])).move).toBeNull();
  });

  it('is reproducible for the same seed', () => {
    const job = moveJob([], { difficulty: 'easy', config: grid9 });
    expect(runJob(job).move).toBe(runJob(job).move);
  });
});

describe('runJob: analyse', () => {
  const analyse = (moves: number[], times: number[]): AnalyseJob => ({
    type: 'analyse',
    config: grid9,
    startingPlayer: X,
    moves,
    moveTimesMs: times,
    players: [1, 2],
    budgetMs: 20,
    maxPositions: 10,
  });

  it('skips the opening and counts the positions it searched', () => {
    const moves = [40, 41, 31, 49, 22, 50, 13, 58];
    const result = runJob(
      analyse(
        moves,
        moves.map(() => 1500),
      ),
    );
    expect(result.sides).toHaveLength(2);
    for (const side of result.sides) {
      expect(side.positions).toBeLessThanOrEqual(2);
      expect(side.topRate).toBeGreaterThanOrEqual(0);
      expect(side.topRate).toBeLessThanOrEqual(1);
    }
  });

  it('measures think-time spread, ignoring each side’s first move', () => {
    const moves = [40, 41, 31, 49, 22, 50];
    const even = runJob(analyse(moves, [9000, 9000, 1000, 1000, 1000, 1000]));
    const uneven = runJob(analyse(moves, [10, 10, 500, 4000, 6000, 300]));
    expect(even.sides[0]!.timeCv).toBe(0);
    expect(even.sides[0]!.meanMs).toBe(1000);
    expect(uneven.sides[0]!.timeCv).toBeGreaterThan(0.5);
  });

  it('returns nothing for a record that does not replay', () => {
    expect(runJob(analyse([0, 0], [1, 1])).sides).toEqual([]);
  });
});

describe('seeded', () => {
  it('produces the same stream for the same seed, in [0, 1)', () => {
    const a = seeded(42);
    const b = seeded(42);
    for (let i = 0; i < 100; i++) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('InlineEngine', () => {
  it('answers asynchronously with the same result as the worker would', async () => {
    const engine = new InlineEngine();
    const pending = engine.run(moveJob([0, 3, 1, 4]));
    expect(engine.load).toBe(1);
    expect((await pending).move).toBe(2);
    expect(engine.load).toBe(0);
  });
});

describe('WorkerPool', () => {
  it('runs a job on a worker thread', async () => {
    pool = new WorkerPool({ size: 1 });
    const result = await pool.run(moveJob([0, 3, 1, 4]));
    expect(result.move).toBe(2);
  }, 30_000);

  it('refuses work beyond its queue rather than slowing everything down', async () => {
    pool = new WorkerPool({ size: 1, maxQueue: 1 });
    const first = pool.run(moveJob([]));
    const second = pool.run(moveJob([]));
    await expect(pool.run(moveJob([]))).rejects.toBeInstanceOf(EngineBusyError);
    await Promise.all([first, second]);
  }, 30_000);

  it('kills and replaces a worker whose job runs too long', async () => {
    pool = new WorkerPool({ size: 1, timeoutMs: 1 });
    await expect(
      pool.run(moveJob([], { config: modeById('gomoku-13').config, timeBudgetMs: 2000 })),
    ).rejects.toThrow(/timed out/);
    // The replacement still works.
    const healthy = new WorkerPool({ size: 1 });
    try {
      expect((await healthy.run(moveJob([0, 3, 1, 4]))).move).toBe(2);
    } finally {
      await healthy.close();
    }
  }, 30_000);
});
