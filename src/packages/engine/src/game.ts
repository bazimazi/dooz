import { type GameConfig, type GameState, MAX_WIN_LENGTH, O, type Player, X } from './types.js';
import { variantFor } from './variants/index.js';

/**
 * The run length a plain board of `size` should use.
 *
 * Three in a row is the classic rule and stays that on a 3x3 board. Requiring a
 * full row on anything bigger makes the game unplayable - every game would be
 * drawn - so the requirement grows far more slowly than the board does and
 * stops at five, which is the length gomoku settled on for the same reason.
 */
export function defaultWinLength(size: number): number {
  if (size <= 3) return 3;
  if (size <= 6) return 4;
  return Math.min(5, MAX_WIN_LENGTH);
}

/** A plain n-in-a-row config for a square board, for callers that only have a size. */
export function configForSize(size: number): GameConfig {
  return { variant: 'classic', size, winLength: defaultWinLength(size) };
}

export function randomStartingPlayer(random: () => number = Math.random): Player {
  return random() < 0.5 ? X : O;
}

/**
 * A fresh game.
 *
 * Accepts a bare board size as well as a full config, because most callers -
 * the local and bot screens, and every existing test - only ever mean "a normal
 * game on this board".
 */
export function createGame(config: GameConfig | number, startingPlayer: Player = X): GameState {
  const resolved = typeof config === 'number' ? configForSize(config) : config;
  return variantFor(resolved.variant).create(resolved, startingPlayer);
}

/** True when `index` is a legal move for the player to act in `state`. */
export function canPlay(state: GameState, index: number): boolean {
  return variantFor(state.config.variant).canPlay(state, index);
}

/** Every legal move in `state`, ascending. Empty once the game is over. */
export function legalMoves(state: GameState): number[] {
  return variantFor(state.config.variant).legalMoves(state);
}

/**
 * Play `index` for the current player.
 *
 * Returns the next state, or `null` if the move is illegal. Callers that trust
 * their input (the AI search, replaying a recorded game) can assert non-null;
 * the multiplayer server relies on the `null` to reject bad client moves.
 */
export function applyMove(state: GameState, index: number): GameState | null {
  return variantFor(state.config.variant).apply(state, index);
}

/**
 * Rebuild a game from its move list.
 *
 * Returns `null` the moment a move is illegal, so a recorded game can be
 * checked rather than taken on trust - and it is how a position is set up in a
 * test without hand-building a board.
 *
 * This is also the replay guarantee: the same config, opener and moves always
 * produce the same final state, because nothing in the rules reads a clock or a
 * random number.
 */
export function replay(
  config: GameConfig | number,
  startingPlayer: Player,
  moves: readonly number[],
): GameState | null {
  let state = createGame(config, startingPlayer);
  for (const move of moves) {
    const next = applyMove(state, move);
    if (!next) return null;
    state = next;
  }
  return state;
}

/**
 * Every position a recorded game passed through, first to last.
 *
 * Returns `null` if the record does not play out, so a replay viewer never
 * renders a position that could not have happened.
 */
export function replayFrames(
  config: GameConfig | number,
  startingPlayer: Player,
  moves: readonly number[],
): GameState[] | null {
  const frames: GameState[] = [createGame(config, startingPlayer)];
  for (const move of moves) {
    const previous = frames.at(-1);
    if (!previous) return null;
    const next = applyMove(previous, move);
    if (!next) return null;
    frames.push(next);
  }
  return frames;
}

/**
 * The minimal, transport-safe form of a game.
 *
 * A game is entirely determined by its rules, its opener and its moves, so that
 * is all a match record stores - a 15x15 board would otherwise be 225 numbers
 * per position, and a replay would be a list of boards rather than a list of
 * moves.
 */
export interface GameRecord {
  readonly config: GameConfig;
  readonly startingPlayer: Player;
  readonly moves: readonly number[];
}

export function toRecord(state: GameState): GameRecord {
  return {
    config: state.config,
    startingPlayer: startingPlayerOf(state),
    moves: [...state.moves],
  };
}

/** Rebuild a state from a record, or `null` if the record is not a real game. */
export function fromRecord(record: GameRecord): GameState | null {
  return replay(record.config, record.startingPlayer, record.moves);
}

/**
 * Who opened the game.
 *
 * Derived rather than stored: with the turn alternating every ply, the opener
 * is the player to move at an even move count and their opponent at an odd one.
 * Ultimate never passes a turn either, so this holds for every variant.
 */
export function startingPlayerOf(state: GameState): Player {
  const even = state.moves.length % 2 === 0;
  if (state.status === 'playing') {
    return even ? state.currentPlayer : state.currentPlayer === X ? O : X;
  }
  // A finished game froze `currentPlayer` at whoever played last.
  return even ? (state.currentPlayer === X ? O : X) : state.currentPlayer;
}
