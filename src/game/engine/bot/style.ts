import { configKey } from '../config.js';
import { type Board, Empty, type GameConfig, isMark, type Player } from '../types.js';
import { forEachWindowOf, windowTable } from './windows.js';

/**
 * How a bot likes to play, as opposed to how well.
 *
 * A difficulty decides strength: how far the bot looks, which tactics it may
 * use, how close to the best move it insists on. A style decides taste - which
 * of the moves that strength allows it actually picks. Two bots of the same
 * level with different styles are equally hard to beat and feel nothing alike:
 * one walls off every line you start, the other ignores you to build its own.
 *
 * A style never makes a level stronger or weaker on purpose, and never touches
 * the guarantees every level shares. The win on the board and the block of a
 * loss are taken before a style is consulted; a forced win is never traded for
 * a prettier move; a level with no slack only ever lets its style choose
 * between moves its search scored exactly the same. Where a level already
 * picks freely inside a score window, the style decides which of them it
 * prefers instead of a coin.
 *
 * Plain data, so it can cross into the bot worker with the rest of the options.
 */
export interface BotStyle {
  /** Weight on building its own lines. 1 is neutral. */
  readonly attack?: number;
  /**
   * Weight on spoiling the opponent's lines, in move choice and in the
   * evaluation the search runs - the share of the opponent's threats it
   * subtracts from its own. 1 is neutral.
   */
  readonly defence?: number;
  /** Pull towards the centre when positive, out to the rim when negative. */
  readonly centre?: number;
  /**
   * Appetite for traps: a bonus for moves that bring several lines to one
   * short of complete at once, the shape a double threat is built from.
   */
  readonly traps?: number;
  /**
   * Chance, 0 to 1, of answering a move with its mirror image through the
   * centre when that square is one the level would play anyway. A copycat.
   */
  readonly mirror?: number;
  /**
   * Preferred first moves, keyed by {@link configKey}. Used while the bot has
   * yet to place a mark, and only when the move is one its level allows.
   */
  readonly book?: Readonly<Record<string, readonly number[]>>;
  /**
   * How long the bot appears to think, as a multiple of the usual pause. Read
   * by the interface only; the search's own budget is the difficulty's.
   */
  readonly tempo?: number;
}

/** What a style adds to a move's appeal for a book move, larger than any shape. */
const BOOK_BONUS = 1_000;

/**
 * Appeal of a building window by how many of the mover's marks it already
 * holds. Steep, so extending a three outranks starting a new one.
 */
const SHAPE = [0.4, 2, 6, 18, 48, 120, 240];

/** Whether a style asks for anything at all - an empty one changes nothing. */
export function hasStyle(style: BotStyle | undefined): style is BotStyle {
  return (
    style !== undefined &&
    (style.attack !== undefined ||
      style.defence !== undefined ||
      style.centre !== undefined ||
      style.traps !== undefined ||
      style.mirror !== undefined ||
      style.book !== undefined)
  );
}

/** The opening moves a style prefers under `config`, if it has any. */
export function bookMoves(style: BotStyle | undefined, config: GameConfig): readonly number[] {
  return style?.book?.[configKey(config)] ?? [];
}

/** Whether `player` has yet to place a mark - the only time the book is read. */
export function isOpening(board: Board, player: Player): boolean {
  return !board.includes(player);
}

/**
 * How much `style` likes `move` for `player`, on a scale where a few points
 * separate two otherwise similar moves.
 *
 * Reads only the win-windows through the square, the same ones the move
 * ordering reads, and splits them into what the mark builds and what it
 * spoils, so a builder and a blocker can weigh the same square differently.
 */
export function styleAppeal(
  board: Board,
  config: GameConfig,
  move: number,
  player: Player,
  style: BotStyle,
): number {
  const { size, winLength } = config;
  let appeal = 0;

  if (style.centre) {
    const middle = (size - 1) / 2;
    const row = Math.floor(move / size);
    const col = move % size;
    const distance = Math.max(Math.abs(row - middle), Math.abs(col - middle));
    // 1 at the centre, 0 on the rim.
    appeal += style.centre * (1 - distance / (middle || 1)) * 6;
  }

  if (isOpening(board, player) && bookMoves(style, config).includes(move)) appeal += BOOK_BONUS;

  const attack = style.attack ?? 1;
  const defence = style.defence ?? 1;
  const traps = style.traps ?? 0;
  if (attack === 1 && defence === 1 && traps === 0) return appeal;
  // Ultimate's lines live inside its small boards, and its windows would read
  // runs straight across them; its style is the centre and the book alone.
  if (config.variant === 'ultimate' || size * size !== board.length) return appeal;

  const table = windowTable(size, winLength);
  let build = 0;
  let spoil = 0;
  let nearlyDone = 0;
  forEachWindowOf(table, move, (w) => {
    let own = 0;
    let other = 0;
    let blocked = false;
    for (let k = 0; k < winLength; k++) {
      const value = board[table.cells[w * winLength + k] ?? 0];
      if (value === Empty || value === undefined) continue;
      if (value === player) own++;
      else if (isMark(value)) other++;
      else blocked = true;
    }
    if (blocked) return;
    if (other === 0) {
      build += SHAPE[own] ?? 0;
      if (own + 1 === winLength - 1) nearlyDone++;
    } else if (own === 0) {
      spoil += SHAPE[other] ?? 0;
    }
  });

  appeal += build * (attack - 1) + spoil * (defence - 1);
  // One line a move short of complete is a threat; two at once is the start of
  // a fork, which is what a trap-setter is looking for.
  if (traps > 0 && nearlyDone > 0) appeal += traps * (nearlyDone - 1) * 14 + traps * 2;
  return appeal;
}

/**
 * The square opposite `cell` through the centre of a `size` board - or, with
 * `sideways`, across the middle column only, which is the mirror a board
 * that marks fall down can still play.
 */
export function mirrorOf(cell: number, size: number, sideways = false): number {
  if (!sideways) return size * size - 1 - cell;
  const row = Math.floor(cell / size);
  return row * size + (size - 1 - (cell % size));
}

/**
 * The move a styled level picks from moves it considers equally acceptable.
 *
 * The highest appeal wins, with a little noise so a style is a leaning rather
 * than a script - a player should recognise the bot, not predict it.
 */
export function pickByStyle(
  moves: readonly number[],
  appeal: (move: number) => number,
  random: () => number,
  noise = 4,
): number | null {
  let best: number | null = null;
  let bestValue = Number.NEGATIVE_INFINITY;
  for (const move of moves) {
    const value = appeal(move) + random() * noise;
    if (value > bestValue) {
      bestValue = value;
      best = move;
    }
  }
  return best;
}
