import { configKey, type GameConfig } from '@/game/engine';

/**
 * The matchmaking queues.
 *
 * Each queue (one per rule set, ranked and casual apart) keeps its waiting
 * players twice: in arrival order, which is what a casual game wants, and in
 * rating buckets, which is what a ranked one wants. A ranked search walks the
 * buckets outwards from the player's own rating and stops as soon as nothing
 * further out could beat the best candidate already found, so a busy queue
 * costs a handful of comparisons per search rather than a scan of everybody.
 *
 * Every entry is also indexed by session, so leaving the queue - which every
 * disconnect, every new request and every pairing does - is a map lookup.
 */

/** Width of one rating bucket, in points. */
const BUCKET_WIDTH = 100;
/**
 * How long either player must have waited before a pairing with somebody they
 * have just played is allowed. Long enough for a third player to turn up in a
 * busy queue; short enough that two friends alone in a quiet one still get a
 * game.
 */
export const RECENT_OPPONENT_GRACE_MS = 12_000;
/** How many recent opponents are remembered per account. */
const RECENT_PER_ACCOUNT = 3;
/** Ceiling on accounts with remembered opponents, so the map cannot grow for ever. */
const MAX_RECENT_ACCOUNTS = 20_000;

/**
 * Ranked matchmaking band, in rating points, after waiting `waitedMs`.
 *
 * It starts narrow enough that the first match is a fair one and widens until
 * it stops mattering, because a perfectly fair match that never happens is
 * worse than a slightly lopsided one that does.
 */
export function ratingBand(waitedMs: number): number {
  if (waitedMs >= 45_000) return Number.POSITIVE_INFINITY;
  return 120 + Math.floor(waitedMs / 6000) * 130;
}

export interface QueueEntry {
  readonly sessionId: string;
  readonly accountId: string;
  readonly rating: number;
  readonly joinedAt: number;
  /** Whether this player will take a bot after a long wait. */
  readonly bots: boolean;
}

export interface Pool {
  readonly key: string;
  readonly config: GameConfig;
  readonly ranked: boolean;
  /** Arrival order. A `Set` iterates in insertion order and deletes in O(1). */
  readonly order: Set<QueueEntry>;
  readonly buckets: Map<number, Set<QueueEntry>>;
}

export class Matchmaker {
  private readonly pools = new Map<string, Pool>();
  private readonly bySession = new Map<string, { pool: Pool; entry: QueueEntry }>();
  /** Account id to its last few opponents, oldest first. Insertion-ordered for eviction. */
  private readonly recent = new Map<string, string[]>();

  get size(): number {
    return this.bySession.size;
  }

  poolSize(config: GameConfig, ranked: boolean): number {
    return this.pools.get(poolKey(config, ranked))?.order.size ?? 0;
  }

  has(sessionId: string): boolean {
    return this.bySession.has(sessionId);
  }

  /** Every pool, for the periodic sweep. A snapshot, so pairing may mutate the pools. */
  allPools(): Pool[] {
    return [...this.pools.values()];
  }

  add(config: GameConfig, ranked: boolean, entry: QueueEntry): Pool {
    this.remove(entry.sessionId);
    const key = poolKey(config, ranked);
    let pool = this.pools.get(key);
    if (!pool) {
      pool = { key, config, ranked, order: new Set(), buckets: new Map() };
      this.pools.set(key, pool);
    }
    pool.order.add(entry);
    const bucket = bucketOf(entry.rating);
    let members = pool.buckets.get(bucket);
    if (!members) {
      members = new Set();
      pool.buckets.set(bucket, members);
    }
    members.add(entry);
    this.bySession.set(entry.sessionId, { pool, entry });
    return pool;
  }

  remove(sessionId: string): QueueEntry | null {
    const found = this.bySession.get(sessionId);
    if (!found) return null;
    const { pool, entry } = found;
    this.bySession.delete(sessionId);
    pool.order.delete(entry);
    const bucket = bucketOf(entry.rating);
    const members = pool.buckets.get(bucket);
    members?.delete(entry);
    if (members?.size === 0) pool.buckets.delete(bucket);
    if (pool.order.size === 0) this.pools.delete(pool.key);
    return entry;
  }

  /**
   * The best opponent for `entry` among the players waiting in `config`'s
   * queue, or `null`. Does not remove anybody.
   *
   * `alive` is asked about each candidate before it is chosen; one that says
   * no is removed from the queue on the spot, since a player who dropped while
   * waiting should not hold a place in it.
   */
  find(
    config: GameConfig,
    ranked: boolean,
    entry: QueueEntry,
    now: number,
    alive: (candidate: QueueEntry) => boolean,
  ): QueueEntry | null {
    const pool = this.pools.get(poolKey(config, ranked));
    if (!pool) return null;
    return ranked
      ? this.findRanked(pool, entry, now, alive)
      : this.findCasual(pool, entry, now, alive);
  }

  /** Remember that two accounts were just paired, for recent-opponent avoidance. */
  recordPairing(a: string, b: string): void {
    this.remember(a, b);
    this.remember(b, a);
  }

  /** Whether `a` has played `b` among their last few games. */
  playedRecently(a: string, b: string): boolean {
    return this.recent.get(a)?.includes(b) ?? false;
  }

  private findCasual(
    pool: Pool,
    entry: QueueEntry,
    now: number,
    alive: (candidate: QueueEntry) => boolean,
  ): QueueEntry | null {
    // The longest waiter wins, except over somebody they have just played -
    // those are passed over until the grace period, then taken like anybody.
    let fallback: QueueEntry | null = null;
    // Removing a dead candidate while iterating a Set is safe; no copy needed.
    for (const candidate of pool.order) {
      if (candidate.accountId === entry.accountId || candidate === entry) continue;
      if (!alive(candidate)) {
        this.remove(candidate.sessionId);
        continue;
      }
      if (!this.avoid(entry, candidate)) return candidate;
      fallback ??= candidate;
    }
    return fallback && this.graceOver(entry, fallback, now) ? fallback : null;
  }

  private findRanked(
    pool: Pool,
    entry: QueueEntry,
    now: number,
    alive: (candidate: QueueEntry) => boolean,
  ): QueueEntry | null {
    // The widest band anybody here could be using, which bounds how far out the
    // walk has to go. The oldest waiter is the first in arrival order.
    const oldest = pool.order.values().next().value;
    const longestWait = Math.max(now - entry.joinedAt, oldest ? now - oldest.joinedAt : 0);
    const reach = ratingBand(longestWait);
    const home = bucketOf(entry.rating);
    const maxSteps = Number.isFinite(reach)
      ? Math.ceil(reach / BUCKET_WIDTH) + 1
      : this.farthestBucket(pool, home);

    let best: QueueEntry | null = null;
    let bestGap = Number.POSITIVE_INFINITY;
    for (let step = 0; step <= maxSteps; step++) {
      // Every rating in a bucket this far out is at least this far away, so
      // once that exceeds the best gap found the search is over.
      if ((step - 1) * BUCKET_WIDTH > bestGap) break;
      for (const bucket of step === 0 ? [home] : [home - step, home + step]) {
        const members = pool.buckets.get(bucket);
        if (!members) continue;
        for (const candidate of members) {
          if (candidate.accountId === entry.accountId || candidate === entry) continue;
          const gap = Math.abs(candidate.rating - entry.rating);
          const waited = Math.max(now - candidate.joinedAt, now - entry.joinedAt);
          if (gap > ratingBand(waited)) continue;
          if (this.avoid(entry, candidate) && !this.graceOver(entry, candidate, now)) continue;
          if (!alive(candidate)) {
            this.remove(candidate.sessionId);
            continue;
          }
          // Ties go to whoever has waited longer.
          if (gap < bestGap || (gap === bestGap && best && candidate.joinedAt < best.joinedAt)) {
            best = candidate;
            bestGap = gap;
          }
        }
      }
    }
    return best;
  }

  private farthestBucket(pool: Pool, home: number): number {
    let farthest = 0;
    for (const bucket of pool.buckets.keys())
      farthest = Math.max(farthest, Math.abs(bucket - home));
    return farthest;
  }

  private avoid(entry: QueueEntry, candidate: QueueEntry): boolean {
    return this.playedRecently(entry.accountId, candidate.accountId);
  }

  private graceOver(entry: QueueEntry, candidate: QueueEntry, now: number): boolean {
    return (
      now - entry.joinedAt >= RECENT_OPPONENT_GRACE_MS ||
      now - candidate.joinedAt >= RECENT_OPPONENT_GRACE_MS
    );
  }

  private remember(account: string, opponent: string): void {
    const list = this.recent.get(account) ?? [];
    this.recent.delete(account);
    const next = [...list.filter((id) => id !== opponent), opponent].slice(-RECENT_PER_ACCOUNT);
    this.recent.set(account, next);
    // Least recently paired first, so the oldest memory is the one let go.
    while (this.recent.size > MAX_RECENT_ACCOUNTS) {
      const first = this.recent.keys().next().value;
      if (first === undefined) break;
      this.recent.delete(first);
    }
  }
}

function bucketOf(rating: number): number {
  return Math.floor(rating / BUCKET_WIDTH);
}

/** Queue key: the rules (seed aside) plus whether a ladder is at stake. */
export function poolKey(config: GameConfig, ranked: boolean): string {
  return `${configKey(config)}:${ranked ? 'ranked' : 'casual'}`;
}
