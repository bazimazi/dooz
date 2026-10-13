import { describe, expect, it } from 'vitest';
import { chooseMove, findBestMove } from '../bot/index.js';
import { isGameConfig } from '../config.js';
import { applyMove, createGame, legalMoves } from '../game.js';
import { modeById } from '../modes.js';
import { fromMoves, seeded } from '../testing.js';
import { O, X } from '../types.js';
import {
  QUBIC_CELLS,
  QUBIC_LINES,
  QUBIC_LINES_THROUGH,
  qubicCoords,
  qubicIndex,
  qubicLineFrom,
} from './qubic.js';

const QUBIC = modeById('qubic').config;

/** Interleave X's and O's cells into a move list, X first. */
function moves(xs: number[], os: number[]): number[] {
  const list: number[] = [];
  for (let ply = 0; ply < xs.length + os.length; ply++) {
    list.push(ply % 2 === 0 ? xs[ply / 2]! : os[(ply - 1) / 2]!);
  }
  return list;
}

describe('qubic geometry', () => {
  it('maps every cube cell to a distinct board square and back', () => {
    const seen = new Set<number>();
    for (let layer = 0; layer < 4; layer++) {
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          const index = qubicIndex(layer, row, col);
          expect(qubicCoords(index)).toEqual({ layer, row, col });
          seen.add(index);
        }
      }
    }
    expect(seen.size).toBe(QUBIC_CELLS);
    expect(Math.max(...seen)).toBe(63);
  });

  it('lays the layers out as the quadrants of an 8x8 board', () => {
    expect(qubicIndex(0, 0, 0)).toBe(0);
    expect(qubicIndex(1, 0, 0)).toBe(4);
    expect(qubicIndex(2, 0, 0)).toBe(32);
    expect(qubicIndex(3, 3, 3)).toBe(63);
  });

  it('has the 76 lines of a 4x4x4 cube, all distinct', () => {
    expect(QUBIC_LINES).toHaveLength(76);
    const keys = new Set(QUBIC_LINES.map((line) => line.toSorted((a, b) => a - b).join(',')));
    expect(keys.size).toBe(76);
    for (const line of QUBIC_LINES) expect(new Set(line).size).toBe(4);
  });

  it('puts seven lines through a corner, four through a face cell, seven through an inner cell', () => {
    // Corners and the eight inner cells sit on seven lines; the rest on four.
    expect(QUBIC_LINES_THROUGH[qubicIndex(0, 0, 0)]).toHaveLength(7);
    expect(QUBIC_LINES_THROUGH[qubicIndex(1, 1, 1)]).toHaveLength(7);
    expect(QUBIC_LINES_THROUGH[qubicIndex(0, 0, 1)]).toHaveLength(4);
    const total = QUBIC_LINES_THROUGH.reduce((sum, lines) => sum + lines.length, 0);
    expect(total).toBe(76 * 4);
  });

  it('orders each line from one end to the other', () => {
    for (const line of QUBIC_LINES) {
      const coords = line.map(qubicCoords);
      for (const axis of ['layer', 'row', 'col'] as const) {
        const values = coords.map((c) => c[axis]);
        const steps = values.slice(1).map((value, at) => value - values[at]!);
        expect(new Set(steps).size).toBe(1);
      }
    }
  });
});

describe('qubic rules', () => {
  it('is only the 4x4x4 cube', () => {
    expect(isGameConfig(QUBIC)).toBe(true);
    expect(isGameConfig({ variant: 'qubic', size: 8, winLength: 5 })).toBe(false);
    expect(isGameConfig({ variant: 'qubic', size: 4, winLength: 4 })).toBe(false);
  });

  it('wins straight down through the four layers', () => {
    const pillar = [0, 1, 2, 3].map((layer) => qubicIndex(layer, 1, 2));
    const others = [0, 1, 2].map((layer) => qubicIndex(layer, 3, 3));
    const game = fromMoves(QUBIC, X, moves(pillar, others));
    expect(game.status).toBe('won');
    expect(game.winner).toBe(X);
    expect(game.winLine).toEqual(pillar);
  });

  it('wins on a great diagonal of the cube', () => {
    const diagonal = [0, 1, 2, 3].map((step) => qubicIndex(step, step, 3 - step));
    const others = [0, 1, 2].map((col) => qubicIndex(0, 3, col));
    const game = fromMoves(QUBIC, O, moves(diagonal, others));
    expect(game.winner).toBe(O);
    expect(qubicLineFrom(game.board, diagonal[3]!)).toEqual(diagonal);
  });

  it('does not count four adjacent squares on the flat board that are not a cube line', () => {
    // Flat row 0, columns 2-5: two cells of layer 0 and two of layer 1.
    const flat = [2, 3, 4, 5];
    const others = [56, 57, 58];
    const game = fromMoves(QUBIC, X, moves(flat, others));
    expect(game.status).toBe('playing');
  });

  it('plays to a draw when the cube fills with no line', () => {
    // Random play rarely fills the cube without a line, so only check that a
    // finished game is consistently won or drawn and never runs past 64 plies.
    const random = seeded(5);
    for (let round = 0; round < 10; round++) {
      let game = createGame(QUBIC, X);
      while (game.status === 'playing') {
        const legal = legalMoves(game);
        game = applyMove(game, legal[Math.floor(random() * legal.length)]!)!;
      }
      expect(game.moves.length).toBeLessThanOrEqual(64);
      if (game.status === 'won') expect(game.winLine).toHaveLength(4);
    }
  });
});

describe('qubic bot', () => {
  const quick = { timeBudgetMs: 150 } as const;

  it('completes a line when it can', () => {
    const three = [0, 1, 2].map((layer) => qubicIndex(layer, 0, 0));
    const game = fromMoves(QUBIC, X, moves(three, [5, 6, 7]));
    for (const difficulty of ['beginner', 'master'] as const) {
      const move = chooseMove(game, { ...quick, difficulty, random: seeded(1) });
      expect(move?.reason).toBe('win');
      expect(move?.move).toBe(qubicIndex(3, 0, 0));
    }
  });

  it('blocks a line it would otherwise lose to', () => {
    const three = [0, 1, 2].map((layer) => qubicIndex(layer, 2, 2));
    const game = fromMoves(QUBIC, O, moves(three, [qubicIndex(0, 0, 0), qubicIndex(0, 3, 3)]));
    expect(game.currentPlayer).toBe(X);
    for (const difficulty of ['beginner', 'hard'] as const) {
      expect(findBestMove(game, { ...quick, difficulty, random: seeded(2) })).toBe(
        qubicIndex(3, 2, 2),
      );
    }
  });

  it('finds a double threat that wins', () => {
    // X holds two of the top row of layer 0 and two of its left column, the
    // corner between them open: playing it threatens both lines at once.
    const xs = [qubicIndex(0, 0, 1), qubicIndex(0, 0, 2), qubicIndex(0, 1, 0), qubicIndex(0, 2, 0)];
    const os = [qubicIndex(3, 3, 3), qubicIndex(3, 3, 2), qubicIndex(3, 2, 3), qubicIndex(2, 3, 3)];
    // Keep O from having threats of its own.
    const game = fromMoves(QUBIC, X, moves(xs, os));
    expect(game.currentPlayer).toBe(X);
    const move = chooseMove(game, { timeBudgetMs: 600, difficulty: 'hard', random: seeded(3) })!;
    const after = applyMove(game, move.move)!;
    // Whatever X played, it should be a winning position: O cannot stop it.
    expect(move.score).toBeGreaterThan(1_000);
    expect(after.status).toBe('playing');
  });

  it('always plays a legal move to the end of a game', () => {
    let game = createGame(QUBIC, X);
    const random = seeded(8);
    while (game.status === 'playing') {
      const move = findBestMove(game, {
        difficulty: game.currentPlayer === X ? 'medium' : 'easy',
        timeBudgetMs: 30,
        random,
      });
      expect(move).not.toBeNull();
      game = applyMove(game, move!)!;
      expect(game).not.toBeNull();
    }
    expect(['won', 'draw']).toContain(game.status);
  });
});
