import { createBoard, isBoardFull } from '../board.js';
import { findWinLineFrom } from '../rules.js';
import {
  Empty,
  type GameConfig,
  type GameState,
  O,
  opponentOf,
  type Player,
  type VariantId,
  X,
} from '../types.js';
import type { Variant } from './variant.js';

/**
 * Rule sets where the mover chooses which mark to place.
 *
 * In Wild tic-tac-toe and in Order and Chaos a mark on the board belongs to
 * nobody: either player may put down an X or an O. The seats are still X and O
 * - they take turns, open games and win them like any other - but the marks no
 * longer say whose they are, only what lines they make.
 *
 * A move is therefore a square and a mark at once, coded `cell + cells * mark`
 * with 0 for an X and 1 for an O, so the move space is twice the board. That
 * keeps a move one integer on the wire and in a replay, and `lastMove` is
 * still just the square.
 */

/** The marks a mover can choose between, in move-code order. */
export const MARK_CHOICES = [X, O] as const;

/** The move code for placing `mark` on `cell` under `config`. */
export function markMove(config: GameConfig, cell: number, mark: Player): number {
  return cell + config.size * config.size * (mark === X ? 0 : 1);
}

/** The square and mark a move code stands for, or `null` if it is out of range. */
export function decodeMarkMove(
  config: GameConfig,
  move: number,
): { readonly cell: number; readonly mark: Player } | null {
  const cells = config.size * config.size;
  if (!Number.isInteger(move) || move < 0 || move >= cells * 2) return null;
  return { cell: move % cells, mark: move < cells ? X : O };
}

/** Whether `variant` lets the mover choose the mark. */
export function choosesMark(variant: VariantId): boolean {
  return variant === 'wild' || variant === 'order-chaos';
}

/** Order and Chaos: the seat that wants a line. */
export const ORDER: Player = X;
/** Order and Chaos: the seat that wants the board to fill without one. */
export const CHAOS: Player = O;

interface MarkRules {
  readonly id: VariantId;
  readonly name: string;
  readonly validate: Variant['validate'];
  /**
   * Who a completed line wins for, given the player who completed it: the
   * mover in Wild, and always Order in Order and Chaos - even when Chaos was
   * careless enough to make it.
   */
  readonly lineWinner: (mover: Player) => Player;
  /** Who takes a full board with no line, or `null` for a draw. */
  readonly fullBoardWinner: Player | null;
}

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

function markVariant(rules: MarkRules): Variant {
  function canPlay(state: GameState, move: number): boolean {
    if (state.status !== 'playing') return false;
    const decoded = decodeMarkMove(state.config, move);
    return decoded !== null && state.board[decoded.cell] === Empty;
  }

  function legalMoves(state: GameState): number[] {
    if (state.status !== 'playing') return [];
    const cells = state.board.length;
    const moves: number[] = [];
    for (let choice = 0; choice < MARK_CHOICES.length; choice++) {
      for (let cell = 0; cell < cells; cell++) {
        if (state.board[cell] === Empty) moves.push(cell + cells * choice);
      }
    }
    return moves;
  }

  function apply(state: GameState, move: number): GameState | null {
    if (!canPlay(state, move)) return null;
    const { cell, mark } = decodeMarkMove(state.config, move)!;

    const board = state.board.slice();
    board[cell] = mark;
    const moves = [...state.moves, move];
    const { size, winLength } = state.config;

    const winLine = findWinLineFrom(board, size, cell, winLength);
    if (winLine) {
      return {
        ...state,
        board,
        status: 'won',
        winner: rules.lineWinner(state.currentPlayer),
        winLine,
        lastMove: cell,
        moves,
      };
    }

    if (isBoardFull(board)) {
      const winner = rules.fullBoardWinner;
      return {
        ...state,
        board,
        status: winner === null ? 'draw' : 'won',
        winner,
        winLine: null,
        lastMove: cell,
        moves,
      };
    }

    return {
      ...state,
      board,
      currentPlayer: opponentOf(state.currentPlayer),
      lastMove: cell,
      moves,
    };
  }

  return {
    id: rules.id,
    name: rules.name,
    validate: rules.validate,
    moveSpace: (config) => config.size * config.size * MARK_CHOICES.length,
    create,
    canPlay,
    legalMoves,
    apply,
  };
}

/**
 * Wild tic-tac-toe: place either mark, and whoever completes a line of either
 * wins. Every two-in-a-row is a gift to the next player, so the game is about
 * never leaving one.
 */
export const wildVariant = markVariant({
  id: 'wild',
  name: 'Wild',
  // The bot solves these outright, and past 4x4 the game is just avoidance on
  // a board too big to see.
  validate: (config) => config.size <= 4 && config.winLength === config.size,
  lineWinner: (mover) => mover,
  fullBoardWinner: null,
});

/**
 * Order and Chaos: Order wants five identical marks in a row, Chaos wants the
 * board to fill without them, and both may place either mark. There are no
 * draws - a full board is Chaos's win.
 */
export const orderChaosVariant = markVariant({
  id: 'order-chaos',
  name: 'Order & Chaos',
  validate: (config) => config.size === 6 && config.winLength === 5,
  lineWinner: () => ORDER,
  fullBoardWinner: CHAOS,
});
