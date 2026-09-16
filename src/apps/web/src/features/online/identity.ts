const NAME_KEY = 'dooz.name';
const CREDENTIALS_KEY = 'dooz.credentials';

/** What the server issued this tab, and what it will take back to reclaim a seat. */
export interface Credentials {
  clientId: string;
  resumeToken: string;
}

/**
 * The credentials live in `sessionStorage`, not `localStorage`, and that is the
 * whole point.
 *
 * `sessionStorage` is per-tab. A reload keeps it, so the seat survives one - and
 * a second tab gets its own blank slate rather than the first tab's credentials,
 * so opening one cannot take over a game already running in the other. Sharing
 * them across tabs is what made two windows of the same browser fight over a
 * single seat.
 *
 * Nothing is lost by scoping them this way: the credentials are only useful
 * inside the 45-second reconnect grace period, which no app relaunch fits in.
 *
 * Storage can be unavailable (private windows, a webview with site data off), in
 * which case online play still works - a reload just starts a fresh identity.
 */
export function loadCredentials(): Credentials | null {
  try {
    const raw = sessionStorage.getItem(CREDENTIALS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const { clientId, resumeToken } = parsed as Partial<Credentials>;
    if (typeof clientId !== 'string' || typeof resumeToken !== 'string') return null;
    return { clientId, resumeToken };
  } catch {
    return null;
  }
}

export function saveCredentials(credentials: Credentials): void {
  try {
    sessionStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
  } catch {
    // Nothing to do: the seat simply will not survive a reload.
  }
}

/**
 * The display name, kept in `localStorage`.
 *
 * Unlike the credentials this is a preference rather than a secret, so it is
 * meant to be shared between tabs and to outlive the session.
 */
export function loadName(): string | null {
  try {
    const name = localStorage.getItem(NAME_KEY);
    return name && name.trim() ? name : null;
  } catch {
    return null;
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Preferences are a convenience; losing them is not worth reporting.
  }
}
