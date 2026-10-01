import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

const credentials = { accountId: 'account-one', token: 'token' };
const payload = {
  profile: {
    accountId: credentials.accountId,
    displayName: 'Player',
    avatar: 'cat',
    rating: null,
    createdAt: 1000,
    claimed: false,
    stats: [],
    achievements: [],
  },
  ranks: [],
};
beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('offline API snapshots', () => {
  it('returns a validated cached profile when the network is unavailable', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }));
    await api.profile(credentials);
    fetch.mockRejectedValue(new Error('Offline'));
    expect(await api.profile(credentials)).toEqual(payload);
    expect(api.cachedProfile(credentials)).toEqual(payload);
  });
  it('requires a live response for an online-account handshake', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }));
    await api.profile(credentials);
    fetch.mockRejectedValue(new Error('Offline'));
    await expect(api.profile(credentials, undefined, true)).rejects.toMatchObject({ status: 0 });
  });
  it('does not share cached private data with another account or mask authentication errors', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }));
    await api.profile(credentials);
    fetch.mockRejectedValueOnce(new Error('Offline'));
    await expect(api.profile({ accountId: 'account-two', token: 'other' })).rejects.toMatchObject({
      status: 0,
    });
    fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Sign in again' }), { status: 401 }),
    );
    await expect(api.profile(credentials)).rejects.toMatchObject({ status: 401 });
  });
  it('does not revive an aborted request from cache', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }));
    await api.profile(credentials);
    const controller = new AbortController();
    controller.abort();
    fetch.mockRejectedValue(new Error('Aborted'));
    await expect(api.profile(credentials, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
