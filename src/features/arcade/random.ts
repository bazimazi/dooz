/**
 * Seeded randomness for the arcade.
 *
 * The daily challenge has to be the same for everyone on the same day, and a
 * run has to rebuild the same map after a reload, so neither can touch
 * `Math.random`. This is the same small generator the daily puzzle order uses:
 * fast, well scattered, and 32 bits of state that fit in a URL or a save.
 */

export type Random = () => number;

/** A generator for `seed`, returning floats in [0, 1). */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b_79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

/** A 32-bit seed from a string, so a seed can be named rather than numbered. */
export function hashSeed(text: string): number {
  let hash = 0x811c_9dc5;
  for (let at = 0; at < text.length; at++) {
    hash ^= text.charCodeAt(at);
    hash = Math.imul(hash, 0x0100_0193);
  }
  return hash >>> 0;
}

/** A whole number in [min, max]. */
export function randomInt(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/** One entry of a non-empty list. */
export function pick<T>(random: Random, list: readonly T[]): T {
  if (list.length === 0) throw new Error('pick from an empty list');
  return list[Math.floor(random() * list.length)]!;
}

/** `count` distinct entries, in a random order. */
export function sample<T>(random: Random, list: readonly T[], count: number): T[] {
  const pool = [...list];
  for (let at = pool.length - 1; at > 0; at--) {
    const swap = Math.floor(random() * (at + 1));
    [pool[at], pool[swap]] = [pool[swap]!, pool[at]!];
  }
  return pool.slice(0, count);
}

/** A fresh seed for something that should differ every time, such as a new run. */
export function freshSeed(): number {
  return Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
}
