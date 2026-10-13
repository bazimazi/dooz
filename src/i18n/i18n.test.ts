import { afterEach, describe, expect, it } from 'vitest';
import { applyLanguage, savePreferences } from '@/lib/preferences';
import { defineMessages, format, negotiateLocale, translate } from './index';

const catalog = defineMessages({
  en: {
    greeting: 'Hello, {name}',
    stars: { one: '{count} star', other: '{count} stars' },
    onlyEnglish: 'Only in English',
  },
  fa: {
    greeting: 'سلام، {name}',
    stars: { other: '{count} ستاره' },
  },
  fr: {
    stars: { one: '{count} étoile', other: '{count} étoiles' },
  },
});

afterEach(() => {
  savePreferences({ language: 'system' });
});

describe('translate', () => {
  it('fills placeholders and falls back to English for missing messages', () => {
    expect(translate(catalog, 'greeting', { name: 'Ada' }, 'en')).toBe('Hello, Ada');
    expect(translate(catalog, 'greeting', { name: 'Ada' }, 'fa')).toBe('سلام، Ada');
    expect(translate(catalog, 'onlyEnglish', undefined, 'fa')).toBe('Only in English');
    expect(translate(catalog, 'greeting', { name: 'Ada' }, 'de')).toBe('Hello, Ada');
  });

  it("picks plurals by the locale's own rules and writes its digits", () => {
    expect(translate(catalog, 'stars', { count: 1 }, 'en')).toBe('1 star');
    expect(translate(catalog, 'stars', { count: 3 }, 'en')).toBe('3 stars');
    // French counts zero as singular, unlike English.
    expect(translate(catalog, 'stars', { count: 0 }, 'fr')).toBe('0 étoile');
    expect(translate(catalog, 'stars', { count: 3 }, 'fa')).toBe('۳ ستاره');
  });

  it('leaves a placeholder it has no value for, so the gap is visible', () => {
    expect(format('Hi {name}', {}, 'en')).toBe('Hi {name}');
  });

  it('follows the saved language when no locale is given', () => {
    savePreferences({ language: 'fa' });
    expect(translate(catalog, 'greeting', { name: 'Ada' })).toBe('سلام، Ada');
  });
});

describe('locale negotiation', () => {
  it('matches on the language subtag and falls back to English', () => {
    expect(negotiateLocale(['es-MX', 'en'])).toBe('es');
    expect(negotiateLocale(['ja-JP'])).toBe('en');
    expect(negotiateLocale(['pt-BR', 'fa-IR'])).toBe('fa');
  });

  it('sets the document language and direction', () => {
    applyLanguage('fa');
    expect(document.documentElement.lang).toBe('fa');
    expect(document.documentElement.dir).toBe('rtl');
    applyLanguage('de');
    expect(document.documentElement.dir).toBe('ltr');
  });
});
