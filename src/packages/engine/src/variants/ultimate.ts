import { createBoard, ultimateBoardOf, ultimateCellOf, ultimateCells } from '../board.js';
import {
  type Cell,
  Empty,
  type GameConfig,
  type GameState,
  opponentOf,
  type Player,
  type UltimateMeta,
} from '../types.js';
import type { Variant } from './variant.js';

/** The eight lines of a 3x3 board, as positions 0-8. Used for both levels. */
export const TRIPLES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function create(config: GameConfig, startingPlayer: Player): GameState {
  return {
    config,
    board: createBoard(9),
    currentPlayer: startingPlayer,
    status: 'playing',
    winner: null,
    winLine: null,
    lastMove: null,
    moves: [],
    ultimate: {
      boards: Array.from<Cell>({ length: 9 }).fill(Empty),
      drawn: Array.from<boolean>({ length: 9 }).fill(false),
      // The opening move may go anywhere; every move after it is directed.
      activeBoard: null,
      winBoards: null,
    },
  };
}

/** A sub-board nobody can play in any more: won outright, or full. */
function isSettled(meta: UltimateMeta, board: number): boolean {
  return meta.boards[board] !== Empty || meta.drawn[board] === true;
}

function canPlay(state: GameState, index: number): boolean {
  const meta = state.ultimate;
  if (!meta || state.status !== 'playing') return false;
  if (!Number.isInteger(index) || index < 0 || index >= 81) return false;
  if (state.board[index] !== Empty) return false;

  const board = ultimateBoardOf(index);
  // A settled sub-board is closed even when the mover is otherwise free: its
  // result is already recorded, and more marks in it could not change anything.
  if (isSettled(meta, board)) return false;

  return meta.activeBoard === null || meta.activeBoard === board;
}

function legalMoves(state: GameState): number[] {
  const meta = state.ultimate;
  if (!meta || state.status !== 'playing') return [];

  const active = meta.activeBoard;
  const boards = active === null ? Array.from({ length: 9 }, (_, board) => board) : [active];

  const moves: number[] = [];
  for (const board of boards) {
    if (isSettled(meta, board)) continue;
    for (const cell of ultimateCells(board)) {
      if (state.board[cell] === Empty) moves.push(cell);
    }
  }
  return moves.toSorted((a, b) => a - b);
}

/** The three positions that win a 3x3 grid for `player`, or `null`. */
function tripleFor(cells: readonly Cell[], player: Player): readonly number[] | null {
  for (const [a, b, c] of TRIPLES) {
    if (cells[a] === player && cells[b] === player && cells[c] === player) return [a, b, c];
  }
  return null;
}

function apply(state: GameState, index: number): GameState | null {
  const meta = state.ultimate;
  if (!meta || !canPlay(state, index)) return null;

  const player = state.currentPlayer;
  const board = state.board.slice();
  board[index] = player;

  const subBoard = ultimateBoardOf(index);
  const cells = ultimateCells(subBoard);
  const subCells = cells.map((cell) => board[cell] ?? Empty);

  const boards = [...meta.boards];
  const drawn = [...meta.drawn];

  if (tripleFor(subCells, player)) boards[subBoard] = player;
  else if (subCells.every((cell) => cell !== Empty)) drawn[subBoard] = true;

  const moves = [...state.moves, index];
  const winBoards = tripleFor(boards, player);

  if (winBoards) {
    return {
      ...state,
      board,
      status: 'won',
      winner: player,
      // The win is three sub-boards, not three cells, so there is no run on the
      // board itself to draw. `winBoards` is what the board component lights up.
      winLine: null,
      lastMove: index,
      moves,
      ultimate: { boards, drawn, activeBoard: null, winBoards },
    };
  }

  // Every sub-board settled with no line through them is the end of the game.
  const settled = boards.every((winner, at) => winner !== Empty || drawn[at] === true);
  if (settled) {
    return {
      ...state,
      board,
      status: 'draw',
      winner: null,
      winLine: null,
      lastMove: index,
      moves,
      ultimate: { boards, drawn, activeBoard: null, winBoards: null },
    };
  }

  // The square played within its own sub-board names the sub-board the
  // opponent must answer in. If that one is finished, they are free.
  const target = ultimateCellOf(index);
  const nextActive = boards[target] !== Empty || drawn[target] === true ? null : target;

  return {
    ...state,
    board,
    currentPlayer: opponentOf(player),
    lastMove: index,
    moves,
    ultimate: { boards, drawn, activeBoard: nextActive, winBoards: null },
  };
}

export const ultimateVariant: Variant = {
  id: 'ultimate',
  create,
  canPlay,
  legalMoves,
  apply,
};
