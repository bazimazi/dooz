import { placementFor, placementOrder } from '@/protocol/tiers';
import { describe, expect, it } from 'vitest';
import {
  currentRd,
  DEFAULT_VOLATILITY,
  expectedScore,
  freshGlicko,
  type GlickoInput,
  glickoExpected,
  isProvisional,
  MAX_RD,
  MIN_RD,
  RANKS,
  RATING_FLOOR,
  RATING_PERIOD_MS,
  rankFor,
  rdFromGamesPlayed,
  softReset,
  STARTING_RATING,
  updateRatings,
} from './rating.js';

const NOW = 1_700_000_000_000;

function player(rating: number, rd: number, ratedAt: number | null = NOW): GlickoInput {
  return { rating, rd, volatility: DEFAULT_VOLATILITY, ratedAt };
}

const settled = player(STARTING_RATING, 60);
const fresh = player(STARTING_RATING, MAX_RD, null);

describe('expectedScore', () => {
  it('is even between equal ratings', () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 10);
  });

  it('is scaled so 400 points is a ten-to-one favourite', () => {
    expect(expectedScore(1600, 1200)).toBeCloseTo(10 / 11, 6);
  });

  it('sums to one across both players', () => {
    expect(expectedScore(1500, 1100) + expectedScore(1100, 1500)).toBeCloseTo(1, 10);
  });
});

describe('glickoExpected', () => {
  it('is pulled towards even when the opponent is uncertain', () => {
    const strong = { rating: 1600, rd: 60, volatility: DEFAULT_VOLATILITY };
    const sure = { rating: 1200, rd: 60, volatility: DEFAULT_VOLATILITY };
    const unsure = { rating: 1200, rd: 350, volatility: DEFAULT_VOLATILITY };
    expect(glickoExpected(strong, unsure)).toBeLessThan(glickoExpected(strong, sure));
    expect(glickoExpected(strong, unsure)).toBeGreaterThan(0.5);
  });
});

describe('updateRatings', () => {
  it('reproduces the worked example from Glickman’s paper', () => {
    // The paper rates a 1500/200 player over three games; one game in
    // isolation must move them in the same direction by a sane amount.
    const before = { rating: 1500, rd: 200, volatility: 0.06, ratedAt: NOW };
    const opponent = { rating: 1400, rd: 30, volatility: 0.06, ratedAt: NOW };
    const next = updateRatings(before, opponent, 1, NOW);
    expect(next.x.rating).toBeGreaterThan(1500);
    expect(next.x.rating - 1500).toBeLessThan(200);
    expect(next.x.rd).toBeLessThan(200);
    expect(next.x.volatility).toBeGreaterThan(0.05);
    expect(next.x.volatility).toBeLessThan(0.07);
  });

  it('leaves two equal, settled players almost untouched after a draw', () => {
    const next = updateRatings(settled, settled, 0.5, NOW);
    expect(Math.round(next.x.rating)).toBe(STARTING_RATING);
    expect(Math.round(next.o.rating)).toBe(STARTING_RATING);
  });

  it('moves two equal players by the same amount in opposite directions', () => {
    const next = updateRatings(fresh, fresh, 1, NOW);
    expect(next.x.rating - STARTING_RATING).toBeCloseTo(STARTING_RATING - next.o.rating, 6);
    expect(next.x.rating).toBeGreaterThan(STARTING_RATING);
  });

  it('is symmetric: a loss is the mirror of a win', () => {
    const win = updateRatings(settled, settled, 1, NOW);
    const loss = updateRatings(settled, settled, 0, NOW);
    expect(loss.x.rating).toBeCloseTo(win.o.rating, 6);
    expect(loss.o.rating).toBeCloseTo(win.x.rating, 6);
  });

  it('rewards an upset far more than an expected win', () => {
    const strong = player(1800, 60);
    const weak = player(1000, 60);
    const upset = updateRatings(weak, strong, 1, NOW);
    const expectedWin = updateRatings(strong, weak, 1, NOW);
    expect(upset.x.rating - weak.rating).toBeGreaterThan(expectedWin.x.rating - strong.rating);
  });

  it('moves an uncertain rating much further than a settled one', () => {
    const newcomer = updateRatings(fresh, settled, 1, NOW);
    const veteran = updateRatings(settled, settled, 1, NOW);
    expect(newcomer.x.rating - STARTING_RATING).toBeGreaterThan(
      3 * (veteran.x.rating - STARTING_RATING),
    );
  });

  it('barely moves a settled player who beats an unknown', () => {
    // An unknown opponent's result says little about anyone.
    const versusFresh = updateRatings(settled, fresh, 1, NOW).x.rating - STARTING_RATING;
    const versusSettled = updateRatings(settled, settled, 1, NOW).x.rating - STARTING_RATING;
    expect(versusFresh).toBeLessThan(versusSettled);
  });

  it('shrinks RD with every game, down to a floor', () => {
    let state: GlickoInput = fresh;
    let previous = state.rd;
    for (let game = 0; game < 200; game++) {
      const next = updateRatings(state, settled, game % 2, NOW).x;
      expect(next.rd).toBeLessThanOrEqual(previous + 1e-9);
      previous = next.rd;
      state = { ...next, ratedAt: NOW };
    }
    expect(state.rd).toBeGreaterThanOrEqual(MIN_RD);
    expect(isProvisional(state.rd)).toBe(false);
  });

  it('never drops a rating below the floor', () => {
    let state: GlickoInput = player(RATING_FLOOR + 5, 60);
    for (let game = 0; game < 50; game++) {
      state = { ...updateRatings(state, player(2400, 60), 0, NOW).x, ratedAt: NOW };
    }
    expect(state.rating).toBeGreaterThanOrEqual(RATING_FLOOR);
  });

  it('keeps volatility bounded through a wild run of results', () => {
    let state: GlickoInput = settled;
    for (let game = 0; game < 40; game++) {
      const opponent = player(game % 2 ? 2200 : 600, 50);
      state = { ...updateRatings(state, opponent, game % 2, NOW).x, ratedAt: NOW };
    }
    expect(state.volatility).toBeGreaterThan(0);
    expect(state.volatility).toBeLessThanOrEqual(0.2);
    expect(Number.isFinite(state.rating)).toBe(true);
  });

  it('treats an idle player as less certain, so their next result counts for more', () => {
    const idle = player(STARTING_RATING, 60, NOW - 200 * RATING_PERIOD_MS);
    const active = player(STARTING_RATING, 60, NOW);
    const idleGain = updateRatings(idle, settled, 1, NOW).x.rating - STARTING_RATING;
    const activeGain = updateRatings(active, settled, 1, NOW).x.rating - STARTING_RATING;
    expect(idleGain).toBeGreaterThan(activeGain);
  });
});

describe('currentRd', () => {
  it('grows with time away and stops at the maximum', () => {
    const at = (days: number) => currentRd(player(1500, 60, NOW), NOW + days * RATING_PERIOD_MS);
    expect(at(0)).toBeCloseTo(60, 6);
    expect(at(30)).toBeGreaterThan(at(0));
    expect(at(365)).toBeGreaterThan(at(30));
    expect(at(1_000_000)).toBe(MAX_RD);
  });

  it('treats a never-rated player as fully uncertain', () => {
    expect(currentRd(fresh, NOW)).toBe(MAX_RD);
  });
});

describe('rdFromGamesPlayed', () => {
  it('starts at the maximum and settles as games accumulate', () => {
    expect(rdFromGamesPlayed(0)).toBe(MAX_RD);
    expect(rdFromGamesPlayed(5)).toBeLessThan(MAX_RD);
    expect(rdFromGamesPlayed(40)).toBeLessThan(rdFromGamesPlayed(5));
    expect(rdFromGamesPlayed(10_000)).toBe(60);
  });
});

describe('softReset', () => {
  it('pulls ratings towards the start without reordering them', () => {
    const high = softReset({ rating: 2000, rd: 50, volatility: 0.06 });
    const low = softReset({ rating: 800, rd: 50, volatility: 0.06 });
    expect(high.rating).toBeLessThan(2000);
    expect(high.rating).toBeGreaterThan(STARTING_RATING);
    expect(low.rating).toBeGreaterThan(800);
    expect(high.rating).toBeGreaterThan(low.rating);
  });

  it('makes a settled rating uncertain again for placements', () => {
    expect(softReset({ rating: 1500, rd: 50, volatility: 0.06 }).rd).toBeGreaterThan(100);
  });
});

describe('freshGlicko', () => {
  it('starts every player at the same uncertain rating', () => {
    expect(freshGlicko()).toEqual({
      rating: STARTING_RATING,
      rd: MAX_RD,
      volatility: DEFAULT_VOLATILITY,
    });
  });
});

describe('rankFor', () => {
  it('places a starting rating in a middle band, not the bottom', () => {
    expect(rankFor(STARTING_RATING).id).toBe('silver');
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

describe('placementFor', () => {
  it('names divisions from III up to I', () => {
    expect(placementFor(1300).label).toBe('Gold III');
    expect(placementFor(1370).label).toBe('Gold II');
    expect(placementFor(1450).label).toBe('Gold I');
    expect(placementFor(2100).label).toBe('Master');
  });

  it('gives the floor of the ladder a division too', () => {
    const bottom = placementFor(RATING_FLOOR);
    expect(bottom.label).toBe('Bronze III');
    expect(bottom.progress).toBe(0);
  });

  it('reports progress through the division and where the next begins', () => {
    const halfway = placementFor(1333);
    expect(halfway.progress).toBeGreaterThan(0.4);
    expect(halfway.progress).toBeLessThan(0.6);
    expect(halfway.nextAt).toBe(1367);
  });

  it('orders placements monotonically with rating', () => {
    let previous = -1;
    for (let rating = 0; rating <= 2400; rating += 10) {
      const order = placementOrder(placementFor(rating));
      expect(order).toBeGreaterThanOrEqual(previous);
      previous = order;
    }
  });
});
