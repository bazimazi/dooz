import { createBoard, emptyIndices, isBoardFull } from '../board.js';
import { findWinLineFrom } from '../rules.js';
import { Empty, type GameConfig, type GameState, opponentOf, type Player } from '../types.js';
import type { Variant } from './variant.js';

/**
 * The rule set behind `classic`, `gomoku` and `misere`.
 *
 * All three place a mark on an empty square and look for a run through it. They
 * differ only in the board they are played on and - for misere - in who the
 * completed run belongs to, so they share one implementation rather than three
 * copies of the same line scan.
 */
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

function apply(state: GameState, index: number, misere: boolean): GameState | null {
  if (!canPlay(state, index)) return null;

  const board = state.board.slice();
  board[index] = state.currentPlayer;

  const winLine = findWinLineFrom(board, state.config.size, index, state.config.winLength);
  const moves = [...state.moves, index];

  if (winLine) {
    // In misere the run still ends the game and is still worth drawing; it just
    // belongs to the player who now has to live with it.
    const winner = misere ? opponentOf(state.currentPlayer) : state.currentPlayer;
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

export const classicVariant: Variant = {
  id: 'classic',
  create,
  canPlay,
  legalMoves,
  apply: (state, index) => apply(state, index, false),
};

export const gomokuVariant: Variant = {
  ...classicVariant,
  id: 'gomoku',
};

export const misereVariant: Variant = {
  id: 'misere',
  create,
  canPlay,
  legalMoves,
  apply: (state, index) => apply(state, index, true),
};
