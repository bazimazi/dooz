import type { GameConfig, Player } from '@/game/engine';
import type { MatchKind } from '@/protocol';
import type { Session } from './types.js';

/**
 * The seams between the lobby and the social and operations layers
 * (moderation, friends, live-room persistence).
 *
 * The lobby stays the referee and nothing more: these layers plug in through a
 * few calls rather than living inside it, so each can be tested on its own and
 * none of them can change what a move or a result means. The competitive
 * layer's seams are in `lobby-hooks.ts`.
 */
export interface SocialHooks {
  /**
   * Why this account may not connect (a ban), or `null`. Checked at `hello`,
   * after the credentials are verified, so it is never an oracle for whether
   * an account id exists.
   */
  refuse?(accountId: string): string | null;
  /** Whether the account is barred from talking to other players (emotes). */
  isMuted?(accountId: string): boolean;
  /** A `challenge` frame: open a private room and invite one friend to it. */
  challenge?(session: Session, accountId: string, config: GameConfig): void;
}

/**
 * A room as it is written down at shutdown and read back on boot.
 *
 * Only what cannot be derived: the board is rebuilt by replaying the moves,
 * which also proves the record is a real game before anyone is seated in it.
 */
export interface PersistedRoom {
  readonly code: string;
  /** The room's rules, as players picked them. */
  readonly config: GameConfig;
  /** The rules the current game was dealt, seed included, which the moves replay under. */
  readonly gameConfig: GameConfig;
  readonly kind: MatchKind;
  readonly startingPlayer: Player;
  readonly moves: readonly number[];
  readonly moveTimesMs: readonly number[];
  readonly startedAt: number;
  readonly seats: readonly {
    readonly accountId: string;
    readonly player: Player;
    readonly ratingBefore: number;
    readonly mayOfferDraw: boolean;
  }[];
  readonly clock: PersistedClock | null;
}

export interface PersistedClock {
  readonly x: number;
  readonly o: number;
  readonly running: Player | null;
  readonly incrementMs: number;
}

export type Presence = 'offline' | 'online' | 'queue' | 'playing';
