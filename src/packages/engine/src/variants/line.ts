import {
  createBoard,
  emptyIndices,
  gravityMoves,
  isBoardFull,
  isGravityLanding,
} from '../board.js';
import { findWinLineFrom } from '../rules.js';
import {
  Empty,
  type GameConfig,
  type GameState,
  opponentOf,
  type Player,
  type VariantId,
} from '../types.js';
import type { Variant } from './variant.js';

/**
 * The rule set behind `classic`, `gomoku`, `misere` and `gravity`.
 *
 * All four place a mark on an empty square and look for a run through it. They
 * differ only in the board they are played on, in which empty squares are open
 * - gravity allows only the lowest free square of each column - and, for
 * misere, in who the completed run belongs to. So they share one implementation
 * rather than four copies of the same line scan.
 */
interface LineRules {
  readonly id: VariantId;
  /** Completing a run loses rather than wins. */
  readonly misere: boolean;
  /** Marks fall to the lowest free square of their column. */
  readonly gravity: boolean;
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

function lineVariant(rules: LineRules): Variant {
  function canPlay(state: GameState, index: number): boolean {
    if (
      state.status !== 'playing' ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= state.board.length ||
      state.board[index] !== Empty
    ) {
      return false;
    }
    return !rules.gravity || isGravityLanding(state.board, state.config.size, index);
  }

  function legalMoves(state: GameState): number[] {
    if (state.status !== 'playing') return [];
    return rules.gravity ? gravityMoves(state.board, state.config.size) : emptyIndices(state.board);
  }

  function apply(state: GameState, index: number): GameState | null {
    if (!canPlay(state, index)) return null;

    const board = state.board.slice();
    board[index] = state.currentPlayer;

    const winLine = findWinLineFrom(board, state.config.size, index, state.config.winLength);
    const moves = [...state.moves, index];

    if (winLine) {
      // In misere the run still ends the game and is still worth drawing; it
      // just belongs to the player who now has to live with it.
      const winner = rules.misere ? opponentOf(state.currentPlayer) : state.currentPlayer;
      return { ...state, board, status: 'won', winner, winLine, lastMove: index, moves };
    }

    if (isBoardFull(board)) {
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

  return { id: rules.id, create, canPlay, legalMoves, apply };
}

export const classicVariant = lineVariant({ id: 'classic', misere: false, gravity: false });
export const gomokuVariant = lineVariant({ id: 'gomoku', misere: false, gravity: false });
export const misereVariant = lineVariant({ id: 'misere', misere: true, gravity: false });
export const gravityVariant = lineVariant({ id: 'gravity', misere: false, gravity: true });
