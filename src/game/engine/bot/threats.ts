import { hasWinFrom } from '../rules.js';
import { type Board, Empty, type Player, opponentOf } from '../types.js';

/**
 * Tactics that do not need a search to find.
 *
 * Everything here is decided by looking one or two plies ahead with certainty
 * rather than by scoring a position, which is what makes it safe to act on
 * before the search runs: a bot that has not started thinking yet must still
 * never walk past a win on the board, and a bot whose clock ran out must still
 * have something sound to play.
 *
 * All of these place marks on the caller's board and take them back again.
 * Nothing can observe the board in between - there is no await and no callback
 * out - and the alternative is a fresh copy per candidate, which on a 15x15
 * board is the single most expensive thing the AI would do.
 */

/** Whether `player` completes a run by playing `index`. */
export function completesLine(
  board: Board,
  size: number,
  index: number,
  player: Player,
  winLength: number,
): boolean {
  if (board[index] !== Empty) return false;
  board[index] = player;
  const won = hasWinFrom(board, size, index, winLength);
  board[index] = Empty;
  return won;
}

/** The first move from `candidates` that completes a run for `player`, if any. */
export function findImmediateWin(
  board: Board,
  size: number,
  player: Player,
  winLength: number,
  candidates: readonly number[],
): number | null {
  for (const move of candidates) {
    if (completesLine(board, size, move, player, winLength)) return move;
  }
  return null;
}

/**
 * Every move that would complete a run for `player`, up to `limit`.
 *
 * The limit exists because the only question ever asked of this is "is there
 * more than one?", and stopping at two saves scanning the rest of the board.
 */
export function winningMoves(
  board: Board,
  size: number,
  player: Player,
  winLength: number,
  candidates: readonly number[],
  limit = Number.POSITIVE_INFINITY,
): number[] {
  const found: number[] = [];
  for (const move of candidates) {
    if (!completesLine(board, size, move, player, winLength)) continue;
    found.push(move);
    if (found.length >= limit) break;
  }
  return found;
}

/**
 * A move that leaves `player` with two ways to win at once.
 *
 * A genuine double threat is a forced win and can be played on sight: the
 * opponent has at most one move, so whichever threat they answer the other one
 * finishes the game next turn. It is only sound because the caller has already
 * established that the opponent has no win of their own this move - otherwise
 * they simply take it and never have to deal with either threat.
 */
export function findForkMove(
  board: Board,
  size: number,
  player: Player,
  winLength: number,
  candidates: readonly number[],
): number | null {
  for (const move of candidates) {
    if (board[move] !== Empty) continue;
    board[move] = player;
    // Playing the fork must not itself be a win - that case is handled before
    // this one is ever called - and a move that wins outright is not a fork.
    const threats = winningMoves(board, size, player, winLength, candidates, 2).length;
    board[move] = Empty;
    if (threats >= 2) return move;
  }
  return null;
}

/**
 * A move that stops `rival` from forking next turn.
 *
 * Preference order, which is the order these actually work in: a move that
 * creates a threat of our own forces a reply and buys the tempo back, so it is
 * tried first; failing that, any move that simply leaves the opponent with no
 * double threat. Returns `null` when there is no such move, which means the
 * position is lost and the caller should fall back to its usual search rather
 * than pretending otherwise.
 */
export function findForkDefence(
  board: Board,
  size: number,
  player: Player,
  winLength: number,
  candidates: readonly number[],
): number | null {
  const rival = opponentOf(player);
  let quiet: number | null = null;

  for (const move of candidates) {
    if (board[move] !== Empty) continue;
    board[move] = player;

    const forcing = winningMoves(board, size, player, winLength, candidates, 1).length > 0;
    const stillForks = findForkMove(board, size, rival, winLength, candidates) !== null;
    board[move] = Empty;

    if (stillForks) continue;
    if (forcing) return move;
    quiet ??= move;
  }

  return quiet;
}
