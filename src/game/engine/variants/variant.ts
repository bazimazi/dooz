import type { GameConfig, GameState, OpeningRule, Player, VariantId } from '../types.js';

/**
 * One rule set, as a set of deterministic state transitions.
 *
 * Everything a variant needs to be playable is here and nothing else is: no
 * rendering, no AI, no transport. The server and the client both drive games
 * exclusively through this interface, which is what lets them agree - and what
 * makes a new variant a single file plus a registry row and a mode entry.
 *
 * A move is a non-negative integer. For most rule sets it is simply the cell a
 * mark goes on; rule sets with more than one kind of action encode the action
 * above the cell range (`cell + cells * kind`) and say how far the codes go in
 * {@link Variant.moveSpace}. `GameState.lastMove` and `winLine` are always
 * cells, never codes.
 *
 * `apply` returns `null` for an illegal move rather than throwing, because the
 * server's whole job is to reject client moves and an exception is a clumsier
 * way to say no.
 */
export interface Variant {
  readonly id: VariantId;
  /** What to call a custom game under these rules, e.g. in a match history. */
  readonly name: string;
  /** Config options this rule set supports beyond variant, size and run length. */
  readonly supports?: {
    readonly exact?: boolean;
    readonly openings?: readonly OpeningRule[];
    /** Reads `config.seed` when creating a game. Required to be present if so. */
    readonly seeded?: boolean;
  };
  /**
   * Variant-specific constraints on an otherwise well-formed config: the
   * board sizes and run lengths the rules are defined for.
   */
  validate(config: GameConfig): boolean;
  /**
   * One past the largest move code the variant can produce under `config`.
   * Omitted when every move is a cell, in which case it is the cell count.
   */
  moveSpace?(config: GameConfig): number;
  /** A fresh game under `config`, with `startingPlayer` to move. */
  create(config: GameConfig, startingPlayer: Player): GameState;
  /** Whether `move` is a legal move for the player to act in `state`. */
  canPlay(state: GameState, move: number): boolean;
  /** Every legal move, ascending. Empty once the game is over. */
  legalMoves(state: GameState): number[];
  /** The state after playing `move`, or `null` if the move is illegal. */
  apply(state: GameState, move: number): GameState | null;
}
