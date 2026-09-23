import type { AccountProfile, Avatar } from '@dooz/protocol';
import { create } from 'zustand';
import { api, ApiError, type Credentials } from '@/lib/api';

const STORAGE_KEY = 'dooz.account';

/**
 * Who this device is.
 *
 * The credentials live in `localStorage`, not `sessionStorage`: unlike the old
 * per-tab resume token this is a durable identity that owns a rating and a
 * match history, and it has to survive a relaunch or none of that is worth
 * keeping. A second tab sharing them is fine - the server hands the account to
 * the newest connection and tells the older one so.
 *
 * An account is created silently the first time the app runs. Nothing is asked
 * of the player up front: they get a name they can change, and can attach a
 * password later if they want the account on another device.
 */
function loadCredentials(): Credentials | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const { accountId, token } = parsed as Partial<Credentials>;
    if (typeof accountId !== 'string' || typeof token !== 'string') return null;
    return { accountId, token };
  } catch {
    return null;
  }
}

function saveCredentials(credentials: Credentials | null): void {
  try {
    if (credentials) localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Without storage the account lasts as long as the tab does, which still
    // plays - it just starts again next launch.
  }
}

export type AccountStatus = 'idle' | 'loading' | 'ready' | 'error';

interface AccountState {
  status: AccountStatus;
  credentials: Credentials | null;
  profile: AccountProfile | null;
  error: string | null;

  /** Load the stored account, or create one. Safe to call repeatedly. */
  initialise: () => Promise<void>;
  refresh: () => Promise<void>;
  rename: (displayName: string) => Promise<boolean>;
  setAvatar: (avatar: Avatar) => Promise<void>;
  claim: (password: string) => Promise<boolean>;
  signIn: (displayName: string, password: string) => Promise<boolean>;
  signOut: () => void;
  clearError: () => void;
}

/** In flight, so two screens mounting at once do not create two accounts. */
let pending: Promise<void> | null = null;

export const useAccountStore = create<AccountState>((set, get) => ({
  status: 'idle',
  credentials: loadCredentials(),
  profile: null,
  error: null,

  initialise: async () => {
    if (get().status === 'ready' || get().status === 'loading') return;
    if (pending) return pending;

    pending = (async () => {
      set({ status: 'loading', error: null });
      const existing = get().credentials;

      if (existing) {
        try {
          const { profile } = await api.profile(existing);
          set({ status: 'ready', profile });
          return;
        } catch (error) {
          // A token the server no longer honours - a sign-in elsewhere, or a
          // reset database - is worth replacing rather than reporting. A
          // network failure is not: it would throw away a good account.
          if (!(error instanceof ApiError) || error.status !== 401) {
            set({ status: 'error', error: messageFor(error) });
            return;
          }
          saveCredentials(null);
          set({ credentials: null });
        }
      }

      try {
        const created = await api.createAccount();
        const credentials = { accountId: created.accountId, token: created.token };
        saveCredentials(credentials);
        set({ status: 'ready', credentials, profile: created.profile });
      } catch (error) {
        set({ status: 'error', error: messageFor(error) });
      }
    })().finally(() => {
      pending = null;
    });

    return pending;
  },

  refresh: async () => {
    const credentials = get().credentials;
    if (!credentials) return;
    try {
      const { profile } = await api.profile(credentials);
      set({ profile });
    } catch (error) {
      set({ error: messageFor(error) });
    }
  },

  rename: async (displayName) => {
    const credentials = get().credentials;
    if (!credentials) return false;
    try {
      const { profile } = await api.updateProfile(credentials, { displayName });
      set({ profile, error: null });
      return true;
    } catch (error) {
      set({ error: messageFor(error) });
      return false;
    }
  },

  setAvatar: async (avatar) => {
    const credentials = get().credentials;
    if (!credentials) return;
    try {
      const { profile } = await api.updateProfile(credentials, { avatar });
      set({ profile, error: null });
    } catch (error) {
      set({ error: messageFor(error) });
    }
  },

  claim: async (password) => {
    const credentials = get().credentials;
    if (!credentials) return false;
    try {
      const { profile } = await api.claim(credentials, password);
      set({ profile, error: null });
      return true;
    } catch (error) {
      set({ error: messageFor(error) });
      return false;
    }
  },

  signIn: async (displayName, password) => {
    try {
      const result = await api.login(displayName, password);
      const credentials = { accountId: result.accountId, token: result.token };
      saveCredentials(credentials);
      set({ status: 'ready', credentials, profile: result.profile, error: null });
      return true;
    } catch (error) {
      set({ error: messageFor(error) });
      return false;
    }
  },

  signOut: () => {
    saveCredentials(null);
    set({ status: 'idle', credentials: null, profile: null, error: null });
  },

  clearError: () => set({ error: null }),
}));

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong';
}
