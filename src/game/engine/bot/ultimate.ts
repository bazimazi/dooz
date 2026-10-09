import { ultimateBoardOf, ultimateCellOf, ultimateCells } from '../board.js';
import { Empty, type GameState, O, type Player, X } from '../types.js';
import { TRIPLES } from '../variants/index.js';
import { EVAL_CAP } from './evaluate.js';
import { slot, zobristFor } from './zobrist.js';

/**
 * Ultimate needs its own search because it has state the flat board does not
 * carry: a result per sub-board, and the constraint on where the next mark may
 * go. Running it through the generic immutable `applyMove` would allocate three
 * arrays per node, which at a few hundred thousand nodes a move is the entire
 * cost of the search.
 *
 * So the position is mutable and moves are taken back rather than rebuilt, with
 * an undo record per ply holding the two things a move can change besides the
 * cell itself.
 */

const FREE = -1;

interface Undo {
  index: number;
  board: number;
  wonBefore: number;
  drawnBefore: number;
  activeBefore: number;
}

/**
 * How much each sub-board is worth holding.
 *
 * The meta board is itself a 3x3 game, so the centre sits on four winning lines
 * and each corner on three, while the edges sit on two. Winning the middle
 * board is worth noticeably more than winning an edge one, and a search that
 * does not know this trades them evenly.
 */
const BOARD_WEIGHT = [1.4, 1, 1.4, 1, 1.75, 1, 1.4, 1, 1.4];

/** Cell value inside a single 3x3 board, on the same reasoning. */
const CELL_WEIGHT = [1.2, 0.8, 1.2, 0.8, 1.6, 0.8, 1.2, 0.8, 1.2];

/** Winning a sub-board outright, before the meta-board lines are counted. */
const BOARD_WON = 220;
/** Two of a meta-board line, with the third still available. */
const META_PAIR = 900;
const META_SINGLE = 70;
/** In-board pairs and singles, which are what decide the sub-boards. */
const SUB_PAIR = 16;
const SUB_SINGLE = 3;
/**
 * Handing the opponent a free choice of board is a real concession - it is the
 * commonest way a weak Ultimate player loses - so it is priced rather than
 * ignored.
 */
const FREEDOM_PENALTY = 34;

export class UltimatePosition {
  readonly cells: Int8Array;
  readonly boards: Int8Array;
  readonly drawn: Uint8Array;
  active: number;
  toMove: Player;
  winner: number;
  settled: boolean;

  primary: number;
  secondary: number;

  private readonly undos: Undo[] = [];

  constructor(state: GameState) {
    const meta = state.ultimate;
    this.cells = Int8Array.from(state.board);
    this.boards = Int8Array.from(meta?.boards ?? Array.from({ length: 9 }, () => Empty));
    this.drawn = Uint8Array.from(
      (meta?.drawn ?? Array.from({ length: 9 }, () => false)).map(Number),
    );
    this.active = meta?.activeBoard ?? FREE;
    this.toMove = state.currentPlayer;
    this.winner = state.winner ?? Empty;
    this.settled = state.status !== 'playing';

    const zobrist = zobristFor(81);
    let primary = 0;
    let secondary = 0;
    for (let index = 0; index < 81; index++) {
      const cell = this.cells[index] ?? Empty;
      if (cell === Empty) continue;
      const key = slot(index, cell as Player);
      primary ^= zobrist.primary[key] ?? 0;
      secondary ^= zobrist.secondary[key] ?? 0;
    }
    if (this.toMove === O) {
      primary ^= zobrist.sidePrimary;
      secondary ^= zobrist.sideSecondary;
    }
    // The board a player is confined to is part of the position: two identical
    // grids with different active boards are different games, and sharing a
    // table entry between them would hand one the other's score.
    const aux = this.active + 1;
    primary ^= zobrist.auxPrimary[aux] ?? 0;
    secondary ^= zobrist.auxSecondary[aux] ?? 0;

    this.primary = primary;
    this.secondary = secondary;
  }

  isPlayable(board: number): boolean {
    return this.boards[board] === Empty && this.drawn[board] === 0;
  }

  moves(): number[] {
    if (this.settled) return [];
    const list: number[] = [];
    const boards = this.active === FREE ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [this.active];
    for (const board of boards) {
      if (!this.isPlayable(board)) continue;
      for (const cell of ultimateCells(board)) {
        if (this.cells[cell] === Empty) list.push(cell);
      }
    }
    return list;
  }

  play(index: number): void {
    const player = this.toMove;
    const board = ultimateBoardOf(index);
    const undo: Undo = {
      index,
      board,
      wonBefore: this.boards[board] ?? Empty,
      drawnBefore: this.drawn[board] ?? 0,
      activeBefore: this.active,
    };
    this.undos.push(undo);

    this.cells[index] = player;
    this.xorCell(index, player);

    const cells = ultimateCells(board);
    if (this.boards[board] === Empty) {
      if (tripleAt(this.cells, cells, player)) this.boards[board] = player;
      else if (cells.every((cell) => this.cells[cell] !== Empty)) this.drawn[board] = 1;
    }

    if (this.boards[board] === player && metaTriple(this.boards, player)) {
      this.winner = player;
      this.settled = true;
    } else if (this.allSettled()) {
      this.settled = true;
    }

    const target = ultimateCellOf(index);
    const nextActive = this.isPlayable(target) ? target : FREE;
    this.xorActive(this.active, nextActive);
    this.active = nextActive;

    this.toMove = player === X ? O : X;
    this.xorSide();
  }

  unplay(): void {
    const undo = this.undos.pop();
    if (!undo) return;

    const player = this.toMove === X ? O : X;
    this.xorSide();
    this.toMove = player;

    this.xorActive(this.active, undo.activeBefore);
    this.active = undo.activeBefore;

    this.boards[undo.board] = undo.wonBefore;
    this.drawn[undo.board] = undo.drawnBefore;
    this.winner = Empty;
    this.settled = false;

    this.cells[undo.index] = Empty;
    this.xorCell(undo.index, player);
  }

  private allSettled(): boolean {
    for (let board = 0; board < 9; board++) {
      if (this.isPlayable(board)) return false;
    }
    return true;
  }

  private xorCell(index: number, player: Player): void {
    const zobrist = zobristFor(81);
    const key = slot(index, player);
    this.primary ^= zobrist.primary[key] ?? 0;
    this.secondary ^= zobrist.secondary[key] ?? 0;
  }

  private xorSide(): void {
    const zobrist = zobristFor(81);
    this.primary ^= zobrist.sidePrimary;
    this.secondary ^= zobrist.sideSecondary;
  }

  private xorActive(from: number, to: number): void {
    if (from === to) return;
    const zobrist = zobristFor(81);
    this.primary ^= (zobrist.auxPrimary[from + 1] ?? 0) ^ (zobrist.auxPrimary[to + 1] ?? 0);
    this.secondary ^= (zobrist.auxSecondary[from + 1] ?? 0) ^ (zobrist.auxSecondary[to + 1] ?? 0);
  }
}

function tripleAt(cells: Int8Array, indices: readonly number[], player: Player): boolean {
  for (const [a, b, c] of TRIPLES) {
    if (
      cells[indices[a] ?? 0] === player &&
      cells[indices[b] ?? 0] === player &&
      cells[indices[c] ?? 0] === player
    ) {
      return true;
    }
  }
  return false;
}

function metaTriple(boards: Int8Array, player: Player): boolean {
  for (const [a, b, c] of TRIPLES) {
    if (boards[a] === player && boards[b] === player && boards[c] === player) return true;
  }
  return false;
}

/**
 * Static score of an Ultimate position from `player`'s point of view.
 *
 * Three layers, in the order they decide games: lines on the meta board, which
 * is what actually wins; sub-boards held, weighted by where they sit; and the
 * shape inside the sub-boards still in play. The freedom term at the end is the
 * tempo cost of letting the opponent choose their own board.
 */
export function evaluateUltimate(position: UltimatePosition, player: Player): number {
  const rival = player === X ? O : X;
  let score = 0;

  for (let board = 0; board < 9; board++) {
    const owner = position.boards[board];
    if (owner === player) score += BOARD_WON * (BOARD_WEIGHT[board] ?? 1);
    else if (owner === rival) score -= BOARD_WON * (BOARD_WEIGHT[board] ?? 1);
  }

  for (const [a, b, c] of TRIPLES) {
    let mine = 0;
    let theirs = 0;
    let dead = false;
    for (const board of [a, b, c]) {
      const owner = position.boards[board];
      if (owner === player) mine++;
      else if (owner === rival) theirs++;
      // A drawn board kills the line for both sides, exactly as a rival's does.
      else if (position.drawn[board] === 1) dead = true;
    }
    if (dead) continue;
    if (mine > 0 && theirs > 0) continue;
    if (mine === 2) score += META_PAIR;
    else if (mine === 1) score += META_SINGLE;
    else if (theirs === 2) score -= META_PAIR;
    else if (theirs === 1) score -= META_SINGLE;
  }

  for (let board = 0; board < 9; board++) {
    if (!position.isPlayable(board)) continue;
    const weight = BOARD_WEIGHT[board] ?? 1;
    const cells = ultimateCells(board);

    for (const [a, b, c] of TRIPLES) {
      let mine = 0;
      let theirs = 0;
      for (const at of [a, b, c]) {
        const value = position.cells[cells[at] ?? 0];
        if (value === player) mine++;
        else if (value === rival) theirs++;
      }
      if (mine > 0 && theirs > 0) continue;
      if (mine === 2) score += SUB_PAIR * weight;
      else if (mine === 1) score += SUB_SINGLE * weight;
      else if (theirs === 2) score -= SUB_PAIR * weight;
      else if (theirs === 1) score -= SUB_SINGLE * weight;
    }

    for (let at = 0; at < 9; at++) {
      const value = position.cells[cells[at] ?? 0];
      const cellValue = (CELL_WEIGHT[at] ?? 1) * weight;
      if (value === player) score += cellValue;
      else if (value === rival) score -= cellValue;
    }
  }

  if (position.active === FREE) {
    // Whoever is to move has the free choice, so it is worth something to them.
    score += position.toMove === player ? FREEDOM_PENALTY : -FREEDOM_PENALTY;
  }

  const total = Math.round(score);
  // Same reason as the line evaluation: a static score must never stray into
  // the band the search reads as a proven win.
  return total > EVAL_CAP ? EVAL_CAP : total < -EVAL_CAP ? -EVAL_CAP : total;
}
