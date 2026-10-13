import { describe, expect, it } from 'vitest';
import { LOCALES, type Locale, type Message } from './index';

/**
 * Every catalog, checked against its English source: each other language has
 * exactly the English keys, keeps the same `{placeholders}`, and words a
 * counted message as a proper plural - one form per plural category the
 * language actually has, always with `other`.
 *
 * A missing translation falls back to English at runtime, so nothing here is
 * needed for the app to work; it is what keeps the languages complete.
 */

type CatalogShape = { en: Record<string, Message> } & Partial<
  Record<Locale, Record<string, unknown>>
>;

const modules = import.meta.glob<Record<string, unknown>>(['./messages/*.ts', '!./**/*.test.ts'], {
  eager: true,
});

function isMessage(value: unknown): value is Message {
  if (typeof value === 'string') return true;
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)['other'] === 'string' &&
    Object.values(value).every((form) => typeof form === 'string')
  );
}

function isCatalog(value: unknown): value is CatalogShape {
  if (typeof value !== 'object' || value === null || !('en' in value)) return false;
  const en: unknown = value.en;
  return (
    typeof en === 'object' &&
    en !== null &&
    Object.keys(en).length > 0 &&
    Object.values(en).every(isMessage)
  );
}

const catalogs = Object.entries(modules).flatMap(([file, exports]) =>
  Object.entries(exports)
    .filter((entry): entry is [string, CatalogShape] => isCatalog(entry[1]))
    .map(([name, catalog]) => ({ id: `${file.replace('./messages/', '')} ${name}`, catalog })),
);

function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!))].toSorted();
}

/** Every placeholder any form of a message uses. */
function allPlaceholders(message: Message): string[] {
  const forms = typeof message === 'string' ? [message] : Object.values(message);
  return [...new Set(forms.flatMap((form) => (form ? placeholders(form) : [])))].toSorted();
}

const OTHER_LOCALES = LOCALES.filter((locale) => locale !== 'en');

describe('message catalogs', () => {
  it('finds the catalogs', () => {
    expect(catalogs.length).toBeGreaterThan(0);
  });

  describe.each(catalogs)('$id', ({ catalog }) => {
    const english = catalog.en;
    const englishKeys = Object.keys(english).toSorted();

    it.each(OTHER_LOCALES)('%s has every English key and no others', (locale) => {
      const translated = catalog[locale];
      expect(translated, `no ${locale} translations`).toBeDefined();
      expect(Object.keys(translated ?? {}).toSorted()).toEqual(englishKeys);
    });

    it.each(OTHER_LOCALES)('%s keeps the English placeholders and plural forms', (locale) => {
      const translated = catalog[locale] ?? {};
      const categories = new Set<string>(
        new Intl.PluralRules(locale).resolvedOptions().pluralCategories,
      );
      for (const key of englishKeys) {
        const source = english[key]!;
        const message = translated[key];
        if (message === undefined) continue;
        expect(isMessage(message), `${locale}.${key} is not a message`).toBe(true);
        const target = message as Message;

        if (typeof source !== 'string') {
          expect(typeof target, `${locale}.${key} must be plural like English`).toBe('object');
        }
        if (typeof target === 'string') {
          expect(placeholders(target), `${locale}.${key}`).toEqual(allPlaceholders(source));
          continue;
        }

        // A plural: forms only for categories the language has, `other` among them.
        for (const form of Object.keys(target)) {
          expect(categories.has(form), `${locale}.${key} has a "${form}" form`).toBe(true);
        }
        expect(typeof target.other, `${locale}.${key} needs "other"`).toBe('string');
        // `other` says everything English does; the narrower forms may leave
        // the count out ("one star") but never add a name English lacks.
        const sourceOther = typeof source === 'string' ? source : source.other;
        expect(placeholders(target.other), `${locale}.${key}.other`).toEqual(
          placeholders(sourceOther),
        );
        const allowed = new Set(allPlaceholders(source));
        for (const [form, text] of Object.entries(target)) {
          for (const name of placeholders(text ?? '')) {
            expect(allowed.has(name), `${locale}.${key}.${form} uses {${name}}`).toBe(true);
          }
        }
      }
    });

    it('English plurals cover the English categories', () => {
      for (const [key, message] of Object.entries(english)) {
        if (typeof message === 'string') continue;
        expect(typeof message.other, `en.${key} needs "other"`).toBe('string');
        for (const form of Object.keys(message)) {
          expect(['one', 'other'], `en.${key} has a "${form}" form`).toContain(form);
        }
      }
    });
  });
});
