/**
 * Where the multiplayer server lives.
 *
 * Configured with `VITE_SERVER_URL`, which the desktop and mobile builds must
 * set: they are served from `tauri://localhost`, so there is no useful origin
 * to infer from. In the browser it defaults to the page's own origin in
 * production (server and client behind one domain) and to the local dev server
 * port during development.
 */
const DEV_SERVER_PORT = 8787;

export function multiplayerSocketUrl(): string {
  const configured = import.meta.env.VITE_SERVER_URL;
  if (configured) return toWebSocketUrl(configured);

  if (typeof window === 'undefined') return `ws://localhost:${DEV_SERVER_PORT}/ws`;

  const { protocol, hostname, origin } = window.location;
  // A Tauri window has no HTTP origin to fall back on, so this is a
  // misconfiguration rather than something to paper over.
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error('VITE_SERVER_URL must be set for the desktop and mobile builds');
  }

  if (import.meta.env.DEV) return `ws://${hostname}:${DEV_SERVER_PORT}/ws`;
  return toWebSocketUrl(origin);
}

function toWebSocketUrl(base: string): string {
  const url = new URL(base);
  url.protocol =
    url.protocol === 'https:' ? 'wss:' : url.protocol === 'http:' ? 'ws:' : url.protocol;
  if (!url.pathname.endsWith('/ws')) {
    url.pathname = `${url.pathname.replace(/\/$/, '')}/ws`;
  }
  return url.toString();
}
