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
  /** Reassigned once on `hello` when a client proves an earlier identity. */
  id: string;
  /**
   * The secret half of this session's identity. Reissued on every connection
   * and sent only to this client, never to the opponent.
   */
  resumeToken: string;
  name: string;
  transport: Transport;
  /** Room the session currently occupies, if any. */
  roomCode: string | null;
  connected: boolean;
  /** `hello` is accepted once per connection; this records that it happened. */
  greeted: boolean;
  /** Token bucket state for rate limiting. */
  tokens: number;
  lastRefill: number;
}

export interface Seat {
  clientId: string;
  /**
   * What a returning client has to produce to be given this seat back. Held on
   * the seat rather than the session because the session is gone by the time
   * the reconnect arrives.
   */
  resumeToken: string;
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
