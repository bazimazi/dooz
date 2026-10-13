import {
  accountProfileSchema,
  displayNameSchema,
  type AccountProfile,
  type Avatar,
  updateProfileRequestSchema,
} from '@/protocol';
import { create } from 'zustand';
import { currentLocale, translate } from '@/i18n';
import { accountMessages } from '@/i18n/messages/onlineAccount';
import { apiErrorMessage } from '@/i18n/messages/onlineApiErrors';
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
  /** Why setting a password failed; shown by the password field. */
  claimError: string | null;
  /** Why signing in to another account failed. */
  signInError: string | null;
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
  /**
   * Switch to an account whose credentials were obtained some other way - a
   * recovery code. The profile is fetched with them first, so credentials the
   * server will not accept never replace working ones.
   */
  adopt: (credentials: Credentials) => Promise<boolean>;
  signOut: () => void;
  /**
   * The server no longer accepts the stored token - the account was signed in
   * elsewhere, or the server's data was reset. A guest account is replaced by a
   * new one; a claimed account asks for its password again.
   */
  dropCredentials: () => Promise<boolean>;
  clearError: () => void;
}
let pending: Promise<boolean> | null = null;
/** When credentials were last dropped, so a server that keeps refusing cannot loop. */
let droppedAt = 0;
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
    claimError: null,
    signInError: null,
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
            const sent = get().changes;
            try {
              profile = (await api.updateProfile(credentials, sent)).profile;
            } catch (error) {
              if (!isRejection(error)) throw error;
              if (!active()) return false;
              // The server refused the edit itself - a name already taken. It
              // will refuse it every time, so drop it rather than let it block
              // every later sync, keep any edit made since, and say why.
              const changes = Object.fromEntries(
                Object.entries(get().changes).filter(
                  ([key, value]) => sent[key as keyof Changes] !== value,
                ),
              ) as Changes;
              const merged = { ...profile, ...changes };
              saveLocal(merged, changes);
              set({ profile: merged, changes, error: messageFor(error) });
              continue;
            }
            if (!active()) return false;
            acceptRemote(profile, revision);
          }
          set({ onlineStatus: 'ready', syncError: null });
          return true;
        } catch (error) {
          if (!active()) return false;
          if (error instanceof ApiError && error.status === 401) {
            pending = null;
            return get().dropCredentials();
          }
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
        set({ error: nameIssueText(parsed.error.issues[0]) });
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
        set({ claimError: get().syncError });
        return false;
      }
      const ownGeneration = generation;
      try {
        const revision = get().revision;
        const { profile } = await api.claim(get().credentials!, password);
        if (ownGeneration !== generation) return false;
        acceptRemote(profile, revision);
        set({ claimError: null });
        return true;
      } catch (error) {
        if (ownGeneration === generation) set({ claimError: messageFor(error) });
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
          revision: 0,
          error: null,
          claimError: null,
          signInError: null,
          syncError: null,
        });
        return true;
      } catch (error) {
        // The current account is untouched; the next sync simply runs again.
        if (ownGeneration === generation)
          set({ signInError: messageFor(error), onlineStatus: 'idle' });
        return false;
      }
    },
    adopt: async (credentials) => {
      const ownGeneration = ++generation;
      pending = null;
      try {
        const { profile } = await api.profile(credentials, undefined, true);
        if (ownGeneration !== generation) return false;
        saveCredentials(credentials);
        saveLocal(profile, {});
        set({
          status: 'ready',
          onlineStatus: 'ready',
          credentials,
          profile,
          changes: {},
          revision: 0,
          error: null,
          claimError: null,
          signInError: null,
          syncError: null,
        });
        return true;
      } catch (error) {
        if (ownGeneration === generation) {
          set({ signInError: messageFor(error), onlineStatus: 'idle' });
        }
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
        claimError: null,
        signInError: null,
        syncError: null,
      });
    },
    dropCredentials: async () => {
      if (Date.now() - droppedAt < 10_000) {
        set({ onlineStatus: 'error', syncError: translate(accountMessages, 'serverRejected') });
        return false;
      }
      droppedAt = Date.now();
      ++generation;
      pending = null;
      saveCredentials(null);
      const claimed = get().profile?.claimed ?? false;
      if (claimed) {
        // Only the password gets this account back; a new one would hide it.
        const profile = newProfile();
        saveLocal(profile, {});
        set({
          credentials: null,
          profile,
          changes: {},
          revision: 0,
          onlineStatus: 'error',
          syncError: translate(accountMessages, 'signedOut'),
        });
        return false;
      }
      set({ credentials: null, onlineStatus: 'idle' });
      return get().ensureOnline();
    },
    clearError: () => set({ error: null, claimError: null, signInError: null }),
  };
});

/** A 4xx other than an expired token: retrying the same request cannot help. */
function isRejection(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 401 &&
    error.status !== 429
  );
}
/** Said in the interface language when it is set; English is the server's own words. */
function messageFor(error: unknown): string {
  return apiErrorMessage(error);
}

/**
 * Why a display name was refused. In English, the schema's own words; in any
 * other language, the same reason from the catalog.
 */
function nameIssueText(issue: { code: string; message: string } | undefined): string {
  if (!issue) return translate(accountMessages, 'invalidName');
  if (currentLocale() === 'en') return issue.message;
  if (issue.code === 'too_small') return translate(accountMessages, 'nameTooShort');
  if (issue.code === 'too_big') return translate(accountMessages, 'nameTooLong');
  if (issue.message === accountMessages.en.nameCharacters) {
    return translate(accountMessages, 'nameCharacters');
  }
  if (issue.message === accountMessages.en.nameDoubleSpaces) {
    return translate(accountMessages, 'nameDoubleSpaces');
  }
  return issue.message;
}
