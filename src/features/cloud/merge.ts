/**
 * Merging two copies of a player's solo progress.
 *
 * The cloud save is a versioned blob - the device's whole `dooz.progress`
 * object - rather than a schema the server knows field by field, so progress
 * features can grow (XP, achievements, new puzzle packs) without the server
 * changing. What makes that safe is that every field in it is something a
 * player only ever earns, never loses, so one generic rule set merges any two
 * copies without losing what either device earned:
 *
 * - **numbers** take the larger: stars, records, counts, XP;
 * - **booleans** are true if either is: unlocked, seen, announced;
 * - **lists of plain values** are unioned: solved puzzles, unlocked items;
 * - **objects** merge key by key, recursively;
 * - an object with a **`lastDay`** is a streak, and streaks are not
 *   field-wise: the copy with the later day wins whole (a streak of 9 from
 *   last month must not be glued onto today's date), keeping the larger `best`;
 * - anything else (a string, mismatched types) takes the incoming copy.
 *
 * The merge is commutative for everything but that last rule, and idempotent,
 * so merging on the server, on the client, or both, in any order, converges.
 */

export const CLOUD_SAVE_VERSION = 1;

/** Deeper than any real progress object; beyond it the incoming value wins. */
const MAX_DEPTH = 8;
/** Lists longer than this are trimmed: a union must not grow without bound. */
const MAX_LIST = 5000;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPrimitive(value: unknown): value is string | number | boolean | null {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function isStreak(value: Record<string, unknown>): boolean {
  return 'lastDay' in value && (typeof value['lastDay'] === 'number' || value['lastDay'] === null);
}

function day(value: Record<string, unknown>): number {
  return typeof value['lastDay'] === 'number' ? value['lastDay'] : -Infinity;
}

function streak(value: Record<string, unknown>): number {
  return typeof value['streak'] === 'number' ? value['streak'] : 0;
}

function mergeStreak(
  stored: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const newer =
    day(incoming) > day(stored) ||
    (day(incoming) === day(stored) && streak(incoming) >= streak(stored))
      ? incoming
      : stored;
  const merged: Record<string, unknown> = { ...newer };
  const bests = [stored['best'], incoming['best']].filter(
    (value): value is number => typeof value === 'number',
  );
  if (bests.length > 0) merged['best'] = Math.max(...bests);
  return merged;
}

/** Merge `incoming` into `stored` by the rules above. Neither input is changed. */
export function mergeProgress(stored: unknown, incoming: unknown, depth = 0): unknown {
  if (incoming === undefined) return stored;
  if (stored === undefined || stored === null) return incoming;
  if (incoming === null) return stored;
  if (depth > MAX_DEPTH) return incoming;

  if (typeof stored === 'number' && typeof incoming === 'number') {
    if (!Number.isFinite(stored)) return incoming;
    if (!Number.isFinite(incoming)) return stored;
    return Math.max(stored, incoming);
  }
  if (typeof stored === 'boolean' && typeof incoming === 'boolean') return stored || incoming;

  if (Array.isArray(stored) && Array.isArray(incoming)) {
    if (stored.every(isPrimitive) && incoming.every(isPrimitive)) {
      const seen = new Set<string>();
      const union: unknown[] = [];
      for (const value of [...stored, ...incoming]) {
        const key = JSON.stringify(value);
        if (seen.has(key)) continue;
        seen.add(key);
        union.push(value);
      }
      return union.slice(-MAX_LIST);
    }
    // Lists of records have no identity to merge on; the longer one is the one
    // that has seen more.
    return (incoming.length >= stored.length ? incoming : stored).slice(-MAX_LIST);
  }

  if (isPlainObject(stored) && isPlainObject(incoming)) {
    if (isStreak(stored) && isStreak(incoming)) return mergeStreak(stored, incoming);
    const merged: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(stored), ...Object.keys(incoming)])) {
      // Never let a key like `__proto__` reach an object literal's prototype.
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      merged[key] = mergeProgress(stored[key], incoming[key], depth + 1);
    }
    return merged;
  }

  return incoming;
}

/** The envelope a cloud save travels in, so a future format can be told apart. */
export interface CloudEnvelope {
  readonly v: number;
  readonly progress: Json | Record<string, unknown>;
}

export function mergeEnvelopes(stored: unknown, incoming: unknown): CloudEnvelope {
  const storedProgress =
    isPlainObject(stored) && isPlainObject(stored['progress']) ? stored['progress'] : {};
  const incomingProgress =
    isPlainObject(incoming) && isPlainObject(incoming['progress']) ? incoming['progress'] : {};
  return {
    v: CLOUD_SAVE_VERSION,
    progress: mergeProgress(storedProgress, incomingProgress) as Record<string, unknown>,
  };
}
