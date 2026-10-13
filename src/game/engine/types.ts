/** A mark on the board. `Empty` is 0 so a fresh board is just a zero-filled array. */
export const Empty = 0;
export const X = 1;
export const O = 2;
/**
 * A square nobody can play on or own: an obstacle, or a square outside a
 * board's real shape (Connect Four's 7x6 grid is a 7x7 board with its top row
 * blocked). It is never empty and never a player's, so it breaks every line
 * through it.
 */
export const Blocked = 3;

export type Player = typeof X | typeof O;
export type Cell = typeof Empty | Player | typeof Blocked;

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
  'pente',
  'qubic',
  'quantum',
  'connect4',
  'wild',
  'order-chaos',
  'obstacles',
  'powers',
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
  /**
   * Only a run of exactly `winLength` wins; a longer one (an overline) does
   * not. Standard gomoku's rule. Absent means any run of at least that length.
   */
  readonly exact?: boolean;
  /**
   * An opening rule that offsets the first player's advantage.
   *
   * - `pro`: the opener's first mark goes in the centre and their second at
   *   least three squares away from it.
   * - `swap`: the pie rule. After the first mark the second player may play
   *   {@link SWAP_MOVE} and take that mark as their own, which hands the turn
   *   back to the opener.
   */
  readonly opening?: OpeningRule;
  /**
   * Seed for anything a variant randomises when the game is created, such as
   * where obstacles go. Part of the config so a replay rebuilds the same board,
   * but not of the mode's identity: `configKey` and `sameConfig` ignore it.
   * Only seeded variants accept one, and they read an absent seed as 0.
   */
  readonly seed?: number;
}

export const OPENING_RULES = ['pro', 'swap'] as const;
export type OpeningRule = (typeof OPENING_RULES)[number];

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
  /**
   * State some other rule sets carry beyond the board, such as Pente's capture
   * counts. Absent on the variants that need none. Like everything else in the
   * state it is derived from the config and the moves, so a replay rebuilds it.
   */
  readonly extra?: VariantExtra;
}

/**
 * Per-variant extra state, keyed by the variant that owns it so a reader can
 * narrow on `kind`. Variants add their own member to this union.
 */
export type VariantExtra = { readonly kind: 'none' } | PenteExtra | QuantumExtra | PowersExtra;

/**
 * Pente's captures.
 *
 * `captures` is indexed by player - `captures[0]` is the pairs X has taken,
 * `captures[1]` O's - because five of them win the game as surely as five in a
 * row. `captured` is the squares the most recent move emptied, so a board can
 * see the stones off rather than have them blink out.
 */
export interface PenteExtra {
  readonly kind: 'pente';
  readonly captures: readonly [number, number];
  readonly captured: readonly number[];
}

/**
 * One quantum mark: a mark in two squares at once until a measurement settles
 * it in one of them.
 *
 * `move` is its subscript - the 1-based ply that placed it - which is both how
 * the board labels it and how simultaneous lines are scored.
 */
export interface QuantumMark {
  readonly player: Player;
  readonly move: number;
  /** The two squares it is spread across, lower first. */
  readonly cells: readonly [number, number];
  /** The square it collapsed into, or `null` while it is still spooky. */
  readonly at: number | null;
}

/**
 * Quantum tic-tac-toe's state beyond the classical board.
 *
 * `board` holds only the collapsed (classical) marks; every spooky mark lives
 * here. `pending` is set when the last move closed a cycle of entanglement: it
 * is the index in `marks` of the mark that closed it, and the player to move
 * must say which of its two squares it collapses into before doing anything
 * else. `cycle` lists the squares of that cycle, for drawing it.
 */
export interface QuantumExtra {
  readonly kind: 'quantum';
  readonly marks: readonly QuantumMark[];
  readonly pending: number | null;
  readonly cycle: readonly number[] | null;
  /** Per square, the subscript of the classical mark there, or `null`. */
  readonly classical: readonly (number | null)[];
  /** The squares that collapsed on the most recent move, for the reveal. */
  readonly collapsed: readonly number[];
}

export function opponentOf(player: Player): Player {
  return player === X ? O : X;
}

/** Whether `cell` holds a player's mark, as opposed to being empty or blocked. */
export function isMark(cell: Cell | undefined): cell is Player {
  return cell === X || cell === O;
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

/** One player's unused one-time powers in a Powers game. */
export interface PowerCharges {
  /** Removals of one opposing mark left. */
  readonly bomb: number;
  /** Walls - empty squares turned permanently blocked - left. */
  readonly wall: number;
}

/**
 * Powers' state beyond the board: what each player has left to spend.
 *
 * Derivable from the moves like everything else - a power is its own move code
 * - but carried so the board and the bot do not replay the game to read it.
 */
export interface PowersExtra {
  readonly kind: 'powers';
  readonly x: PowerCharges;
  readonly o: PowerCharges;
}
