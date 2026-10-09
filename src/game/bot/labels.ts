import type { BotDifficulty } from '@/game/engine';

/** How each bot level is named on screen. */
export const DIFFICULTY_LABELS: Record<BotDifficulty, string> = {
  beginner: 'Beginner',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
  master: 'Master',
};
