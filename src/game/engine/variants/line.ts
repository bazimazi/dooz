import {
  createBoard,
  emptyIndices,
  gravityMoves,
  isBoardFull,
  isGravityLanding,
} from '../board.js';
import { findWinLineFrom } from '../rules.js';
import {
  Blocked,
  Empty,
  type GameConfig,
  type GameState,
  opponentOf,
  type Player,
  type VariantId,
} from '../types.js';
import { obstacleCells } from './obstacles.js';
import type { Variant } from './variant.js';

/**
 * The rule set behind `classic`, `gomoku`, `misere`, `gravity`, `connect4` and
 * `obstacles`.
 *
 * All of them place a mark on an empty square and look for a run through it.
 * They differ only in the board they are played on - Connect Four's and
 * Obstacles' start with squares blocked - in which empty squares are open
 * (gravity allows only the lowest free square of each column) and, for misere,
 * in who the completed run belongs to. So they share one implementation rather
 * than six copies of the same line scan.
 */
interface LineRules {
  readonly id: VariantId;
  readonly name: string;
  /** Completing a run loses rather than wins. */
  readonly misere: boolean;
  /** Marks fall to the lowest free square of their column. */
  readonly gravity: boolean;
  readonly supports: Variant['supports'];
  readonly validate: Variant['validate'];
  /**
   * Squares that start the game blocked: Connect Four's missing top row, or
   * the obstacles a seeded board scatters. Absent means a clear board.
   */
  readonly blocked?: (config: GameConfig) => readonly number[];
}

function createWith(
  config: GameConfig,
  startingPlayer: Player,
  blocked: readonly number[] = [],
): GameState {
  const board = createBoard(config.size);
  for (const cell of blocked) board[cell] = Blocked;
  return {
    config,
    board,
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

    const { size, winLength, exact } = state.config;
    const winLine = findWinLineFrom(board, size, index, winLength, exact);
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

  function create(config: GameConfig, startingPlayer: Player): GameState {
    return createWith(config, startingPlayer, rules.blocked?.(config));
  }

  return {
    id: rules.id,
    name: rules.name,
    supports: rules.supports,
    validate: rules.validate,
    create,
    canPlay,
    legalMoves,
    apply,
  };
}

const anyBoard = (): boolean => true;
const PLACEMENT_OPTIONS = { exact: true, openings: ['pro', 'swap'] } as const;

export const classicVariant = lineVariant({
  id: 'classic',
  name: 'Custom',
  misere: false,
  gravity: false,
  supports: PLACEMENT_OPTIONS,
  validate: anyBoard,
});
export const gomokuVariant = lineVariant({
  id: 'gomoku',
  name: 'Gomoku',
  misere: false,
  gravity: false,
  supports: PLACEMENT_OPTIONS,
  validate: anyBoard,
});
export const misereVariant = lineVariant({
  id: 'misere',
  name: 'Misère',
  misere: true,
  gravity: false,
  validate: anyBoard,
  supports: undefined,
});
export const gravityVariant = lineVariant({
  id: 'gravity',
  name: 'Gravity',
  misere: false,
  gravity: true,
  supports: { openings: ['swap'] },
  // A column needs room to stack a run in it, or gravity is just a smaller board.
  validate: (config) => config.size >= 4,
});

/**
 * Connect Four: seven columns of six under gravity, four in a row.
 *
 * Played on the 7x7 board every square-board tool already understands, with
 * its top row blocked so each column holds six. Gravity then needs nothing
 * new - a column whose six squares are full has only the blocked one left, so
 * it simply stops being a landing - and the boards the renderer crops are the
 * only place the seventh row shows.
 */
export const CONNECT4_SIZE = 7;

export function connect4Blocked(config: GameConfig): number[] {
  return Array.from({ length: config.size }, (_, col) => col);
}

export const connect4Variant = lineVariant({
  id: 'connect4',
  name: 'Connect Four',
  misere: false,
  gravity: true,
  supports: { openings: ['swap'] },
  validate: (config) => config.size === CONNECT4_SIZE && config.winLength === 4,
  blocked: connect4Blocked,
});

/**
 * Five in a row around obstacles: a handful of squares, placed from the game's
 * seed, that nobody can play on and no line can pass through.
 */
export const obstaclesVariant = lineVariant({
  id: 'obstacles',
  name: 'Obstacles',
  misere: false,
  gravity: false,
  supports: { seeded: true },
  validate: (config) => config.size >= 7 && config.size <= 11 && config.winLength === 5,
  blocked: obstacleCells,
});
