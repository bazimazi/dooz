import { createBoard, isBoardFull } from '../board.js';
import { findWinLineFrom } from '../rules.js';
import {
  Blocked,
  Empty,
  type GameConfig,
  type GameState,
  opponentOf,
  type Player,
  type PowerCharges,
  type PowersExtra,
  X,
} from '../types.js';
import type { Variant } from './variant.js';

/**
 * Powers: five in a row, with two one-time powers each.
 *
 * - **Bomb** lifts one of the opponent's marks off the board.
 * - **Wall** turns an empty square into a blocked one for the rest of the game.
 *
 * Using a power is the whole turn. Each is its own move code above the cell
 * range - `cell + cells * kind`, with kind 1 a bomb and 2 a wall - so a power
 * travels, replays and validates like any other move. What each player has
 * left lives in `GameState.extra`, and is rebuilt by replaying the moves.
 */

export const POWER_KINDS = ['place', 'bomb', 'wall'] as const;
export type PowerKind = (typeof POWER_KINDS)[number];

/** Uses of each power a player starts with. */
export const POWER_CHARGES: PowerCharges = { bomb: 1, wall: 1 };

/** The move code for `kind` aimed at `cell` under `config`. */
export function powerMove(config: GameConfig, cell: number, kind: PowerKind): number {
  return cell + config.size * config.size * POWER_KINDS.indexOf(kind);
}

/** The square and action a move code stands for, or `null` if it is out of range. */
export function decodePowerMove(
  config: GameConfig,
  move: number,
): { readonly cell: number; readonly kind: PowerKind } | null {
  const cells = config.size * config.size;
  if (!Number.isInteger(move) || move < 0 || move >= cells * POWER_KINDS.length) return null;
  return { cell: move % cells, kind: POWER_KINDS[Math.floor(move / cells)]! };
}

/** What `player` has left to spend in `state`, or nothing outside a Powers game. */
export function powerCharges(state: GameState, player: Player): PowerCharges {
  const extra = state.extra;
  if (extra?.kind !== 'powers') return { bomb: 0, wall: 0 };
  return player === X ? extra.x : extra.o;
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
    extra: { kind: 'powers', x: POWER_CHARGES, o: POWER_CHARGES },
  };
}

function canPlay(state: GameState, move: number): boolean {
  if (state.status !== 'playing') return false;
  const decoded = decodePowerMove(state.config, move);
  if (!decoded) return false;
  const { cell, kind } = decoded;
  const target = state.board[cell];
  if (kind === 'place') return target === Empty;

  const charges = powerCharges(state, state.currentPlayer);
  if (kind === 'bomb') return charges.bomb > 0 && target === opponentOf(state.currentPlayer);
  return charges.wall > 0 && target === Empty;
}

function legalMoves(state: GameState): number[] {
  if (state.status !== 'playing') return [];
  const cells = state.board.length;
  const charges = powerCharges(state, state.currentPlayer);
  const rival = opponentOf(state.currentPlayer);
  const moves: number[] = [];

  for (let cell = 0; cell < cells; cell++) if (state.board[cell] === Empty) moves.push(cell);
  if (charges.bomb > 0) {
    for (let cell = 0; cell < cells; cell++) {
      if (state.board[cell] === rival) moves.push(cell + cells);
    }
  }
  if (charges.wall > 0) {
    for (let cell = 0; cell < cells; cell++) {
      if (state.board[cell] === Empty) moves.push(cell + cells * 2);
    }
  }
  return moves;
}

function apply(state: GameState, move: number): GameState | null {
  if (!canPlay(state, move)) return null;
  const { cell, kind } = decodePowerMove(state.config, move)!;
  const mover = state.currentPlayer;
  const board = state.board.slice();
  const moves = [...state.moves, move];

  if (kind !== 'place') {
    // A power changes the board but can never complete a line - a bomb only
    // removes a mark and a wall only blocks - so the turn simply passes.
    board[cell] = kind === 'bomb' ? Empty : Blocked;
    const extra = spend(state.extra as PowersExtra, mover, kind);
    // A wall on the last empty square fills the board as surely as a mark.
    if (isBoardFull(board)) {
      return { ...state, board, status: 'draw', winner: null, lastMove: cell, moves, extra };
    }
    return { ...state, board, currentPlayer: opponentOf(mover), lastMove: cell, moves, extra };
  }

  board[cell] = mover;
  const { size, winLength } = state.config;
  const winLine = findWinLineFrom(board, size, cell, winLength);
  if (winLine) {
    return { ...state, board, status: 'won', winner: mover, winLine, lastMove: cell, moves };
  }
  if (isBoardFull(board)) {
    return { ...state, board, status: 'draw', winner: null, winLine: null, lastMove: cell, moves };
  }
  return { ...state, board, currentPlayer: opponentOf(mover), lastMove: cell, moves };
}

function spend(extra: PowersExtra, player: Player, kind: 'bomb' | 'wall'): PowersExtra {
  const own = player === X ? extra.x : extra.o;
  const left = { ...own, [kind]: own[kind] - 1 };
  return player === X ? { ...extra, x: left } : { ...extra, o: left };
}

export const powersVariant: Variant = {
  id: 'powers',
  name: 'Powers',
  validate: (config) => config.size >= 7 && config.winLength === 5,
  moveSpace: (config) => config.size * config.size * POWER_KINDS.length,
  create,
  canPlay,
  legalMoves,
  apply,
};
