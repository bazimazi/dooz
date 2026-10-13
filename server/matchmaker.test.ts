import { modeById } from '@/game/engine';
import { describe, expect, it } from 'vitest';
import {
  Matchmaker,
  poolKey,
  type QueueEntry,
  RECENT_OPPONENT_GRACE_MS,
  ratingBand,
} from './matchmaker.js';

const config = modeById('grid-6').config;
const NOW = 1_000_000;
const alive = () => true;

function entry(id: string, rating: number, joinedAt = NOW): QueueEntry {
  return { sessionId: `s-${id}`, accountId: `a-${id}`, rating, joinedAt, bots: true };
}

describe('ratingBand', () => {
  it('widens with the wait and eventually stops mattering', () => {
    expect(ratingBand(0)).toBe(120);
    expect(ratingBand(12_000)).toBeGreaterThan(ratingBand(0));
    expect(ratingBand(45_000)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('Matchmaker', () => {
  it('indexes entries by session for constant-time removal', () => {
    const queue = new Matchmaker();
    queue.add(config, true, entry('a', 1200));
    queue.add(config, true, entry('b', 1300));
    expect(queue.size).toBe(2);
    expect(queue.remove('s-a')?.accountId).toBe('a-a');
    expect(queue.remove('s-a')).toBeNull();
    expect(queue.poolSize(config, true)).toBe(1);
    queue.remove('s-b');
    expect(queue.allPools()).toEqual([]);
  });

  it('keeps one entry per session, moving it between queues', () => {
    const queue = new Matchmaker();
    queue.add(config, true, entry('a', 1200));
    queue.add(config, false, entry('a', 1200));
    expect(queue.size).toBe(1);
    expect(queue.poolSize(config, true)).toBe(0);
    expect(queue.poolSize(config, false)).toBe(1);
  });

  it('matches the nearest rating inside the band, not the first in line', () => {
    const queue = new Matchmaker();
    queue.add(config, true, entry('far', 1290));
    queue.add(config, true, entry('near', 1215));
    queue.add(config, true, entry('outside', 1500));
    expect(queue.find(config, true, entry('me', 1200), NOW, alive)?.accountId).toBe('a-near');
  });

  it('will not match outside the band until somebody has waited', () => {
    const queue = new Matchmaker();
    queue.add(config, true, entry('waiting', 1700, NOW));
    expect(queue.find(config, true, entry('me', 1200, NOW), NOW, alive)).toBeNull();
    // The long waiter's band covers the newcomer.
    expect(
      queue.find(config, true, entry('me', 1200, NOW + 45_000), NOW + 45_000, alive)?.accountId,
    ).toBe('a-waiting');
  });

  it('matches the longest waiter in a casual queue', () => {
    const queue = new Matchmaker();
    queue.add(config, false, entry('first', 2000, NOW));
    queue.add(config, false, entry('second', 1200, NOW + 10));
    expect(queue.find(config, false, entry('me', 1200), NOW + 20, alive)?.accountId).toBe(
      'a-first',
    );
  });

  it('never matches an account with itself', () => {
    const queue = new Matchmaker();
    queue.add(config, false, entry('a', 1200));
    expect(
      queue.find(config, false, { ...entry('a', 1200), sessionId: 'other' }, NOW, alive),
    ).toBeNull();
  });

  it('drops candidates whose connection is gone', () => {
    const queue = new Matchmaker();
    queue.add(config, false, entry('gone', 1200));
    expect(queue.find(config, false, entry('me', 1200), NOW, () => false)).toBeNull();
    expect(queue.size).toBe(0);
  });

  it('avoids a recent opponent while anyone else will do, then gives in', () => {
    const queue = new Matchmaker();
    queue.recordPairing('a-me', 'a-old');
    queue.add(config, false, entry('old', 1200, NOW));
    expect(queue.find(config, false, entry('me', 1200, NOW), NOW, alive)).toBeNull();

    queue.add(config, false, entry('new', 1200, NOW + 1));
    expect(queue.find(config, false, entry('me', 1200, NOW), NOW + 2, alive)?.accountId).toBe(
      'a-new',
    );

    queue.remove('s-new');
    const later = NOW + RECENT_OPPONENT_GRACE_MS;
    expect(queue.find(config, false, entry('me', 1200, NOW), later, alive)?.accountId).toBe(
      'a-old',
    );
  });

  it('applies the same avoidance on the ranked ladder', () => {
    const queue = new Matchmaker();
    queue.recordPairing('a-me', 'a-old');
    queue.add(config, true, entry('old', 1200, NOW));
    queue.add(config, true, entry('other', 1260, NOW));
    expect(queue.find(config, true, entry('me', 1200, NOW), NOW, alive)?.accountId).toBe('a-other');
  });

  it('remembers only the last few opponents', () => {
    const queue = new Matchmaker();
    for (const id of ['1', '2', '3', '4']) queue.recordPairing('me', id);
    expect(queue.playedRecently('me', '1')).toBe(false);
    expect(queue.playedRecently('me', '4')).toBe(true);
    expect(queue.playedRecently('4', 'me')).toBe(true);
  });

  it('stays fast with a crowded queue', () => {
    const queue = new Matchmaker();
    for (let index = 0; index < 20_000; index++) {
      queue.add(config, true, entry(String(index), 400 + (index % 2000), NOW));
    }
    const started = performance.now();
    for (let index = 0; index < 1000; index++) {
      queue.find(config, true, entry(`me${index}`, 400 + index, NOW), NOW, alive);
    }
    expect(performance.now() - started).toBeLessThan(2000);
  });

  it('keys queues by rules, ignoring the seed, and by ladder', () => {
    expect(poolKey({ ...config, seed: 1 }, true)).toBe(poolKey({ ...config, seed: 2 }, true));
    expect(poolKey(config, true)).not.toBe(poolKey(config, false));
  });
});
