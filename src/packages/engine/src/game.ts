import { createBoard, isBoardFull } from './board.js';
import { findWinLineFrom } from './rules.js';
import { type BoardSize, Empty, type GameState, O, opponentOf, type Player, X } from './types.js';

export function randomStartingPlayer(random: () => number = Math.random): Player {
  return random() < 0.5 ? X : O;
}

export function createGame(size: BoardSize, startingPlayer: Player = X): GameState {
  return {
    size,
    board: createBoard(size),
    currentPlayer: startingPlayer,
    status: 'playing',
    winner: null,
    winLine: null,
    lastMove: null,
    moves: [],
  };
}

/** True when `index` is a legal move for the player to act in `state`. */
export function canPlay(state: GameState, index: number): boolean {
  return (
    state.status === 'playing' &&
    Number.isInteger(index) &&
    index >= 0 &&
    index < state.board.length &&
    state.board[index] === Empty
  );
}

/**
 * Play `index` for the current player.
 *
 * Returns the next state, or `null` if the move is illegal. Callers that trust
 * their input (the AI search, replaying a recorded game) can assert non-null;
 * the multiplayer server relies on the `null` to reject bad client moves.
 */
export function applyMove(state: GameState, index: number): GameState | null {
  if (!canPlay(state, index)) return null;

  const board = state.board.slice();
  board[index] = state.currentPlayer;

  const winLine = findWinLineFrom(board, state.size, index);
  const moves = [...state.moves, index];

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

  if (isBoardFull(board)) {
    return { ...state, board, status: 'draw', winner: null, winLine: null, lastMove: index, moves };
  }

  return {
    ...state,
    board,
    currentPlayer: opponentOf(state.currentPlayer),
    lastMove: index,
    moves,
  };
}

/** Rebuild a game from its move list. Used to verify a state instead of trusting it. */
export function replay(
  size: BoardSize,
  startingPlayer: Player,
  moves: readonly number[],
): GameState | null {
  let state = createGame(size, startingPlayer);
  for (const move of moves) {
    const next = applyMove(state, move);
    if (!next) return null;
    state = next;
  }
  return state;
}
