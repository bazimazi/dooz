import { describe, expect, it } from 'vitest';
import {
  applyMove,
  createGame,
  encodeQuantumMove,
  type GameState,
  legalMoves,
  modeById,
  X,
} from '@/game/engine';
import { seeded } from '@/game/engine/testing';
import { snapshotSchema } from '@/protocol';
import { toSnapshot } from './lobby.js';

/**
 * Per-variant state crosses the wire with the snapshot, and the schema both
 * accepts it and refuses it on a rule set it does not belong to.
 */

function randomGame(mode: 'pente' | 'quantum' | 'qubic', plies: number, seed: number): GameState {
  const random = seeded(seed);
  let game = createGame(modeById(mode).config, X);
  for (let ply = 0; ply < plies && game.status === 'playing'; ply++) {
    const legal = legalMoves(game);
    game = applyMove(game, legal[Math.floor(random() * legal.length)]!)!;
  }
  return game;
}

describe('snapshot extra state', () => {
  it('carries Pente captures and Quantum marks intact', () => {
    for (const mode of ['pente', 'quantum'] as const) {
      for (let seed = 0; seed < 8; seed++) {
        const game = randomGame(mode, mode === 'pente' ? 120 : 9, seed);
        const parsed = snapshotSchema.parse(JSON.parse(JSON.stringify(toSnapshot(game))));
        expect(parsed.extra).toEqual(game.extra);
        expect(parsed.moves).toEqual(game.moves);
      }
    }
  });

  it('accepts Qubic, which carries none, and its 8x8 board', () => {
    const game = randomGame('qubic', 20, 3);
    const parsed = snapshotSchema.parse(toSnapshot(game));
    expect(parsed.extra).toBeUndefined();
    expect(parsed.board).toHaveLength(64);
  });

  it('accepts quantum move codes above the cell range', () => {
    let game = createGame(modeById('quantum').config, X);
    for (const [a, b] of [
      [0, 1],
      [1, 2],
      [0, 2],
    ] as const) {
      game = applyMove(
        game,
        encodeQuantumMove({ collapse: null, follow: { kind: 'spooky', cells: [a, b] } }),
      )!;
    }
    // A collapse code is above 91.
    game = applyMove(
      game,
      encodeQuantumMove({ collapse: 1, follow: { kind: 'spooky', cells: [4, 5] } }),
    )!;
    expect(game.moves.at(-1)).toBeGreaterThan(90);
    expect(() => snapshotSchema.parse(toSnapshot(game))).not.toThrow();
  });

  it('refuses one rule set’s state on another', () => {
    const pente = randomGame('pente', 10, 1);
    const snapshot = toSnapshot(createGame(modeById('gomoku-13').config, X));
    expect(() => snapshotSchema.parse({ ...snapshot, extra: pente.extra })).toThrow();
  });
});
