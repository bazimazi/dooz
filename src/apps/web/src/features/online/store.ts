import type { BoardSize, GameState, Player } from '@dooz/engine';
import {
  type ClientMessage,
  decodeServerMessage,
  encode,
  type Opponent,
  PROTOCOL_VERSION,
  type ServerMessage,
  type Snapshot,
} from '@dooz/protocol';
import { create } from 'zustand';
import { multiplayerSocketUrl } from '@/lib/server-url';
import { loadIdentity, saveIdentity } from './identity';

export type OnlinePhase =
  'offline' | 'connecting' | 'idle' | 'searching' | 'hosting' | 'playing' | 'opponentLeft';

interface OnlineState {
  phase: OnlinePhase;
  /** Set while the socket is down but a reconnect is scheduled. */
  reconnecting: boolean;
  error: string | null;

  clientId: string | null;
  name: string;

  roomCode: string | null;
  boardSize: BoardSize | null;
  /** Which mark this device plays. */
  you: Player | null;
  opponent: Opponent | null;
  game: GameState | null;
  /** The opponent has asked for a rematch and is waiting on us. */
  rematchOffered: boolean;
  /** We have asked and are waiting on them. */
  rematchRequested: boolean;

  connect: () => void;
  disconnect: () => void;
  setName: (name: string) => void;
  quickMatch: (boardSize: BoardSize) => void;
  createRoom: (boardSize: BoardSize) => void;
  joinRoom: (code: string) => void;
  play: (index: number) => void;
  rematch: () => void;
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
/** Set when the user asked to disconnect, so the socket is not re-opened. */
let intentionallyClosed = false;

/**
 * The client half of online play.
 *
 * A single module-level socket backs the store, which means the connection
 * survives navigation between the lobby and the game screen - the room would
 * otherwise be abandoned every time the route changed.
 */
export const useOnlineStore = create<OnlineState>((set, get) => {
  function send(message: ClientMessage) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(encode(message));
  }

  function handle(message: ServerMessage) {
    switch (message.type) {
      case 'welcome': {
        saveIdentity({ clientId: message.clientId, name: get().name });
        set({ clientId: message.clientId, phase: 'idle', reconnecting: false, error: null });
        attempt = 0;
        return;
      }
      case 'searching':
        set({ phase: 'searching', boardSize: message.boardSize, error: null });
        return;
      case 'roomCreated':
        set({
          phase: 'hosting',
          roomCode: message.code,
          boardSize: message.boardSize,
          error: null,
        });
        return;
      case 'matched':
        set({
          phase: 'playing',
          roomCode: message.code,
          you: message.you,
          opponent: message.opponent,
          boardSize: message.snapshot.size,
          game: toGame(message.snapshot),
          rematchOffered: false,
          rematchRequested: false,
          error: null,
        });
        return;
      case 'state':
        set((state) => ({
          game: toGame(message.snapshot),
          // A fresh board means the rematch went through.
          rematchOffered: message.snapshot.status === 'playing' ? false : state.rematchOffered,
          rematchRequested: message.snapshot.status === 'playing' ? false : state.rematchRequested,
        }));
        return;
      case 'rematchOffered':
        set({ rematchOffered: true });
        return;
      case 'opponentPresence':
        set({ opponent: message.opponent });
        return;
      case 'opponentLeft':
        set({ phase: 'opponentLeft', rematchOffered: false, rematchRequested: false });
        return;
      case 'error':
        set({ error: message.message });
        // These leave the client with nothing to wait for, so drop back to the
        // lobby rather than sitting on a dead "searching" screen.
        if (message.code === 'roomNotFound' || message.code === 'roomFull') {
          set({ phase: 'idle', roomCode: null });
        }
        return;
      case 'pong':
        return;
    }
  }

  function openSocket() {
    intentionallyClosed = false;

    let url: string;
    try {
      url = multiplayerSocketUrl();
    } catch (error) {
      set({ phase: 'offline', error: error instanceof Error ? error.message : 'Bad server URL' });
      return;
    }

    set({ phase: get().clientId ? get().phase : 'connecting' });

    const next = new WebSocket(url);
    socket = next;

    next.addEventListener('open', () => {
      const { name, clientId } = get();
      send({
        type: 'hello',
        version: PROTOCOL_VERSION,
        name,
        ...(clientId ? { clientId } : {}),
      });
      keepaliveTimer = setInterval(() => send({ type: 'ping' }), KEEPALIVE_MS);
    });

    next.addEventListener('message', (event: MessageEvent<unknown>) => {
      const message = decodeServerMessage(String(event.data));
      if (message) handle(message);
    });

    next.addEventListener('close', () => {
      if (keepaliveTimer) clearInterval(keepaliveTimer);
      keepaliveTimer = null;
      socket = null;
      if (intentionallyClosed) {
        set({ phase: 'offline', reconnecting: false });
        return;
      }

      // Reconnecting restores the seat, so keep the room on screen meanwhile
      // rather than throwing the player back to the lobby.
      set({ reconnecting: true });
      const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 8000;
      attempt += 1;
      reconnectTimer = setTimeout(openSocket, delay);
    });

    next.addEventListener('error', () => next.close());
  }

  const stored = loadIdentity();

  return {
    phase: 'offline',
    reconnecting: false,
    error: null,
    clientId: stored?.clientId ?? null,
    name: stored?.name ?? 'Player',
    roomCode: null,
    boardSize: null,
    you: null,
    opponent: null,
    game: null,
    rematchOffered: false,
    rematchRequested: false,

    connect: () => {
      if (socket || reconnectTimer) return;
      attempt = 0;
      openSocket();
    },

    disconnect: () => {
      intentionallyClosed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      socket?.close();
      socket = null;
      set({ phase: 'offline', reconnecting: false });
    },

    setName: (name) => {
      const trimmed = name.trim().slice(0, 24) || 'Player';
      set({ name: trimmed });
      saveIdentity({ clientId: get().clientId, name: trimmed });
      // Tell the server too, so a rename mid-session reaches the opponent
      // rather than waiting for the next connection.
      send({ type: 'setName', name: trimmed });
    },

    quickMatch: (boardSize) => {
      set({ error: null, game: null, roomCode: null, opponent: null, you: null });
      send({ type: 'quickMatch', boardSize });
    },

    createRoom: (boardSize) => {
      set({ error: null, game: null, roomCode: null, opponent: null, you: null });
      send({ type: 'createRoom', boardSize });
    },

    joinRoom: (code) => {
      set({ error: null, game: null, opponent: null, you: null });
      send({ type: 'joinRoom', code: code.trim().toUpperCase() });
    },

    play: (index) => send({ type: 'move', index }),

    rematch: () => {
      set({ rematchRequested: true });
      send({ type: 'rematch' });
    },

    leave: () => {
      send({ type: 'leave' });
      set({
        phase: 'idle',
        roomCode: null,
        game: null,
        you: null,
        opponent: null,
        rematchOffered: false,
        rematchRequested: false,
      });
    },

    clearError: () => set({ error: null }),
  };
});

/**
 * Widen a wire snapshot into the shape the board components expect.
 *
 * The move list is not sent - the client has no use for it and it would double
 * the size of every state frame - so it comes back empty.
 */
function toGame(snapshot: Snapshot): GameState {
  return {
    size: snapshot.size,
    board: snapshot.board,
    currentPlayer: snapshot.currentPlayer,
    status: snapshot.status,
    winner: snapshot.winner,
    winLine: snapshot.winLine,
    lastMove: snapshot.lastMove,
    moves: [],
  };
}
