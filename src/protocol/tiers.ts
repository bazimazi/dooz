/**
 * Ladder tiers and divisions, shared by the server and the client.
 *
 * The server decides ratings; this only names them. It lives next to the
 * protocol because both ends have to agree on where "Gold II" starts - a
 * client that drew the boundary somewhere else would show a promotion the
 * server never awarded.
 *
 * Bronze to Diamond have three divisions each, III (lowest) to I. Master has
 * none: it is the top of the ladder and ordered by the leaderboard instead.
 * The bands are wide on purpose, so a player stays in one long enough for it to
 * mean something.
 */

export const TIER_IDS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'] as const;
export type TierId = (typeof TIER_IDS)[number];

export interface Tier {
  readonly id: TierId;
  readonly name: string;
  /** Lowest rating in the tier. Bronze has no real floor; see `BRONZE_SPAN_FROM`. */
  readonly from: number;
}

export const TIERS: readonly Tier[] = [
  { id: 'bronze', name: 'Bronze', from: 0 },
  { id: 'silver', name: 'Silver', from: 1100 },
  { id: 'gold', name: 'Gold', from: 1300 },
  { id: 'platinum', name: 'Platinum', from: 1500 },
  { id: 'diamond', name: 'Diamond', from: 1700 },
  { id: 'master', name: 'Master', from: 1900 },
];

/** Every divided tier is this many points wide. */
const TIER_SPAN = 200;
const DIVISIONS = 3;
/**
 * Where Bronze's divisions are measured from. Everything below it is Bronze
 * III, so a rating at the floor still has a division and a progress bar rather
 * than a tier with no shape.
 */
const BRONZE_SPAN_FROM = 900;

export interface Placement {
  readonly tier: TierId;
  readonly tierName: string;
  /** 3, 2 or 1 (III, II, I), or `null` for Master. */
  readonly division: 1 | 2 | 3 | null;
  /** "Gold II", "Master". */
  readonly label: string;
  /** How far through the current division, 0 to 1. `null` in Master. */
  readonly progress: number | null;
  /** Rating at which the next division (or tier) starts, or `null` in Master. */
  readonly nextAt: number | null;
}

export function tierFor(rating: number): Tier {
  let current: Tier = TIERS[0]!;
  for (const tier of TIERS) if (rating >= tier.from) current = tier;
  return current;
}

const ROMAN = { 1: 'I', 2: 'II', 3: 'III' } as const;

export function placementFor(rating: number): Placement {
  const tier = tierFor(rating);
  if (tier.id === 'master') {
    return {
      tier: tier.id,
      tierName: tier.name,
      division: null,
      label: tier.name,
      progress: null,
      nextAt: null,
    };
  }

  const base = tier.id === 'bronze' ? BRONZE_SPAN_FROM : tier.from;
  const width = TIER_SPAN / DIVISIONS;
  // Index 0 is the bottom division (III).
  const step = Math.min(DIVISIONS - 1, Math.max(0, Math.floor((rating - base) / width)));
  const division = (DIVISIONS - step) as 1 | 2 | 3;
  const floor = base + step * width;
  const nextAt = Math.round(floor + width);
  const progress = Math.min(1, Math.max(0, (rating - floor) / width));

  return {
    tier: tier.id,
    tierName: tier.name,
    division,
    label: `${tier.name} ${ROMAN[division]}`,
    progress,
    nextAt,
  };
}

/** A comparable number for a placement, so a promotion can be told from a demotion. */
export function placementOrder(placement: Placement): number {
  const tierIndex = TIER_IDS.indexOf(placement.tier);
  return tierIndex * 10 + (placement.division === null ? 0 : DIVISIONS - placement.division);
}
