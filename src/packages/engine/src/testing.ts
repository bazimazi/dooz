import { createBoard } from './board.js';
import { applyMove, createGame } from './game.js';
import { type Board, type GameConfig, type GameState, O, type Player, X } from './types.js';

/**
 * Helpers shared by the engine's own tests and the server's.
 *
 * They live in the package rather than in a test file because the server tests
 * need to build the same positions, and a second copy of `board()` is a second
 * place for the row/column arithmetic to be wrong.
 */

/** Build a board from a picture, e.g. `board(3, 'XX.', '.O.', 'O..')`. */
export function board(size: number, ...rows: string[]): Board {
  const cells = createBoard(size);
  rows.forEach((row, r) => {
    Array.from(row).forEach((char, c) => {
      if (char === 'X') cells[r * size + c] = X;
      else if (char === 'O') cells[r * size + c] = O;
    });
  });
  return cells;
}

/** A row of `size` empty cells, for padding a picture out. */
export function blank(size: number): string {
  return '.'.repeat(size);
}

/**
 * Deterministic PRNG so a failing run can be reproduced exactly.
 *
 * Mulberry32 rather than a plain linear congruential generator, because an LCG
 * barely moves on its first output for small seeds - `seeded(0)` through
 * `seeded(23)` all returned 0.236 to three places, so a test sampling "24
 * different seeds" was in fact sampling one.
 */
export function seeded(seed: number): () => number {
  let state = (seed ^ 0x9e37_79b9) >>> 0;
  return () => {
    state = (state + 0x6d2b_79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

/** Play a list of moves from a fresh game, asserting each one is legal. */
export function fromMoves(
  config: GameConfig | number,
  starting: Player,
  moves: readonly number[],
): GameState {
  let state = createGame(config, starting);
  for (const move of moves) {
    const next = applyMove(state, move);
    if (!next) throw new Error(`Illegal move ${move} in test position`);
    state = next;
  }
  return state;
}
