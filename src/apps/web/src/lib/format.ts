/**
 * Formatting helpers.
 *
 * Everything user-facing that is not a sentence goes through here, so the app
 * says "3 minutes ago" the same way on every screen. They take the locale from
 * the platform rather than assuming English, which is most of what makes the
 * app translatable later: the strings are the only thing left to do.
 */

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

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

  for (const [unit, size] of UNITS) {
    if (magnitude >= size) return relative.format(Math.round(delta / size), unit);
  }
  return relative.format(0, 'second');
}

/** An absolute timestamp, for the title attribute behind a relative one. */
export function fullDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    timestamp,
  );
}

/** "4m 12s" - a match length, where the seconds still matter. */
export function duration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

/** A rating change, always signed, because an unsigned one is ambiguous. */
export function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

/** A win rate as a whole percentage, or a dash when nothing has been played. */
export function winRate(won: number, played: number): string {
  if (played === 0) return '—';
  return `${Math.round((won / played) * 100)}%`;
}

/** "1st", "2nd", "3rd" - for a leaderboard position. */
export function ordinal(value: number): string {
  const rules = new Intl.PluralRules(undefined, { type: 'ordinal' });
  const suffixes: Record<string, string> = {
    one: 'st',
    two: 'nd',
    few: 'rd',
    other: 'th',
  };
  return `${value}${suffixes[rules.select(value)] ?? 'th'}`;
}
