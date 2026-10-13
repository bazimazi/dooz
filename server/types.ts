import type { BotDifficulty, GameConfig, GameState, Player } from '@/game/engine';
import type { EndReason, MatchKind, MatchResult, ServerMessage } from '@/protocol';
import type { MatchClock } from './clock.js';
import type { AccountRow } from './db/accounts.js';

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
  /** Identifies the connection. Not the identity - that is `accountId`. */
  readonly id: string;
  /** Set once `hello` has authenticated. Null on a connection that has not. */
  accountId: string | null;
  account: AccountRow | null;
  transport: Transport;
  /** Room this session holds a seat in, if any. */
  roomCode: string | null;
  /** Room this session is watching, if any. Never set at the same time as `roomCode`. */
  spectating: string | null;
  connected: boolean;
  /** `hello` is accepted once per connection; this records that it happened. */
  greeted: boolean;
  /** When the connection opened, for the deadline on `hello`. */
  readonly connectedAt: number;
  /** Token bucket state for rate limiting. */
  tokens: number;
  lastRefill: number;
  /** Separate, much tighter bucket for emotes. */
  emoteTokens: number;
  emoteRefill: number;
  /** This player has muted the opponent. Cleared whenever they take a new seat. */
  muted: boolean;
}

export interface Seat {
  readonly accountId: string;
  readonly player: Player;
  account: AccountRow;
  connected: boolean;
  wantsRematch: boolean;
  offeredDraw: boolean;
  /**
   * Cleared when a draw offer is declined and set again by this seat's next
   * move, so a refused offer cannot be repeated until the position has changed.
   */
  mayOfferDraw: boolean;
  /** Rating in this room's mode when the current game started. */
  ratingBefore: number;
  /** When this seat's connection dropped, for the abandon timer. */
  disconnectedAt: number | null;
  /**
   * Set when a server bot holds this seat, at this strength. A bot seat has no
   * session; its moves come from the engine pool, and it is always connected.
   */
  bot?: BotDifficulty;
}

export interface Room {
  readonly code: string;
  readonly config: GameConfig;
  /** Mode id for a preset, or the config key for a custom game. Keys ratings. */
  readonly mode: string;
  readonly kind: MatchKind;
  seats: Seat[];
  game: GameState;
  clock: MatchClock | null;
  /** Sessions watching without a seat. */
  spectators: Set<string>;
  /** When the last occupant disconnected, for the reconnect grace period. */
  vacantSince: number | null;
  /** Wall-clock start of the current game, for the match record. */
  startedAt: number;
  /** When the move before this one landed, so each move's time can be stored. */
  lastMoveAt: number;
  moveTimesMs: number[];
  /** Set once the current game has been scored, so it is never scored twice. */
  settled: boolean;
  /**
   * How the current game was scored, for anyone who arrives after the fact: a
   * reconnecting player or a spectator would otherwise see a resignation as a
   * board still in play.
   */
  result: MatchResult | null;
  /** The tournament this room was paired for. Such rooms are never rematched. */
  tournament?: { readonly id: string; readonly name: string; readonly berserk: boolean } | null;
  /** Seats that went berserk this game: half the clock, no increment, a bonus point. */
  berserk?: Set<Player>;
}

/** The outcome of a game, as the lobby decides it. */
export interface Outcome {
  readonly winner: Player | null;
  readonly reason: EndReason;
}
