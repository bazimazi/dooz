import {
  type BotDifficulty,
  DEFAULT_MODE_ID,
  isBotDifficulty,
  isModeId,
  type ModeId,
} from '@dooz/engine';

const STORAGE_KEY = 'dooz.preferences';

export type ThemeChoice = 'system' | 'light' | 'dark';

export interface Preferences {
  /** Last mode played, so the home screen opens where the player left off. */
  mode: ModeId;
  difficulty: BotDifficulty;
  theme: ThemeChoice;
  /** Show the squares that would win or lose the game this move. */
  hints: boolean;
  /** The onboarding has been seen, so it is not shown again. */
  onboarded: boolean;
}

const DEFAULTS: Preferences = {
  mode: DEFAULT_MODE_ID,
  difficulty: 'medium',
  theme: 'system',
  hints: false,
  onboarded: false,
};

function isTheme(value: unknown): value is ThemeChoice {
  return value === 'system' || value === 'light' || value === 'dark';
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

    const { mode, difficulty, theme, hints, onboarded } = parsed as Partial<Preferences>;
    return {
      mode: isModeId(mode) ? mode : DEFAULTS.mode,
      difficulty: isBotDifficulty(difficulty) ? difficulty : DEFAULTS.difficulty,
      theme: isTheme(theme) ? theme : DEFAULTS.theme,
      hints: typeof hints === 'boolean' ? hints : DEFAULTS.hints,
      onboarded: typeof onboarded === 'boolean' ? onboarded : DEFAULTS.onboarded,
    };
  } catch {
    return DEFAULTS;
  }
}

export function savePreferences(preferences: Partial<Preferences>): void {
  try {
    const next = { ...loadPreferences(), ...preferences };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    if (preferences.theme !== undefined) applyTheme(next.theme);
  } catch {
    // Preferences are a convenience; losing them is not worth reporting.
  }
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

/** True when the platform has been asked to keep movement to a minimum. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
