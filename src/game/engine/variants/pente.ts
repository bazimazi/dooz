import { createBoard, emptyIndices, isBoardFull } from '../board.js';
import { findWinLineFrom } from '../rules.js';
import {
  type Board,
  Empty,
  type GameConfig,
  type GameState,
  opponentOf,
  type PenteExtra,
  type Player,
  X,
} from '../types.js';
import type { Variant } from './variant.js';

/**
 * Pente: five in a row, with captures.
 *
 * A mark placed so that it and another of the mover's marks flank exactly two
 * of the opponent's in a straight line - X O O X - takes those two off the
 * board. Five captured pairs win as surely as five in a row does, so every pair
 * a player leaves exposed is a point the opponent can bank, and every line they
 * build can be cut out from the middle.
 *
 * Only the mover captures, and only with the mark just placed: walking into a
 * flanked position (playing the second O of X O _ X) is safe, because the
 * capture is a consequence of placing the flanking mark, not of the shape.
 * Exactly two are taken - X O O O X captures nothing.
 *
 * The capture count is derived during `apply` and carried in `extra`, so a
 * replay rebuilds it from the moves like everything else.
 */

/** Captured pairs that win the game. */
export const PENTE_CAPTURES_TO_WIN = 5;

/** All eight directions a capture can run in, as [rowStep, colStep]. */
export const PENTE_DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [-1, 1],
] as const;

/** Index into `PenteExtra.captures` for `player`. */
export function captureSlot(player: Player): 0 | 1 {
  return player === X ? 0 : 1;
}

/**
 * The squares placing `player` at `index` would capture, in pairs.
 *
 * Reads the board as it stands, with `index` itself treated as the mover's
 * whatever is on it, so the search can ask before or after placing.
 */
export function penteCapturesAt(
  board: Board,
  size: number,
  index: number,
  player: Player,
): number[] {
  const opponent = opponentOf(player);
  const row = Math.floor(index / size);
  const col = index % size;
  const taken: number[] = [];

  for (const [dRow, dCol] of PENTE_DIRECTIONS) {
    const farRow = row + dRow * 3;
    const farCol = col + dCol * 3;
    if (farRow < 0 || farRow >= size || farCol < 0 || farCol >= size) continue;
    const first = index + dRow * size + dCol;
    const second = first + dRow * size + dCol;
    const far = second + dRow * size + dCol;
    if (board[first] === opponent && board[second] === opponent && board[far] === player) {
      taken.push(first, second);
    }
  }
  return taken;
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
    extra: { kind: 'pente', captures: [0, 0], captured: [] },
  };
}

/**
 * Pente is a five-in-a-row game and needs the room for it: captures only mean
 * something on a board big enough that a line can be rebuilt after one.
 */
function validate(config: GameConfig): boolean {
  return config.size >= 9 && config.winLength === 5;
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

/** The captures so far, as `[X's pairs, O's pairs]`. Zeros for any other rule set. */
export function penteCaptures(state: GameState): readonly [number, number] {
  return state.extra?.kind === 'pente' ? state.extra.captures : [0, 0];
}

/** The squares the most recent move captured, empty if it captured none. */
export function capturedBy(state: GameState): readonly number[] {
  return state.extra?.kind === 'pente' ? state.extra.captured : [];
}

function apply(state: GameState, index: number): GameState | null {
  if (!canPlay(state, index)) return null;

  const { size, winLength } = state.config;
  const mover = state.currentPlayer;
  const board = state.board.slice();
  board[index] = mover;

  const captured = penteCapturesAt(board, size, index, mover);
  for (const cell of captured) board[cell] = Empty;

  const previous = penteCaptures(state);
  const slot = captureSlot(mover);
  const captures: [number, number] = [previous[0], previous[1]];
  captures[slot] += captured.length / 2;
  const extra: PenteExtra = { kind: 'pente', captures, captured };

  const moves = [...state.moves, index];
  const winLine = findWinLineFrom(board, size, index, winLength);

  if (winLine || captures[slot] >= PENTE_CAPTURES_TO_WIN) {
    return {
      ...state,
      board,
      status: 'won',
      winner: mover,
      // A win on captures has no line to draw; one made by five in a row does,
      // even when the same mark also took the fifth pair.
      winLine,
      lastMove: index,
      moves,
      extra,
    };
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
      extra,
    };
  }

  return {
    ...state,
    board,
    currentPlayer: opponentOf(mover),
    lastMove: index,
    moves,
    extra,
  };
}

export const penteVariant: Variant = {
  id: 'pente',
  name: 'Pente',
  validate,
  create,
  canPlay,
  legalMoves,
  apply,
};
