/** A mark on the board. `Empty` is 0 so a fresh board is just a zero-filled array. */
export const Empty = 0;
export const X = 1;
export const O = 2;

export type Player = typeof X | typeof O;
export type Cell = typeof Empty | Player;

/** Board sizes the game ships with. Each has its own win length (see `WIN_LENGTH`). */
export const BOARD_SIZES = [3, 6, 9] as const;
export type BoardSize = (typeof BOARD_SIZES)[number];

/**
 * Number of marks in a row needed to win, per board size.
 * 3x3 keeps the classic full-row rule; larger boards would be unplayable
 * (and always drawn) if a win required filling an entire line.
 */
export const WIN_LENGTH: Record<BoardSize, number> = { 3: 3, 6: 4, 9: 5 };

/** Row-major flat board. `board[row * size + col]`. */
export type Board = Cell[];

export type GameStatus = 'playing' | 'won' | 'draw';

/** The winning run, as flat cell indices, ordered from one end of the line to the other. */
export type WinLine = readonly number[];

export interface GameState {
  readonly size: BoardSize;
  readonly board: Board;
  /** Whose turn it is. Meaningless once `status` is not `playing`. */
  readonly currentPlayer: Player;
  readonly status: GameStatus;
  /** Set only when `status === 'won'`. */
  readonly winner: Player | null;
  /** Set only when `status === 'won'`. */
  readonly winLine: WinLine | null;
  /** Flat index of the most recent move, or `null` on a fresh board. */
  readonly lastMove: number | null;
  /** Every move played so far, oldest first. Enables replay and undo. */
  readonly moves: readonly number[];
}

export function opponentOf(player: Player): Player {
  return player === X ? O : X;
}

export function isBoardSize(value: unknown): value is BoardSize {
  return BOARD_SIZES.includes(value as BoardSize);
}
