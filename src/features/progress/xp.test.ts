import { describe, expect, it } from 'vitest';
import {
  botGameXp,
  levelFor,
  levelProgress,
  MAX_LEVEL,
  streakXp,
  sumXp,
  xpForStep,
  xpToReach,
} from './xp';

describe('level curve', () => {
  it('starts at level one and steps up by a growing amount', () => {
    expect(levelFor(0)).toBe(1);
    expect(xpToReach(2)).toBe(100);
    expect(levelFor(99)).toBe(1);
    expect(levelFor(100)).toBe(2);
    expect(xpToReach(3) - xpToReach(2)).toBe(xpForStep(2));
    expect(xpForStep(3)).toBeGreaterThan(xpForStep(2));
  });

  it('is consistent between thresholds and levels everywhere', () => {
    for (let level = 1; level < MAX_LEVEL; level++) {
      expect(levelFor(xpToReach(level))).toBe(level);
      expect(levelFor(xpToReach(level + 1) - 1)).toBe(level);
    }
  });

  it('stops at the top level', () => {
    expect(levelFor(10_000_000)).toBe(MAX_LEVEL);
    expect(levelProgress(10_000_000).fraction).toBe(1);
  });

  it('reports progress within a level', () => {
    const progress = levelProgress(xpToReach(4) + 30);
    expect(progress).toMatchObject({ level: 4, into: 30, span: xpForStep(4) });
    expect(progress.fraction).toBeCloseTo(30 / xpForStep(4));
  });
});

describe('bot game XP', () => {
  it('pays more for stronger bots and a token for a loss', () => {
    expect(sumXp(botGameXp('master', 'win'))).toBeGreaterThan(sumXp(botGameXp('easy', 'win')));
    expect(sumXp(botGameXp('master', 'loss'))).toBe(sumXp(botGameXp('easy', 'loss')));
    expect(sumXp(botGameXp('hard', 'draw'))).toBeLessThan(sumXp(botGameXp('hard', 'win')));
  });

  it('adds a blitz bonus and adjusts for handicaps, never below a token', () => {
    const plain = sumXp(botGameXp('medium', 'win'));
    expect(sumXp(botGameXp('medium', 'win', { blitz: true }))).toBeGreaterThan(plain);
    expect(sumXp(botGameXp('medium', 'win', { handicap: 2 }))).toBeLessThan(plain);
    expect(sumXp(botGameXp('medium', 'win', { handicap: -2 }))).toBeGreaterThan(plain);
    expect(sumXp(botGameXp('beginner', 'win', { handicap: 3 }))).toBeGreaterThan(0);
  });

  it('rewards streaks from the third win, capped', () => {
    expect(streakXp(2)).toBeNull();
    expect(streakXp(3)?.xp).toBe(5);
    expect(streakXp(40)?.xp).toBe(25);
  });
});
