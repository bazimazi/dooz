import { placementFor, TIERS, tierFor } from '@/protocol/tiers';

/**
 * Glicko-2, one game per rating period.
 *
 * Each rating carries how sure the system is of it (the rating deviation, RD)
 * and how erratic the player has been (the volatility). That buys three things
 * the Elo it replaced could not do honestly:
 *
 * - a new account moves quickly because its RD is high, not because it has
 *   played fewer than some arbitrary number of games;
 * - a player who has been away comes back uncertain - their RD grows with the
 *   time since their last rated game - so their first results move them more;
 * - a result against an opponent nobody is sure about counts for less.
 *
 * The scale is Elo's (400 points is a ten-to-one favourite), so the ratings
 * that existed before the switch carry over unchanged; only the deviation had
 * to be estimated, from how many ranked games each player had behind them.
 *
 * Every game is its own rating period. That is what an online ladder needs -
 * the result shows the moment the game ends - and the inactivity inflation
 * below stands in for the empty periods between games.
 */

export const STARTING_RATING = 1200;
/** Nobody drops below this, so a bad run cannot put a ladder position out of reach. */
export const RATING_FLOOR = 400;

/** RD of a player the system knows nothing about. Also the ceiling. */
export const MAX_RD = 350;
/**
 * The lowest RD may go. Without a floor a long-settled rating stops moving at
 * all, and a player who genuinely improves cannot climb.
 */
export const MIN_RD = 45;
/** Above this RD a rating is provisional: shown, but marked as not yet settled. */
export const PROVISIONAL_RD = 110;
export const DEFAULT_VOLATILITY = 0.06;

/** How tightly volatility may change between periods. Glickman suggests 0.3-1.2. */
const TAU = 0.5;
/** Glicko-2's internal scale factor, 400 / ln(10). */
const SCALE = 173.7178;
const CONVERGENCE = 0.000001;

/** Length of one idle rating period for inactivity inflation. */
export const RATING_PERIOD_MS = 24 * 60 * 60 * 1000;

export interface Glicko {
  /** Exact rating. Displayed rounded. */
  readonly rating: number;
  readonly rd: number;
  readonly volatility: number;
}

export interface GlickoInput extends Glicko {
  /** When this rating last changed, for inactivity inflation. `null` if never rated. */
  readonly ratedAt: number | null;
}

export interface RatingOutcome {
  readonly x: Glicko;
  readonly o: Glicko;
}

export function freshGlicko(): Glicko {
  return { rating: STARTING_RATING, rd: MAX_RD, volatility: DEFAULT_VOLATILITY };
}

/**
 * RD as of `now`, grown by the idle periods since the last rated game.
 *
 * This is Glicko-2's pre-period step, φ* = √(φ² + σ²t), applied for however many
 * whole-or-partial days have passed. It is computed whenever a rating is read
 * for a decision rather than written back on a timer, so an idle account costs
 * nothing until it plays again.
 */
export function currentRd(input: GlickoInput, now: number): number {
  if (input.ratedAt === null) return Math.min(MAX_RD, input.rd);
  const periods = Math.max(0, (now - input.ratedAt) / RATING_PERIOD_MS);
  const phi = input.rd / SCALE;
  const grown = Math.sqrt(phi * phi + input.volatility * input.volatility * periods) * SCALE;
  return Math.min(MAX_RD, grown);
}

/**
 * The SQL that a leaderboard uses to gate on current RD without a square root.
 *
 * SQLite has no `sqrt` in every build, so the comparison is made on squares:
 * rd² + (scale·σ)²·t ≤ limit².
 */
export function rdWithinSql(limit: number, nowParam: string): string {
  return `(rd * rd + (${SCALE} * volatility) * (${SCALE} * volatility) * MAX(0, (${nowParam} - COALESCE(rated_at, ${nowParam})) * 1.0 / ${RATING_PERIOD_MS})) <= ${limit * limit}`;
}

/** Expected score for `rating` against `opponent`, between 0 and 1, ignoring RD. */
export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

/** Expected score once the opponent's uncertainty is taken into account. */
export function glickoExpected(player: Glicko, opponent: Glicko): number {
  const mu = (player.rating - STARTING_RATING) / SCALE;
  const muJ = (opponent.rating - STARTING_RATING) / SCALE;
  return 1 / (1 + Math.exp(-g(opponent.rd / SCALE) * (mu - muJ)));
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

/** One player's update against one opponent. */
function updateOne(player: Glicko, opponent: Glicko, score: number): Glicko {
  const mu = (player.rating - STARTING_RATING) / SCALE;
  const phi = player.rd / SCALE;
  const muJ = (opponent.rating - STARTING_RATING) / SCALE;
  const phiJ = opponent.rd / SCALE;
  const sigma = player.volatility;

  const gJ = g(phiJ);
  const expected = 1 / (1 + Math.exp(-gJ * (mu - muJ)));
  const v = 1 / (gJ * gJ * expected * (1 - expected));
  const delta = v * gJ * (score - expected);

  const nextSigma = nextVolatility(phi, sigma, v, delta);
  const phiStar = Math.sqrt(phi * phi + nextSigma * nextSigma);
  const nextPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const nextMu = mu + nextPhi * nextPhi * gJ * (score - expected);

  return {
    rating: Math.max(RATING_FLOOR, nextMu * SCALE + STARTING_RATING),
    rd: Math.min(MAX_RD, Math.max(MIN_RD, nextPhi * SCALE)),
    volatility: nextSigma,
  };
}

/**
 * The new volatility, by the Illinois root-finding procedure from Glickman's
 * paper (step 5). Bounded to a fixed number of iterations: it converges in a
 * handful, and a loop that could spin on a pathological input is not something
 * to run inside a game result.
 */
function nextVolatility(phi: number, sigma: number, v: number, delta: number): number {
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const denominator = phi * phi + v + ex;
    return (
      (ex * (delta * delta - phi * phi - v - ex)) / (2 * denominator * denominator) -
      (x - a) / (TAU * TAU)
    );
  };

  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0 && k < 100) k++;
    B = a - k * TAU;
  }

  let fA = f(A);
  let fB = f(B);
  for (let iteration = 0; iteration < 100 && Math.abs(B - A) > CONVERGENCE; iteration++) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }

  const result = Math.exp(A / 2);
  // A volatility that ran away would make every later result swing wildly.
  return Number.isFinite(result) ? Math.min(0.2, Math.max(0.02, result)) : sigma;
}

/**
 * The new ratings after a game.
 *
 * `score` is X's share of the point: 1 for a win, 0.5 for a draw, 0 for a loss.
 * Both sides are computed from the ratings *before* the game, each with its RD
 * grown for the time since it last moved, so the order they are applied in
 * cannot change the result.
 */
export function updateRatings(
  x: GlickoInput,
  o: GlickoInput,
  score: number,
  now: number,
): RatingOutcome {
  const xNow: Glicko = { rating: x.rating, rd: currentRd(x, now), volatility: x.volatility };
  const oNow: Glicko = { rating: o.rating, rd: currentRd(o, now), volatility: o.volatility };
  return { x: updateOne(xNow, oNow, score), o: updateOne(oNow, xNow, 1 - score) };
}

/**
 * An RD estimate for a rating that predates Glicko.
 *
 * Elo kept no confidence figure, only a game count. This maps one onto the
 * other: an account with no ranked games is as uncertain as a new one, and the
 * deviation settles roughly as Glicko's own would over the same number of
 * results against similar opposition.
 */
export function rdFromGamesPlayed(rankedPlayed: number): number {
  return Math.min(MAX_RD, Math.max(60, MAX_RD / Math.sqrt(1 + Math.max(0, rankedPlayed) / 2)));
}

/** Whether a rating is still settling. */
export function isProvisional(rd: number): boolean {
  return rd > PROVISIONAL_RD;
}

/**
 * Season soft reset: pull a rating part of the way back to the start and make
 * it uncertain again, so placement matches can move it quickly - back to where
 * it was, if that is where the player belongs.
 */
export const SEASON_RESET_KEEP = 0.75;
export const SEASON_RESET_MIN_RD = 150;

export function softReset(input: Glicko): Glicko {
  return {
    rating: STARTING_RATING + (input.rating - STARTING_RATING) * SEASON_RESET_KEEP,
    rd: Math.max(input.rd, SEASON_RESET_MIN_RD),
    volatility: input.volatility,
  };
}

/**
 * Rank names, so a number has something human next to it. The tiers and their
 * divisions live in the protocol package so the client draws the same lines.
 */
export const RANKS = TIERS;
export type Rank = (typeof RANKS)[number];
export type RankId = Rank['id'];

export function rankFor(rating: number): Rank {
  return tierFor(rating);
}

export { placementFor };

/**
 * Ranked games needed in a season before a player appears on its leaderboard.
 *
 * A leaderboard full of accounts that won their only game is worse than no
 * leaderboard, so placements are excluded from the rankings until this many
 * games are behind them.
 */
export const PLACEMENT_GAMES = 5;

/**
 * Leaderboards list players whose current RD - inactivity included - is at or
 * under this. It keeps somebody who placed in week one and then vanished from
 * holding a top spot on a rating nobody has tested since.
 */
export const LEADERBOARD_MAX_RD = 150;
