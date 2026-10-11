import { useSyncExternalStore } from 'react';
import { loadPreferences, subscribePreferences, type GraphicsQuality } from './preferences';

export const GRAPHICS_DESCRIPTIONS: Record<GraphicsQuality, string> = {
  low: 'Best for slower phones. Static visuals, no particles, blur or shadows.',
  balanced: 'Gameplay animations with a still background, fewer particles and no blur or glow.',
  high: 'The full experience: animated backgrounds, particles, blur and glow.',
};

/** Components remove costly decoration entirely, rather than just hiding it. */
export function useGraphics(): GraphicsQuality {
  return useSyncExternalStore(subscribePreferences, readGraphics, serverGraphics);
}

const readGraphics = (): GraphicsQuality => loadPreferences().graphics;
const serverGraphics = (): GraphicsQuality => 'high';
