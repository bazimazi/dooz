import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { moveHeuristic } from '../src/bot/evaluate.js';
import { vanishQueues } from '../src/bot/index.js';
import {
  applyMove,
  type BotDifficulty,
  type Cell,
  chooseMove,
  createGame,
  DIRECTIONS,
  Empty,
  type GameConfig,
  type GameState,
  legalMoves,
  modeById,
  type ModeId,
  O,
  opponentOf,
  type Player,
  replay,
  VANISH_MOVE_LIMIT,
  vanishedBy,
  vanishVerdict,
  vanishWinningMoves,
  X,
} from '../src/index.js';
import { seeded } from '../src/testing.js';

/**
 * The tactics-puzzle pack: "win in N" positions for the line modes and vanish.
 *
 * Run with `npm run puzzles --workspace @dooz/engine`. It writes the pack the
 * client ships, `apps/web/src/features/puzzles/pack.json`, unless `--out=` says
 * otherwise; `--modes=grid-6,gravity` restricts the run and `--dry-run` skips
 * the write, both for working on one mode at a time.
 *
 * Positions come from engine self-play: bot games at mixed levels, from fixed
 * seeds and on a counting clock instead of a real one, so the same games - and
 * therefore the same pack - come out of every run on every machine. Near the
 * end of each decisive game the winner's positions are handed to an exact
 * prover, and a position becomes a puzzle only when the win is forced, the
 * number of moves it takes is exact, and every attacker move before the last
 * is the only one that wins in time. The client plays the defence from the
 * stored line, so nothing here is left for it to compute.
 *
 * The bot's own search is not used for any of that. It prunes defender moves
 * for speed, which is right for playing and wrong for proving: a puzzle whose
 * "only move" has a second solution, or whose defence has an escape, is worse
 * than no puzzle. See {@link LineProver} for why the prover here is sound.
 */

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const outPath = resolve(
  argValue('out') ?? resolve(here, '../../../apps/web/src/features/puzzles/pack.json'),
);
const dryRun = args.includes('--dry-run');
const onlyModes = argValue('modes')?.split(',');

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

type Tier = 1 | 2 | 3;

interface Matchup {
  readonly x: BotDifficulty;
  readonly o: BotDifficulty;
  /**
   * Thinking budget, in ticks of the counting clock rather than milliseconds.
   * The search reads the clock once per 1,024 nodes, so a budget of 20 is
   * roughly 20,000 nodes whatever machine the generator runs on.
   */
  readonly budget: number;
  /** Random plies before the bots take over, so seeds lead to different games. */
  readonly opening: number;
}

interface ModePlan {
  readonly id: ModeId;
  /** Puzzle id prefix. */
  readonly prefix: string;
  /** Puzzles wanted per tier. A tier that comes up short is filled from the others. */
  readonly targets: Readonly<Record<Tier, number>>;
  /** Longest win searched for, in attacker moves. */
  readonly maxMateIn: number;
  /** Fewest marks on the board for a position to look like a real game. */
  readonly minStones: number;
  /** Fewest marks for a mate-in-1, which only earns its place on a busy board. */
  readonly minStonesMateInOne: number;
  readonly games: number;
  readonly matchups: readonly Matchup[];
  /** How many of the winner's positions to examine, counting back from the end. */
  readonly scanBack: number;
  /** Prover nodes one position may cost before it is given up on. */
  readonly nodeLimit: number;
  /**
   * Fewest legal moves at the start. A nearly full gravity board with two open
   * columns is a coin toss, not a puzzle.
   */
  readonly minChoices: number;
}

function versus(x: BotDifficulty, o: BotDifficulty, budget: number, opening: number): Matchup {
  return { x, o, budget, opening };
}

/**
 * Big-board games: a few quick lopsided ones, mostly games with a strong side.
 * The strong levels are the ones that build double threats on purpose, and
 * the positions just before their combinations are the interesting ones.
 */
const BIG_BOARD_MATCHUPS: readonly Matchup[] = [
  versus('medium', 'easy', 8, 2),
  versus('medium', 'hard', 12, 2),
  versus('hard', 'medium', 12, 3),
  versus('medium', 'medium', 8, 3),
  versus('hard', 'hard', 12, 3),
  versus('hard', 'medium', 12, 2),
];

const PLANS: readonly ModePlan[] = [
  {
    id: 'classic',
    prefix: 'c3',
    targets: { 1: 4, 2: 2, 3: 0 },
    maxMateIn: 3,
    minStones: 2,
    minStonesMateInOne: 99,
    games: 400,
    matchups: [
      versus('beginner', 'beginner', 1, 1),
      versus('beginner', 'easy', 1, 2),
      versus('easy', 'beginner', 1, 1),
      versus('easy', 'easy', 1, 2),
    ],
    scanBack: 4,
    nodeLimit: 200_000,
    minChoices: 2,
  },
  {
    id: 'grid-6',
    prefix: 'g6',
    targets: { 1: 6, 2: 5, 3: 3 },
    maxMateIn: 4,
    minStones: 6,
    minStonesMateInOne: 99,
    games: 400,
    matchups: [
      versus('easy', 'medium', 8, 2),
      versus('medium', 'easy', 8, 2),
      versus('medium', 'medium', 8, 3),
      versus('medium', 'hard', 12, 2),
      versus('hard', 'medium', 12, 2),
    ],
    scanBack: 6,
    nodeLimit: 2_000_000,
    minChoices: 4,
  },
  {
    id: 'grid-9',
    prefix: 'g9',
    targets: { 1: 2, 2: 9, 3: 5 },
    maxMateIn: 4,
    minStones: 10,
    minStonesMateInOne: 22,
    games: 150,
    matchups: BIG_BOARD_MATCHUPS,
    scanBack: 7,
    nodeLimit: 1_500_000,
    minChoices: 4,
  },
  {
    id: 'gomoku-13',
    prefix: 'k13',
    targets: { 1: 2, 2: 7, 3: 3 },
    maxMateIn: 4,
    minStones: 12,
    minStonesMateInOne: 26,
    games: 110,
    matchups: BIG_BOARD_MATCHUPS,
    scanBack: 7,
    nodeLimit: 1_500_000,
    minChoices: 4,
  },
  {
    id: 'gomoku-15',
    prefix: 'k15',
    targets: { 1: 2, 2: 7, 3: 3 },
    maxMateIn: 4,
    minStones: 12,
    minStonesMateInOne: 26,
    games: 110,
    matchups: BIG_BOARD_MATCHUPS,
    scanBack: 7,
    nodeLimit: 1_500_000,
    minChoices: 4,
  },
  {
    id: 'gravity',
    prefix: 'gr',
    targets: { 1: 8, 2: 0, 3: 6 },
    maxMateIn: 5,
    minStones: 6,
    minStonesMateInOne: 99,
    games: 220,
    matchups: [
      versus('easy', 'medium', 8, 2),
      versus('medium', 'easy', 8, 2),
      versus('medium', 'medium', 8, 3),
      versus('medium', 'hard', 12, 2),
      versus('hard', 'medium', 12, 3),
    ],
    scanBack: 6,
    nodeLimit: 2_000_000,
    minChoices: 4,
  },
  {
    id: 'vanish',
    prefix: 'vn',
    targets: { 1: 5, 2: 0, 3: 5 },
    maxMateIn: 5,
    minStones: 4,
    minStonesMateInOne: 99,
    games: 300,
    matchups: [
      versus('beginner', 'easy', 1, 1),
      versus('easy', 'medium', 1, 1),
      versus('medium', 'easy', 1, 2),
      versus('medium', 'medium', 1, 2),
      versus('easy', 'hard', 1, 1),
    ],
    // Every position of the game: the solver answers in constant time.
    scanBack: 30,
    nodeLimit: 0,
    minChoices: 2,
  },
];

/** Tier by mode and length, per the pack's difficulty ladder. */
function tierFor(mode: ModeId, mateIn: number): Tier {
  if (mateIn <= 1) return 1;
  if (mode === 'gravity' || mode === 'vanish') return mateIn === 2 ? 1 : 3;
  if (mode === 'classic' || mode === 'grid-6') return mateIn === 2 ? 1 : mateIn === 3 ? 2 : 3;
  return mateIn === 2 ? 2 : 3;
}

// ---------------------------------------------------------------------------
// The prover for the line modes
// ---------------------------------------------------------------------------

/** Thrown when a position costs more than its node budget. The position is dropped. */
class Aborted extends Error {}

interface WindowGeometry {
  /** `cells[w * winLength + k]`: the k-th cell of window `w`. */
  readonly cells: Int32Array;
  /** Windows through each cell. */
  readonly byCell: readonly Int32Array[];
  readonly count: number;
}

const NO_WINDOWS = new Int32Array(0);
const geometryCache = new Map<string, WindowGeometry>();

/** Every run of `winLength` cells on the board, and the runs through each cell. */
function geometry(size: number, winLength: number): WindowGeometry {
  const key = `${size}:${winLength}`;
  const cached = geometryCache.get(key);
  if (cached) return cached;

  const cells: number[] = [];
  const byCell: number[][] = Array.from({ length: size * size }, () => []);
  let count = 0;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      for (const [dRow, dCol] of DIRECTIONS) {
        const endRow = row + dRow * (winLength - 1);
        const endCol = col + dCol * (winLength - 1);
        if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;
        for (let k = 0; k < winLength; k++) {
          const cell = (row + dRow * k) * size + (col + dCol * k);
          cells.push(cell);
          byCell[cell]?.push(count);
        }
        count++;
      }
    }
  }

  const built: WindowGeometry = {
    cells: Int32Array.from(cells),
    byCell: byCell.map((list) => Int32Array.from(list)),
    count,
  };
  geometryCache.set(key, built);
  return built;
}

/** Ordering weight of a window by how many marks one side already has in it. */
const WINDOW_WEIGHT = [0, 2, 16, 128, 1_024, 8_192, 65_536];

/** `array[index] += delta`. */
function bump(array: Int16Array, index: number, delta: number): void {
  array[index] = (array[index] ?? 0) + delta;
}

interface TableEntry {
  readonly check: number;
  /** Smallest budget this position is known to be won within. */
  proven: number;
  /** Largest budget this position is known not to be won within. */
  refuted: number;
}

/**
 * Exact "win within k moves" for the line modes: classic, grid, gomoku, gravity.
 *
 * `wins(k)` answers whether the attacker, to move, can complete a line within
 * k of their own moves against every defence. It is exact in both directions -
 * a `false` is as much a proof as a `true` - because every legal attacker move
 * is tried (in a good order, so a `true` usually comes quickly) and every legal
 * defender reply is answered, except where one of these arguments makes it
 * unnecessary:
 *
 * - **Immediate wins.** A win on the board ends it. If the defender has one
 *   after the attacker moves, that attacker move fails; if the defender has one
 *   before, the attacker's only candidate is the square that blocks it, and two
 *   of them cannot both be blocked.
 * - **Forced replies.** If an attacker move leaves exactly one winning square,
 *   every defender reply but the block loses on the spot, so only the block is
 *   searched. Two or more winning squares cannot be covered by one mark (a mark
 *   only ever removes the square it lands on), so the move wins outright.
 * - **Double threats need two windows.** In two moves, with nothing to block,
 *   the attacker wins exactly when one move makes two winning squares, and a
 *   move only makes a new winning square through a window already two short of
 *   a line. So only squares lying in two such windows are tried there.
 * - **The pass test** (not under gravity). An extra defender mark never helps
 *   the attacker: whatever wins against the defender with that mark on the
 *   board wins without it too, by playing as if it were there - the attacker's
 *   lines are made of the attacker's marks alone, and fewer defender marks
 *   means fewer defender lines and a board that fills later. So if the attacker
 *   cannot win after the defender *passes*, no real defender reply can lose
 *   either, and the attacker move is refuted without looking at a single one of
 *   them. When the pass test does not refute, every legal defender reply is
 *   searched - including the far-away ones on a 15x15 board. Nothing is skipped
 *   on the grounds that it looks irrelevant.
 *
 * Gravity changes which squares are legal, so a mark there can hurt its owner
 * (it opens the square above it) and the pass test does not apply. It does not
 * need to: a gravity node has at most seven moves, and every one is searched.
 *
 * The board is incremental. Every window of `winLength` cells keeps a count of
 * each player's marks, and from those each empty square keeps how many windows
 * it would complete (a winning square) and how many windows it would turn into
 * a four (to find double threats without trying every move). That makes "can
 * anyone win here" a counter read rather than a board scan. Proven results are
 * kept in a transposition table keyed by 85 bits of Zobrist hash.
 */
class LineProver {
  readonly size: number;
  readonly winLength: number;
  readonly gravity: boolean;
  readonly board: Int8Array;
  readonly cellCount: number;
  attacker: Player = X;
  nodes = 0;

  private readonly nodeLimit: number;
  private readonly geometry: WindowGeometry;
  /** Marks per window, by player (index 0 unused). */
  private readonly marks: [Uint8Array, Uint8Array, Uint8Array];
  /** Per empty cell: windows it would complete for that player. */
  private readonly threat: [Int16Array, Int16Array, Int16Array];
  /** Per empty cell: windows that hold `winLength - 2` of that player's marks and no others. */
  private readonly pair: [Int16Array, Int16Array, Int16Array];
  /** Cells that would complete a line, per player. */
  private readonly threatCells: [number, number, number] = [0, 0, 0];
  /** Sum of those cells, which is the cell itself when there is only one. */
  private readonly threatSum: [number, number, number] = [0, 0, 0];
  private empties: number;
  /** Gravity: the square a mark dropped into each column lands on, or -1. */
  private readonly landing: Int32Array;
  private readonly keys: Int32Array;
  private hash1 = 0;
  private hash2 = 0;
  private hash3 = 0;
  private readonly table = new Map<number, TableEntry>();
  private readonly orderScratch: Float64Array;

  constructor(config: GameConfig, board: readonly Cell[], nodeLimit: number) {
    this.size = config.size;
    this.winLength = config.winLength;
    this.gravity = config.variant === 'gravity';
    this.cellCount = config.size * config.size;
    this.nodeLimit = nodeLimit;
    this.geometry = geometry(this.size, this.winLength);
    const windows = this.geometry.count;
    const cells = this.cellCount;
    this.marks = [new Uint8Array(0), new Uint8Array(windows), new Uint8Array(windows)];
    this.threat = [new Int16Array(0), new Int16Array(cells), new Int16Array(cells)];
    this.pair = [new Int16Array(0), new Int16Array(cells), new Int16Array(cells)];
    this.board = new Int8Array(cells);
    this.empties = cells;
    this.orderScratch = new Float64Array(cells);
    this.keys = zobristKeys(cells);

    board.forEach((value, cell) => {
      if (value === X || value === O) this.place(cell, value);
    });

    this.landing = new Int32Array(this.size).fill(-1);
    for (let col = 0; col < this.size; col++) {
      for (let row = this.size - 1; row >= 0; row--) {
        if (this.board[row * this.size + col] === 0) {
          this.landing[col] = row * this.size + col;
          break;
        }
      }
    }
  }

  get defender(): Player {
    return opponentOf(this.attacker);
  }

  /** Change sides. The table is only valid for one attacker, so it is dropped. */
  setAttacker(player: Player): void {
    if (player !== this.attacker) this.table.clear();
    this.attacker = player;
  }

  // -- Board ----------------------------------------------------------------

  play(cell: number, player: Player): void {
    this.place(cell, player);
    if (this.gravity) this.landing[cell % this.size] = cell >= this.size ? cell - this.size : -1;
  }

  unplay(cell: number, player: Player): void {
    const rival = opponentOf(player);
    const length = this.winLength;
    const own = this.marks[player];
    const other = this.marks[rival];
    this.board[cell] = 0;
    this.empties++;
    for (const w of this.windowsAt(cell)) {
      const mine = (own[w] ?? 0) - 1;
      own[w] = mine;
      const theirs = other[w] ?? 0;
      if (theirs === 0) {
        if (mine === length - 1) this.addThreat(player, cell);
        else if (mine === length - 2) {
          const spare = this.otherEmpty(w, cell);
          this.dropThreat(player, spare);
          bump(this.pair[player], cell, 1);
          bump(this.pair[player], spare, 1);
        } else if (mine === length - 3) this.shiftPairs(w, cell, player, -1);
      } else if (mine === 0) {
        if (theirs === length - 1) this.addThreat(rival, cell);
        else if (theirs === length - 2) {
          bump(this.pair[rival], cell, 1);
          bump(this.pair[rival], this.otherEmpty(w, cell), 1);
        }
      }
    }
    this.hash(cell, player);
    if (this.gravity) this.landing[cell % this.size] = cell;
  }

  private place(cell: number, player: Player): void {
    const rival = opponentOf(player);
    const length = this.winLength;
    const own = this.marks[player];
    const other = this.marks[rival];
    for (const w of this.windowsAt(cell)) {
      const mine = own[w] ?? 0;
      const theirs = other[w] ?? 0;
      if (theirs === 0) {
        if (mine === length - 1) this.dropThreat(player, cell);
        else if (mine === length - 2) {
          const spare = this.otherEmpty(w, cell);
          bump(this.pair[player], cell, -1);
          bump(this.pair[player], spare, -1);
          this.addThreat(player, spare);
        } else if (mine === length - 3) this.shiftPairs(w, cell, player, 1);
      } else if (mine === 0) {
        // The rival's window dies with this mark in it.
        if (theirs === length - 1) this.dropThreat(rival, cell);
        else if (theirs === length - 2) {
          bump(this.pair[rival], cell, -1);
          bump(this.pair[rival], this.otherEmpty(w, cell), -1);
        }
      }
      own[w] = mine + 1;
    }
    this.board[cell] = player;
    this.empties--;
    this.hash(cell, player);
  }

  private windowsAt(cell: number): Int32Array {
    return this.geometry.byCell[cell] ?? NO_WINDOWS;
  }

  /** The empty cell of window `w` other than `cell`, when it has exactly two. */
  private otherEmpty(w: number, cell: number): number {
    const { cells } = this.geometry;
    const base = w * this.winLength;
    for (let k = 0; k < this.winLength; k++) {
      const at = cells[base + k] ?? -1;
      if (at !== cell && this.board[at] === 0) return at;
    }
    throw new Error('window has no other empty cell');
  }

  /** Window `w` moves in or out of "two short of a line": adjust its other empties. */
  private shiftPairs(w: number, cell: number, player: Player, delta: number): void {
    const { cells } = this.geometry;
    const base = w * this.winLength;
    for (let k = 0; k < this.winLength; k++) {
      const at = cells[base + k] ?? -1;
      if (at !== cell && this.board[at] === 0) bump(this.pair[player], at, delta);
    }
  }

  private addThreat(player: Player, cell: number): void {
    const threats = this.threat[player];
    const count = threats[cell] ?? 0;
    threats[cell] = count + 1;
    if (count === 0) {
      this.threatCells[player]++;
      this.threatSum[player] += cell;
    }
  }

  private dropThreat(player: Player, cell: number): void {
    const threats = this.threat[player];
    const count = (threats[cell] ?? 0) - 1;
    threats[cell] = count;
    if (count === 0) {
      this.threatCells[player]--;
      this.threatSum[player] -= cell;
    }
  }

  private hash(cell: number, player: Player): void {
    const at = (cell * 2 + player - 1) * 3;
    this.hash1 ^= this.keys[at] ?? 0;
    this.hash2 ^= this.keys[at + 1] ?? 0;
    this.hash3 ^= this.keys[at + 2] ?? 0;
  }

  // -- Queries --------------------------------------------------------------

  /** Squares `player` could complete a line on right now, legal ones only. */
  winCount(player: Player): number {
    if (!this.gravity) return this.threatCells[player];
    let count = 0;
    for (const cell of this.landing) {
      if (cell >= 0 && (this.threat[player][cell] ?? 0) > 0) count++;
    }
    return count;
  }

  /** The winning square, when {@link winCount} is exactly one. */
  private onlyWin(player: Player): number {
    if (!this.gravity) return this.threatSum[player];
    for (const cell of this.landing) {
      if (cell >= 0 && (this.threat[player][cell] ?? 0) > 0) return cell;
    }
    throw new Error('no winning square');
  }

  /** Every legal winning square for `player`, ascending. */
  winSquares(player: Player): number[] {
    return this.legal().filter((cell) => (this.threat[player][cell] ?? 0) > 0);
  }

  isWinSquare(player: Player, cell: number): boolean {
    return this.isLegal(cell) && (this.threat[player][cell] ?? 0) > 0;
  }

  isLegal(cell: number): boolean {
    if (this.board[cell] !== 0) return false;
    return !this.gravity || this.landing[cell % this.size] === cell;
  }

  /** Legal moves, ascending. */
  legal(): number[] {
    const moves: number[] = [];
    if (this.gravity) {
      for (const cell of this.landing) if (cell >= 0) moves.push(cell);
      return moves.toSorted((a, b) => a - b);
    }
    for (let cell = 0; cell < this.cellCount; cell++) if (this.board[cell] === 0) moves.push(cell);
    return moves;
  }

  /** Legal moves, most promising for `player` first: building and blocking lines. */
  ordered(player: Player): number[] {
    const moves = this.legal();
    const own = this.marks[player];
    const other = this.marks[opponentOf(player)];
    const scores = this.orderScratch;
    for (const cell of moves) {
      let score = 0;
      for (const w of this.windowsAt(cell)) {
        const mine = own[w] ?? 0;
        const theirs = other[w] ?? 0;
        if (theirs === 0) score += WINDOW_WEIGHT[mine] ?? 0;
        else if (mine === 0) score += (WINDOW_WEIGHT[theirs] ?? 0) * 0.75;
      }
      scores[cell] = score;
    }
    return moves.toSorted((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0) || a - b);
  }

  /** Whether some window holding `stone` is one mark from an attacker line at `cell`. */
  threatThrough(cell: number, stone: number): boolean {
    const { cells } = this.geometry;
    const own = this.marks[this.attacker];
    const other = this.marks[this.defender];
    for (const w of this.windowsAt(cell)) {
      if (own[w] !== this.winLength - 1 || other[w] !== 0) continue;
      const base = w * this.winLength;
      for (let k = 0; k < this.winLength; k++) if (cells[base + k] === stone) return true;
    }
    return false;
  }

  // -- The proof ------------------------------------------------------------

  /** True when the attacker, to move, wins within `budget` of their own moves. */
  wins(budget: number): boolean {
    if (this.winCount(this.attacker) > 0) return true;
    if (budget <= 1 || this.empties === 0) return false;

    const key = (this.hash1 >>> 0) * 2_097_152 + (this.hash2 >>> 11);
    const check = this.hash3;
    const entry = this.table.get(key);
    const known = entry !== undefined && entry.check === check;
    if (known) {
      if (budget >= entry.proven) return true;
      if (budget <= entry.refuted) return false;
    }

    if (++this.nodes > this.nodeLimit) throw new Aborted();
    const result = this.search(budget);

    if (known) {
      if (result) entry.proven = Math.min(entry.proven, budget);
      else entry.refuted = Math.max(entry.refuted, budget);
    } else {
      if (this.table.size > 4_000_000) this.table.clear();
      this.table.set(key, {
        check,
        proven: result ? budget : Number.POSITIVE_INFINITY,
        refuted: result ? 0 : budget,
      });
    }
    return result;
  }

  private search(budget: number): boolean {
    const attacker = this.attacker;
    const defender = this.defender;
    const threats = this.winCount(defender);
    if (threats >= 2) return false;
    if (threats === 1) return this.moveWins(this.onlyWin(defender), budget);

    if (!this.gravity && budget === 2) {
      // See "double threats need two windows" above.
      const pairs = this.pair[attacker];
      for (let cell = 0; cell < this.cellCount; cell++) {
        if ((pairs[cell] ?? 0) >= 2 && this.board[cell] === 0 && this.moveWins(cell, 2)) {
          return true;
        }
      }
      return false;
    }

    for (const move of this.ordered(attacker)) {
      if (this.moveWins(move, budget)) return true;
    }
    return false;
  }

  /**
   * Whether attacker move `move` wins within `budget` (counting itself).
   *
   * Assumes the attacker has no immediate win, which every caller has checked.
   */
  moveWins(move: number, budget: number): boolean {
    const attacker = this.attacker;
    const defender = this.defender;
    this.play(move, attacker);

    let result: boolean;
    if (this.empties === 0 || this.winCount(defender) > 0) {
      // Drawn by a full board, or the defender simply wins.
      result = false;
    } else {
      const threats = this.winCount(attacker);
      if (threats >= 2) result = true;
      else if (threats === 1) {
        const block = this.onlyWin(attacker);
        this.play(block, defender);
        result = this.wins(budget - 1);
        this.unplay(block, defender);
      } else if (!this.gravity && (budget === 2 || !this.wins(budget - 1))) {
        // No threat, so off gravity a defender mark cannot hand the attacker a
        // win next move; and if a pass survives, so does every real reply.
        result = false;
      } else {
        result = this.everyReplyLoses(budget - 1);
      }
    }

    this.unplay(move, attacker);
    return result;
  }

  private everyReplyLoses(budget: number): boolean {
    const defender = this.defender;
    for (const reply of this.ordered(defender)) {
      this.play(reply, defender);
      const lost = this.wins(budget);
      this.unplay(reply, defender);
      if (!lost) return false;
    }
    return true;
  }

  /** Every attacker move that wins within `budget`, stopping once `limit` are found. */
  winningMoves(budget: number, limit = Number.POSITIVE_INFINITY): number[] {
    const found: number[] = [];
    const immediate = this.winCount(this.attacker) > 0;
    for (const move of this.ordered(this.attacker)) {
      const wins =
        this.isWinSquare(this.attacker, move) ||
        (!immediate && budget >= 2 && this.moveWins(move, budget));
      if (wins) found.push(move);
      if (found.length >= limit) break;
    }
    return found.toSorted((a, b) => a - b);
  }

  /** The fewest moves the attacker needs, up to `limit`, or `null` if more. */
  distance(limit: number): number | null {
    for (let budget = 1; budget <= limit; budget++) if (this.wins(budget)) return budget;
    return null;
  }

  engineBoard(): Cell[] {
    return Array.from(this.board, (value) => (value === X || value === O ? value : Empty));
  }
}

/** Three independent 32-bit Zobrist keys per (cell, player), the same on every run. */
const zobristCache = new Map<number, Int32Array>();

function zobristKeys(cells: number): Int32Array {
  const cached = zobristCache.get(cells);
  if (cached) return cached;
  const random = seeded(cells * 7919);
  const keys = new Int32Array(cells * 2 * 3);
  for (let i = 0; i < keys.length; i++) keys[i] = Math.floor(random() * 0x1_0000_0000) | 0;
  zobristCache.set(cells, keys);
  return keys;
}

// ---------------------------------------------------------------------------
// Solving a position
// ---------------------------------------------------------------------------

/** What the prover (or the vanish solver) makes of a position that is a puzzle. */
interface Solution {
  readonly mateIn: number;
  readonly line: number[];
  readonly accept: number[][];
  readonly theme: string | undefined;
  /** Rough difficulty, for ordering within a tier. */
  readonly difficulty: number;
  /** Selection preference: difficulty plus a premium for moves that are not reflexes. */
  readonly interest: number;
}

/** Themes whose key move is not the first thing a player's hand goes to. */
const SUBTLE_THEMES = new Set([
  'double-four',
  'four-three',
  'quiet-move',
  'stack',
  'zugzwang',
  'forcing-line',
]);

/**
 * The puzzle in a line-mode position, or `null` if there is none.
 *
 * `null` covers everything that disqualifies a position: no forced win within
 * the plan's limit, a defender who could win on the spot, an attacker step
 * with more than one winning move, or a proof that ran past its node budget.
 */
function solveLine(state: GameState, plan: ModePlan): Solution | null {
  const prover = new LineProver(state.config, state.board, plan.nodeLimit);
  prover.setAttacker(state.currentPlayer);
  if (prover.winCount(prover.defender) > 0) return reject('defender-threat');
  try {
    const mateIn = prover.distance(plan.maxMateIn);
    if (mateIn === null) return reject('no-win');
    if (mateIn === 1 && state.moves.length < plan.minStonesMateInOne) return reject('sparse');
    return lineSolution(prover, mateIn, state);
  } catch (error) {
    if (error instanceof Aborted) return reject('budget');
    throw error;
  }
}

/** Why positions were turned down, per mode, for the progress report. */
const rejected = new Map<string, number>();

function reject(reason: string): null {
  rejected.set(reason, (rejected.get(reason) ?? 0) + 1);
  return null;
}

/** Walk the main line of a proven mate-in-`mateIn`, checking uniqueness at every step. */
function lineSolution(prover: LineProver, mateIn: number, state: GameState): Solution | null {
  const { attacker, defender, size, winLength } = prover;
  const threatening = threateningMoves(prover);
  const line: number[] = [];
  const accept: number[][] = [];
  const threatsAfter: number[] = [];
  let firstWins: number[] = [];
  let fourThree = false;
  let lastReplyBlocked = false;
  let stack = false;

  for (let step = 0; step < mateIn; step++) {
    const remaining = mateIn - step;
    if (remaining === 1) {
      const finals = prover.winSquares(attacker);
      if (finals.length === 0) throw new Error('prover: the main line lost the win');
      const reply = line.at(-1);
      stack =
        prover.gravity && lastReplyBlocked && reply !== undefined && finals.includes(reply - size);
      line.push(nth(finals, 0));
      accept.push(finals);
      break;
    }

    const winners = prover.winningMoves(remaining, 2);
    if (winners.length !== 1) return reject('not-unique');
    const key = nth(winners, 0);
    line.push(key);
    accept.push([key]);
    prover.play(key, attacker);

    const wins = prover.winSquares(attacker);
    threatsAfter.push(wins.length);
    if (step === 0) firstWins = wins;
    if (step === 1 && threatsAfter[0] === 1 && wins.length >= 2) {
      fourThree = wins.some((cell) => prover.threatThrough(cell, nth(line, 0)));
    }

    const reply = defenderReply(prover, remaining - 1, wins);
    lastReplyBlocked = wins.includes(reply);
    line.push(reply);
    prover.play(reply, defender);
    // The key move was proven against every reply, so this cannot fail - but
    // the pack is the product, and a second look costs nothing.
    if (!prover.wins(remaining - 1)) throw new Error('prover: the defence escaped');
  }

  const stones = state.moves.length;
  const firstQuiet = mateIn >= 3 && threatsAfter[0] === 0;
  let theme: string | undefined;
  if (mateIn === 1) theme = 'win-in-one';
  else if (stack) theme = 'stack';
  else if (firstQuiet) theme = 'quiet-move';
  else if (mateIn === 2 && firstWins.length === 0) {
    // No threat at all, and still a win next move: only gravity does this.
    // Every reply the defender has opens a square the attacker wins on.
    theme = 'zugzwang';
  } else if (mateIn === 2) {
    const sameLine = collinear(nth(line, 0), firstWins, size);
    if (winLength >= 5) theme = sameLine ? 'open-four' : 'double-four';
    else if (winLength === 4 && sameLine) theme = 'open-three';
    else theme = 'fork';
  } else if (mateIn === 3 && winLength >= 5 && fourThree) theme = 'four-three';
  else if (threatsAfter.slice(0, -1).every((count) => count === 1) && threatsAfter.at(-1)! >= 2) {
    theme = 'forcing-line';
  }

  let difficulty: number;
  if (mateIn === 1) {
    // Hidden in plain sight: one winning square on a crowded board, away from
    // the mark the opponent just played.
    const last = state.lastMove ?? -1;
    const finals = nth(accept, 0);
    const away = finals.every((cell) => chebyshev(cell, last, size) > 1);
    difficulty = Math.min(stones, 80) * 0.5 + (finals.length === 1 ? 20 : 0) + (away ? 15 : 0);
  } else {
    // Moves that threaten something but do not win: the plausible wrong answers.
    const decoys = threatening - (nth(threatsAfter, 0) > 0 ? 1 : 0);
    difficulty = mateIn * 100 + Math.min(decoys, 15) * 3 + Math.min(stones, 80) * 0.4;
    if (firstQuiet) difficulty += 40;
    if (theme === 'open-four' || theme === 'open-three') difficulty -= 25;
  }
  const interest = difficulty + (theme !== undefined && SUBTLE_THEMES.has(theme) ? 30 : 0);
  return { mateIn, line, accept, theme, difficulty, interest };
}

/**
 * The defence the client will play: the reply that holds out longest.
 *
 * Ties go to a reply that sits on one of the attacker's winning squares - the
 * block a person would play - then to the reply the engine's own move ordering
 * likes best, then to the lowest square, so the choice is deterministic.
 */
function defenderReply(
  prover: LineProver,
  budget: number,
  attackerWins: readonly number[],
): number {
  const { defender, size, winLength } = prover;
  const board = prover.engineBoard();
  let best = -1;
  let bestDistance = -1;
  let bestBlocks = false;
  let bestHeuristic = Number.NEGATIVE_INFINITY;

  for (const reply of prover.legal()) {
    prover.play(reply, defender);
    const distance = prover.distance(budget - 1) ?? budget;
    prover.unplay(reply, defender);
    const blocks = attackerWins.includes(reply);
    const heuristic = moveHeuristic(board, size, reply, defender, winLength);

    const better =
      distance !== bestDistance
        ? distance > bestDistance
        : blocks !== bestBlocks
          ? blocks
          : heuristic > bestHeuristic;
    if (better) {
      best = reply;
      bestDistance = distance;
      bestBlocks = blocks;
      bestHeuristic = heuristic;
    }
  }
  return best;
}

/** Attacker moves that leave at least one winning square behind them. */
function threateningMoves(prover: LineProver): number {
  let count = 0;
  for (const move of prover.legal()) {
    prover.play(move, prover.attacker);
    if (prover.winCount(prover.attacker) > 0) count++;
    prover.unplay(move, prover.attacker);
  }
  return count;
}

/** Whether every cell in `cells` lies on one line through `from`. */
function collinear(from: number, cells: readonly number[], size: number): boolean {
  const directions = new Set(
    cells.map((cell) => {
      let dRow = Math.sign(Math.floor(cell / size) - Math.floor(from / size));
      let dCol = Math.sign((cell % size) - (from % size));
      if (dRow < 0 || (dRow === 0 && dCol < 0)) {
        dRow = -dRow;
        dCol = -dCol;
      }
      return `${dRow},${dCol}`;
    }),
  );
  return directions.size <= 1;
}

/** `list[index]`, which must exist. */
function nth<T>(list: readonly T[], index: number): T {
  const value = list[index];
  if (value === undefined) throw new Error(`no element at ${index}`);
  return value;
}

function chebyshev(a: number, b: number, size: number): number {
  if (a < 0 || b < 0) return Number.POSITIVE_INFINITY;
  return Math.max(
    Math.abs(Math.floor(a / size) - Math.floor(b / size)),
    Math.abs((a % size) - (b % size)),
  );
}

/**
 * The puzzle in a vanish position, read straight off the solved game.
 *
 * The solver's verdict is exact - value and distance under best play by both
 * sides - so a move wins within k exactly when it wins on the spot or leaves
 * the opponent lost within the remaining plies. The only thing it does not
 * know about is the draw at {@link VANISH_MOVE_LIMIT}, so the whole forced
 * line has to finish before it.
 */
function solveVanish(state: GameState, plan: ModePlan): Solution | null {
  const attacker = state.currentPlayer;
  const defender = opponentOf(attacker);
  if (vanishWinningMoves(state, defender).length > 0) return reject('defender-threat');
  const verdict = vanishVerdict(state);
  if (verdict.value !== 1) return reject('no-win');
  const mateIn = (verdict.distance + 1) / 2;
  if (mateIn > plan.maxMateIn || state.moves.length + verdict.distance > VANISH_MOVE_LIMIT) {
    return reject('too-long');
  }
  if (mateIn === 1 && countStones(state) < plan.minStonesMateInOne) return reject('sparse');

  let current = state;
  const line: number[] = [];
  const accept: number[][] = [];
  let lastThreats = 0;
  let lifted: number | null = null;
  for (let step = 0; step < mateIn; step++) {
    const remaining = mateIn - step;
    const winners = legalMoves(current).filter(
      (move) => vanishMovesToWin(current, move) <= remaining,
    );
    if (remaining === 1) {
      if (winners.length === 0) throw new Error('vanish: the main line lost the win');
      line.push(nth(winners, 0));
      accept.push(winners);
      break;
    }
    if (winners.length !== 1) return reject('not-unique');
    const key = nth(winners, 0);
    line.push(key);
    accept.push([key]);
    current = applyMove(current, key)!;
    const threats = vanishWinningMoves(current, attacker);
    lastThreats = threats.length;
    const reply = vanishReply(current, remaining - 1, threats);
    line.push(reply);
    current = applyMove(current, reply)!;
    lifted = vanishedBy(current);
  }

  // The defender's last move lifted the very mark that was blocking the
  // winning square: a block that cannot be played, because it is already
  // there - until the defence has to move and takes it away.
  const tempo = lifted !== null && (accept.at(-1) ?? []).includes(lifted);
  const theme =
    mateIn === 1 ? 'win-in-one' : tempo ? 'vanish-tempo' : lastThreats >= 2 ? 'fork' : undefined;
  const difficulty = mateIn * 100 + legalMoves(state).length * 3 + (tempo ? 20 : 0);
  return { mateIn, line, accept, theme, difficulty, interest: difficulty + (tempo ? 30 : 0) };
}

/** Attacker moves `move` needs to win, counting itself, or infinity if it does not. */
function vanishMovesToWin(state: GameState, move: number): number {
  const next = applyMove(state, move)!;
  if (next.status === 'won') return next.winner === state.currentPlayer ? 1 : Infinity;
  if (next.status !== 'playing') return Infinity;
  const verdict = vanishVerdict(next);
  if (verdict.value !== -1 || next.moves.length + verdict.distance > VANISH_MOVE_LIMIT) {
    return Infinity;
  }
  return 1 + verdict.distance / 2;
}

/** As {@link defenderReply}, from the solver's distances. */
function vanishReply(state: GameState, budget: number, attackerWins: readonly number[]): number {
  const defender = state.currentPlayer;
  let best = -1;
  let bestDistance = -1;
  let bestBlocks = false;
  let bestHeuristic = Number.NEGATIVE_INFINITY;
  for (const reply of legalMoves(state)) {
    const next = applyMove(state, reply)!;
    const verdict = vanishVerdict(next);
    const distance = (verdict.distance + 1) / 2;
    if (next.status !== 'playing' || verdict.value !== 1 || distance > budget) {
      throw new Error('vanish: the defence escaped');
    }
    const blocks = attackerWins.includes(reply);
    const heuristic = moveHeuristic(state.board, 3, reply, defender, 3);
    const better =
      distance !== bestDistance
        ? distance > bestDistance
        : blocks !== bestBlocks
          ? blocks
          : heuristic > bestHeuristic;
    if (better) {
      best = reply;
      bestDistance = distance;
      bestBlocks = blocks;
      bestHeuristic = heuristic;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

const symmetryCache = new Map<string, Int32Array[]>();

/**
 * Cell maps for the symmetries a mode's positions are equivalent under: all
 * eight of the square for the flat boards, only the mirror under gravity -
 * turning a gravity board over is a different game.
 */
function symmetries(size: number, mirrorOnly: boolean): Int32Array[] {
  const key = `${size}:${mirrorOnly}`;
  const cached = symmetryCache.get(key);
  if (cached) return cached;
  const maps: Int32Array[] = [];
  for (let t = 0; t < 8; t++) {
    if (mirrorOnly && t !== 0 && t !== 4) continue;
    const map = new Int32Array(size * size);
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        let r = row;
        let c = col;
        if (t & 1) [r, c] = [c, r];
        if (t & 2) r = size - 1 - r;
        if (t & 4) c = size - 1 - c;
        map[row * size + col] = r * size + c;
      }
    }
    maps.push(map);
  }
  symmetryCache.set(key, maps);
  return maps;
}

/** The position up to symmetry and colour: attacker `a`, defender `d`. */
function positionKey(state: GameState): string {
  const { size, variant } = state.config;
  const maps = symmetries(size, variant === 'gravity');
  let best = '';

  if (variant === 'vanish') {
    // A vanish position is its two queues: the same marks in a different age
    // order are a different position.
    const { mover, other } = vanishQueues(state);
    for (const map of maps) {
      const text = `${mover.map((cell) => map[cell]).join('')}|${other.map((cell) => map[cell]).join('')}`;
      if (best === '' || text < best) best = text;
    }
    return `vanish:${best}`;
  }

  const chars = Array.from<string>({ length: size * size });
  for (const map of maps) {
    state.board.forEach((value, cell) => {
      chars[map[cell] ?? cell] = value === 0 ? '.' : value === state.currentPlayer ? 'a' : 'd';
    });
    const text = chars.join('');
    if (best === '' || text < best) best = text;
  }
  return `${variant}:${size}:${best}`;
}

// ---------------------------------------------------------------------------
// Self-play
// ---------------------------------------------------------------------------

/**
 * One bot game, the same every run for the same seed.
 *
 * The bots are given a counting clock rather than the wall clock: the search
 * reads the time once per 1,024 nodes, so a budget of n ticks is a node budget
 * and the moves they choose do not depend on how busy the machine is.
 */
function playGame(config: GameConfig, seed: number, matchup: Matchup): GameState {
  const random = seeded(seed);
  let state = createGame(config, random() < 0.5 ? X : O);
  for (let ply = 0; ply < matchup.opening && state.status === 'playing'; ply++) {
    const pool = openingPool(state);
    state = applyMove(state, nth(pool, Math.floor(random() * pool.length)))!;
  }
  while (state.status === 'playing') {
    const difficulty = state.currentPlayer === X ? matchup.x : matchup.o;
    let tick = 0;
    const choice = chooseMove(state, {
      difficulty,
      random,
      timeBudgetMs: matchup.budget,
      now: () => tick++,
    });
    if (!choice) break;
    state = applyMove(state, choice.move)!;
  }
  return state;
}

/** Random opening squares: anywhere on the small boards, near the centre on the big ones. */
function openingPool(state: GameState): number[] {
  const moves = legalMoves(state);
  const { size, variant } = state.config;
  if (size <= 3 || variant === 'gravity') return moves;
  const centre = (size - 1) / 2;
  const reach = size >= 9 ? 2 : 1.5;
  const near = moves.filter(
    (move) =>
      Math.abs(Math.floor(move / size) - centre) <= reach &&
      Math.abs((move % size) - centre) <= reach,
  );
  return near.length > 0 ? near : moves;
}

function countStones(state: GameState): number {
  return state.board.reduce<number>((total, cell) => total + (cell === 0 ? 0 : 1), 0);
}

// ---------------------------------------------------------------------------
// Collection and selection
// ---------------------------------------------------------------------------

interface Puzzle {
  id: string;
  mode: ModeId;
  startingPlayer: Player;
  moves: number[];
  mateIn: number;
  line: number[];
  accept: number[][];
  tier: Tier;
  theme?: string;
}

interface Candidate {
  readonly puzzle: Omit<Puzzle, 'id'>;
  readonly difficulty: number;
  readonly interest: number;
  /** The position up to symmetry, for deduplication and a stable tie-break. */
  readonly key: string;
  /** The game it came from. The pack takes at most one puzzle per game. */
  readonly game: number;
}

/** Play a mode's games and turn every qualifying position in them into a candidate. */
function collect(plan: ModePlan, planIndex: number): Candidate[] {
  const config = modeById(plan.id).config;
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  let decisive = 0;
  let examined = 0;
  let playing = 0;
  let proving = 0;
  rejected.clear();
  const started = Date.now();
  const reportEvery = Math.max(1, Math.floor(plan.games / 5));

  for (let game = 0; game < plan.games; game++) {
    const matchup = nth(plan.matchups, game % plan.matchups.length);
    const played = Date.now();
    const final = playGame(config, (planIndex + 1) * 100_000 + game, matchup);
    playing += Date.now() - played;
    if (final.status === 'won' && final.winner !== null) {
      decisive++;
      const winner = final.winner;
      const starting = final.moves.length % 2 === 1 ? winner : opponentOf(winner);

      // The winner's positions, from their final move backwards.
      for (let back = 0; back < plan.scanBack; back++) {
        const ply = final.moves.length - 1 - back * 2;
        if (ply < 0) break;
        const state = replay(config, starting, final.moves.slice(0, ply));
        if (!state || state.status !== 'playing') continue;
        if (countStones(state) < plan.minStones) {
          // On the line boards, going further back only removes marks.
          if (plan.id === 'vanish') continue;
          break;
        }
        if (legalMoves(state).length < plan.minChoices) continue;
        const key = positionKey(state);
        if (seen.has(key)) continue;
        seen.add(key);
        examined++;

        const solving = Date.now();
        const solution = plan.id === 'vanish' ? solveVanish(state, plan) : solveLine(state, plan);
        proving += Date.now() - solving;
        if (!solution) continue;
        candidates.push({
          puzzle: {
            mode: plan.id,
            startingPlayer: starting,
            moves: [...state.moves],
            mateIn: solution.mateIn,
            line: solution.line,
            accept: solution.accept,
            tier: tierFor(plan.id, solution.mateIn),
            ...(solution.theme ? { theme: solution.theme } : {}),
          },
          difficulty: Math.round(solution.difficulty * 10) / 10,
          interest: solution.interest,
          key,
          game,
        });
      }
    }

    if ((game + 1) % reportEvery === 0) {
      const byLength = countBy(candidates, (candidate) => `m${candidate.puzzle.mateIn}`);
      console.log(
        `  ${plan.id}: ${game + 1}/${plan.games} games, ${decisive} decisive, ` +
          `${examined} positions, ${candidates.length} puzzles ${JSON.stringify(byLength)} ` +
          `(${seconds(started)}: play ${(playing / 1000).toFixed(1)}s, ` +
          `prove ${(proving / 1000).toFixed(1)}s) rejected ${JSON.stringify(Object.fromEntries(rejected))}`,
      );
    }
  }
  return candidates;
}

/**
 * The mode's share of the pack: its tier targets, filled best-first but taking
 * turns across themes so one pattern does not crowd out the rest, and never two
 * puzzles from the same game - the position before a combination and the one
 * after its first move are much the same puzzle twice. A tier that comes up
 * short is made up from whatever is left.
 */
function select(plan: ModePlan, candidates: readonly Candidate[]): Candidate[] {
  const chosen: Candidate[] = [];
  const usedGames = new Set<number>();
  const byInterest = (a: Candidate, b: Candidate) =>
    b.interest - a.interest || compareText(a.key, b.key);

  const take = (pool: readonly Candidate[], count: number) => {
    const groups = new Map<string, Candidate[]>();
    for (const candidate of pool.toSorted(byInterest)) {
      // Themes and lengths take turns, so neither one pattern nor one length fills a tier.
      const kind = `${candidate.puzzle.theme ?? ''}:${candidate.puzzle.mateIn}`;
      const group = groups.get(kind);
      if (group) group.push(candidate);
      else groups.set(kind, [candidate]);
    }
    const queues = [...groups.values()];
    let taken = 0;
    while (taken < count) {
      let progressed = false;
      for (const queue of queues) {
        let next = queue.shift();
        while (next && usedGames.has(next.game)) next = queue.shift();
        if (!next) continue;
        chosen.push(next);
        usedGames.add(next.game);
        taken++;
        progressed = true;
        if (taken >= count) break;
      }
      if (!progressed) break;
    }
  };

  // The scarce tiers choose first: mate-in-1s are plentiful, and taking their
  // games first would cost the harder puzzles from the same games.
  for (const tier of [3, 2, 1] as const) {
    take(
      candidates.filter((candidate) => candidate.puzzle.tier === tier),
      plan.targets[tier],
    );
  }
  const wanted = plan.targets[1] + plan.targets[2] + plan.targets[3];
  if (chosen.length < wanted) {
    const left = candidates.filter((candidate) => !chosen.includes(candidate));
    take(left, wanted - chosen.length);
  }
  return chosen;
}

// ---------------------------------------------------------------------------
// Verification with the engine alone
// ---------------------------------------------------------------------------

/**
 * Squares where `player` would complete a line with their next mark.
 *
 * For the side to move that is just the legal moves that win. For the side
 * waiting, the line modes are asked with the turn handed over; vanish is asked
 * through its own helper, because who moves decides which mark lifts first.
 */
function immediateWins(state: GameState, player: Player): number[] {
  if (state.status !== 'playing') return [];
  if (player !== state.currentPlayer && state.config.variant === 'vanish') {
    return vanishWinningMoves(state, player);
  }
  const probe = player === state.currentPlayer ? state : { ...state, currentPlayer: player };
  return legalMoves(probe).filter((move) => applyMove(probe, move)?.status === 'won');
}

/** The structural checks the client's test makes, run before anything is written. */
function verify(puzzle: Puzzle): void {
  const fail = (why: string): never => {
    throw new Error(`${puzzle.id}: ${why}`);
  };
  const config = modeById(puzzle.mode).config;
  const start = replay(config, puzzle.startingPlayer, puzzle.moves);
  if (!start || start.status !== 'playing') return fail('moves do not reach a live position');
  const attacker = start.currentPlayer;
  const defender = opponentOf(attacker);
  if (puzzle.line.length !== puzzle.mateIn * 2 - 1) fail('line length');
  if (puzzle.accept.length !== puzzle.mateIn) fail('accept length');
  if (puzzle.mateIn >= 2 && immediateWins(start, attacker).length > 0) fail('already won');
  if (immediateWins(start, defender).length > 0) fail('defender wins first');

  let state = start;
  puzzle.line.forEach((move, ply) => {
    if (ply % 2 === 0) {
      const step = ply / 2;
      const expected = step < puzzle.mateIn - 1 ? [move] : immediateWins(state, attacker);
      if (JSON.stringify(puzzle.accept[step]) !== JSON.stringify(expected)) fail(`accept ${step}`);
      if (!expected.includes(move)) fail(`final move ${move} does not win`);
    }
    const next = applyMove(state, move);
    if (!next) return fail(`illegal move ${move}`);
    const last = ply === puzzle.line.length - 1;
    if (last ? next.status !== 'won' || next.winner !== attacker : next.status !== 'playing') {
      fail(`unexpected ${next.status} after move ${move}`);
    }
    state = next;
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function countBy<T>(items: readonly T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function seconds(since: number): string {
  return `${((Date.now() - since) / 1000).toFixed(1)}s`;
}

const run = Date.now();
const plans = PLANS.filter((plan) => !onlyModes || onlyModes.includes(plan.id));
const selected: Candidate[] = [];

for (const plan of plans) {
  const started = Date.now();
  console.log(`\n=== ${plan.id} ===`);
  const candidates = collect(plan, PLANS.indexOf(plan));
  const chosen = select(plan, candidates);
  selected.push(...chosen);
  const mix = countBy(
    chosen,
    (candidate) => `t${candidate.puzzle.tier}/m${candidate.puzzle.mateIn}`,
  );
  const themes = countBy(chosen, (candidate) => candidate.puzzle.theme ?? '-');
  const offered = countBy(candidates, (candidate) => candidate.puzzle.theme ?? '-');
  console.log(
    `  ${plan.id}: ${candidates.length} candidates ${JSON.stringify(offered)}\n` +
      `  chose ${chosen.length} ${JSON.stringify(mix)} themes ${JSON.stringify(themes)} ` +
      `(${seconds(started)})`,
  );
}

// Easiest first: by tier, then by the rough difficulty within it.
const modeOrder = (id: ModeId) => PLANS.findIndex((plan) => plan.id === id);
const ordered = selected.toSorted(
  (a, b) =>
    a.puzzle.tier - b.puzzle.tier ||
    a.difficulty - b.difficulty ||
    modeOrder(a.puzzle.mode) - modeOrder(b.puzzle.mode) ||
    compareText(a.key, b.key),
);

const numbering = new Map<ModeId, number>();
const puzzles: Puzzle[] = ordered.map((candidate) => {
  const { mode, startingPlayer, moves, mateIn, line, accept, tier, theme } = candidate.puzzle;
  const index = (numbering.get(mode) ?? 0) + 1;
  numbering.set(mode, index);
  const prefix = PLANS.find((plan) => plan.id === mode)?.prefix ?? mode;
  const puzzle: Puzzle = {
    id: `${prefix}-${String(index).padStart(3, '0')}`,
    mode,
    startingPlayer,
    moves,
    mateIn,
    line,
    accept,
    tier,
  };
  if (theme) puzzle.theme = theme;
  return puzzle;
});
for (const puzzle of puzzles) verify(puzzle);

console.log(`\n${puzzles.length} puzzles in ${seconds(run)}`);
console.log(`  by mode: ${JSON.stringify(countBy(puzzles, (puzzle) => puzzle.mode))}`);
console.log(`  by tier: ${JSON.stringify(countBy(puzzles, (puzzle) => `t${puzzle.tier}`))}`);
console.log(`  by theme: ${JSON.stringify(countBy(puzzles, (puzzle) => puzzle.theme ?? '-'))}`);

if (dryRun) {
  console.log('dry run: nothing written');
} else {
  // Formatted the way the repository's prettier config would, so regenerating
  // the pack never shows up as a formatting diff.
  let text = `${JSON.stringify({ version: 1, puzzles }, null, 2)}\n`;
  try {
    const prettier = await import('prettier');
    const options = (await prettier.resolveConfig(outPath)) ?? {};
    text = await prettier.format(text, { ...options, filepath: outPath });
  } catch {
    console.warn('prettier unavailable: writing plain JSON');
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, text);
  console.log(`wrote ${outPath}`);
}
