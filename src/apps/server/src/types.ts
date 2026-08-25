import type { BoardSize, GameState, Player } from '@dooz/engine';
import type { ServerMessage } from '@dooz/protocol';

/**
 * Everything the lobby needs from a connection.
 *
 * Keeping the lobby behind this interface rather than a WebSocket means the
 * whole matchmaking and game flow can be tested with plain objects, and a
 * different transport (a Bun or Cloudflare runtime, say) is a drop-in.
 */
export interface Transport {
  send(message: ServerMessage): void;
  close(): void;
}

export interface Session {
  /** Reassigned once on `hello` when a client resumes an earlier identity. */
  id: string;
  name: string;
  transport: Transport;
  /** Room the session currently occupies, if any. */
  roomCode: string | null;
  connected: boolean;
  /** Token bucket state for rate limiting. */
  tokens: number;
  lastRefill: number;
}

export interface Seat {
  clientId: string;
  name: string;
  readonly player: Player;
  connected: boolean;
  wantsRematch: boolean;
}

export interface Room {
  readonly code: string;
  readonly boardSize: BoardSize;
  /** Public rooms are handed out by quick match; private ones need the code. */
  readonly isPublic: boolean;
  seats: Seat[];
  game: GameState;
  /** When the last occupant disconnected, for the reconnect grace period. */
  vacantSince: number | null;
}
