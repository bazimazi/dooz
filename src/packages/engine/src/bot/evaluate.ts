import { type Board, type BoardSize, Empty, type Player, WIN_LENGTH } from '../types.js';
import { windowsByCell, winWindows } from './windows.js';

/**
 * Value of owning `count` cells of a win-window with the rest still empty.
 *
 * Steeply superlinear so the AI prefers one strong threat over several weak
 * ones: three-in-a-row-with-room is worth far more than three scattered marks.
 * Index 0 is unused (an empty window is worth nothing to either side).
 */
const THREAT_VALUE = [0, 1, 14, 180, 2400, 32000];

export const WIN_SCORE = 1_000_000;

/**
 * Static score of `board` from `player`'s point of view.
 *
 * Only windows owned exclusively by one side count: a window holding both an X
 * and an O is dead ground and can never become a win, so it scores zero.
 */
export function evaluate(board: Board, size: BoardSize, player: Player): number {
  const need = WIN_LENGTH[size];
  let score = 0;

  for (const window of winWindows(size)) {
    let own = 0;
    let theirs = 0;

    for (const cell of window) {
      const value = board[cell];
      if (value === Empty) continue;
      if (value === player) own++;
      else theirs++;
    }

    if (own > 0 && theirs > 0) continue;
    if (own > 0) score += THREAT_VALUE[Math.min(own, need)] ?? 0;
    else if (theirs > 0) score -= THREAT_VALUE[Math.min(theirs, need)] ?? 0;
  }

  return score;
}

/**
 * Cheap ordering score for playing `index`.
 *
 * Alpha-beta prunes far more when strong moves are tried first, but running the
 * full evaluation on every candidate would cost more than it saves. This looks
 * only at the windows the cell belongs to, and adds the value of the threat it
 * creates to the value of the opposing threat it denies - so attacking and
 * blocking moves both float to the front.
 */
export function moveHeuristic(
  board: Board,
  size: BoardSize,
  index: number,
  player: Player,
): number {
  const need = WIN_LENGTH[size];
  let score = 0;

  for (const windowIndex of windowsByCell(size)[index] ?? []) {
    const window = winWindows(size)[windowIndex];
    if (!window) continue;

    let own = 0;
    let theirs = 0;
    for (const cell of window) {
      const value = board[cell];
      if (value === Empty) continue;
      if (value === player) own++;
      else theirs++;
    }

    if (theirs === 0) score += gain(own, need);
    if (own === 0) score += gain(theirs, need);
  }

  return score;
}

function gain(count: number, need: number): number {
  const from = THREAT_VALUE[Math.min(count, need)] ?? 0;
  const to = THREAT_VALUE[Math.min(count + 1, need)] ?? 0;
  return to - from;
}
