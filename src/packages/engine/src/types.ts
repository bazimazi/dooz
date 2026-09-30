/** A mark on the board. `Empty` is 0 so a fresh board is just a zero-filled array. */
export const Empty = 0;
export const X = 1;
export const O = 2;

export type Player = typeof X | typeof O;
export type Cell = typeof Empty | Player;

/** Row-major flat board. `board[row * size + col]`. */
export type Board = Cell[];

/**
 * Board sizes the rules are defined for.
 *
 * The lower bound is the classic grid; the upper bound is a gomoku board. Above
 * 15 the win-window tables the evaluation builds stop being cheap enough to keep
 * per size, and nothing about the game gets better.
 */
export const MIN_BOARD_SIZE = 3;
export const MAX_BOARD_SIZE = 15;

/**
 * Marks in a row needed to win.
 *
 * Three is the classic rule. Six is the ceiling because a longer run on any
 * board this size is either unreachable or drawn by construction, and the win
 * tables are sized against it.
 */
export const MIN_WIN_LENGTH = 3;
export const MAX_WIN_LENGTH = 6;

/**
 * The rule sets the game ships with.
 *
 * `classic` and `gomoku` share one implementation - they differ only in the
 * board and run length a mode picks - and are kept apart because a player
 * choosing between them is choosing between two games, not two numbers.
 * `misere` inverts who a completed line belongs to. `gravity` drops every mark
 * to the lowest free square of its column. `vanish` keeps only each player's
 * three newest marks on the board, which it can derive from the move list.
 * `ultimate` is the only one with state beyond the board and the moves.
 */
export const VARIANT_IDS = [
  'classic',
  'gomoku',
  'misere',
  'gravity',
  'vanish',
  'ultimate',
] as const;
export type VariantId = (typeof VARIANT_IDS)[number];

/**
 * Everything the rules need to run a game.
 *
 * This travels with the state rather than being looked up from a table, so a
 * recorded game replays under the rules it was played under even if the mode
 * list later changes.
 */
export interface GameConfig {
  readonly variant: VariantId;
  readonly size: number;
  readonly winLength: number;
}

export type GameStatus = 'playing' | 'won' | 'draw';

/** The winning run, as flat cell indices, ordered from one end of the line to the other. */
export type WinLine = readonly number[];

/**
 * The extra state an Ultimate game carries.
 *
 * The 81 cells live on the ordinary flat board; what Ultimate adds is a result
 * per sub-board and the constraint on where the next mark may go. `activeBoard`
 * is `null` when the sub-board the last move pointed at is already finished, in
 * which case the mover may play anywhere.
 */
export interface UltimateMeta {
  /** Winner of each of the nine sub-boards, `Empty` while undecided. */
  readonly boards: readonly Cell[];
  /** Sub-boards that filled up with no winner. Parallel to `boards`. */
  readonly drawn: readonly boolean[];
  /** Sub-board the mover is confined to, or `null` for a free move. */
  readonly activeBoard: number | null;
  /** The three sub-boards that won it, once someone has. */
  readonly winBoards: WinLine | null;
}

export interface GameState {
  readonly config: GameConfig;
  readonly board: Board;
  /** Whose turn it is. Meaningless once `status` is not `playing`. */
  readonly currentPlayer: Player;
  readonly status: GameStatus;
  /** Set only when `status === 'won'`. */
  readonly winner: Player | null;
  /**
   * The run that ended the game, in board cells. Set whenever a line was
   * completed - including in misere, where completing it is what loses.
   */
  readonly winLine: WinLine | null;
  /** Flat index of the most recent move, or `null` on a fresh board. */
  readonly lastMove: number | null;
  /** Every move played so far, oldest first. Enables replay and undo. */
  readonly moves: readonly number[];
  /** Set on Ultimate games and `null` on every other variant. */
  readonly ultimate: UltimateMeta | null;
}

export function opponentOf(player: Player): Player {
  return player === X ? O : X;
}

export function isPlayer(value: unknown): value is Player {
  return value === X || value === O;
}

export function isVariantId(value: unknown): value is VariantId {
  return typeof value === 'string' && (VARIANT_IDS as readonly string[]).includes(value);
}

/** Narrows a board size from untrusted input - a URL parameter, a stored preference. */
export function isBoardSize(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_BOARD_SIZE &&
    value <= MAX_BOARD_SIZE
  );
}

/**
 * Whether `config` describes a game the rules can actually run.
 *
 * A run longer than the board can never be completed, so such a game would be
 * drawn from the first move - and Ultimate is defined on one board only. Both
 * are rejected here rather than producing a game nobody can win.
 */
export function isGameConfig(value: unknown): value is GameConfig {
  if (typeof value !== 'object' || value === null) return false;
  const { variant, size, winLength } = value as Partial<GameConfig>;

  if (!isVariantId(variant) || !isBoardSize(size)) return false;
  if (
    typeof winLength !== 'number' ||
    !Number.isInteger(winLength) ||
    winLength < MIN_WIN_LENGTH ||
    winLength > MAX_WIN_LENGTH ||
    winLength > size
  ) {
    return false;
  }

  // Ultimate is nine 3x3 boards and nothing else: the sub-board geometry is
  // what the variant *is*, so there is no other size it could mean.
  if (variant === 'ultimate') return size === 9 && winLength === 3;

  // Vanish caps each player at three marks, so it is only a game where three is
  // also the run - and the board it is solved on is the one it is played on.
  if (variant === 'vanish') return size === 3 && winLength === 3;

  // A column needs room to stack a run in it, or gravity is just a smaller board.
  if (variant === 'gravity') return size >= 4;

  return true;
}

/** Total cells on the board `config` describes. */
export function cellCount(config: GameConfig): number {
  return config.size * config.size;
}

/** A stable string for a config, used to key queues, ratings and statistics. */
export function configKey(config: GameConfig): string {
  return `${config.variant}:${config.size}:${config.winLength}`;
}

export function sameConfig(a: GameConfig, b: GameConfig): boolean {
  return a.variant === b.variant && a.size === b.size && a.winLength === b.winLength;
}
