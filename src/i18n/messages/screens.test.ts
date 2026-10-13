import { describe, expect, it } from 'vitest';
import { GAME_MODES } from '@/game/engine';
import { type Catalog, LOCALES, type Message } from '@/i18n';
import { homeMessages } from './home';
import { learnMessages } from './learn';
import { describeConfigText, modeMessages, modeText } from './modes';
import { puzzleMessages } from './puzzles';
import { replayMessages } from './replay';
import { settingsMessages } from './settings';

/**
 * The compiler holds every translation to English's keys, but not to having
 * all of them, nor to keeping their placeholders. These catalogs are meant to
 * be complete, so a missing or broken translation fails here rather than
 * quietly falling back to English on somebody's screen.
 */

const TRANSLATED = LOCALES.filter((locale) => locale !== 'en');

const CATALOGS: Record<string, Catalog<Record<string, Message>>> = {
  home: homeMessages,
  learn: learnMessages,
  modes: modeMessages,
  puzzles: puzzleMessages,
  replay: replayMessages,
  settings: settingsMessages,
};

function placeholders(message: Message | undefined): string[] {
  if (message === undefined) return [];
  const texts = typeof message === 'string' ? [message] : Object.values(message);
  return [...new Set(texts.flatMap((text) => text?.match(/\{\w+\}/g) ?? []))].toSorted();
}

describe.each(Object.entries(CATALOGS))('the %s catalog', (_, catalog) => {
  it.each(TRANSLATED)('is fully translated into %s, placeholders and all', (locale) => {
    const translated = catalog[locale] ?? {};
    for (const [key, english] of Object.entries(catalog.en)) {
      expect(translated[key], `${locale}: ${key}`).toBeDefined();
      expect(placeholders(translated[key]), `${locale}: ${key}`).toEqual(placeholders(english));
    }
  });
});

describe('mode text', () => {
  it('matches the engine’s English word for word', () => {
    for (const mode of GAME_MODES) {
      expect(modeText(mode.id, 'en')).toEqual({
        name: mode.name,
        tagline: mode.tagline,
        rules: mode.rules,
      });
    }
  });

  it('gives every mode the same number of rules in every language', () => {
    for (const mode of GAME_MODES) {
      for (const locale of TRANSLATED) {
        const text = modeText(mode.id, locale);
        expect(text.rules).toHaveLength(mode.rules.length);
        expect(text.name).not.toBe('');
      }
    }
  });

  it('describes a custom game in the locale’s own words and digits', () => {
    const custom = { variant: 'gomoku', size: 11, winLength: 5 } as const;
    expect(describeConfigText(custom, 'en')).toBe('Gomoku 11×11 · 5 in a row');
    expect(describeConfigText(custom, 'fa')).toBe('گوموکو ۱۱×۱۱، ۵ در یک ردیف');
    expect(describeConfigText(GAME_MODES[0]!.config, 'de')).toBe('Klassisch');
  });
});
