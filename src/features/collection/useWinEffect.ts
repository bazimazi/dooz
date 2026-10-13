import { useSyncExternalStore } from 'react';
import { equippedCosmetic, type WinEffect } from '@/features/progress/cosmetics';
import { useProgressStore } from '@/features/progress/store';
import { loadPreferences, subscribePreferences } from '@/lib/preferences';

const readEffect = (): string => loadPreferences().cosmetics.effect ?? '';
const serverEffect = (): string => '';

/**
 * The win effect equipped in the collection, or the default confetti when
 * the choice is unknown or not unlocked on this device.
 */
export function useWinEffect(): WinEffect {
  const id = useSyncExternalStore(subscribePreferences, readEffect, serverEffect);
  const progress = useProgressStore();
  return equippedCosmetic('effect', id ? { effect: id } : {}, progress);
}
