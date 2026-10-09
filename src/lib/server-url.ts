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

/** The origin the HTTP API is served from, with no trailing slash. */
export function httpBaseUrl(): string {
  const configured = import.meta.env.VITE_SERVER_URL;
  if (configured) return stripTrailingSlash(configured);

  if (typeof window === 'undefined') return `http://localhost:${DEV_SERVER_PORT}`;

  const { protocol, hostname, origin } = window.location;
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error('VITE_SERVER_URL must be set for the desktop and mobile builds');
  }

  if (import.meta.env.DEV) return `http://${hostname}:${DEV_SERVER_PORT}`;
  return stripTrailingSlash(origin);
}

export function multiplayerSocketUrl(): string {
  const url = new URL(httpBaseUrl());
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/ws`;
  return url.toString();
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}
