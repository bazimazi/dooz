import { createBoard, emptyIndices, isBoardFull } from '../board.js';
import {
  type Board,
  Empty,
  type GameConfig,
  type GameState,
  isMark,
  opponentOf,
  type Player,
  type WinLine,
} from '../types.js';
import type { Variant } from './variant.js';

/**
 * Qubic: four in a row in a 4x4x4 cube.
 *
 * Sixty-four cells and seventy-six lines - every row, column and pillar of the
 * cube, the diagonals of each plane, and the four great diagonals through the
 * middle. It is a first-player win (Patashnik proved it in 1980 with a computer
 * search), but the win is so deep that strong play is a real game.
 *
 * The cube rides on the ordinary flat board as an 8x8 grid with the four layers
 * laid out as its quadrants - layer 0 top left, layer 1 top right, layer 2
 * bottom left, layer 3 bottom right. That way the wire format, the replays and
 * any view that does not know about cubes still show the four layers side by
 * side, which is exactly how Qubic is drawn on paper. Which cells form a line
 * is this file's own table: adjacency on the 8x8 grid means nothing here.
 */

/** Edge of the cube. */
export const QUBIC_EDGE = 4;
/** Size of the flat board the cube is stored on. */
export const QUBIC_BOARD_SIZE = 8;
/** Cells in the cube. */
export const QUBIC_CELLS = QUBIC_EDGE ** 3;

export interface CubeCoords {
  readonly layer: number;
  readonly row: number;
  readonly col: number;
}

/** The flat board index of a cube cell. */
export function qubicIndex(layer: number, row: number, col: number): number {
  const quadrantRow = Math.floor(layer / 2) * QUBIC_EDGE;
  const quadrantCol = (layer % 2) * QUBIC_EDGE;
  return (quadrantRow + row) * QUBIC_BOARD_SIZE + quadrantCol + col;
}

/** The cube coordinates of a flat board index. */
export function qubicCoords(index: number): CubeCoords {
  const flatRow = Math.floor(index / QUBIC_BOARD_SIZE);
  const flatCol = index % QUBIC_BOARD_SIZE;
  const layer = Math.floor(flatRow / QUBIC_EDGE) * 2 + Math.floor(flatCol / QUBIC_EDGE);
  return { layer, row: flatRow % QUBIC_EDGE, col: flatCol % QUBIC_EDGE };
}

/**
 * Every winning line, as four flat indices ordered from one end to the other.
 *
 * Built from the thirteen directions through the cube - one from each opposite
 * pair - and every starting cell from which four steps stay inside it.
 */
export const QUBIC_LINES: readonly (readonly number[])[] = (() => {
  const lines: number[][] = [];
  for (let dl = -1; dl <= 1; dl++) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        // One of each opposite pair: the first non-zero step is positive.
        const first = dl !== 0 ? dl : dr !== 0 ? dr : dc;
        if (first <= 0) continue;
        for (let l = 0; l < QUBIC_EDGE; l++) {
          for (let r = 0; r < QUBIC_EDGE; r++) {
            for (let c = 0; c < QUBIC_EDGE; c++) {
              const end = [l + dl * 3, r + dr * 3, c + dc * 3];
              if (end.some((value) => value < 0 || value >= QUBIC_EDGE)) continue;
              // Only lines that start at the cube's face, so each is listed once.
              const before = [l - dl, r - dr, c - dc];
              if (before.every((value) => value >= 0 && value < QUBIC_EDGE)) continue;
              lines.push(
                Array.from({ length: QUBIC_EDGE }, (_, step) =>
                  qubicIndex(l + dl * step, r + dr * step, c + dc * step),
                ),
              );
            }
          }
        }
      }
    }
  }
  return lines;
})();

/** Per flat index, the indices into {@link QUBIC_LINES} of the lines through it. */
export const QUBIC_LINES_THROUGH: readonly (readonly number[])[] = (() => {
  const through: number[][] = Array.from({ length: QUBIC_BOARD_SIZE ** 2 }, () => []);
  QUBIC_LINES.forEach((line, at) => {
    for (const cell of line) through[cell]!.push(at);
  });
  return through;
})();

/** The completed line through `index` for whoever holds it, or `null`. */
export function qubicLineFrom(board: Board, index: number): WinLine | null {
  const player = board[index];
  if (!isMark(player)) return null;
  for (const at of QUBIC_LINES_THROUGH[index] ?? []) {
    const line = QUBIC_LINES[at]!;
    if (line.every((cell) => board[cell] === player)) return line;
  }
  return null;
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

/** The cube has one shape: four layers of four by four, four in a row. */
function validate(config: GameConfig): boolean {
  return config.size === QUBIC_BOARD_SIZE && config.winLength === QUBIC_EDGE;
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
  board[index] = state.currentPlayer;
  const moves = [...state.moves, index];
  const winLine = qubicLineFrom(board, index);

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

export const qubicVariant: Variant = {
  id: 'qubic',
  name: 'Qubic',
  validate,
  create,
  canPlay,
  legalMoves,
  apply,
};
