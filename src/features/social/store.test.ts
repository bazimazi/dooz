import { modeById } from '@/game/engine';
import { type ClientMessage, encode, type Notice, type ServerMessage } from '@/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountStore } from '@/features/account/store';
import { useOnlineStore } from '@/features/online/store';
import { socialApi } from '@/lib/social-api';
import { useSocialStore } from './store';

/** A socket that records what the store sends and lets a test answer. */
class FakeSocket {
  static instances: FakeSocket[] = [];
  static readonly OPEN = 1;
  readyState = 1;
  sent: ClientMessage[] = [];
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }
  addEventListener(type: string, handler: (event: unknown) => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(handler);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, handler: (event: unknown) => void) {
    this.listeners.get(type)?.delete(handler);
  }
  send(raw: string) {
    this.sent.push(JSON.parse(raw) as ClientMessage);
  }
  close() {
    this.readyState = 3;
    this.emit('close', {});
  }
  open() {
    this.emit('open', {});
  }
  deliver(message: ServerMessage) {
    this.emit('message', { data: encode(message) });
  }
  private emit(type: string, event: unknown) {
    for (const handler of this.listeners.get(type) ?? []) handler(event);
  }
}

function notice(id: string, kind: Notice['kind'] = 'friendRequest'): Notice {
  return { id, kind, title: 'Friend request', body: 'Ada wants to be friends.', at: 1 };
}

const ONLINE = useOnlineStore.getState();
const SOCIAL = useSocialStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeSocket);
  useOnlineStore.setState(ONLINE, true);
  useSocialStore.setState(SOCIAL, true);
  useAccountStore.setState({
    status: 'ready',
    credentials: { accountId: '00000000-0000-4000-8000-000000000001', token: 'x'.repeat(43) },
    profile: null,
    error: null,
  });
});

afterEach(() => {
  useOnlineStore.getState().disconnect();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('social store', () => {
  it('shows each notice once, however many channels it arrives on', () => {
    const { receive } = useSocialStore.getState();
    receive(notice('n-1'));
    receive(notice('n-1'));
    receive(notice('n-2', 'correspondenceTurn'));
    const state = useSocialStore.getState();
    expect(state.notices.map((entry) => entry.id)).toEqual(['n-1', 'n-2']);
    expect(state.incomingRequests).toBe(1);
    expect(state.correspondenceTurns).toBe(1);

    useSocialStore.getState().dismissNotice('n-1');
    expect(useSocialStore.getState().notices.map((entry) => entry.id)).toEqual(['n-2']);
  });

  it('keeps only the newest few on screen', () => {
    for (let i = 0; i < 10; i++) useSocialStore.getState().receive(notice(`many-${i}`));
    expect(useSocialStore.getState().notices).toHaveLength(4);
    expect(useSocialStore.getState().notices[0]?.id).toBe('many-6');
  });

  it('takes counts and notices from the pulse', async () => {
    vi.spyOn(socialApi, 'pulse').mockResolvedValue({
      notices: [notice('pulse-1', 'challenge')],
      incomingRequests: 3,
      correspondenceTurns: 2,
    });
    await useSocialStore.getState().pulse();
    const state = useSocialStore.getState();
    expect(state.incomingRequests).toBe(3);
    expect(state.correspondenceTurns).toBe(2);
    expect(state.notices.map((entry) => entry.id)).toEqual(['pulse-1']);
  });

  it('never polls without an account', async () => {
    const pulse = vi.spyOn(socialApi, 'pulse');
    useAccountStore.setState({ credentials: null });
    await useSocialStore.getState().pulse();
    expect(pulse).not.toHaveBeenCalled();
  });
});

describe('online store and friends', () => {
  function connect(): FakeSocket {
    useOnlineStore.getState().connect();
    const socket = FakeSocket.instances.at(-1)!;
    socket.open();
    socket.deliver({
      type: 'welcome',
      version: 5,
      profile: { accountId: 'me', displayName: 'Ada', avatar: 'fox', rating: null },
      resumed: false,
    });
    return socket;
  }

  it('sends a challenge and forwards notices to the social store', () => {
    const socket = connect();
    const friend = '00000000-0000-4000-8000-000000000002';
    useOnlineStore.getState().challenge(friend, modeById('classic').config);
    expect(socket.sent.at(-1)).toMatchObject({ type: 'challenge', accountId: friend });

    socket.deliver({ type: 'notice', notice: notice('ws-1', 'challengeDeclined') });
    expect(useSocialStore.getState().notices.map((entry) => entry.id)).toContain('ws-1');
  });

  it('stops reconnecting once told the account is suspended', () => {
    const socket = connect();
    socket.deliver({ type: 'error', code: 'banned', message: 'This account has been suspended.' });
    socket.close();
    vi.advanceTimersByTime(30_000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(useOnlineStore.getState().error).toBe('This account has been suspended.');
  });
});
