/**
 * The languages the interface is translated into.
 *
 * English is the source: every message exists in English first, and any
 * message another language has not translated yet falls back to it rather than
 * showing a key. Persian is the one right-to-left language, which is why each
 * locale carries its direction.
 *
 * This file imports nothing, so preferences can resolve a language without
 * pulling in the catalogs.
 */
export const LOCALES = ['en', 'es', 'fr', 'de', 'fa'] as const;
export type Locale = (typeof LOCALES)[number];

/** A player's choice: a locale, or whatever the device is set to. */
export type LanguageChoice = 'system' | Locale;

export interface LocaleInfo {
  /** The language's own name for itself, as a language picker shows it. */
  readonly nativeName: string;
  readonly dir: 'ltr' | 'rtl';
}

export const LOCALE_INFO: Record<Locale, LocaleInfo> = {
  en: { nativeName: 'English', dir: 'ltr' },
  es: { nativeName: 'Español', dir: 'ltr' },
  fr: { nativeName: 'Français', dir: 'ltr' },
  de: { nativeName: 'Deutsch', dir: 'ltr' },
  fa: { nativeName: 'فارسی', dir: 'rtl' },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function isLanguageChoice(value: unknown): value is LanguageChoice {
  return value === 'system' || isLocale(value);
}

/**
 * The supported locale closest to what the device asks for: an exact match
 * on the language subtag (`es-MX` is Spanish), else English.
 */
export function negotiateLocale(requested: readonly string[]): Locale {
  for (const tag of requested) {
    const language = tag.toLowerCase().split('-')[0];
    if (isLocale(language)) return language;
  }
  return 'en';
}

function deviceLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

/** The locale a language choice resolves to on this device. */
export function resolveLocale(choice: LanguageChoice): Locale {
  return choice === 'system' ? negotiateLocale(deviceLanguages()) : choice;
}
