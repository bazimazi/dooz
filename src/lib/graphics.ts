import { useSyncExternalStore } from 'react';
import {
  type ArtStyle,
  type GraphicsQuality,
  loadPreferences,
  subscribePreferences,
} from './preferences';

/** Components remove costly decoration entirely, rather than just hiding it. */
export function useGraphics(): GraphicsQuality {
  return useSyncExternalStore(subscribePreferences, readGraphics, serverGraphics);
}

const readGraphics = (): GraphicsQuality => loadPreferences().graphics;
const serverGraphics = (): GraphicsQuality => 'high';

/**
 * How each visual style is previewed in Settings. Their names and descriptions
 * are translated, so they live in the settings catalog instead.
 *
 * The swatch is drawn from fixed colours - the style at its most typical - rather
 * than the live tokens, because the picker has to show every style at once
 * while the page itself is wearing only one of them.
 */
export const ART_STYLE_INFO: Record<
  ArtStyle,
  { swatch: { canvas: string; board: string; grid: string; x: string; o: string } }
> = {
  pastel: {
    swatch: { canvas: '#232599', board: '#191685', grid: '#d9d9d9', x: '#f3339e', o: '#f9bd13' },
  },
  tabletop: {
    swatch: { canvas: '#173a2c', board: '#6a4224', grid: '#f3d9a8', x: '#ff8a78', o: '#f7cd5c' },
  },
  neon: {
    swatch: { canvas: '#0b0618', board: '#0d0720', grid: '#6a46e0', x: '#ff3fb4', o: '#ffe14d' },
  },
  paper: {
    swatch: { canvas: '#ece2cc', board: '#fffdf4', grid: '#8fb0e0', x: '#c8195f', o: '#946000' },
  },
  ink: {
    swatch: { canvas: '#efe7d6', board: '#f8f2e4', grid: '#a89a7c', x: '#c1271a', o: '#24211c' },
  },
  chalkboard: {
    swatch: { canvas: '#1c2a24', board: '#2a3c33', grid: '#c9d4c9', x: '#ff9ec4', o: '#ffe08a' },
  },
};

/** The player's visual style, re-rendering whenever it changes. */
export function useArtStyle(): ArtStyle {
  return useSyncExternalStore(subscribePreferences, readStyle, serverStyle);
}

const readStyle = (): ArtStyle => loadPreferences().style;
const serverStyle = (): ArtStyle => 'pastel';

/**
 * What the effects layer may spend at each quality.
 *
 * One table, so the canvas, the callouts and the shake all agree on what
 * Balanced means rather than each guessing. Low spends nothing: the layer is
 * not mounted at all.
 */
export interface EffectsBudget {
  /** Live particles at once, across every burst. */
  particles: number;
  /** Device pixel ratio ceiling for the canvas backing store. */
  pixelRatio: number;
  /** Peak screen-shake offset in CSS pixels. */
  shake: number;
  /** Slow-motion hold on the winning move, in milliseconds. */
  slowMotion: number;
  /** Additive glow ("bloom") on particles and the win trace. */
  bloom: boolean;
}

export const EFFECTS_BUDGET: Record<GraphicsQuality, EffectsBudget> = {
  low: { particles: 0, pixelRatio: 1, shake: 0, slowMotion: 0, bloom: false },
  balanced: { particles: 48, pixelRatio: 1.5, shake: 3, slowMotion: 0, bloom: false },
  high: { particles: 160, pixelRatio: 2, shake: 7, slowMotion: 420, bloom: true },
};
