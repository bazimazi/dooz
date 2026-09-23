import type { GameConfig, GameState, Player, VariantId } from '../types.js';

/**
 * One rule set, as a set of deterministic state transitions.
 *
 * Everything a variant needs to be playable is here and nothing else is: no
 * rendering, no AI, no transport. The server and the client both drive games
 * exclusively through this interface, which is what lets them agree - and what
 * makes a new variant a single file plus a mode entry.
 *
 * `apply` returns `null` for an illegal move rather than throwing, because the
 * server's whole job is to reject client moves and an exception is a clumsier
 * way to say no.
 */
export interface Variant {
  readonly id: VariantId;
  /** A fresh game under `config`, with `startingPlayer` to move. */
  create(config: GameConfig, startingPlayer: Player): GameState;
  /** Whether `index` is a legal move for the player to act in `state`. */
  canPlay(state: GameState, index: number): boolean;
  /** Every legal move, ascending. Empty once the game is over. */
  legalMoves(state: GameState): number[];
  /** The state after playing `index`, or `null` if the move is illegal. */
  apply(state: GameState, index: number): GameState | null;
}
