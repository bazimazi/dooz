import { colOf, rowOf } from '../board.js';
import { swapMove } from '../config.js';
import { type GameState, isMark } from '../types.js';
import type { BotDifficulty } from './difficulty.js';

/**
 * How the bot handles the pie rule.
 *
 * Under `swap` the second player may take the opening mark as their own, so
 * the first mark is a proposal rather than a move: open too strongly and it is
 * taken, too weakly and it is left to rot. Both halves are judged by one
 * measure - how far the mark is from the strong squares - because that is what
 * actually decides how much the first mark is worth on these boards: the
 * centre on a square board, and the middle column under gravity, where a disc
 * in it is known to win Connect Four for whoever owns it.
 */

/** Whether the variant drops marks down columns, so only the column matters. */
function dropsMarks(state: GameState): boolean {
  return state.config.variant === 'gravity' || state.config.variant === 'connect4';
}

/**
 * Squares (Chebyshev, or columns under gravity) from the middle within which an
 * opening mark is too strong to leave with the opener.
 */
function strongReach(state: GameState): number {
  if (dropsMarks(state)) return 0;
  const { size } = state.config;
  return size <= 3 ? 0 : Math.max(1, Math.floor(size / 5));
}

function distanceFromMiddle(state: GameState, cell: number): number {
  const { size } = state.config;
  const mid = (size - 1) / 2;
  const cols = Math.abs(colOf(size, cell) - mid);
  if (dropsMarks(state)) return Math.floor(cols);
  return Math.floor(Math.max(Math.abs(rowOf(size, cell) - mid), cols));
}

/**
 * The bot's move when the swap rule is in play and the opening is still on,
 * or `null` to play the position normally.
 *
 * - Second move: swap when the opening mark is on a strong square. The
 *   beginner never thinks of it.
 * - First move: from medium up, open just outside the strong zone, which is
 *   the opening a swap leaves least to gain from. The weaker levels open in the
 *   middle and live with having it taken.
 */
export function swapOpeningMove(
  state: GameState,
  legal: readonly number[],
  difficulty: BotDifficulty,
  random: () => number,
): number | null {
  const code = swapMove(state.config);
  if (code === null) return null;

  if (state.moves.length === 1 && legal.includes(code) && state.lastMove !== null) {
    if (difficulty === 'beginner') return null;
    return distanceFromMiddle(state, state.lastMove) <= strongReach(state) ? code : null;
  }

  if (state.moves.length === 0 && state.board.every((cell) => !isMark(cell))) {
    if (difficulty === 'beginner' || difficulty === 'easy') return null;
    const ring = strongReach(state) + 1;
    const options = legal.filter(
      (move) => move !== code && distanceFromMiddle(state, move) === ring,
    );
    if (options.length === 0) return null;
    return options[Math.min(options.length - 1, Math.floor(random() * options.length))]!;
  }

  return null;
}
