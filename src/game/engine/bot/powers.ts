import { emptyIndices } from '../board.js';
import { Empty, type GameState, opponentOf, type Player } from '../types.js';
import { powerCharges } from '../variants/powers.js';
import { candidateMoves } from './candidates.js';
import type { BotDifficulty } from './difficulty.js';
import { findImmediateWin, winningMoves } from './threats.js';

/**
 * When the bot spends a power.
 *
 * Powers is five in a row with two one-time actions, so the bot plays it with
 * the line search and asks this first whether the moment for a power has come.
 * Only the bomb ever earns it, and only at the two moments where it changes the
 * result rather than the position:
 *
 * - **Rescue.** The opponent has two ways to win and a mark can only block
 *   one. Lifting a mark that both threats rely on - the middle of an open four
 *   - answers both at once.
 * - **Breakthrough.** Lifting a mark that blocks the bot's own line leaves it
 *   two ways to win, and the opponent has no bomb left to take one back.
 *
 * The wall is never better for the bot than its own mark on the same square:
 * it blocks exactly as well and builds nothing. It exists for players.
 */

export interface PowerTactic {
  readonly move: number;
  readonly reason: 'block' | 'fork';
}

/** The power move worth playing now, or `null` to play a mark as normal. */
export function powerTactic(state: GameState, difficulty: BotDifficulty): PowerTactic | null {
  if (difficulty === 'beginner') return null;
  const { board, config } = state;
  const { size, winLength } = config;
  const cells = board.length;
  const me = state.currentPlayer;
  const rival = opponentOf(me);
  if (powerCharges(state, me).bomb <= 0) return null;

  const working = board.slice();
  const near = () => candidateMoves(working, size, 1);

  // Never a power while a mark simply wins.
  if (findImmediateWin(working, size, me, winLength, near()) !== null) return null;

  const theirWins = winningMoves(working, size, rival, winLength, near(), 2);
  const targets = marksOf(working, rival);

  if (theirWins.length >= 2) {
    for (const target of targets) {
      working[target] = Empty;
      const left = winningMoves(working, size, rival, winLength, near(), 1).length;
      working[target] = rival;
      if (left === 0) return { move: target + cells, reason: 'block' };
    }
    return null;
  }

  // A breakthrough only works on an opponent who cannot answer it in kind,
  // and only for the levels that look for forks at all.
  if (difficulty === 'easy' || theirWins.length > 0 || powerCharges(state, rival).bomb > 0) {
    return null;
  }
  for (const target of targets) {
    working[target] = Empty;
    const mine = winningMoves(working, size, me, winLength, emptyIndices(working), 2).length;
    const theirs = winningMoves(working, size, rival, winLength, near(), 1).length;
    working[target] = rival;
    if (mine >= 2 && theirs === 0) return { move: target + cells, reason: 'fork' };
  }
  return null;
}

function marksOf(board: GameState['board'], player: Player): number[] {
  const marks: number[] = [];
  for (let cell = 0; cell < board.length; cell++) if (board[cell] === player) marks.push(cell);
  return marks;
}
