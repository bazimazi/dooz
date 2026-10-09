import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountProfile } from '@/protocol';

const profile = (name = 'Remote'): AccountProfile => ({
  accountId: 'server-account',
  displayName: name,
  avatar: 'owl',
  rating: null,
  createdAt: 1000,
  claimed: false,
  stats: [],
  achievements: [],
});
async function store() {
  return (await import('./store')).useAccountStore;
}
beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('local account', () => {
  it('opens and edits a profile offline without creating a server account', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const account = await store();
    await account.getState().initialise();
    expect(account.getState().profile?.avatar).toBe('fox');
    expect(await account.getState().rename('Offline Player')).toBe(true);
    await account.getState().setAvatar('cat');
    expect(fetch).not.toHaveBeenCalled();
    vi.resetModules();
    const reloaded = await store();
    expect(reloaded.getState().profile).toMatchObject({
      displayName: 'Offline Player',
      avatar: 'cat',
    });
    expect(reloaded.getState().credentials).toBeNull();
  });
  it('keeps credentials and edits after a network failure, then syncs them', async () => {
    localStorage.setItem(
      'dooz.account',
      JSON.stringify({ accountId: 'server-account', token: 'token' }),
    );
    localStorage.setItem('dooz.local-profile', JSON.stringify({ profile: profile(), changes: {} }));
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const account = await store();
    await account.getState().setAvatar('cat');
    await account.getState().ensureOnline();
    expect(account.getState().profile?.avatar).toBe('cat');
    expect(account.getState().credentials?.token).toBe('token');
    expect(account.getState().status).toBe('ready');
    expect(account.getState().changes).toEqual({ avatar: 'cat' });
    fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ profile: profile(), ranks: [] }), { status: 200 }),
    );
    fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ profile: { ...profile(), avatar: 'cat' } }), { status: 200 }),
    );
    expect(await account.getState().ensureOnline()).toBe(true);
    expect(account.getState().changes).toEqual({});
    expect(account.getState().profile?.avatar).toBe('cat');
  });
  it('accepts the server-assigned unique name when a local profile first goes online', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          accountId: 'server-account',
          token: 'token',
          profile: profile('Player 2'),
        }),
        { status: 200 },
      ),
    );
    const account = await store();
    await account.getState().rename('Player');
    expect(await account.getState().ensureOnline()).toBe(true);
    expect(account.getState().profile?.displayName).toBe('Player 2');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('never revives a signed-out account when an old request completes', async () => {
    let resolve!: (value: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    const account = await store();
    const request = account.getState().ensureOnline();
    account.getState().signOut();
    resolve(
      new Response(
        JSON.stringify({ accountId: 'server-account', token: 'token', profile: profile() }),
        { status: 200 },
      ),
    );
    expect(await request).toBe(false);
    expect(account.getState().credentials).toBeNull();
    expect(account.getState().profile?.displayName).toBe('Player');
  });

  it('syncs edits made while the initial server request is still in flight', async () => {
    let resolve!: (response: Response) => void;
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ profile: { ...profile('New Player'), avatar: 'cat' } }), {
          status: 200,
        }),
      );
    const account = await store();
    await account.getState().rename('New Player');
    const request = account.getState().ensureOnline();
    await account.getState().setAvatar('cat');
    resolve(
      new Response(
        JSON.stringify({
          accountId: 'server-account',
          token: 'token',
          profile: profile('New Player'),
        }),
        { status: 200 },
      ),
    );
    expect(await request).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(account.getState().profile?.avatar).toBe('cat');
    expect(account.getState().changes).toEqual({});
  });
});
