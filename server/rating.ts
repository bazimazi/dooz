/**
 * Elo, with a provisional period.
 *
 * Elo rather than Glicko because the thing Glicko adds - a confidence interval
 * that decays while you are away - only pays for itself in a pool large enough
 * for a player's true strength to be uncertain relative to the field. A
 * K-factor that starts high and settles gives the same "new accounts move
 * quickly" behaviour with a tenth of the state, and every number in it can be
 * explained to a player in a sentence.
 */

export const STARTING_RATING = 1200;
/** Nobody drops below this, so a bad run cannot put a ladder position out of reach. */
export const RATING_FLOOR = 400;

/**
 * How far one game can move a rating.
 *
 * Large while the system still has no idea how strong someone is, then settling
 * so an established rating is not swung by a single result.
 */
export function kFactor(played: number): number {
  if (played < 15) return 48;
  if (played < 40) return 28;
  return 16;
}

/** Expected score for `rating` against `opponent`, between 0 and 1. */
export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

export interface RatingInput {
  readonly rating: number;
  readonly played: number;
}

export interface RatingOutcome {
  readonly x: number;
  readonly o: number;
}

/**
 * The new ratings after a game.
 *
 * `score` is X's share of the point: 1 for a win, 0.5 for a draw, 0 for a loss.
 * Both sides are computed from the ratings *before* the game, so the order they
 * are applied in cannot change the result.
 */
export function updateRatings(x: RatingInput, o: RatingInput, score: number): RatingOutcome {
  const expected = expectedScore(x.rating, o.rating);
  const nextX = x.rating + kFactor(x.played) * (score - expected);
  const nextO = o.rating + kFactor(o.played) * (1 - score - (1 - expected));

  return {
    x: Math.max(RATING_FLOOR, Math.round(nextX)),
    o: Math.max(RATING_FLOOR, Math.round(nextO)),
  };
}

/**
 * Rank names, so a number has something human next to it.
 *
 * The bands are wide on purpose: a player should stay in one long enough for it
 * to mean something, and a ladder that reclassifies you every other game is
 * noise dressed as progression.
 */
export const RANKS = [
  { id: 'bronze', name: 'Bronze', from: 0 },
  { id: 'silver', name: 'Silver', from: 1100 },
  { id: 'gold', name: 'Gold', from: 1300 },
  { id: 'platinum', name: 'Platinum', from: 1500 },
  { id: 'diamond', name: 'Diamond', from: 1700 },
  { id: 'master', name: 'Master', from: 1900 },
] as const;

export type Rank = (typeof RANKS)[number];
export type RankId = Rank['id'];

export function rankFor(rating: number): Rank {
  let current: Rank = RANKS[0];
  for (const rank of RANKS) if (rating >= rank.from) current = rank;
  return current;
}

/**
 * Games needed before a rating is shown as settled.
 *
 * A leaderboard full of accounts that won their only game is worse than no
 * leaderboard, so placements are excluded from the rankings until this many
 * games are behind them.
 */
export const PLACEMENT_GAMES = 5;
