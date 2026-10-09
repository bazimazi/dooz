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
import pack from './pack.json';

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
}

const puzzles: readonly PackPuzzle[] = pack.puzzles;

/**
 * Squares where `player` would complete a line with their next mark.
 *
 * For the side to move, the legal moves that win. For the side waiting, the
 * line modes are asked with the turn handed over; vanish has its own helper,
 * because which of a player's marks lifts next depends on who is moving.
 */
function immediateWins(state: GameState, player: Player): number[] {
  if (player !== state.currentPlayer && state.config.variant === 'vanish') {
    return vanishWinningMoves(state, player);
  }
  const probe = player === state.currentPlayer ? state : { ...state, currentPlayer: player };
  return legalMoves(probe).filter((move) => applyMove(probe, move)?.status === 'won');
}

describe('puzzle pack', () => {
  it('has puzzles, each with its own id, easiest tier first', () => {
    expect(pack.version).toBe(1);
    expect(puzzles.length).toBeGreaterThan(0);
    expect(new Set(puzzles.map((puzzle) => puzzle.id)).size).toBe(puzzles.length);
    const tiers = puzzles.map((puzzle) => puzzle.tier);
    expect(tiers).toEqual(tiers.toSorted((a, b) => a - b));
  });

  it.each(puzzles.map((puzzle) => [puzzle.id, puzzle] as const))(
    '%s is a forced win as stored',
    (_id, puzzle) => {
      if (!isModeId(puzzle.mode)) throw new Error(`unknown mode ${puzzle.mode}`);
      expect([1, 2]).toContain(puzzle.startingPlayer);
      expect([1, 2, 3]).toContain(puzzle.tier);
      if (puzzle.theme !== undefined) expect(puzzle.theme).toMatch(/^[a-z]+(-[a-z]+)*$/);

      const start = replay(
        modeById(puzzle.mode).config,
        puzzle.startingPlayer as Player,
        puzzle.moves,
      );
      expect(start?.status).toBe('playing');
      const attacker = start!.currentPlayer;
      const defender = opponentOf(attacker);

      expect(puzzle.mateIn).toBeGreaterThanOrEqual(1);
      expect(puzzle.line).toHaveLength(puzzle.mateIn * 2 - 1);
      expect(puzzle.accept).toHaveLength(puzzle.mateIn);
      // A mate in N is not one the attacker can finish sooner, and the defender
      // is not already threatening to finish first.
      if (puzzle.mateIn >= 2) expect(immediateWins(start!, attacker)).toEqual([]);
      expect(immediateWins(start!, defender)).toEqual([]);

      let state = start!;
      puzzle.line.forEach((move, ply) => {
        if (ply % 2 === 0) {
          const step = ply / 2;
          if (step < puzzle.mateIn - 1) {
            // Before the last step there is exactly one right answer.
            expect(puzzle.accept[step]).toEqual([move]);
          } else {
            // The last step accepts every square that wins, and only those.
            const wins = immediateWins(state, attacker);
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
});
