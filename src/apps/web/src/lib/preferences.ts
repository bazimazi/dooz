import { type BoardSize, type BotDifficulty, isBoardSize, isBotDifficulty } from '@dooz/engine';

const STORAGE_KEY = 'dooz.preferences';

export interface Preferences {
  boardSize: BoardSize;
  difficulty: BotDifficulty;
}

const DEFAULTS: Preferences = { boardSize: 3, difficulty: 'hard' };

/**
 * Last-used board size and bot difficulty.
 *
 * Reading these back means the home screen opens on whatever the player chose
 * last time instead of resetting to 3x3 on every launch — which matters more on
 * mobile and desktop, where the app is relaunched rather than kept in a tab.
 */
export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULTS;

    const { boardSize, difficulty } = parsed as Partial<Preferences>;
    return {
      boardSize: isBoardSize(boardSize) ? boardSize : DEFAULTS.boardSize,
      difficulty: isBotDifficulty(difficulty) ? difficulty : DEFAULTS.difficulty,
    };
  } catch {
    return DEFAULTS;
  }
}

export function savePreferences(preferences: Partial<Preferences>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadPreferences(), ...preferences }));
  } catch {
    // Preferences are a convenience; losing them is not worth reporting.
  }
}
