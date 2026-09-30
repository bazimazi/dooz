import { createBoard, emptyIndices } from '../board.js';
import { findWinLineFrom } from '../rules.js';
import { Empty, type GameConfig, type GameState, opponentOf, type Player } from '../types.js';
import type { Variant } from './variant.js';

/**
 * Vanish: three in a row where nobody keeps more than three marks.
 *
 * Placing a fourth mark first lifts your oldest one off the board, so the board
 * never fills and a position is never frozen - every threat you make is also a
 * mark you are about to lose. Played perfectly it is a first-player win in
 * thirteen plies (the solver in `bot/vanish.ts` proves it on first use), but
 * the win is a long way from obvious, and the loop of building, losing and
 * rebuilding is what the variant is for.
 *
 * Nothing here needs state beyond the move list: every mark on the board is one
 * of the last three its owner placed, so the order they leave in is simply the
 * order they arrived in. That keeps the variant on the plain `GameState` shape,
 * and the wire format, the replays and the server all carry it unchanged.
 */

/** Marks each player may have on the board at once. */
export const VANISH_KEEP = 3;

/**
 * Plies after which a game with no line is drawn.
 *
 * The rules alone never end a game - the board cannot fill - and two players
 * who only ever defend would shuffle forever. Perfect play wins inside
 * thirteen plies, so the limit only ever cuts off a game that has stopped
 * going anywhere.
 */
export const VANISH_MOVE_LIMIT = 50;

/** Plies back from the move being played to the mark it lifts off the board. */
const LIFT_DISTANCE = VANISH_KEEP * 2;

function create(config: GameConfig, startingPlayer: Player): GameState {
  return {
    config,
    board: createBoard(config.size),
    currentPlayer: startingPlayer,
    status: 'playing',
    winner: null,
    winLine: null,
    lastMove: null,
    moves: [],
    ultimate: null,
  };
}

function canPlay(state: GameState, index: number): boolean {
  return (
    state.status === 'playing' &&
    Number.isInteger(index) &&
    index >= 0 &&
    index < state.board.length &&
    state.board[index] === Empty
  );
}

function legalMoves(state: GameState): number[] {
  return state.status === 'playing' ? emptyIndices(state.board) : [];
}

function apply(state: GameState, index: number): GameState | null {
  if (!canPlay(state, index)) return null;

  const board = state.board.slice();
  const lifted = liftedBy(state.moves, state.moves.length);
  // The old mark goes before the new one lands, so it can never be part of the
  // line the new one completes: a run has to be made of marks that stay.
  if (lifted !== null) board[lifted] = Empty;
  board[index] = state.currentPlayer;

  const moves = [...state.moves, index];
  const winLine = findWinLineFrom(board, state.config.size, index, state.config.winLength);

  if (winLine) {
    return {
      ...state,
      board,
      status: 'won',
      winner: state.currentPlayer,
      winLine,
      lastMove: index,
      moves,
    };
  }

  if (moves.length >= VANISH_MOVE_LIMIT) {
    return {
      ...state,
      board,
      status: 'draw',
      winner: null,
      winLine: null,
      lastMove: index,
      moves,
    };
  }

  return {
    ...state,
    board,
    currentPlayer: opponentOf(state.currentPlayer),
    lastMove: index,
    moves,
  };
}

/** The square the move at position `ply` of `moves` lifts, if it lifts one. */
function liftedBy(moves: readonly number[], ply: number): number | null {
  return ply >= LIFT_DISTANCE ? (moves[ply - LIFT_DISTANCE] ?? null) : null;
}

/**
 * The marks that will leave the board next.
 *
 * `mover` is the mark the player to move loses by playing, and `waiting` the
 * one their opponent loses on the move after. Both matter to reading the
 * position: a line that runs through either of them is weaker than it looks.
 * Either is `null` while that player still has room for another mark.
 */
export function vanishingNext(state: GameState): { mover: number | null; waiting: number | null } {
  if (state.config.variant !== 'vanish' || state.status !== 'playing') {
    return { mover: null, waiting: null };
  }
  const ply = state.moves.length;
  return { mover: liftedBy(state.moves, ply), waiting: liftedBy(state.moves, ply + 1) };
}

/** The square the most recent move lifted off the board, if it lifted one. */
export function vanishedBy(state: GameState): number | null {
  if (state.config.variant !== 'vanish' || state.moves.length === 0) return null;
  return liftedBy(state.moves, state.moves.length - 1);
}

export const vanishVariant: Variant = {
  id: 'vanish',
  create,
  canPlay,
  legalMoves,
  apply,
};
