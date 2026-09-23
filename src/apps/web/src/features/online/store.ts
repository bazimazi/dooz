import type { GameConfig, GameState, Player } from '@dooz/engine';
import {
  type ClientMessage,
  type Clock,
  decodeServerMessage,
  type Emote,
  encode,
  type MatchKind,
  type MatchResult,
  PROTOCOL_VERSION,
  type PublicProfile,
  type Seat,
  type ServerMessage,
  type Snapshot,
} from '@dooz/protocol';
import { create } from 'zustand';
import { useAccountStore } from '@/features/account/store';
import { multiplayerSocketUrl } from '@/lib/server-url';

export type OnlinePhase =
  | 'offline'
  | 'connecting'
  | 'idle'
  | 'searching'
  | 'hosting'
  | 'playing'
  | 'watching'
  | 'opponentLeft';

/** An emote to show, with the moment it arrived so it can expire. */
export interface IncomingEmote {
  id: number;
  from: Player;
  emote: Emote;
  at: number;
}

interface OnlineState {
  phase: OnlinePhase;
  /** Set while the socket is down but a reconnect is scheduled. */
  reconnecting: boolean;
  error: string | null;

  profile: PublicProfile | null;

  roomCode: string | null;
  kind: MatchKind | null;
  config: GameConfig | null;
  ranked: boolean;
  queued: number;
  /** Which mark this device plays, or `null` while watching. */
  you: Player | null;
  seats: Seat[];
  spectators: number;
  game: GameState | null;
  clock: Clock | null;
  /** Set once the match is decided; the board alone cannot always say so. */
  result: MatchResult | null;

  rematchOffered: boolean;
  rematchRequested: boolean;
  drawOffered: boolean;
  drawRequested: boolean;
  muted: boolean;
  emotes: IncomingEmote[];

  connect: () => void;
  disconnect: () => void;
  queue: (config: GameConfig, ranked: boolean) => void;
  createRoom: (config: GameConfig) => void;
  joinRoom: (code: string) => void;
  spectate: (code: string) => void;
  play: (index: number) => void;
  resign: () => void;
  offerDraw: () => void;
  respondDraw: (accept: boolean) => void;
  rematch: () => void;
  sendEmote: (emote: Emote) => void;
  setMuted: (muted: boolean) => void;
  dismissEmote: (id: number) => void;
  leave: () => void;
  clearError: () => void;
}

/** Reconnect backoff, in milliseconds, then repeating at the last value. */
const BACKOFF_MS = [500, 1000, 2000, 4000, 8000];
const KEEPALIVE_MS = 25_000;

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
let attempt = 0;
let emoteId = 0;
/**
 * Set when reconnecting would be pointless or unwanted: the user asked to
 * disconnect, or the server told us this client cannot be talked to.
 */
let stopReconnecting = false;

/** Fields reset whenever a new game or a new room starts. */
const FRESH_MATCH = {
  result: null,
  rematchOffered: false,
  rematchRequested: false,
  drawOffered: false,
  drawRequested: false,
  emotes: [] as IncomingEmote[],
} as const;

/**
 * The client half of online play.
 *
 * A single module-level socket backs the store, which means the connection
 * survives navigation between the lobby and the game screen - the room would
 * otherwise be abandoned every time the route changed.
 *
 * Nothing here decides anything about the game. Every board, clock and result
 * is whatever the server last said, and a move is a cell index sent upward
 * rather than a change applied locally: the two ends run identical rules, but
 * only one of them is believed.
 */
export const useOnlineStore = create<OnlineState>((set, get) => {
  function send(message: ClientMessage) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(encode(message));
  }

  function handle(message: ServerMessage) {
    switch (message.type) {
      case 'welcome':
        set({
          profile: message.profile,
          // A resumed connection is not idle: the room it belongs to is on its
          // way in the next frame, and a screen that reads `idle` as "do what
          // you came here for" would queue for a new game and abandon it.
          phase: message.resumed ? 'connecting' : 'idle',
          reconnecting: false,
          error: null,
        });
        attempt = 0;
        return;

      case 'searching':
        set({
          phase: 'searching',
          config: message.config,
          ranked: message.ranked,
          queued: message.queued,
          error: null,
        });
        return;

      case 'roomCreated':
        set({
          phase: 'hosting',
          roomCode: message.code,
          config: message.config,
          ranked: false,
          error: null,
        });
        return;

      case 'matched':
        set({
          ...FRESH_MATCH,
          phase: message.you === null ? 'watching' : 'playing',
          roomCode: message.code,
          kind: message.kind,
          ranked: message.kind === 'ranked',
          you: message.you,
          seats: message.seats,
          spectators: message.spectators,
          config: message.snapshot.config,
          game: toGame(message.snapshot),
          clock: message.clock,
          error: null,
        });
        return;

      case 'state':
        set(() => ({
          game: toGame(message.snapshot),
          clock: message.clock,
          // A fresh board means a new game started under us, so anything
          // outstanding from the last one is gone with it.
          ...(message.snapshot.moves.length === 0
            ? FRESH_MATCH
            : { drawOffered: false, drawRequested: false }),
        }));
        return;

      case 'result':
        set({ result: message.result, drawOffered: false, drawRequested: false });
        return;

      case 'seats':
        set({ seats: message.seats });
        return;

      case 'spectators':
        set({ spectators: message.count });
        return;

      case 'rematchOffered':
        set({ rematchOffered: true });
        return;

      case 'drawOffered':
        set({ drawOffered: true });
        return;

      case 'drawDeclined':
        set({ drawRequested: false });
        return;

      case 'emote':
        set((state) => ({
          // Only ever a couple on screen: a stack of them would cover the board,
          // which is the one thing an emote must never do.
          emotes: [
            ...state.emotes.slice(-2),
            { id: ++emoteId, from: message.from, emote: message.emote, at: Date.now() },
          ],
        }));
        return;

      case 'opponentLeft':
        set({ phase: 'opponentLeft', rematchOffered: false, rematchRequested: false });
        return;

      case 'error':
        set({ error: message.message, rematchRequested: false, drawRequested: false });

        // These leave the client with nothing to wait for, so drop back to the
        // lobby rather than sitting on a dead "searching" screen.
        if (
          message.code === 'roomNotFound' ||
          message.code === 'roomFull' ||
          message.code === 'serverFull'
        ) {
          set({ phase: 'idle', roomCode: null });
        }

        // The server is about to close on us and every retry would be refused
        // the same way, so stop before the backoff turns into a loop that only
        // ends when the tab does.
        if (
          message.code === 'versionMismatch' ||
          message.code === 'unauthorized' ||
          message.code === 'alreadyPlaying'
        ) {
          stopReconnecting = true;
          set({ phase: 'offline', reconnecting: false });
        }
        return;

      case 'pong':
        return;
    }
  }

  function openSocket() {
    reconnectTimer = null;

    let url: string;
    try {
      url = multiplayerSocketUrl();
    } catch (error) {
      set({ phase: 'offline', error: error instanceof Error ? error.message : 'Bad server URL' });
      return;
    }

    set({ phase: get().profile ? get().phase : 'connecting' });

    const next = new WebSocket(url);
    socket = next;

    next.addEventListener('open', () => {
      // Guard every handler against being the previous socket's. A close or an
      // error can arrive after this one has been replaced - React's strict mode
      // mounts, unmounts and remounts in a row, which is exactly that shape -
      // and a stale handler would otherwise tear down the live connection.
      if (socket !== next) return;

      const credentials = useAccountStore.getState().credentials;
      if (!credentials) {
        // Nothing to introduce ourselves with. The account store creates one on
        // launch, so this is a transient state rather than a dead end.
        set({ phase: 'connecting' });
        next.close();
        return;
      }

      send({
        type: 'hello',
        version: PROTOCOL_VERSION,
        accountId: credentials.accountId,
        token: credentials.token,
      });
      keepaliveTimer = setInterval(() => send({ type: 'ping' }), KEEPALIVE_MS);
    });

    next.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (socket !== next) return;
      const message = decodeServerMessage(String(event.data));
      if (message) handle(message);
    });

    next.addEventListener('close', () => {
      if (socket !== next) return;

      if (keepaliveTimer) clearInterval(keepaliveTimer);
      keepaliveTimer = null;
      socket = null;
      if (stopReconnecting) {
        set({ reconnecting: false });
        return;
      }

      // Reconnecting restores the seat, so keep the room on screen meanwhile
      // rather than throwing the player back to the lobby.
      set({ reconnecting: true });
      const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 8000;
      attempt += 1;
      reconnectTimer = setTimeout(openSocket, delay);
    });

    next.addEventListener('error', () => {
      if (socket === next) next.close();
    });
  }

  /** Clear whatever the last room left behind before asking for a new one. */
  function resetRoom() {
    set({
      ...FRESH_MATCH,
      error: null,
      game: null,
      clock: null,
      roomCode: null,
      seats: [],
      spectators: 0,
      you: null,
      kind: null,
      muted: false,
    });
  }

  return {
    phase: 'offline',
    reconnecting: false,
    error: null,
    profile: null,
    roomCode: null,
    kind: null,
    config: null,
    ranked: false,
    queued: 0,
    you: null,
    seats: [],
    spectators: 0,
    game: null,
    clock: null,
    result: null,
    rematchOffered: false,
    rematchRequested: false,
    drawOffered: false,
    drawRequested: false,
    muted: false,
    emotes: [],

    connect: () => {
      if (socket || reconnectTimer) return;
      attempt = 0;
      stopReconnecting = false;
      openSocket();
    },

    disconnect: () => {
      stopReconnecting = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      if (keepaliveTimer) clearInterval(keepaliveTimer);
      keepaliveTimer = null;
      const closing = socket;
      socket = null;
      closing?.close();
      set({ phase: 'offline', reconnecting: false });
    },

    queue: (config, ranked) => {
      resetRoom();
      set({ config, ranked });
      send({ type: 'queue', config, ranked });
    },

    createRoom: (config) => {
      resetRoom();
      set({ config });
      send({ type: 'createRoom', config });
    },

    joinRoom: (code) => {
      resetRoom();
      send({ type: 'joinRoom', code: code.trim().toUpperCase() });
    },

    spectate: (code) => {
      resetRoom();
      send({ type: 'spectate', code: code.trim().toUpperCase() });
    },

    play: (index) => send({ type: 'move', index }),

    resign: () => send({ type: 'resign' }),

    offerDraw: () => {
      set({ drawRequested: true });
      send({ type: 'offerDraw' });
    },

    respondDraw: (accept) => {
      set({ drawOffered: false });
      send({ type: 'respondDraw', accept });
    },

    rematch: () => {
      set({ rematchRequested: true });
      send({ type: 'rematch' });
    },

    sendEmote: (emote) => send({ type: 'emote', emote }),

    setMuted: (muted) => {
      set({ muted });
      send({ type: 'mute', muted });
    },

    dismissEmote: (id) =>
      set((state) => ({ emotes: state.emotes.filter((entry) => entry.id !== id) })),

    leave: () => {
      send({ type: 'leave' });
      resetRoom();
      set({ phase: 'idle' });
    },

    clearError: () => set({ error: null }),
  };
});

/**
 * Widen a wire snapshot into the shape the board components expect.
 *
 * The move list now travels with the snapshot, so this is lossless - which is
 * what lets the game screen show a move history and step back through a
 * finished game without asking the server for anything.
 */
function toGame(snapshot: Snapshot): GameState {
  return {
    config: snapshot.config,
    board: snapshot.board,
    currentPlayer: snapshot.currentPlayer,
    status: snapshot.status,
    winner: snapshot.winner,
    winLine: snapshot.winLine,
    lastMove: snapshot.lastMove,
    moves: snapshot.moves,
    ultimate: snapshot.ultimate
      ? {
          boards: snapshot.ultimate.boards,
          drawn: snapshot.ultimate.drawn,
          activeBoard: snapshot.ultimate.activeBoard,
          winBoards: snapshot.ultimate.winBoards,
        }
      : null,
  };
}

/** The seat this device is sitting in, and the one opposite. */
export function seatsFor(
  seats: readonly Seat[],
  you: Player | null,
): { yours: Seat | null; theirs: Seat | null } {
  if (you === null) {
    return { yours: seats[0] ?? null, theirs: seats[1] ?? null };
  }
  return {
    yours: seats.find((seat) => seat.player === you) ?? null,
    theirs: seats.find((seat) => seat.player !== you) ?? null,
  };
}
