import { currentLocale, type Locale, translate } from '@/i18n';
import { formatMessages } from '@/i18n/messages/onlineFormat';

/**
 * Formatting helpers.
 *
 * Everything user-facing that is not a sentence goes through here, so the app
 * says "3 minutes ago" the same way on every screen. They follow the language
 * the player chose rather than assuming English: Intl does the dates and the
 * digits, and the few words Intl has no name for come from a catalog.
 */

/**
 * The tag to hand Intl for the interface language. The device's own tag when
 * it speaks the same language, so an English interface on a British device
 * still writes dates the British way; otherwise the bare language.
 */
function intlLocale(locale: Locale = currentLocale()): string {
  if (typeof navigator !== 'undefined') {
    const device = navigator.languages?.length ? navigator.languages : [navigator.language];
    const match = device.find((tag) => tag?.toLowerCase().split('-')[0] === locale);
    if (match) return match;
  }
  return locale;
}

const relativeFormats = new Map<string, Intl.RelativeTimeFormat>();

function relativeFormat(): Intl.RelativeTimeFormat {
  const tag = intlLocale();
  let format = relativeFormats.get(tag);
  if (!format) {
    format = new Intl.RelativeTimeFormat(tag, { numeric: 'auto' });
    relativeFormats.set(tag, format);
  }
  return format;
}

const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600_000],
  ['month', 30 * 24 * 3600_000],
  ['week', 7 * 24 * 3600_000],
  ['day', 24 * 3600_000],
  ['hour', 3600_000],
  ['minute', 60_000],
  ['second', 1000],
];

/** "3 minutes ago", "yesterday", "last week". */
export function timeAgo(timestamp: number, now = Date.now()): string {
  const delta = timestamp - now;
  const magnitude = Math.abs(delta);
  const relative = relativeFormat();

  for (const [unit, size] of UNITS) {
    // Truncated, not rounded: 59.6 minutes is "59 minutes", never "60 minutes".
    if (magnitude >= size) return relative.format(Math.trunc(delta / size), unit);
  }
  return relative.format(0, 'second');
}

/** An absolute timestamp, for the title attribute behind a relative one. */
export function fullDate(timestamp: number): string {
  return new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
    timestamp,
  );
}

/** A calendar date with no time, in the reader's locale. */
export function longDate(timestamp: number): string {
  return new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'medium' }).format(timestamp);
}

/** "4m 12s" - a match length, where the seconds still matter. */
export function duration(ms: number): string {
  const locale = currentLocale();
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return translate(formatMessages, 'durationSeconds', { seconds }, locale);
  const padded = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 }).format(seconds);
  return translate(formatMessages, 'durationMinutes', { minutes, seconds: padded }, locale);
}

/** A rating change, always signed, because an unsigned one is ambiguous. */
export function signed(value: number): string {
  return new Intl.NumberFormat(currentLocale(), {
    signDisplay: 'exceptZero',
    useGrouping: false,
  }).format(value);
}

/** A win rate as a whole percentage, or a dash when nothing has been played. */
export function winRate(won: number, played: number): string {
  if (played === 0) return '—';
  const percent = Math.round((won / played) * 100);
  return new Intl.NumberFormat(currentLocale(), { style: 'percent' }).format(percent / 100);
}

/** "1st", "2nd", "3rd" - for a leaderboard position. */
export function ordinal(value: number): string {
  const locale = currentLocale();
  const category = new Intl.PluralRules(locale, { type: 'ordinal' }).select(value);
  const key =
    category === 'one' || category === 'two' || category === 'few'
      ? (`ordinal_${category}` as const)
      : 'ordinal_other';
  return translate(formatMessages, key, { n: value }, locale);
}
