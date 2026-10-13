import { useSyncExternalStore } from 'react';

/**
 * The world the current screen is set in - a journey rival's pond, library or
 * eclipse - or `null` for none.
 *
 * Held here rather than passed down because the backdrop sits behind every
 * screen and knows nothing about games, the same reason the turn tint is an
 * attribute on the root. A world is applied with `applyWorld` and always taken
 * off again on the way out, so the home screen is never left in a rival's
 * colours.
 */

export type WorldMotif = 'pond' | 'yarn' | 'library' | 'forest' | 'embers' | 'eclipse';

export interface WorldLook {
  id: string;
  motif: WorldMotif;
  /** A translucent wash over the board surface. */
  tint: string;
  /** The world's own colour, for the frame and the backdrop motif. */
  accent: string;
}

let current: WorldLook | null = null;
const listeners = new Set<() => void>();

export function applyWorld(world: WorldLook | null): void {
  current = world;
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (world) {
      root.dataset['world'] = world.id;
      root.style.setProperty('--world-tint', world.tint);
      root.style.setProperty('--world-accent', world.accent);
    } else {
      delete root.dataset['world'];
      root.style.removeProperty('--world-tint');
      root.style.removeProperty('--world-accent');
    }
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The world the page is in now, re-rendering when it changes. */
export function useWorld(): WorldLook | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
