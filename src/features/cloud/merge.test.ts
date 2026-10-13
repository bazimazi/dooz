import { describe, expect, it } from 'vitest';
import { CLOUD_SAVE_VERSION, mergeEnvelopes, mergeProgress } from './merge';

const deviceA = {
  bot: { 'classic:hard': { won: 4, lost: 2, drawn: 1, streak: 0, best: 3 } },
  localGames: 10,
  puzzles: ['p1', 'p2'],
  daily: { lastDay: 20_000, streak: 3, best: 5 },
  journey: { 'pip-1': 3, 'mo-1': 1 },
  announced: ['neon'],
  xp: 900,
  achievements: { first: 100 },
  seenIntro: false,
};

const deviceB = {
  bot: {
    'classic:hard': { won: 2, lost: 5, drawn: 0, streak: 2, best: 2 },
    'gomoku-15:master': { won: 1, lost: 0, drawn: 0, streak: 1, best: 1 },
  },
  localGames: 4,
  puzzles: ['p2', 'p3'],
  daily: { lastDay: 20_010, streak: 1, best: 2 },
  journey: { 'pip-1': 2, 'mo-1': 3, 'sage-1': 2 },
  announced: ['chalk'],
  xp: 1200,
  achievements: { second: 50 },
  seenIntro: true,
};

describe('cloud save merge', () => {
  it('keeps everything either device earned', () => {
    expect(mergeProgress(deviceA, deviceB)).toEqual({
      bot: {
        'classic:hard': { won: 4, lost: 5, drawn: 1, streak: 2, best: 3 },
        'gomoku-15:master': { won: 1, lost: 0, drawn: 0, streak: 1, best: 1 },
      },
      localGames: 10,
      puzzles: ['p1', 'p2', 'p3'],
      // The later day wins whole; the best ever is kept.
      daily: { lastDay: 20_010, streak: 1, best: 5 },
      journey: { 'pip-1': 3, 'mo-1': 3, 'sage-1': 2 },
      announced: ['neon', 'chalk'],
      xp: 1200,
      achievements: { first: 100, second: 50 },
      seenIntro: true,
    });
  });

  it('is idempotent and, for earned state, commutative', () => {
    const once = mergeProgress(deviceA, deviceB);
    expect(mergeProgress(once, deviceB)).toEqual(once);
    expect(mergeProgress(once, once)).toEqual(once);
    const other = mergeProgress(deviceB, deviceA) as Record<string, unknown>;
    expect(other['journey']).toEqual((once as Record<string, unknown>)['journey']);
    expect(other['daily']).toEqual((once as Record<string, unknown>)['daily']);
    expect(new Set(other['puzzles'] as string[])).toEqual(new Set(['p1', 'p2', 'p3']));
  });

  it('treats missing and null values as nothing earned', () => {
    expect(mergeProgress(undefined, { a: 1 })).toEqual({ a: 1 });
    expect(mergeProgress({ a: 1 }, null)).toEqual({ a: 1 });
    expect(mergeProgress({ daily: { lastDay: null, streak: 0, best: 0 } }, deviceB)).toMatchObject({
      daily: { lastDay: 20_010, streak: 1, best: 2 },
    });
  });

  it('ignores prototype-polluting keys', () => {
    const hostile = JSON.parse('{"__proto__": {"polluted": true}, "a": 1}') as unknown;
    const merged = mergeProgress({}, hostile) as Record<string, unknown>;
    expect(merged['a']).toBe(1);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
  });

  it('wraps progress in a versioned envelope', () => {
    const merged = mergeEnvelopes({ v: 1, progress: deviceA }, { v: 1, progress: deviceB });
    expect(merged.v).toBe(CLOUD_SAVE_VERSION);
    expect((merged.progress as Record<string, unknown>)['xp']).toBe(1200);
    expect(mergeEnvelopes(null, { v: 1, progress: { xp: 5 } }).progress).toEqual({ xp: 5 });
    expect(mergeEnvelopes({ junk: true }, 'not an object').progress).toEqual({});
  });
});
