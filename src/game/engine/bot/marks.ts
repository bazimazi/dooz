import { hasWinFrom } from '../rules.js';
import { type Board, Empty, type GameState, O, opponentOf, type Player, X } from '../types.js';
import { CHAOS, MARK_CHOICES, ORDER } from '../variants/marks.js';
import type { BotDifficulty } from './difficulty.js';
import { profileFor } from './difficulty.js';
import { WIN_SCORE } from './evaluate.js';
import type { RootScore } from './search.js';
import { windowTable } from './windows.js';
import { slot, zobristFor } from './zobrist.js';

/**
 * The AI for the rule sets where the mover chooses the mark: Wild and Order
 * and Chaos.
 *
 * The line search cannot play these. It assumes a mark belongs to whoever
 * placed it, scores a window by whose marks are in it, and generates one move
 * per square - and here a mark belongs to nobody, a window matters by whether
 * its marks agree, and every square is two moves. So these share a smaller
 * search of their own: iterative-deepening negamax with a transposition table
 * and exact root scores, over a board of at most 36 squares, with each rule
 * set supplying how a quiet position is scored and how its moves are ordered.
 *
 * Wild's 3x3 board is small enough that the strong levels search it to the
 * end - every result they report is proven - and the 4x4 board is close to it.
 */

const MATE_THRESHOLD = WIN_SCORE - 1000;
const EXACT = 0;
const LOWER_BOUND = 1;
const UPPER_BOUND = 2;

interface Entry {
  secondary: number;
  depth: number;
  score: number;
  flag: number;
}

interface MarkRules {
  /** Who a completed line wins for, given who completed it. */
  lineWinner(mover: Player): Player;
  /** Who takes a full board with no line, or `null` for a draw. */
  readonly fullWinner: Player | null;
  /**
   * Score of a position the search stops at, from `toMove`'s side. May return
   * a proven result when the position's outcome is already certain.
   */
  leaf(board: Board, toMove: Player, ply: number, empties: number): number;
  /** Ordering score for `toMove` placing `mark` on `cell`, already played on `board`. */
  order(board: Board, cell: number, mark: Player, toMove: Player): number;
}

export interface MarkSearchOptions {
  readonly maxDepth: number;
  readonly deadline: number;
  readonly now?: () => number;
  readonly shouldStop?: () => boolean;
}

export interface MarkSearchResult {
  readonly rootScores: readonly RootScore[];
  readonly depth: number;
  readonly nodes: number;
}

/** Plies each level may look ahead. Wild 3x3 is nine plies long in all. */
const MARK_DEPTH: Record<BotDifficulty, number> = {
  beginner: 1,
  easy: 2,
  medium: 3,
  hard: 6,
  expert: 10,
  master: 40,
};

/**
 * Score window, on the rule sets' own scales, within which a level picks any
 * root move. Proven losses are never in it and a proven win is never passed up.
 */
const MARK_SLACK: Record<BotDifficulty, number> = {
  beginner: Number.POSITIVE_INFINITY,
  easy: 60,
  medium: 12,
  hard: 0,
  expert: 0,
  master: 0,
};

/** Searches `state` under `rules`, scoring every root move exactly. */
function searchMarks(
  state: GameState,
  rules: MarkRules,
  options: MarkSearchOptions,
): MarkSearchResult {
  const { size, winLength } = state.config;
  const cells = state.board.length;
  const now = options.now ?? Date.now;
  const working = state.board.slice();
  const table = zobristFor(cells);
  const transpositions = new Map<number, Entry>();
  let empties = working.filter((cell) => cell === Empty).length;

  let primary = 0;
  let secondary = 0;
  for (let cell = 0; cell < cells; cell++) {
    const mark = working[cell];
    if (mark !== X && mark !== O) continue;
    primary ^= table.primary[slot(cell, mark)] ?? 0;
    secondary ^= table.secondary[slot(cell, mark)] ?? 0;
  }
  if (state.currentPlayer === O) {
    primary ^= table.sidePrimary;
    secondary ^= table.sideSecondary;
  }

  let nodes = 0;
  let aborted = false;
  const outOfTime = () => {
    if ((nodes & 0xff) === 0 && (now() >= options.deadline || options.shouldStop?.() === true)) {
      aborted = true;
    }
    return aborted;
  };

  const toggle = (cell: number, mark: Player) => {
    primary ^= (table.primary[slot(cell, mark)] ?? 0) ^ table.sidePrimary;
    secondary ^= (table.secondary[slot(cell, mark)] ?? 0) ^ table.sideSecondary;
  };

  /** Every move for `toMove`, best-looking first. */
  const movesFor = (toMove: Player): number[] => {
    const moves: number[] = [];
    const scores = new Map<number, number>();
    for (let choice = 0; choice < MARK_CHOICES.length; choice++) {
      const mark = MARK_CHOICES[choice]!;
      for (let cell = 0; cell < cells; cell++) {
        if (working[cell] !== Empty) continue;
        const move = cell + cells * choice;
        working[cell] = mark;
        scores.set(move, rules.order(working, cell, mark, toMove));
        working[cell] = Empty;
        moves.push(move);
      }
    }
    return moves.toSorted((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0));
  };

  /** The score of `toMove` playing `move`, from `toMove`'s side. */
  const scoreMove = (
    move: number,
    ply: number,
    depth: number,
    alpha: number,
    beta: number,
    toMove: Player,
  ): number => {
    const cell = move % cells;
    const mark = move < cells ? X : O;
    working[cell] = mark;
    empties--;
    toggle(cell, mark);

    let score: number;
    if (hasWinFrom(working, size, cell, winLength)) {
      score = rules.lineWinner(toMove) === toMove ? WIN_SCORE - ply - 1 : -(WIN_SCORE - ply - 1);
    } else if (empties === 0) {
      const winner = rules.fullWinner;
      score =
        winner === null ? 0 : winner === toMove ? WIN_SCORE - ply - 1 : -(WIN_SCORE - ply - 1);
    } else {
      score = -negamax(ply + 1, depth - 1, -beta, -alpha, opponentOf(toMove));
    }

    toggle(cell, mark);
    empties++;
    working[cell] = Empty;
    return score;
  };

  const negamax = (
    ply: number,
    depth: number,
    alphaIn: number,
    betaIn: number,
    toMove: Player,
  ): number => {
    nodes++;
    if (depth <= 0 || outOfTime()) return rules.leaf(working, toMove, ply, empties);

    let alpha = alphaIn;
    let beta = betaIn;
    const stored = transpositions.get(primary);
    if (stored && stored.secondary === secondary && stored.depth >= depth) {
      const score = fromEntry(stored.score, ply);
      if (stored.flag === EXACT) return score;
      if (stored.flag === LOWER_BOUND && score > alpha) alpha = score;
      else if (stored.flag === UPPER_BOUND && score < beta) beta = score;
      if (alpha >= beta) return score;
    }

    let best = Number.NEGATIVE_INFINITY;
    for (const move of movesFor(toMove)) {
      const score = scoreMove(move, ply, depth, alpha, beta, toMove);
      if (aborted) return best === Number.NEGATIVE_INFINITY ? score : best;
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }

    const flag = best <= alphaIn ? UPPER_BOUND : best >= betaIn ? LOWER_BOUND : EXACT;
    transpositions.set(primary, { secondary, depth, score: toEntry(best, ply), flag });
    return best;
  };

  const me = state.currentPlayer;
  const rootMoves = movesFor(me);
  let rootScores: RootScore[] = rootMoves.map((move) => ({ move, score: 0 }));
  let completed = 0;

  for (let depth = 1; depth <= Math.min(options.maxDepth, empties); depth++) {
    const scored: RootScore[] = [];
    for (const move of rootMoves) {
      const score = scoreMove(
        move,
        0,
        depth,
        Number.NEGATIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        me,
      );
      if (aborted) break;
      scored.push({ move, score });
    }
    if (aborted) {
      // A partial pass cannot stand beside a complete one, but a proof holds
      // at any depth.
      const proven = new Map(
        scored.filter((entry) => Math.abs(entry.score) >= MATE_THRESHOLD).map((e) => [e.move, e]),
      );
      rootScores = rootScores.map((entry) => proven.get(entry.move) ?? entry);
      break;
    }
    rootScores = scored;
    completed = depth;
    // Once every root move is proven, deeper passes can only repeat it.
    if (scored.every((entry) => Math.abs(entry.score) >= MATE_THRESHOLD)) break;
    // Try the best of this pass first next time: it tightens the window sooner.
    rootMoves.sort(
      (a, b) =>
        (scored.find((entry) => entry.move === b)?.score ?? 0) -
        (scored.find((entry) => entry.move === a)?.score ?? 0),
    );
  }

  return { rootScores, depth: completed, nodes };
}

const toEntry = (score: number, ply: number): number =>
  score >= MATE_THRESHOLD ? score + ply : score <= -MATE_THRESHOLD ? score - ply : score;
const fromEntry = (score: number, ply: number): number =>
  score >= MATE_THRESHOLD ? score - ply : score <= -MATE_THRESHOLD ? score + ply : score;

// ---------------------------------------------------------------------------
// Window bookkeeping shared by both rule sets
// ---------------------------------------------------------------------------

/**
 * The squares that would complete a line right now, with which mark does it:
 * bit 1 for an X, bit 2 for an O. A line of identical marks one short with its
 * last square free is the only kind of threat these games have.
 */
function completions(board: Board, size: number, winLength: number): Map<number, number> {
  const table = windowTable(size, winLength);
  const found = new Map<number, number>();
  for (let w = 0; w < table.count; w++) {
    let xs = 0;
    let os = 0;
    let gap = -1;
    for (let k = 0; k < winLength; k++) {
      const cell = table.cells[w * winLength + k] ?? 0;
      const value = board[cell];
      if (value === X) xs++;
      else if (value === O) os++;
      else if (value === Empty) gap = cell;
    }
    if (gap < 0 || xs + os !== winLength - 1) continue;
    if (xs === winLength - 1) found.set(gap, (found.get(gap) ?? 0) | 1);
    else if (os === winLength - 1) found.set(gap, (found.get(gap) ?? 0) | 2);
  }
  return found;
}

/** Live windows through `cell` - holding one kind of mark or none - and their counts. */
function forWindowsThrough(
  board: Board,
  size: number,
  winLength: number,
  cell: number,
  visit: (xs: number, os: number) => void,
): void {
  const table = windowTable(size, winLength);
  const start = table.byCellStart[cell] ?? 0;
  const end = table.byCellStart[cell + 1] ?? start;
  for (let i = start; i < end; i++) {
    const w = table.byCellIndex[i] ?? 0;
    let xs = 0;
    let os = 0;
    for (let k = 0; k < winLength; k++) {
      const value = board[table.cells[w * winLength + k] ?? 0];
      if (value === X) xs++;
      else if (value === O) os++;
    }
    visit(xs, os);
  }
}

// ---------------------------------------------------------------------------
// Wild
// ---------------------------------------------------------------------------

function wildRules(size: number, winLength: number): MarkRules {
  return {
    lineWinner: (mover) => mover,
    fullWinner: null,
    // Any line one short is a win for whoever moves next, whichever mark it
    // is made of - so a position is decided the moment one exists.
    leaf: (board, _toMove, ply) =>
      completions(board, size, winLength).size > 0 ? WIN_SCORE - ply - 1 : 0,
    order: (board, cell) => {
      let score = 0;
      forWindowsThrough(board, size, winLength, cell, (xs, os) => {
        if (xs === winLength || os === winLength) score += 1_000_000;
        // One short after this mark: a gift to the opponent.
        else if ((xs === 0 || os === 0) && xs + os === winLength - 1) score -= 1_000;
        // Spoiling a line - both marks in it - takes it off the board for good.
        else if (xs > 0 && os > 0) score += 4;
      });
      return score;
    },
  };
}

// ---------------------------------------------------------------------------
// Order and Chaos
// ---------------------------------------------------------------------------

/** What a live window is worth to Order, by how many identical marks it holds. */
const ORDER_VALUE = [1, 4, 18, 80, 400, 0];

function orderChaosRules(size: number, winLength: number): MarkRules {
  const table = windowTable(size, winLength);

  /** Order's view of a quiet position: the sum over windows still alive. */
  const orderScore = (board: Board): { score: number; live: number } => {
    let score = 0;
    let live = 0;
    for (let w = 0; w < table.count; w++) {
      let xs = 0;
      let os = 0;
      for (let k = 0; k < winLength; k++) {
        const value = board[table.cells[w * winLength + k] ?? 0];
        if (value === X) xs++;
        else if (value === O) os++;
      }
      if (xs > 0 && os > 0) continue;
      live++;
      score += ORDER_VALUE[xs + os] ?? 0;
    }
    return { score, live };
  };

  return {
    lineWinner: () => ORDER,
    fullWinner: CHAOS,
    leaf: (board, toMove, ply, empties) => {
      const threats = completions(board, size, winLength);
      // Order to move with a line one short simply completes it.
      if (toMove === ORDER && threats.size > 0) return WIN_SCORE - ply - 1;
      if (toMove === CHAOS) {
        // Chaos can spoil one square, with one mark. Two squares, or one that
        // either mark completes, cannot both be answered.
        let lost = threats.size >= 2;
        for (const marks of threats.values()) if (marks === 3) lost = true;
        if (lost) return -(WIN_SCORE - ply - 2);
      }

      const { score, live } = orderScore(board);
      // No window left that could ever hold five alike: the board will fill
      // without a line, which is Chaos's win, however long it takes.
      if (live === 0) {
        const proven = WIN_SCORE - ply - empties;
        return toMove === CHAOS ? proven : -proven;
      }
      return toMove === ORDER ? score : -score;
    },
    order: (board, cell, mark, toMove) => {
      // The change this mark made to Order's score, read off its own windows.
      let delta = 0;
      let line = false;
      forWindowsThrough(board, size, winLength, cell, (xs, os) => {
        if (xs === winLength || os === winLength) line = true;
        const xsBefore = mark === X ? xs - 1 : xs;
        const osBefore = mark === O ? os - 1 : os;
        const before = xsBefore > 0 && osBefore > 0 ? 0 : (ORDER_VALUE[xsBefore + osBefore] ?? 0);
        const after = xs > 0 && os > 0 ? 0 : (ORDER_VALUE[xs + os] ?? 0);
        delta += after - before;
      });
      if (line) return toMove === ORDER ? 1_000_000 : -1_000_000;
      return toMove === ORDER ? delta : -delta;
    },
  };
}

// ---------------------------------------------------------------------------
// Choosing
// ---------------------------------------------------------------------------

export interface MarkBotOptions {
  readonly difficulty: BotDifficulty;
  readonly timeBudgetMs?: number;
  readonly random: () => number;
  readonly now?: () => number;
  readonly shouldStop?: () => boolean;
}

export interface MarkBotMove {
  readonly move: number;
  readonly score: number;
  readonly depth: number;
  readonly nodes: number;
}

/** The move a level of `options.difficulty` plays in a Wild or Order and Chaos game. */
export function chooseMarkMove(state: GameState, options: MarkBotOptions): MarkBotMove | null {
  const { size, winLength, variant } = state.config;
  const rules =
    variant === 'order-chaos' ? orderChaosRules(size, winLength) : wildRules(size, winLength);
  const now = options.now ?? Date.now;
  const budget = options.timeBudgetMs ?? Math.max(120, profileFor(options.difficulty).timeMs);

  const result = searchMarks(state, rules, {
    maxDepth: MARK_DEPTH[options.difficulty],
    deadline: now() + budget,
    ...(options.now ? { now: options.now } : {}),
    ...(options.shouldStop ? { shouldStop: options.shouldStop } : {}),
  });
  if (result.rootScores.length === 0) return null;

  let best = Number.NEGATIVE_INFINITY;
  for (const entry of result.rootScores) if (entry.score > best) best = entry.score;

  // A forced win is always taken, and the strong levels pick among the best
  // alone. The others choose among the moves close enough to it - never a
  // proven loss while anything else is left.
  const slack = best >= MATE_THRESHOLD ? 0 : MARK_SLACK[options.difficulty];
  let pool = result.rootScores.filter(
    (entry) => entry.score >= best - slack && entry.score > -MATE_THRESHOLD,
  );
  if (pool.length === 0) pool = result.rootScores.filter((entry) => entry.score === best);

  const picked = pool[Math.min(pool.length - 1, Math.floor(options.random() * pool.length))]!;
  return { move: picked.move, score: picked.score, depth: result.depth, nodes: result.nodes };
}
