import { BOT_DIFFICULTIES, type BotDifficulty } from '@/game/engine';
import { type Locale, translate, useLocale } from '@/i18n';
import { gameLabelMessages } from '@/i18n/messages/gameLabels';

/** A bot level's name, in `locale` (the interface's own by default). */
export function difficultyLabel(difficulty: BotDifficulty, locale?: Locale): string {
  return translate(gameLabelMessages, difficulty, undefined, locale);
}

/** A bot level's name cut to fit a segmented control: "Med", "Exp". */
export function difficultyShortLabel(difficulty: BotDifficulty, locale?: Locale): string {
  return translate(gameLabelMessages, `${difficulty}Short`, undefined, locale);
}

/** "Hard bot": how an unnamed bot opponent is called. */
export function botName(difficulty: BotDifficulty, locale?: Locale): string {
  return translate(
    gameLabelMessages,
    'botName',
    { level: difficultyLabel(difficulty, locale) },
    locale,
  );
}

/**
 * How each bot level is named on screen, in the current language.
 *
 * Each entry is read when it is looked up, so a lookup always gets the
 * language in force at the time. A component that should re-render when the
 * language changes reads `useLocale()` (or uses {@link difficultyLabel} with
 * it) as well.
 */
export const DIFFICULTY_LABELS: Readonly<Record<BotDifficulty, string>> = Object.defineProperties(
  {} as Record<BotDifficulty, string>,
  Object.fromEntries(
    BOT_DIFFICULTIES.map((difficulty) => [
      difficulty,
      { enumerable: true, get: () => difficultyLabel(difficulty) },
    ]),
  ),
);

/** The level-name helpers bound to the current language, re-rendering on a change. */
export function useDifficultyLabels(): {
  label: (difficulty: BotDifficulty) => string;
  short: (difficulty: BotDifficulty) => string;
  bot: (difficulty: BotDifficulty) => string;
} {
  const locale = useLocale();
  return {
    label: (difficulty) => difficultyLabel(difficulty, locale),
    short: (difficulty) => difficultyShortLabel(difficulty, locale),
    bot: (difficulty) => botName(difficulty, locale),
  };
}
