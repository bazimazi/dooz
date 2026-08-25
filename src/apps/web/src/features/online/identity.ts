const STORAGE_KEY = 'dooz.identity';

export interface Identity {
  clientId: string | null;
  name: string;
}

/**
 * The client id and display name, kept between visits.
 *
 * The id is what lets the server hand a returning player their seat back after
 * a reload or a dropped connection, so it has to outlive the page.
 * Storage can be unavailable (private windows, a webview with site data off),
 * in which case online play still works — reconnection just starts fresh.
 */
export function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const { clientId, name } = parsed as Partial<Identity>;
    return {
      clientId: typeof clientId === 'string' ? clientId : null,
      name: typeof name === 'string' && name.trim() ? name : 'Player',
    };
  } catch {
    return null;
  }
}

export function saveIdentity(identity: Identity): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // Nothing to do: the session simply will not survive a reload.
  }
}
