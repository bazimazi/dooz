import { describe, expect, it } from 'vitest';
import {
  applyMove,
  createGame,
  type GameState,
  legalMoves,
  modeById,
  type Player,
  quantumOf,
} from '@/game/engine';
import { seeded } from '@/game/engine/testing';
import { snapshotSchema } from '@/protocol';
import { type Client, createHarness, currentSnapshot, resultOf } from './test-support.js';

/**
 * Pente, Qubic and Quantum played to the end through the lobby: the server
 * drives them by the same rules, the snapshots carry their extra state and
 * survive the client's own parsing, and a finished game produces a result.
 */

function playOut(mode: 'pente' | 'qubic' | 'quantum', seed: number) {
  // A whole game of fast moves would trip the per-connection rate limit.
  const harness = createHarness({ messageBurst: 1_000 });
  try {
    const config = modeById(mode).config;
    const a = harness.join('Ada');
    const b = harness.join('Bob');
    a.send({ type: 'queue', config, ranked: false });
    b.send({ type: 'queue', config, ranked: false });

    const random = seeded(seed);
    const youOf = (client: Client) => client.last('matched')!.you as Player;
    // The client's own rebuild of the game, kept in step with the server's.
    const first = currentSnapshot(a)!;
    let local: GameState = createGame(config, first.currentPlayer);

    for (let guard = 0; guard < 200; guard++) {
      const snapshot = currentSnapshot(a)!;
      if (snapshot.status !== 'playing') break;
      const mover = snapshot.currentPlayer === youOf(a) ? a : b;
      const legal = legalMoves(local);
      const move = legal[Math.floor(random() * legal.length)]!;
      mover.send({ type: 'move', index: move });
      local = applyMove(local, move)!;

      const after = currentSnapshot(a)!;
      expect(after.moves).toEqual(local.moves);
      expect(after.board).toEqual(local.board);
      expect(after.extra).toEqual(local.extra);
      // What the client would do with it: parse it as hostile input.
      expect(snapshotSchema.safeParse(after).success).toBe(true);
    }

    const final = currentSnapshot(a)!;
    expect(final.status).not.toBe('playing');
    expect(final.winner).toBe(local.winner);
    expect(resultOf(a)).toBeDefined();
    return local;
  } finally {
    harness.close();
  }
}

describe('new rule sets online', () => {
  it('plays Pente to the end, captures and all', () => {
    const game = playOut('pente', 3);
    expect(game.extra?.kind).toBe('pente');
  });

  it('plays Qubic to the end on its cube', () => {
    const game = playOut('qubic', 4);
    expect(game.board).toHaveLength(64);
  });

  it('plays Quantum to the end, collapse codes included', () => {
    for (const seed of [5, 6, 7]) {
      const game = playOut('quantum', seed);
      expect(quantumOf(game).marks.length).toBeGreaterThan(0);
    }
  });
});
