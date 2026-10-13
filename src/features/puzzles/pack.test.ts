import {
  applyMove,
  type GameState,
  isModeId,
  legalMoves,
  modeById,
  opponentOf,
  type Player,
  replay,
  vanishWinningMoves,
} from '@/game/engine';
import { describe, expect, it } from 'vitest';
import index from './index.json';
import pack from './pack.json';
import {
  dailyPuzzle,
  endsOnDefence,
  loadPuzzles,
  type Puzzle,
  PUZZLE_INDEX,
  transformPuzzle,
  turnsFor,
} from './puzzles';

/**
 * The puzzle pack, checked against the rules alone.
 *
 * The generator (`scripts/bench/puzzles.ts`) proves each puzzle before
 * writing it; this re-checks everything that can be checked without a search,
 * so a hand edit or a stale pack cannot ship a puzzle whose stored defence is
 * illegal, whose line does not win, or whose accepted answers are wrong.
 */

interface PackPuzzle {
  readonly id: string;
  readonly mode: string;
  readonly startingPlayer: number;
  readonly moves: readonly number[];
  readonly mateIn: number;
  readonly line: readonly number[];
  readonly accept: readonly (readonly number[])[];
  readonly tier: number;
  readonly theme?: string;
  readonly rating?: number;
}

const puzzles: readonly PackPuzzle[] = pack.puzzles;

/**
 * Squares where `player` would win with their next mark.
 *
 * For the side to move, the legal moves that win. For the side waiting, the
 * question is asked with the turn handed over; vanish has its own helper,
 * because which of a player's marks lifts next depends on who is moving.
 * Under misère a completed line wins for the *other* side, so a square only
 * counts when the result is the player's own win.
 */
function immediateWins(state: GameState, player: Player): number[] {
  if (player !== state.currentPlayer && state.config.variant === 'vanish') {
    return vanishWinningMoves(state, player);
  }
  const probe = player === state.currentPlayer ? state : { ...state, currentPlayer: player };
  return legalMoves(probe).filter((move) => {
    const next = applyMove(probe, move);
    return next?.status === 'won' && next.winner === player;
  });
}

/** Misère: solver moves after which every defender reply completes a defender line. */
function squeezes(state: GameState, solver: Player): number[] {
  return legalMoves(state).filter((move) => {
    const next = applyMove(state, move);
    if (!next || next.status !== 'playing') return false;
    return legalMoves(next).every((reply) => {
      const after = applyMove(next, reply);
      return after?.status === 'won' && after.winner === solver;
    });
  });
}

describe('puzzle pack', () => {
  it('has hundreds of puzzles, each with its own id, easiest tier first', () => {
    expect([1, 2]).toContain(pack.version);
    expect(puzzles.length).toBeGreaterThan(0);
    expect(new Set(puzzles.map((puzzle) => puzzle.id)).size).toBe(puzzles.length);
    const tiers = puzzles.map((puzzle) => puzzle.tier);
    expect(tiers).toEqual(tiers.toSorted((a, b) => a - b));
  });

  it('has an index that lists exactly the pack, in the same order', () => {
    expect(index.version).toBe(pack.version);
    const rows = index.puzzles as unknown[][];
    expect(rows.map((row) => row[0])).toEqual(puzzles.map((puzzle) => puzzle.id));
    rows.forEach((row, at) => {
      const puzzle = puzzles[at]!;
      expect(row.slice(1, 4)).toEqual([puzzle.mode, puzzle.mateIn, puzzle.tier]);
      expect(row[4] ?? undefined).toBe(puzzle.theme);
      const rating = row[5];
      expect(typeof rating === 'number' && rating >= 1 && rating <= 100).toBe(true);
      if (puzzle.rating !== undefined) expect(rating).toBe(puzzle.rating);
    });
  });

  it.each(puzzles.map((puzzle) => [puzzle.id, puzzle] as const))(
    '%s is a forced win as stored',
    (_id, puzzle) => {
      if (!isModeId(puzzle.mode)) throw new Error(`unknown mode ${puzzle.mode}`);
      expect([1, 2]).toContain(puzzle.startingPlayer);
      expect([1, 2, 3]).toContain(puzzle.tier);
      if (puzzle.theme !== undefined) expect(puzzle.theme).toMatch(/^[a-z]+(-[a-z]+)*$/);
      const misere = endsOnDefence(puzzle.mode);

      const start = replay(
        modeById(puzzle.mode).config,
        puzzle.startingPlayer as Player,
        puzzle.moves,
      );
      expect(start?.status).toBe('playing');
      const attacker = start!.currentPlayer;
      const defender = opponentOf(attacker);

      expect(puzzle.mateIn).toBeGreaterThanOrEqual(1);
      expect(puzzle.line).toHaveLength(puzzle.mateIn * 2 - (misere ? 0 : 1));
      expect(puzzle.accept).toHaveLength(puzzle.mateIn);
      // A mate in N is not one the attacker can finish sooner, and the defender
      // is not already threatening to finish first.
      if (!misere) {
        if (puzzle.mateIn >= 2) expect(immediateWins(start!, attacker)).toEqual([]);
        // Under Ultimate the defender's squares depend on where the attacker
        // sends them, so "if it were their turn" has no answer to check here;
        // the stored line, replayed below, is what proves the defence.
        if (start!.config.variant !== 'ultimate') {
          expect(immediateWins(start!, defender)).toEqual([]);
        }
      } else if (puzzle.mateIn >= 2) {
        expect(squeezes(start!, attacker)).toEqual([]);
      }

      let state = start!;
      puzzle.line.forEach((move, ply) => {
        if (ply % 2 === 0) {
          const step = ply / 2;
          if (step < puzzle.mateIn - 1) {
            // Before the last step there is exactly one right answer.
            expect(puzzle.accept[step]).toEqual([move]);
          } else {
            // The last step accepts every square that wins, and only those.
            const wins = misere ? squeezes(state, attacker) : immediateWins(state, attacker);
            expect(puzzle.accept[step]).toEqual(wins);
            expect(wins).toContain(move);
          }
        }

        const next = applyMove(state, move);
        expect(next, `move ${move} at ply ${ply} is legal`).not.toBeNull();
        state = next!;
        if (ply < puzzle.line.length - 1) expect(state.status).toBe('playing');
      });

      expect(state.status).toBe('won');
      expect(state.winner).toBe(attacker);
    },
  );

  it('stays a puzzle under every turn of the board it allows', () => {
    // A sample, one per mode: every turn of every puzzle would be thousands.
    const seen = new Set<string>();
    for (const raw of puzzles) {
      if (seen.has(raw.mode) || !isModeId(raw.mode)) continue;
      seen.add(raw.mode);
      const puzzle = { ...raw, rating: 50, number: 1 } as unknown as Puzzle;
      for (const turn of turnsFor(puzzle.mode)) {
        const turned = transformPuzzle(puzzle, turn);
        expect(turned, `${puzzle.id} turn ${turn}`).not.toBeNull();
        const final = turned!.accept.at(-1)!;
        expect(final).toEqual(final.toSorted((a, b) => a - b));
      }
    }
  });

  it('loads every puzzle on the client, and indexes every one', async () => {
    // The client drops a puzzle it cannot verify; none should be dropped.
    expect((await loadPuzzles()).map((puzzle) => puzzle.id)).toEqual(
      puzzles.map((puzzle) => puzzle.id),
    );
    expect(PUZZLE_INDEX).toHaveLength(puzzles.length);
  });

  it('does not repeat the daily puzzle within a year', () => {
    const start = 20_000;
    const ids = Array.from({ length: 366 }, (_, day) => dailyPuzzle(start + day)?.id);
    expect(new Set(ids).size).toBe(366);
  });
});
