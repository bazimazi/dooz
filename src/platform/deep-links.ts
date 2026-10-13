import type * as DeepLinkPlugin from '@tauri-apps/plugin-deep-link';
import { isTauri } from './env';

/**
 * Links from outside that open the app at the right screen.
 *
 * Two kinds arrive:
 * - `dooz://play/online?code=ABCD` (and the short `dooz://join/ABCD`), the
 *   custom scheme every native build registers. It works with no server-side
 *   setup, so it is what a desktop or phone can always be reached by.
 * - `https://<public host>/play/online?code=ABCD`, the invite link the game
 *   already shares, when the owner has set up Android App Links / iOS Universal
 *   Links for that domain (see the README). The phone then opens the app
 *   instead of the browser.
 *
 * Both are turned into an in-app path and handed to the router. Whatever the
 * link says is untrusted: only known top-level screens are accepted, and the
 * routes still validate every search parameter themselves.
 */
const SCHEME = 'dooz:';

const noop = () => {};

/** First path segments the app has screens for. */
const SCREENS = new Set([
  'play',
  'puzzles',
  'replay',
  'profile',
  'leaderboard',
  'learn',
  'journey',
]);

/**
 * The in-app path a link should open, or `null` if it is not one of ours.
 *
 * `publicUrl` is the deployed web app (`VITE_PUBLIC_URL`); https links are only
 * accepted from its host.
 */
export function deepLinkPath(link: string, publicUrl?: string): string | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }

  let path: string;
  if (url.protocol === SCHEME) {
    // A custom scheme has no real host, so `dooz://play/online` parses with
    // `play` as the host. Put it back in front of the path.
    path = `/${url.host}${url.pathname}`;
  } else if (url.protocol === 'https:' && publicUrl) {
    let base: URL;
    try {
      base = new URL(publicUrl);
    } catch {
      return null;
    }
    if (url.host !== base.host) return null;
    path = url.pathname;
  } else {
    return null;
  }

  const segments = path.split('/').filter(Boolean);
  const [first, second] = segments;

  // `dooz://join/ABCD` - short enough to read out or type.
  if (first === 'join' && second) {
    return `/play/online?${new URLSearchParams({ code: second }).toString()}`;
  }

  if (!first) return '/';
  if (!SCREENS.has(first)) return '/';
  return `/${segments.join('/')}${url.search}`;
}

/**
 * Route every deep link - the one that launched the app and any that arrive
 * while it runs - to `navigate`. Resolves to a function that stops listening.
 *
 * On Windows and Linux a link to a running app starts a second copy; the
 * single-instance plugin hands its URL to this one, which is why there is only
 * one listener to handle both cases. On macOS, iOS and Android the system
 * delivers it to the running app directly.
 */
export async function installDeepLinks(navigate: (path: string) => void): Promise<() => void> {
  if (!isTauri()) return noop;

  let plugin: typeof DeepLinkPlugin;
  try {
    plugin = await import('@tauri-apps/plugin-deep-link');
  } catch {
    return noop;
  }

  const publicUrl = import.meta.env.VITE_PUBLIC_URL as string | undefined;
  // A cold start can report the same URL both as the launch URL and as a new
  // one, depending on the platform. Opening the same room twice in a row is
  // never wanted, so a repeat within a moment is dropped.
  let last = { link: '', at: 0 };
  const open = (links: readonly string[] | null) => {
    const link = links?.at(-1);
    if (!link) return;
    const now = Date.now();
    if (link === last.link && now - last.at < 2000) return;
    last = { link, at: now };
    const path = deepLinkPath(link, publicUrl);
    if (path) navigate(path);
  };

  let unlisten = noop;
  try {
    unlisten = await plugin.onOpenUrl(open);
  } catch {
    // Not registered in this build; launch links are still worth reading.
  }
  try {
    open(await plugin.getCurrent());
  } catch {
    // Nothing launched us, or the plugin is unavailable.
  }
  return unlisten;
}
