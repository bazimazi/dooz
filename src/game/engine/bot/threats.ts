import { hasWinFrom } from '../rules.js';
import { Blocked, type Board, Empty, type Player, opponentOf } from '../types.js';

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
  exact = false,
): boolean {
  if (board[index] !== Empty) return false;
  board[index] = player;
  const won = hasWinFrom(board, size, index, winLength, exact);
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
  exact = false,
): number | null {
  for (const move of candidates) {
    if (completesLine(board, size, move, player, winLength, exact)) return move;
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
  exact = false,
): number[] {
  const found: number[] = [];
  for (const move of candidates) {
    if (!completesLine(board, size, move, player, winLength, exact)) continue;
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
  exact = false,
): number | null {
  const listed = new Set(candidates);
  for (const move of candidates) {
    if (board[move] !== Empty) continue;
    board[move] = player;
    // Playing the fork must not itself be a win - that case is handled before
    // this one is ever called - and a move that wins outright is not a fork.
    const threats = threatsAfter(
      board,
      size,
      player,
      winLength,
      candidates,
      listed,
      move,
      2,
      exact,
    );
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
  exact = false,
): number | null {
  const rival = opponentOf(player);
  const listed = new Set(candidates);
  let quiet: number | null = null;

  for (const move of candidates) {
    if (board[move] !== Empty) continue;
    board[move] = player;

    const forcing =
      threatsAfter(board, size, player, winLength, candidates, listed, move, 1, exact) > 0;
    const stillForks = findForkMove(board, size, rival, winLength, candidates, exact) !== null;
    board[move] = Empty;

    if (stillForks) continue;
    if (forcing) return move;
    quiet ??= move;
  }

  return quiet;
}

/** The four line directions, as row and column steps. */
const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const;

/**
 * How many winning squares `player` has once `move` is on the board, up to
 * `limit`.
 *
 * The candidate list was drawn up before `move` was played, so it can miss a
 * square that only the new mark is near - and that is exactly where the new
 * mark's threat tends to be: extending a pair to an open three on a 6x6 board
 * puts the winning square two steps from the old marks. Threats the move did
 * not create are counted from the candidates as before; one it did create runs
 * through it, so the squares on its lines are the only ones to add.
 */
function threatsAfter(
  board: Board,
  size: number,
  player: Player,
  winLength: number,
  candidates: readonly number[],
  listed: ReadonlySet<number>,
  move: number,
  limit: number,
  exact = false,
): number {
  let found = winningMoves(board, size, player, winLength, candidates, limit, exact).length;
  if (found >= limit) return found;

  const rival = opponentOf(player);
  const row = Math.floor(move / size);
  const col = move % size;
  for (const [dr, dc] of DIRECTIONS) {
    for (const sign of [-1, 1]) {
      for (let step = 1; step < winLength; step++) {
        const r = row + dr * step * sign;
        const c = col + dc * step * sign;
        if (r < 0 || r >= size || c < 0 || c >= size) break;
        const cell = r * size + c;
        // A rival mark or a blocked square ends every line through `move` in
        // this direction.
        if (board[cell] === rival || board[cell] === Blocked) break;
        if (listed.has(cell) || !completesLine(board, size, cell, player, winLength, exact)) {
          continue;
        }
        if (++found >= limit) return found;
      }
    }
  }
  return found;
}
