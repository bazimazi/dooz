import { colOf, rowOf } from '../board.js';
import { type GameConfig, type GameState, opponentOf, type OpeningRule } from '../types.js';
import type { Variant } from './variant.js';

/**
 * Opening rules, as a layer over any placement variant.
 *
 * Both rules only ever touch the first few plies, so rather than teaching every
 * rule set about them they wrap one: the wrapped variant still decides what a
 * move does, and the wrapper only narrows which moves are open (pro) or adds
 * one extra move (swap).
 */

/** Squares, in king moves, the opener's second mark must keep from the centre under `pro`. */
export const PRO_DISTANCE = 3;

/** The move code for the pie-rule swap: one past the wrapped variant's own codes. */
export function swapMoveFor(base: Variant, config: GameConfig): number {
  return base.moveSpace?.(config) ?? config.size * config.size;
}

export function centreOf(size: number): number {
  const mid = Math.floor(size / 2);
  return mid * size + mid;
}

function distanceFromCentre(size: number, cell: number): number {
  const mid = Math.floor(size / 2);
  return Math.max(Math.abs(rowOf(size, cell) - mid), Math.abs(colOf(size, cell) - mid));
}

export function withOpening(base: Variant, rule: OpeningRule): Variant {
  if (rule === 'pro') return withProRule(base);
  return withSwapRule(base);
}

function withProRule(base: Variant): Variant {
  /** Whether `move` is allowed by the pro rule; the base variant decides the rest. */
  function proAllows(state: GameState, move: number): boolean {
    const { size } = state.config;
    const ply = state.moves.length;
    if (ply === 0) return move === centreOf(size);
    if (ply === 2) return move < size * size && distanceFromCentre(size, move) >= PRO_DISTANCE;
    return true;
  }

  return {
    ...base,
    canPlay: (state, move) => proAllows(state, move) && base.canPlay(state, move),
    legalMoves: (state) => base.legalMoves(state).filter((move) => proAllows(state, move)),
    apply: (state, move) => (proAllows(state, move) ? base.apply(state, move) : null),
  };
}

/** The swap is open only as the second move, with the opening mark there to take. */
function canSwap(state: GameState): boolean {
  return state.status === 'playing' && state.moves.length === 1 && state.lastMove !== null;
}

function withSwapRule(base: Variant): Variant {
  function isSwap(state: GameState, move: number): boolean {
    return move === swapMoveFor(base, state.config);
  }

  return {
    ...base,
    moveSpace: (config) => swapMoveFor(base, config) + 1,
    canPlay: (state, move) => (isSwap(state, move) ? canSwap(state) : base.canPlay(state, move)),
    legalMoves: (state) => {
      const moves = base.legalMoves(state);
      return canSwap(state) ? [...moves, swapMoveFor(base, state.config)] : moves;
    },
    apply: (state, move) => {
      if (!isSwap(state, move)) return base.apply(state, move);
      if (!canSwap(state)) return null;
      // The swapper takes the opening mark as their own, and the opener - who
      // now owns nothing on the board - moves next. Seen from the colours this
      // is one mark changing hands, so the turn still alternates every ply.
      const cell = state.lastMove!;
      const board = state.board.slice();
      board[cell] = state.currentPlayer;
      return {
        ...state,
        board,
        currentPlayer: opponentOf(state.currentPlayer),
        lastMove: cell,
        moves: [...state.moves, move],
      };
    },
  };
}
