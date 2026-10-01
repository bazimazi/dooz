import {
  type BotDifficulty,
  DEFAULT_MODE_ID,
  isBotDifficulty,
  isModeId,
  type ModeId,
} from '@dooz/engine';

const STORAGE_KEY = 'dooz.preferences';

export type ThemeChoice = 'system' | 'light' | 'dark';

/** The piece sets a player can choose between. See `components/art/marks.tsx`. */
export const SKINS = ['classic', 'neon', 'chalk', 'candy'] as const;
export type Skin = (typeof SKINS)[number];

export interface Preferences {
  /** Last mode played, so the home screen opens where the player left off. */
  mode: ModeId;
  difficulty: BotDifficulty;
  theme: ThemeChoice;
  /** Show the squares that would win or lose the game this move. */
  hints: boolean;
  /** The onboarding has been seen, so it is not shown again. */
  onboarded: boolean;
  /** Sound effects. */
  sound: boolean;
  /** Master volume for everything the app plays, 0 to 1. */
  volume: number;
  /** The ambient score. Off until asked for: music nobody chose is noise. */
  music: boolean;
  /** Vibration on devices that have it. */
  haptics: boolean;
  /** Which piece set the board draws with. */
  skin: Skin;
  /** Names for the two seats of a pass-and-play game. */
  localNames: [string, string];
}

const DEFAULTS: Preferences = {
  mode: DEFAULT_MODE_ID,
  difficulty: 'medium',
  theme: 'system',
  hints: false,
  onboarded: false,
  sound: true,
  volume: 0.7,
  music: false,
  haptics: true,
  skin: 'classic',
  localNames: ['Player 1', 'Player 2'],
};

function isTheme(value: unknown): value is ThemeChoice {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function isSkin(value: unknown): value is Skin {
  return typeof value === 'string' && (SKINS as readonly string[]).includes(value);
}

function isVolume(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** A seat name from storage: short, printable, and never empty. */
function readName(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().slice(0, 14);
  return trimmed.length > 0 ? trimmed : fallback;
}

/**
 * Settings that survive a relaunch.
 *
 * Reading these back means the app opens on whatever the player chose last time
 * instead of resetting to the default on every launch - which matters more on
 * mobile and desktop, where the app is relaunched rather than kept in a tab.
 *
 * Storage can be unavailable (a private window, a webview with site data off),
 * so every path falls back to the defaults rather than failing.
 */
export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULTS;

    const stored = parsed as Partial<Record<keyof Preferences, unknown>>;
    const names = Array.isArray(stored.localNames) ? stored.localNames : [];
    return {
      mode: isModeId(stored.mode) ? stored.mode : DEFAULTS.mode,
      difficulty: isBotDifficulty(stored.difficulty) ? stored.difficulty : DEFAULTS.difficulty,
      theme: isTheme(stored.theme) ? stored.theme : DEFAULTS.theme,
      hints: typeof stored.hints === 'boolean' ? stored.hints : DEFAULTS.hints,
      onboarded: typeof stored.onboarded === 'boolean' ? stored.onboarded : DEFAULTS.onboarded,
      sound: typeof stored.sound === 'boolean' ? stored.sound : DEFAULTS.sound,
      volume: isVolume(stored.volume) ? stored.volume : DEFAULTS.volume,
      music: typeof stored.music === 'boolean' ? stored.music : DEFAULTS.music,
      haptics: typeof stored.haptics === 'boolean' ? stored.haptics : DEFAULTS.haptics,
      skin: isSkin(stored.skin) ? stored.skin : DEFAULTS.skin,
      localNames: [
        readName(names[0], DEFAULTS.localNames[0]),
        readName(names[1], DEFAULTS.localNames[1]),
      ],
    };
  } catch {
    return DEFAULTS;
  }
}

type Listener = (preferences: Preferences) => void;
const listeners = new Set<Listener>();

/**
 * Be told whenever a preference changes, from anywhere in the app.
 *
 * The sound engine and the board's piece set both live outside the component
 * that edits them, and a setting that only takes effect on the next reload is
 * one the player assumes is broken.
 */
export function subscribePreferences(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function savePreferences(preferences: Partial<Preferences>): void {
  let next: Preferences;
  try {
    next = { ...loadPreferences(), ...preferences };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Preferences are a convenience; losing them is not worth reporting. The
    // change still applies for this session.
    next = { ...loadPreferences(), ...preferences };
  }
  if (preferences.theme !== undefined) applyTheme(next.theme);
  for (const listener of listeners) listener(next);
}

/**
 * Put the chosen theme on the document.
 *
 * `system` removes the attribute entirely rather than resolving it here, so the
 * stylesheet's own media query decides - which means the page follows the
 * system switching mid-session without anything having to listen for it.
 */
export function applyTheme(theme: ThemeChoice): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);

  // Keep the browser's own chrome - the address bar, the scrollbars - in step.
  root.style.colorScheme = theme === 'system' ? 'light dark' : theme;
}
