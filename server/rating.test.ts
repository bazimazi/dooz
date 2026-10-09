import { describe, expect, it } from 'vitest';
import {
  expectedScore,
  kFactor,
  RANKS,
  RATING_FLOOR,
  rankFor,
  STARTING_RATING,
  updateRatings,
} from './rating.js';

const settled = { rating: STARTING_RATING, played: 100 };

describe('expectedScore', () => {
  it('is even between equal ratings', () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 10);
  });

  it('gives the stronger player the larger share', () => {
    expect(expectedScore(1600, 1200)).toBeGreaterThan(0.9);
    expect(expectedScore(1200, 1600)).toBeLessThan(0.1);
  });

  it('sums to one across both players', () => {
    for (const [a, b] of [
      [1200, 1200],
      [1500, 1100],
      [900, 2000],
    ]) {
      expect(expectedScore(a!, b!) + expectedScore(b!, a!)).toBeCloseTo(1, 10);
    }
  });

  it('is scaled so 400 points is a ten-to-one favourite', () => {
    expect(expectedScore(1600, 1200)).toBeCloseTo(10 / 11, 6);
  });
});

describe('kFactor', () => {
  it('starts high and settles as games accumulate', () => {
    expect(kFactor(0)).toBeGreaterThan(kFactor(20));
    expect(kFactor(20)).toBeGreaterThan(kFactor(200));
  });

  it('never reaches zero, so a rating can always still move', () => {
    expect(kFactor(10_000)).toBeGreaterThan(0);
  });
});

describe('updateRatings', () => {
  it('leaves two equal, settled players untouched after a draw', () => {
    const next = updateRatings(settled, settled, 0.5);
    expect(next.x).toBe(STARTING_RATING);
    expect(next.o).toBe(STARTING_RATING);
  });

  it('moves the winner up and the loser down by the same amount', () => {
    const next = updateRatings(settled, settled, 1);
    expect(next.x).toBeGreaterThan(STARTING_RATING);
    expect(next.o).toBeLessThan(STARTING_RATING);
    expect(next.x - STARTING_RATING).toBe(STARTING_RATING - next.o);
  });

  it('is symmetric: a loss is the mirror of a win', () => {
    const win = updateRatings(settled, settled, 1);
    const loss = updateRatings(settled, settled, 0);
    expect(loss.x).toBe(win.o);
    expect(loss.o).toBe(win.x);
  });

  it('rewards an upset far more than an expected win', () => {
    const strong = { rating: 1800, played: 100 };
    const weak = { rating: 1000, played: 100 };

    const upset = updateRatings(weak, strong, 1);
    const expectedWin = updateRatings(strong, weak, 1);

    expect(upset.x - weak.rating).toBeGreaterThan(expectedWin.x - strong.rating);
  });

  it('costs a favourite almost the whole K-factor for losing to an outsider', () => {
    const strong = { rating: 1800, played: 100 };
    const weak = { rating: 1000, played: 100 };

    const lost = strong.rating - updateRatings(strong, weak, 0).x;
    const gained = updateRatings(strong, weak, 1).x - strong.rating;

    // Beating a 800-point outsider is worth next to nothing; losing to one
    // costs nearly everything a single game can cost.
    expect(lost).toBeGreaterThan(kFactor(strong.played) * 0.9);
    expect(gained).toBeLessThan(2);
  });

  it('moves a new account faster than an established one', () => {
    const fresh = updateRatings({ rating: 1200, played: 0 }, settled, 1);
    const veteran = updateRatings(settled, settled, 1);
    expect(fresh.x - 1200).toBeGreaterThan(veteran.x - 1200);
  });

  it('never drops a rating below the floor', () => {
    let rating = RATING_FLOOR + 5;
    for (let game = 0; game < 50; game++) {
      rating = updateRatings({ rating, played: 100 }, { rating: 2400, played: 100 }, 0).x;
    }
    expect(rating).toBeGreaterThanOrEqual(RATING_FLOOR);
  });

  it('keeps the pool total roughly constant between two settled players', () => {
    // Elo is zero-sum at equal K; rounding is the only thing that moves it.
    const before = 1500 + 1300;
    const next = updateRatings({ rating: 1500, played: 100 }, { rating: 1300, played: 100 }, 1);
    expect(Math.abs(next.x + next.o - before)).toBeLessThanOrEqual(1);
  });
});

describe('rankFor', () => {
  it('places a starting rating in a middle band, not the bottom', () => {
    expect(rankFor(STARTING_RATING).id).toBe('silver');
  });

  it('never leaves a rating without a rank', () => {
    for (let rating = 0; rating <= 3000; rating += 37) {
      expect(rankFor(rating)).toBeDefined();
    }
  });

  it('is monotonic: a higher rating is never a lower rank', () => {
    const order = new Map(RANKS.map((rank, index) => [rank.id, index]));
    let previous = -1;
    for (let rating = 0; rating <= 2400; rating += 25) {
      const index = order.get(rankFor(rating).id)!;
      expect(index).toBeGreaterThanOrEqual(previous);
      previous = index;
    }
  });
});
