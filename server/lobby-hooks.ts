import type { BotDifficulty, GameConfig } from '@/game/engine';
import type { ClientMessage, MatchKind, MatchResult, PublicProfile } from '@/protocol';
import type { AccountRow } from './db/accounts.js';
import type { Outcome, Room, Seat, Session } from './types.js';

/**
 * How the competitive systems plug into the lobby.
 *
 * The lobby stays the one place that referees a game; seasons, bots,
 * tournaments and anti-cheat only watch what it decides and ask it to do
 * things through a handful of public methods. Each is an extension with a few
 * optional callbacks, so none of them has to know about the others and a test
 * can run the lobby with any subset.
 */

export interface SettledMatch {
  readonly matchId: string;
  readonly room: Room;
  readonly outcome: Outcome;
  readonly x: Seat;
  readonly o: Seat;
  readonly result: MatchResult;
}

export interface LobbyExtension {
  /** The season ranked games count towards right now. */
  seasonId?(): number | undefined;
  /** A game was scored, recorded and announced. Must not throw into the lobby. */
  settled?(match: SettledMatch): void;
  /** A game began, or a move landed and it goes on. */
  turn?(room: Room): void;
  /** A client message the lobby does not handle itself. `true` if this one did. */
  message?(session: Session, message: ClientMessage): boolean;
  /** Once per lobby tick, after the lobby's own housekeeping. */
  tick?(now: number): void;
}

/** Picks a bot for a player who has waited long enough. */
export interface BotProvider {
  pick(
    rating: number,
    config: GameConfig,
  ): { account: AccountRow; difficulty: BotDifficulty; rating: number } | null;
}

export interface BotBackfillOptions {
  readonly provider: BotProvider;
  /** Casual wait before a bot is offered. */
  readonly casualAfterMs: number;
  /**
   * Ranked wait before a bot is offered, or `null` for never. A bot game that
   * came from the ranked queue is played unrated - a bot's strength is set by
   * hand, not earned, so it has no business moving anyone's rating.
   */
  readonly rankedAfterMs: number | null;
}

/** A request to seat two players in a game they did not queue for. */
export interface ArrangedMatch {
  readonly config: GameConfig;
  readonly kind: MatchKind;
  readonly accountIds: readonly [string, string];
  readonly tournament?: { readonly id: string; readonly name: string; readonly berserk: boolean };
}

/** One game in progress, as the public live list shows it. */
export interface LiveGame {
  readonly code: string;
  readonly mode: string;
  readonly kind: MatchKind;
  readonly config: GameConfig;
  readonly x: PublicProfile;
  readonly o: PublicProfile;
  readonly moves: number;
  readonly spectators: number;
  readonly startedAt: number;
  readonly tournament: string | null;
}

/** Where an account is, as far as the lobby knows. */
export interface Activity {
  readonly online: boolean;
  readonly queued: boolean;
  /** Room holding a seat for this account, if any. */
  readonly room: string | null;
  /** Whether that room has a game in progress. */
  readonly live: boolean;
  /** When this account's last game ended, if the room is still open. */
  readonly finishedAt: number | null;
}
