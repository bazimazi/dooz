import type { Notice } from '@/protocol';
import type { FriendsResponse } from '@/protocol/social';
import { create } from 'zustand';
import { useAccountStore } from '@/features/account/store';
import { translate } from '@/i18n';
import { apiErrorMessage } from '@/i18n/messages/onlineApiErrors';
import { socialMessages } from '@/i18n/messages/onlineSocial';
import { socialApi } from '@/lib/social-api';

/**
 * Friends, presence and notices on the client.
 *
 * Notices arrive two ways - over the game socket when one is open, and from
 * the pulse the app polls while it is visible - and the same notice can come
 * down both. Each id is shown once.
 *
 * The pulse only runs for a device that already has an account: polling must
 * never be the thing that creates one.
 */

/** How often the app checks in while it is on screen. */
export const PULSE_INTERVAL_MS = 20_000;
/** Notices waiting to be shown at once; older ones give way. */
const MAX_SHOWN = 4;
const MAX_REMEMBERED = 200;

interface SocialState {
  friends: FriendsResponse | null;
  loading: boolean;
  error: string | null;
  /** Notices on screen, oldest first. */
  notices: Notice[];
  incomingRequests: number;
  correspondenceTurns: number;

  loadFriends: () => Promise<void>;
  /** Run an action against the server, then refresh the list. Returns an error message or null. */
  act: (
    action: (credentials: NonNullable<ReturnType<typeof credentialsNow>>) => Promise<unknown>,
  ) => Promise<string | null>;
  receive: (notice: Notice) => void;
  dismissNotice: (id: string) => void;
  pulse: () => Promise<void>;
}

const remembered = new Set<string>();

function credentialsNow() {
  return useAccountStore.getState().credentials;
}

/** Messages are put in the interface language as they are set. */
function messageOf(error: unknown): string {
  return apiErrorMessage(error);
}

export const useSocialStore = create<SocialState>((set, get) => ({
  friends: null,
  loading: false,
  error: null,
  notices: [],
  incomingRequests: 0,
  correspondenceTurns: 0,

  loadFriends: async () => {
    // Friends need a server account; asking for the list is reason enough to make one.
    if (!(await useAccountStore.getState().ensureOnline())) {
      set({ error: useAccountStore.getState().syncError ?? apiErrorMessage(null) });
      return;
    }
    const credentials = credentialsNow();
    if (!credentials) return;
    set({ loading: true });
    try {
      const friends = await socialApi.friends(credentials);
      set({ friends, loading: false, error: null, incomingRequests: friends.incoming.length });
    } catch (error) {
      set({ loading: false, error: messageOf(error) });
    }
  },

  act: async (action) => {
    const credentials = credentialsNow();
    if (!credentials) return translate(socialMessages, 'connectFirst');
    try {
      await action(credentials);
    } catch (error) {
      return messageOf(error);
    }
    await get().loadFriends();
    return null;
  },

  receive: (notice) => {
    if (remembered.has(notice.id)) return;
    remembered.add(notice.id);
    if (remembered.size > MAX_REMEMBERED) {
      const oldest = remembered.values().next().value;
      if (oldest !== undefined) remembered.delete(oldest);
    }
    set((state) => ({
      notices: [...state.notices, notice].slice(-MAX_SHOWN),
      incomingRequests: state.incomingRequests + (notice.kind === 'friendRequest' ? 1 : 0),
      correspondenceTurns:
        state.correspondenceTurns + (notice.kind === 'correspondenceTurn' ? 1 : 0),
    }));
    // A friend list on screen should show the change the notice is about.
    if (get().friends && (notice.kind === 'friendRequest' || notice.kind === 'friendAccepted')) {
      void get().loadFriends();
    }
  },

  dismissNotice: (id) => set((state) => ({ notices: state.notices.filter((n) => n.id !== id) })),

  pulse: async () => {
    const credentials = credentialsNow();
    if (!credentials || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    try {
      const result = await socialApi.pulse(credentials);
      set({
        incomingRequests: result.incomingRequests,
        correspondenceTurns: result.correspondenceTurns,
      });
      for (const notice of result.notices) get().receive(notice);
    } catch {
      // A missed check-in is retried on the next tick; nothing to show.
    }
  },
}));
