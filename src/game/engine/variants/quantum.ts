import { createBoard } from '../board.js';
import {
  type Board,
  Empty,
  type GameConfig,
  type GameState,
  isMark,
  opponentOf,
  type Player,
  type QuantumExtra,
  type QuantumMark,
  type WinLine,
} from '../types.js';
import { TRIPLES } from './ultimate.js';
import type { Variant } from './variant.js';

/**
 * Quantum tic-tac-toe, as Allan Goff defined it.
 *
 * Every move places one *spooky* mark in two different squares at once, joined
 * by an entanglement. Spooky marks pile up, and the squares they join form a
 * graph. The moment a move closes a cycle in that graph the marks on it can no
 * longer all be in superposition: the cycle is *measured*, and every mark on it
 * - and every mark hanging off it - collapses into one of its two squares,
 * becoming an ordinary (classical) mark that owns that square for good. The
 * player who did NOT close the cycle decides which of the two ways it falls, by
 * choosing which square the cycle-closing mark lands in; everything else
 * follows from that one choice.
 *
 * Each mark carries a subscript: the move that placed it. When a collapse
 * completes lines for both players at once, the line whose newest mark is
 * older - the lower maximum subscript - wins. (Goff scores that as one point
 * against half a point; a single game here has one winner, so it goes to the
 * player who would have scored the full point. Subscripts are unique, so the
 * tie-break is always decisive.) A player who completes two lines at once still
 * just wins.
 *
 * ## Move codes
 *
 * Turn order must alternate strictly - the engine derives the opener from the
 * move count - so the collapse choice is not a move of its own. It is made by
 * the player to move as the first half of their move, and the second half is
 * what they do on the board it leaves behind. A move is therefore a pair:
 *
 * - The follow-up `f`, in `[0, 91)`: a spooky mark across squares `a < b` is
 *   `a * 9 + b`; a classical mark on square `c` (the ninth mark, when a single
 *   square is left) is `81 + c`; and `90` is "nothing", allowed only when the
 *   collapse itself ended the game.
 * - With no collapse pending the code is `f`. With one pending it is
 *   `91 * (1 + choice) + f`, where `choice` 0 lands the cycle-closing mark in
 *   its lower square and 1 in its higher.
 *
 * So `moveSpace` is 273. `lastMove` is a square, as for every rule set: the
 * higher square of a spooky mark, the square of a classical one, or - when a
 * collapse ended the game - the square the chooser picked.
 */

const CELLS = 9;
/** Codes per collapse choice: 81 spooky pairs (most unused), 9 classical, 1 nothing. */
export const QUANTUM_FOLLOW_UPS = 91;
const CLASSICAL_BASE = 81;
export const QUANTUM_NOTHING = 90;
export const QUANTUM_MOVE_SPACE = QUANTUM_FOLLOW_UPS * 3;

/** A quantum move, decoded. */
export interface QuantumMove {
  /** Which square the pending cycle-closing mark lands in, or `null` with nothing pending. */
  readonly collapse: 0 | 1 | null;
  readonly follow:
    | { readonly kind: 'spooky'; readonly cells: readonly [number, number] }
    | { readonly kind: 'classical'; readonly cell: number }
    | { readonly kind: 'nothing' };
}

/** Encode a move. `cells` of a spooky mark may come in either order. */
export function encodeQuantumMove(move: QuantumMove): number {
  let follow: number;
  if (move.follow.kind === 'spooky') {
    const [a, b] = move.follow.cells;
    follow = Math.min(a, b) * CELLS + Math.max(a, b);
  } else if (move.follow.kind === 'classical') {
    follow = CLASSICAL_BASE + move.follow.cell;
  } else {
    follow = QUANTUM_NOTHING;
  }
  return move.collapse === null ? follow : QUANTUM_FOLLOW_UPS * (1 + move.collapse) + follow;
}

/** Decode a move code, or `null` if it is not well formed (legality aside). */
export function decodeQuantumMove(code: number): QuantumMove | null {
  if (!Number.isInteger(code) || code < 0 || code >= QUANTUM_MOVE_SPACE) return null;
  const group = Math.floor(code / QUANTUM_FOLLOW_UPS);
  const follow = code % QUANTUM_FOLLOW_UPS;
  const collapse = group === 0 ? null : group === 1 ? 0 : 1;

  if (follow < CLASSICAL_BASE) {
    const a = Math.floor(follow / CELLS);
    const b = follow % CELLS;
    if (a >= b) return null;
    return { collapse, follow: { kind: 'spooky', cells: [a, b] } };
  }
  if (follow < QUANTUM_NOTHING) {
    return { collapse, follow: { kind: 'classical', cell: follow - CLASSICAL_BASE } };
  }
  return { collapse, follow: { kind: 'nothing' } };
}

const EMPTY_EXTRA: QuantumExtra = {
  kind: 'quantum',
  marks: [],
  pending: null,
  cycle: null,
  classical: Array.from({ length: CELLS }, () => null),
  collapsed: [],
};

/** The quantum state of `state`, or a fresh one for a state that has none. */
export function quantumOf(state: GameState): QuantumExtra {
  return state.extra?.kind === 'quantum' ? state.extra : EMPTY_EXTRA;
}

function create(config: GameConfig, startingPlayer: Player): GameState {
  return {
    config,
    board: createBoard(config.size),
    currentPlayer: startingPlayer,
    status: 'playing',
    winner: null,
    winLine: null,
    lastMove: null,
    moves: [],
    ultimate: null,
    extra: EMPTY_EXTRA,
  };
}

/** Goff's game is defined on the classic board and nowhere else. */
function validate(config: GameConfig): boolean {
  return config.size === 3 && config.winLength === 3;
}

/** A board, its marks and their subscripts, mid-move. Mutable; never escapes a move. */
interface Working {
  board: Board;
  marks: QuantumMark[];
  classical: (number | null)[];
  collapsed: number[];
}

/** How a measurement left the game. */
type Verdict =
  | { readonly kind: 'won'; readonly winner: Player; readonly line: WinLine }
  | { readonly kind: 'draw' }
  | null;

/**
 * Collapse the pending mark into its `choice` square, and everything entangled
 * with it after it.
 *
 * A mark settling in a square forces every other spooky mark in that square to
 * its other square, which forces the marks there, and so on through the whole
 * connected piece of the graph. A piece holding exactly one cycle has as many
 * marks as squares, so each square ends up with exactly one.
 */
function measure(working: Working, pending: number, choice: 0 | 1): void {
  const queue: [number, number][] = [[pending, working.marks[pending]!.cells[choice]]];
  while (queue.length > 0) {
    const [index, cell] = queue.shift()!;
    const mark = working.marks[index]!;
    if (mark.at !== null || working.board[cell] !== Empty) continue;
    working.marks[index] = { ...mark, at: cell };
    working.board[cell] = mark.player;
    working.classical[cell] = mark.move;
    working.collapsed.push(cell);
    working.marks.forEach((other, at) => {
      if (at === index || other.at !== null) return;
      if (other.cells[0] === cell) queue.push([at, other.cells[1]]);
      else if (other.cells[1] === cell) queue.push([at, other.cells[0]]);
    });
  }
}

/**
 * Whether the classical board has been decided.
 *
 * Every completed line is scored by the subscript of its newest mark, and the
 * oldest such line wins - Goff's rule for simultaneous lines, made decisive.
 */
function verdictOf(board: Board, classical: readonly (number | null)[]): Verdict {
  let best: { winner: Player; line: WinLine; age: number } | null = null;
  for (const line of TRIPLES) {
    const owner = board[line[0]];
    if (!isMark(owner)) continue;
    if (!line.every((cell) => board[cell] === owner)) continue;
    const age = Math.max(...line.map((cell) => classical[cell] ?? 0));
    if (!best || age < best.age) best = { winner: owner, line, age };
  }
  if (best) return { kind: 'won', winner: best.winner, line: best.line };
  return freeSquares(board).length === 0 ? { kind: 'draw' } : null;
}

/** Squares without a classical mark. Spooky marks do not occupy a square. */
function freeSquares(board: Board): number[] {
  const free: number[] = [];
  for (let cell = 0; cell < CELLS; cell++) if (board[cell] === Empty) free.push(cell);
  return free;
}

/**
 * The squares of the cycle the newest mark closed, walking the entanglement
 * graph from one of its squares to the other without using that mark.
 */
function cycleThrough(marks: readonly QuantumMark[], closing: number): number[] {
  const [from, to] = marks[closing]!.cells;
  const previous = new Map<number, number>([[from, -1]]);
  const queue = [from];
  while (queue.length > 0) {
    const cell = queue.shift()!;
    if (cell === to) break;
    marks.forEach((mark, at) => {
      if (at === closing || mark.at !== null) return;
      const [a, b] = mark.cells;
      const next = a === cell ? b : b === cell ? a : null;
      if (next !== null && !previous.has(next)) {
        previous.set(next, cell);
        queue.push(next);
      }
    });
  }
  const path: number[] = [];
  for (let cell: number | undefined = to; cell !== undefined && cell !== -1;) {
    path.push(cell);
    cell = previous.get(cell);
  }
  return path.toReversed();
}

/** Whether squares `a` and `b` are already joined through spooky marks. */
function connected(marks: readonly QuantumMark[], a: number, b: number): boolean {
  const parent = Array.from({ length: CELLS }, (_, cell) => cell);
  const find = (cell: number): number => {
    while (parent[cell] !== cell) cell = parent[cell] = parent[parent[cell]!]!;
    return cell;
  };
  for (const mark of marks) {
    if (mark.at !== null) continue;
    parent[find(mark.cells[0])] = find(mark.cells[1]);
  }
  return find(a) === find(b);
}

/**
 * The state after `code`, or `null` if it is not legal.
 *
 * Shared by `apply` and `canPlay` - the only way to know whether a follow-up is
 * allowed is to know what the collapse before it leaves.
 */
function play(state: GameState, code: number): GameState | null {
  if (state.status !== 'playing') return null;
  const move = decodeQuantumMove(code);
  if (!move) return null;

  const quantum = quantumOf(state);
  const mover = state.currentPlayer;
  if ((quantum.pending === null) !== (move.collapse === null)) return null;

  const working: Working = {
    board: state.board.slice(),
    marks: quantum.marks.slice(),
    classical: quantum.classical.slice(),
    collapsed: [],
  };

  let verdict: Verdict = null;
  if (quantum.pending !== null && move.collapse !== null) {
    measure(working, quantum.pending, move.collapse);
    verdict = verdictOf(working.board, working.classical);
  }

  const free = freeSquares(working.board);
  const ply = state.moves.length + 1;
  let lastMove: number;

  // What the follow-up may be is decided by what the collapse left: nothing
  // once the game is over, the last square when only one is left, and a
  // spooky pair otherwise.
  if (verdict) {
    if (move.follow.kind !== 'nothing') return null;
    lastMove = working.marks[quantum.pending!]!.cells[move.collapse!];
  } else if (move.follow.kind === 'nothing') {
    return null;
  } else if (free.length === 1) {
    if (move.follow.kind !== 'classical' || move.follow.cell !== free[0]) return null;
    const cell = move.follow.cell;
    working.marks.push({ player: mover, move: ply, cells: [cell, cell], at: cell });
    working.board[cell] = mover;
    working.classical[cell] = ply;
    working.collapsed.push(cell);
    verdict = verdictOf(working.board, working.classical);
    lastMove = cell;
  } else {
    if (move.follow.kind !== 'spooky') return null;
    const [a, b] = move.follow.cells;
    if (working.board[a] !== Empty || working.board[b] !== Empty) return null;
    working.marks.push({ player: mover, move: ply, cells: [a, b], at: null });
    lastMove = b;
  }

  // A spooky mark that joins two squares already joined closes a cycle, and
  // the opponent must measure it on their move.
  let pending: number | null = null;
  let cycle: number[] | null = null;
  if (!verdict && move.follow.kind === 'spooky') {
    const closing = working.marks.length - 1;
    const [a, b] = move.follow.cells;
    if (connected(working.marks.slice(0, closing), a, b)) {
      pending = closing;
      cycle = cycleThrough(working.marks, closing);
    }
  }

  const extra: QuantumExtra = {
    kind: 'quantum',
    marks: working.marks,
    pending,
    cycle,
    classical: working.classical,
    collapsed: working.collapsed,
  };
  const moves = [...state.moves, code];
  const base = { ...state, board: working.board, lastMove, moves, extra };

  if (verdict?.kind === 'won') {
    return { ...base, status: 'won', winner: verdict.winner, winLine: verdict.line };
  }
  if (verdict?.kind === 'draw') {
    return { ...base, status: 'draw', winner: null, winLine: null };
  }
  return { ...base, currentPlayer: opponentOf(mover) };
}

function canPlay(state: GameState, code: number): boolean {
  return play(state, code) !== null;
}

/**
 * Every legal code, ascending.
 *
 * At most 72: two ways to collapse, times 36 pairs of squares. Small enough to
 * enumerate by trying each candidate against the rules themselves.
 */
function legalMoves(state: GameState): number[] {
  if (state.status !== 'playing') return [];
  const quantum = quantumOf(state);
  const groups = quantum.pending === null ? [0] : [1, 2];
  const legal: number[] = [];
  for (const group of groups) {
    for (let follow = 0; follow < QUANTUM_FOLLOW_UPS; follow++) {
      const code = group * QUANTUM_FOLLOW_UPS + follow;
      // Cheap shape checks first; the full rules only for codes that pass.
      if (follow < CLASSICAL_BASE && Math.floor(follow / CELLS) >= follow % CELLS) continue;
      if (play(state, code)) legal.push(code);
    }
  }
  return legal;
}

/**
 * The follow-ups open to the player to move once `choice` has been measured:
 * whether the collapse ends the game, which squares are left, and the codes
 * that go with each. What the board needs to walk a player through the two
 * halves of a move.
 */
export function quantumOptions(
  state: GameState,
  choice: 0 | 1 | null,
): { ends: boolean; free: number[]; preview: GameState | null } {
  const quantum = quantumOf(state);
  if (state.status !== 'playing' || (quantum.pending === null) !== (choice === null)) {
    return { ends: false, free: [], preview: null };
  }
  const working: Working = {
    board: state.board.slice(),
    marks: quantum.marks.slice(),
    classical: quantum.classical.slice(),
    collapsed: [],
  };
  if (quantum.pending !== null && choice !== null) measure(working, quantum.pending, choice);
  const ends = verdictOf(working.board, working.classical) !== null;
  const preview: GameState = {
    ...state,
    board: working.board,
    extra: {
      ...quantum,
      marks: working.marks,
      classical: working.classical,
      collapsed: working.collapsed,
      pending: null,
      cycle: null,
    },
  };
  return { ends, free: ends ? [] : freeSquares(working.board), preview };
}

export const quantumVariant: Variant = {
  id: 'quantum',
  name: 'Quantum',
  validate,
  moveSpace: () => QUANTUM_MOVE_SPACE,
  create,
  canPlay,
  legalMoves,
  apply: play,
};
