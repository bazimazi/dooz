import { type Board, Empty, type Player, opponentOf } from '../types.js';
import { forEachWindowOf, windowTable, type WindowTable } from './windows.js';

export const WIN_SCORE = 1_000_000;

/**
 * Ceiling on a static evaluation, well below the mate band.
 *
 * The search treats anything past `WIN_SCORE - 1000` as a proven result and
 * stops deepening on it. A position with enough live threads on it sums past
 * that on its own - eight saturated windows on a 3x3 board is already over a
 * million - and the search then "proves" a win that is only a guess, stops
 * early, and plays the guess. Clamping here is what keeps the two scales apart.
 */
export const EVAL_CAP = 400_000;

/**
 * What a partly-filled win-window is worth.
 *
 * Two tables, not one, because how many of a run's ends are still open matters
 * as much as how long it is. A closed three can be answered at leisure; an open
 * three has to be blocked this move or it becomes an open four, and an open
 * four cannot be blocked at all. Scoring both the same is what makes a naive
 * evaluation build long dead runs into a wall.
 *
 * The jumps are steeply superlinear so one real threat outranks any number of
 * scattered marks, and `OPEN[winLength - 1]` is deliberately larger than two
 * `CLOSED[winLength - 1]`s: an unstoppable threat is worth more than two
 * stoppable ones.
 */
const CLOSED = [0, 1, 12, 90, 1_600, 20_000, 60_000];
const OPEN = [0, 3, 45, 620, 28_000, 90_000, 200_000];

/**
 * Positional weight per cell: the centre is worth more than the rim.
 *
 * On a big board this is the only thing separating the opening moves, all of
 * which are otherwise tied at zero. It is small enough never to outweigh a real
 * threat.
 */
const centreCache = new Map<number, Float64Array>();

function centreWeights(size: number): Float64Array {
  const cached = centreCache.get(size);
  if (cached) return cached;

  const weights = new Float64Array(size * size);
  const middle = (size - 1) / 2;
  // Zero at the corners, `size` at the centre, falling off with Chebyshev
  // distance - which matches how lines actually reach across a square board.
  const span = middle === 0 ? 1 : middle;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const distance = Math.max(Math.abs(row - middle), Math.abs(col - middle));
      weights[row * size + col] = (1 - distance / span) * 4;
    }
  }
  centreCache.set(size, weights);
  return weights;
}

function windowScore(own: number, open: number, winLength: number): number {
  if (own >= winLength) return WIN_SCORE;
  // One open end is worth something between the two tables; a run that can only
  // grow one way is still live, just half as promising.
  if (open === 2) return OPEN[own] ?? 0;
  if (open === 1) return Math.round(((OPEN[own] ?? 0) + (CLOSED[own] ?? 0)) / 2);
  return CLOSED[own] ?? 0;
}

/**
 * Static score of `board` from `player`'s point of view.
 *
 * Attack and defence are evaluated independently and then combined, with the
 * opponent's threats weighted slightly higher than our own: the side to move
 * gets a tempo, so a threat we have not yet answered is more dangerous than one
 * we have not yet made.
 */
export function evaluate(board: Board, size: number, player: Player, winLength: number): number {
  const table = windowTable(size, winLength);
  const rival = opponentOf(player);
  const { cells, count } = table;

  let mine = 0;
  let theirs = 0;

  for (let w = 0; w < count; w++) {
    const base = w * winLength;
    let own = 0;
    let other = 0;

    for (let k = 0; k < winLength; k++) {
      const value = board[cells[base + k] ?? 0];
      if (value === Empty) continue;
      if (value === player) own++;
      else other++;
    }

    // A window holding both marks is dead ground: neither side can ever
    // complete it, so it is worth exactly nothing to either of them.
    if (own > 0 && other > 0) continue;
    if (own === 0 && other === 0) continue;

    // An end is open when it is on the board and either free or already ours:
    // a flank held by the other side closes the run exactly as the board edge
    // does, while one of our own marks lets it keep growing through.
    const occupant = own > 0 ? player : rival;
    const open = openEnds(board, table, w, occupant);

    const score = windowScore(own > 0 ? own : other, open, winLength);
    if (own > 0) mine += score;
    else theirs += score;
  }

  const weights = centreWeights(size);
  for (let cell = 0; cell < board.length; cell++) {
    const value = board[cell];
    if (value === player) mine += weights[cell] ?? 0;
    else if (value === rival) theirs += weights[cell] ?? 0;
  }

  const score = Math.round(mine - theirs * 1.08);
  return score > EVAL_CAP ? EVAL_CAP : score < -EVAL_CAP ? -EVAL_CAP : score;
}

/**
 * Cheap ordering score for playing `index`.
 *
 * Alpha-beta prunes far more when strong moves are tried first, but running the
 * full evaluation on every candidate would cost more than it saves. This looks
 * only at the windows the cell belongs to, and adds the value of the threat it
 * would create to the value of the opposing threat it would deny - so attacking
 * and blocking moves both float to the front.
 */
export function moveHeuristic(
  board: Board,
  size: number,
  index: number,
  player: Player,
  winLength: number,
): number {
  const table = windowTable(size, winLength);
  const rival = opponentOf(player);
  let score = (centreWeights(size)[index] ?? 0) * 2;

  forEachWindowOf(table, index, (w) => {
    const base = w * winLength;
    let own = 0;
    let other = 0;
    for (let k = 0; k < winLength; k++) {
      const value = board[table.cells[base + k] ?? 0];
      if (value === Empty) continue;
      if (value === player) own++;
      else other++;
    }

    const open = openEnds(board, table, w, own > 0 ? player : rival);

    // Building: what this window becomes worth once the mark lands in it.
    if (other === 0) score += gain(own, open, winLength);
    // Blocking: what the opponent loses when this window stops being theirs.
    if (own === 0 && other > 0) score += windowScore(other, open, winLength);
  });

  return score;
}

function openEnds(board: Board, table: WindowTable, w: number, occupant: Player): number {
  const before = table.flanks[w * 2] ?? -1;
  const after = table.flanks[w * 2 + 1] ?? -1;
  let open = 0;
  if (before >= 0 && (board[before] === Empty || board[before] === occupant)) open++;
  if (after >= 0 && (board[after] === Empty || board[after] === occupant)) open++;
  return open;
}

function gain(own: number, open: number, winLength: number): number {
  const from = windowScore(own, open, winLength);
  const to = windowScore(Math.min(own + 1, winLength), open, winLength);
  return to - from;
}
