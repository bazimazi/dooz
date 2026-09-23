/**
 * Structured logging.
 *
 * One JSON object per line, because the thing that reads these in production is
 * a log shipper rather than a person, and a shipper cannot index a sentence.
 * In development it prints a readable line instead - a wall of JSON is no way
 * to watch a game being played.
 *
 * Nothing here ever logs a token, a password or a password hash. Account ids
 * are logged because a support question is unanswerable without them; they are
 * identifiers, not credentials.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const configured = (process.env['LOG_LEVEL'] ?? 'info').toLowerCase();
const threshold = LEVELS[configured as LogLevel] ?? LEVELS.info;
const pretty = process.env['LOG_FORMAT'] === 'pretty' || process.env['NODE_ENV'] === 'development';

export interface LogFields {
  readonly [key: string]: string | number | boolean | null | undefined;
}

function write(level: LogLevel, event: string, fields: LogFields = {}): void {
  if (LEVELS[level] < threshold) return;

  if (pretty) {
    const rest = Object.entries(fields)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(' ');
    console.log(`${level.toUpperCase().padEnd(5)} ${event}${rest ? ` ${rest}` : ''}`);
    return;
  }

  console.log(JSON.stringify({ level, event, time: new Date().toISOString(), ...fields }));
}

export const log = {
  debug: (event: string, fields?: LogFields) => write('debug', event, fields),
  info: (event: string, fields?: LogFields) => write('info', event, fields),
  warn: (event: string, fields?: LogFields) => write('warn', event, fields),
  error: (event: string, fields?: LogFields) => write('error', event, fields),
  /** Errors carry no useful fields of their own, so they are flattened here. */
  exception: (event: string, error: unknown, fields?: LogFields) =>
    write('error', event, {
      ...fields,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 4).join(' | ') : undefined,
    }),
};
