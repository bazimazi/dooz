import {
  accountProfileSchema,
  displayNameSchema,
  type AccountProfile,
  type Avatar,
  updateProfileRequestSchema,
} from '@dooz/protocol';
import { create } from 'zustand';
import { api, ApiError, type Credentials } from '@/lib/api';

const STORAGE_KEY = 'dooz.account';
const PROFILE_KEY = 'dooz.local-profile';
type Changes = { displayName?: string; avatar?: Avatar };

function loadCredentials(): Credentials | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return parsed && typeof parsed.accountId === 'string' && typeof parsed.token === 'string'
      ? { accountId: parsed.accountId, token: parsed.token }
      : null;
  } catch {
    return null;
  }
}
function saveCredentials(credentials: Credentials | null): void {
  try {
    if (credentials) localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* The in-memory identity still works without storage. */
  }
}
function newProfile(): AccountProfile {
  return {
    accountId:
      globalThis.crypto?.randomUUID?.() ??
      `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    displayName: 'Player',
    avatar: 'fox',
    rating: null,
    createdAt: Date.now(),
    claimed: false,
    stats: [],
    achievements: [],
  };
}
function loadLocal(): { profile: AccountProfile; changes: Changes } {
  try {
    const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null');
    const profile = accountProfileSchema.safeParse(stored?.profile);
    const changes = updateProfileRequestSchema.safeParse(stored?.changes ?? {});
    const credentials = loadCredentials();
    if (profile.success && (!credentials || profile.data.accountId === credentials.accountId)) {
      return { profile: profile.data, changes: changes.success ? changes.data : {} };
    }
  } catch {
    /* An old or corrupt cache must not block local play. */
  }
  return { profile: newProfile(), changes: {} };
}
const initial = loadLocal();
function saveLocal(profile: AccountProfile, changes: Changes): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ profile, changes }));
  } catch {
    /* Storage may be unavailable or full. */
  }
}
saveLocal(initial.profile, initial.changes);

export type AccountStatus = 'idle' | 'loading' | 'ready' | 'error';
interface AccountState {
  status: AccountStatus;
  onlineStatus: AccountStatus;
  credentials: Credentials | null;
  profile: AccountProfile | null;
  changes: Changes;
  revision: number;
  error: string | null;
  syncError: string | null;
  /** Local identity is always available; no server request is needed. */
  initialise: () => Promise<void>;
  /** Called only for features that require a server account. */
  ensureOnline: () => Promise<boolean>;
  refresh: () => Promise<void>;
  rename: (displayName: string) => Promise<boolean>;
  setAvatar: (avatar: Avatar) => Promise<void>;
  claim: (password: string) => Promise<boolean>;
  signIn: (displayName: string, password: string) => Promise<boolean>;
  signOut: () => void;
  clearError: () => void;
}
let pending: Promise<boolean> | null = null;
let generation = 0;

export const useAccountStore = create<AccountState>((set, get) => {
  function acceptRemote(profile: AccountProfile, revision: number) {
    const changes = get().revision === revision ? {} : get().changes;
    const merged = { ...profile, ...changes };
    saveLocal(merged, changes);
    set({ profile: merged, changes, status: 'ready' });
  }
  function edit(changes: Changes) {
    const profile = { ...(get().profile ?? newProfile()), ...changes };
    const queued = { ...get().changes, ...changes };
    saveLocal(profile, queued);
    set({ profile, changes: queued, revision: get().revision + 1, error: null });
    // Local changes succeed immediately. Synchronization is optional and retryable.
    if (get().credentials && navigator.onLine) void get().refresh();
  }
  return {
    status: 'ready',
    onlineStatus: 'idle',
    credentials: loadCredentials(),
    profile: initial.profile,
    changes: initial.changes,
    revision: 0,
    error: null,
    syncError: null,
    initialise: async () => {
      if (!get().profile) {
        const profile = newProfile();
        saveLocal(profile, {});
        set({ profile, changes: {}, status: 'ready' });
      }
    },
    ensureOnline: async () => {
      if (pending) return pending;
      const ownGeneration = generation;
      const active = () => ownGeneration === generation;
      const operation = (async () => {
        const alreadyReady = get().onlineStatus === 'ready';
        set({ onlineStatus: alreadyReady ? 'ready' : 'loading', syncError: null });
        try {
          let credentials = get().credentials;
          let revision = get().revision;
          let profile: AccountProfile;
          if (!credentials) {
            const local = get().profile!;
            const created = await api.createAccount(local.displayName, local.avatar);
            if (!active()) return false;
            credentials = { accountId: created.accountId, token: created.token };
            saveCredentials(credentials);
            set({ credentials });
            profile = created.profile;
            acceptRemote(profile, revision);
          } else {
            profile = (await api.profile(credentials, undefined, true)).profile;
            if (!active()) return false;
            // A read never acknowledges queued changes.
            acceptRemote(profile, -1);
          }
          while (Object.keys(get().changes).length > 0) {
            revision = get().revision;
            profile = (await api.updateProfile(credentials, get().changes)).profile;
            if (!active()) return false;
            acceptRemote(profile, revision);
          }
          set({ onlineStatus: 'ready', syncError: null });
          return true;
        } catch (error) {
          if (active())
            set({ onlineStatus: alreadyReady ? 'ready' : 'error', syncError: messageFor(error) });
          return false;
        }
      })();
      pending = operation;
      void operation.finally(() => {
        if (pending === operation) pending = null;
      });
      return operation;
    },
    refresh: async () => {
      if (!get().credentials) return;
      await get().ensureOnline();
    },
    rename: async (name) => {
      const parsed = displayNameSchema.safeParse(name);
      if (!parsed.success) {
        set({ error: parsed.error.issues[0]?.message ?? 'Invalid name' });
        return false;
      }
      edit({ displayName: parsed.data });
      return true;
    },
    setAvatar: async (avatar) => {
      const parsed = updateProfileRequestSchema.safeParse({ avatar });
      if (parsed.success) edit(parsed.data);
    },
    claim: async (password) => {
      if (!(await get().ensureOnline())) {
        set({ error: get().syncError });
        return false;
      }
      const ownGeneration = generation;
      try {
        const revision = get().revision;
        const { profile } = await api.claim(get().credentials!, password);
        if (ownGeneration !== generation) return false;
        acceptRemote(profile, revision);
        set({ error: null });
        return true;
      } catch (error) {
        if (ownGeneration === generation) set({ error: messageFor(error) });
        return false;
      }
    },
    signIn: async (displayName, password) => {
      const ownGeneration = ++generation;
      pending = null;
      try {
        const result = await api.login(displayName, password);
        if (ownGeneration !== generation) return false;
        const credentials = { accountId: result.accountId, token: result.token };
        saveCredentials(credentials);
        saveLocal(result.profile, {});
        set({
          status: 'ready',
          onlineStatus: 'ready',
          credentials,
          profile: result.profile,
          changes: {},
          error: null,
          syncError: null,
        });
        return true;
      } catch (error) {
        if (ownGeneration === generation) set({ error: messageFor(error), onlineStatus: 'error' });
        return false;
      }
    },
    signOut: () => {
      ++generation;
      pending = null;
      const profile = newProfile();
      saveCredentials(null);
      saveLocal(profile, {});
      set({
        status: 'ready',
        onlineStatus: 'idle',
        credentials: null,
        profile,
        changes: {},
        revision: 0,
        error: null,
        syncError: null,
      });
    },
    clearError: () => set({ error: null }),
  };
});
function messageFor(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Could not reach the server';
}
