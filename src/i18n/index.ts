import { useCallback, useSyncExternalStore } from 'react';
import { loadPreferences, subscribePreferences } from '@/lib/preferences';
import { type Locale, resolveLocale } from './locales';

/**
 * Translation, without a library.
 *
 * Messages live in catalogs, one per area of the app (`messages/*.ts`), each
 * made with {@link defineMessages}. A catalog's English entries are its source
 * and fix its keys; every other language is a partial copy, so a missing
 * translation shows English instead of a key, and a typo in a key is a type
 * error rather than a blank label.
 *
 * A message is a string with `{name}` placeholders, or - when it says how
 * many of something there are - one string per plural category, picked by
 * `count` with the locale's own plural rules. Numbers are written in the
 * locale's digits, so Persian shows ۳ rather than 3.
 */

export * from './locales';

export type PluralMessage = Partial<Record<Intl.LDMLPluralRule, string>> & {
  readonly other: string;
};
export type Message = string | PluralMessage;
export type MessageValues = Readonly<Record<string, string | number>>;

export type Catalog<E extends Record<string, Message>> = {
  readonly en: E;
} & {
  readonly [L in Exclude<Locale, 'en'>]?: Partial<Record<keyof E, Message>>;
};

/** Declare a catalog. The identity function, there to infer and check its type. */
export function defineMessages<const E extends Record<string, Message>>(
  catalog: Catalog<E>,
): Catalog<E> {
  return catalog;
}

// ---------------------------------------------------------------------------
// The active locale
// ---------------------------------------------------------------------------

/** The locale the interface is in right now. */
export function currentLocale(): Locale {
  return resolveLocale(loadPreferences().language);
}

/** As {@link currentLocale}, re-rendering when the player changes language. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribePreferences, currentLocale, serverLocale);
}

const serverLocale = (): Locale => 'en';

// ---------------------------------------------------------------------------
// Formatting messages
// ---------------------------------------------------------------------------

const pluralRules = new Map<Locale, Intl.PluralRules>();
const numberFormats = new Map<Locale, Intl.NumberFormat>();

function pluralFor(locale: Locale): Intl.PluralRules {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRules.set(locale, rules);
  }
  return rules;
}

/** A number in the locale's own digits and grouping. */
export function formatNumber(value: number, locale: Locale = currentLocale()): string {
  let numbers = numberFormats.get(locale);
  if (!numbers) {
    numbers = new Intl.NumberFormat(locale);
    numberFormats.set(locale, numbers);
  }
  return numbers.format(value);
}

/** Fill a message for `locale`. Exported for tests and for code outside React. */
export function format(message: Message, values: MessageValues = {}, locale: Locale): string {
  let text: string;
  if (typeof message === 'string') {
    text = message;
  } else {
    const count = typeof values['count'] === 'number' ? values['count'] : 0;
    text = message[pluralFor(locale).select(count)] ?? message.other;
  }
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    if (value === undefined) return match;
    return typeof value === 'number' ? formatNumber(value, locale) : value;
  });
}

/** Look a message up in `catalog` for `locale`, falling back to English. */
export function translate<E extends Record<string, Message>>(
  catalog: Catalog<E>,
  key: keyof E,
  values?: MessageValues,
  locale: Locale = currentLocale(),
): string {
  const localized = locale === 'en' ? undefined : catalog[locale]?.[key];
  return format(localized ?? catalog.en[key] ?? String(key), values, locale);
}

export type Translator<E extends Record<string, Message>> = (
  key: keyof E,
  values?: MessageValues,
) => string;

/**
 * The translator for one catalog, bound to the current locale.
 *
 * ```tsx
 * const t = useT(homeMessages);
 * return <button>{t('playBot')}</button>;
 * ```
 */
export function useT<E extends Record<string, Message>>(catalog: Catalog<E>): Translator<E> {
  const locale = useLocale();
  return useCallback(
    (key: keyof E, values?: MessageValues) => translate(catalog, key, values, locale),
    [catalog, locale],
  );
}
