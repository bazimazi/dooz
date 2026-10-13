import type { TelemetryEvent } from '@/protocol/social';
import { isTauri, platformName } from '@/platform';
import { httpBaseUrl } from './server-url';

/**
 * Anonymous usage events and crash reports, sent to our own server.
 *
 * What is sent: event names ("game.start"), a few plain fields (the mode, bot
 * level, outcome), and errors with their stack, scrubbed of query strings.
 * What is never sent: an account id, a name, a device id, or anything that
 * survives the app being closed - not even a session id. Nothing is sent at
 * all when the player turns it off in Settings, or when the browser asks
 * sites not to track (Do Not Track / Global Privacy Control).
 *
 * Events are queued in memory and sent in batches every half minute, and
 * whatever is left goes with `sendBeacon` when the page is hidden.
 */

const OPT_OUT_KEY = 'dooz.telemetry';
const FLUSH_INTERVAL_MS = 30_000;
const FLUSH_AT = 20;
const MAX_QUEUE = 100;
/** The same error reported more than this in one session is noise, not news. */
const MAX_REPEATS = 3;

type Data = Record<string, string | number | boolean>;

let queue: TelemetryEvent[] = [];
const repeats = new Map<string, number>();
let timer: ReturnType<typeof setInterval> | null = null;

/** Whether the browser has asked sites not to track. Respected, not overridable. */
export function browserOptedOut(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const legacy = (typeof window !== 'undefined' ? window : {}) as { doNotTrack?: string };
  return (
    nav.globalPrivacyControl === true ||
    nav.doNotTrack === '1' ||
    nav.doNotTrack === 'yes' ||
    nav.msDoNotTrack === '1' ||
    legacy.doNotTrack === '1'
  );
}

/** The player's own choice; on unless they turned it off. */
export function telemetryChoice(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function telemetryEnabled(): boolean {
  return telemetryChoice() && !browserOptedOut();
}

export function setTelemetryChoice(enabled: boolean): void {
  try {
    if (enabled) localStorage.removeItem(OPT_OUT_KEY);
    else localStorage.setItem(OPT_OUT_KEY, 'off');
  } catch {
    // Without storage the choice lasts the session, which the queue honours.
  }
  if (!enabled) queue = [];
}

/** Record a named event. A no-op when telemetry is off. */
export function track(name: string, data?: Data): void {
  if (!telemetryEnabled()) return;
  push({ kind: 'event', name, at: Date.now(), ...(data ? { data: clean(data) } : {}) });
}

/** Record an error. `source` says where it was caught. */
export function reportError(error: unknown, source: string): void {
  if (!telemetryEnabled()) return;
  const name =
    error instanceof Error && /^[a-zA-Z][\w.:-]{0,47}$/.test(error.name) ? error.name : 'Error';
  const message = scrub(error instanceof Error ? error.message : String(error)).slice(0, 500);
  const key = `${name}:${message}`;
  const seen = repeats.get(key) ?? 0;
  if (seen >= MAX_REPEATS) return;
  repeats.set(key, seen + 1);

  const stack =
    error instanceof Error && error.stack ? scrub(error.stack).slice(0, 4000) : undefined;
  push({
    kind: 'error',
    name,
    at: Date.now(),
    message: message || 'Unknown error',
    ...(stack ? { stack } : {}),
    source: source.slice(0, 40),
  });
  // Crashes go out promptly: the next thing that happens may be the tab closing.
  void flush();
}

function push(event: TelemetryEvent): void {
  queue.push(event);
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  if (queue.length >= FLUSH_AT) void flush();
}

/** Strip query strings and fragments from URLs, and anything shaped like an email. */
function scrub(text: string): string {
  return text
    .replace(/(https?:\/\/[^\s?#)]+)[?#][^\s)]*/g, '$1')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>');
}

function clean(data: Data): Data {
  const entries = Object.entries(data)
    .filter(([key]) => /^[a-zA-Z]\w{0,31}$/.test(key))
    .slice(0, 12)
    .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 100) : value]);
  return Object.fromEntries(entries) as Data;
}

function platform(): string {
  if (isTauri()) {
    const name = platformName();
    return name === 'android' || name === 'ios' ? name : 'desktop';
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches) {
    return 'pwa';
  }
  return 'web';
}

function batch(events: TelemetryEvent[]): string {
  const version = String(import.meta.env['VITE_APP_VERSION'] ?? import.meta.env.MODE).slice(0, 20);
  return JSON.stringify({ v: 1, app: { version, platform: platform() }, events });
}

function endpoint(): string | null {
  try {
    return `${httpBaseUrl()}/api/telemetry`;
  } catch {
    return null;
  }
}

/** Send what is queued. Failed batches are dropped: telemetry is best effort. */
export async function flush(): Promise<void> {
  if (queue.length === 0 || !telemetryEnabled()) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  const url = endpoint();
  if (!url) return;
  const events = queue.splice(0, 50);
  try {
    await fetch(url, {
      method: 'POST',
      // text/plain keeps this a "simple" request: no CORS preflight, and the
      // same shape `sendBeacon` uses.
      headers: { 'content-type': 'text/plain' },
      body: batch(events),
      keepalive: true,
      credentials: 'omit',
    });
  } catch {
    // Offline or blocked. Not worth retrying.
  }
}

function flushOnHide(): void {
  if (queue.length === 0 || !telemetryEnabled()) return;
  const url = endpoint();
  if (!url || typeof navigator.sendBeacon !== 'function') return;
  const events = queue.splice(0, 50);
  navigator.sendBeacon(url, new Blob([batch(events)], { type: 'text/plain' }));
}

/** Catch uncaught errors and start the batch timer. Safe to call once at launch. */
export function installTelemetry(): void {
  if (typeof window === 'undefined' || timer) return;
  window.addEventListener('error', (event) => reportError(event.error ?? event.message, 'window'));
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason, 'promise'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnHide();
  });
  window.addEventListener('pagehide', flushOnHide);
  timer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  track('session.start');
}

/** For tests: what is waiting to be sent. */
export function pendingEvents(): readonly TelemetryEvent[] {
  return queue;
}
