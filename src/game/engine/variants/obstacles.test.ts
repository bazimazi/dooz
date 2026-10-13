import { describe, expect, it } from 'vitest';
import { colOf, rowOf } from '../board.js';
import { configKey, isGameConfig, isSeeded, sameConfig, withSeed } from '../config.js';
import { applyMove, canPlay, createGame, legalMoves, replay, toRecord } from '../game.js';
import { modeById } from '../modes.js';
import { findWinLineFrom } from '../rules.js';
import { seeded } from '../testing.js';
import { Blocked, type GameConfig, X } from '../types.js';
import { obstacleCells, obstacleCount } from './obstacles.js';

const OBSTACLES = modeById('obstacles').config;
const SIZE = OBSTACLES.size;

function seededConfig(seed: number): GameConfig {
  return { ...OBSTACLES, seed };
}

describe('obstacle layout', () => {
  it('is the same for the same seed and differs between seeds', () => {
    expect(obstacleCells(seededConfig(42))).toEqual(obstacleCells(seededConfig(42)));
    const layouts = new Set(
      Array.from({ length: 12 }, (_, seed) => obstacleCells(seededConfig(seed)).join(',')),
    );
    expect(layouts.size).toBeGreaterThan(8);
  });

  it('places a balanced, spread-out handful away from the centre', () => {
    const mid = Math.floor(SIZE / 2);
    for (let seed = 0; seed < 200; seed++) {
      const cells = obstacleCells(seededConfig(seed * 7919));
      expect(cells).toHaveLength(obstacleCount(SIZE));
      const set = new Set(cells);
      for (const cell of cells) {
        // Point-symmetric through the centre: every rock has a twin.
        expect(set.has(SIZE * SIZE - 1 - cell)).toBe(true);
        // Clear of the middle, where the opening is played.
        const distance = Math.max(
          Math.abs(rowOf(SIZE, cell) - mid),
          Math.abs(colOf(SIZE, cell) - mid),
        );
        expect(distance).toBeGreaterThanOrEqual(2);
        // No two rocks touch, even at a corner.
        for (const other of cells) {
          if (other === cell) continue;
          const apart = Math.max(
            Math.abs(rowOf(SIZE, cell) - rowOf(SIZE, other)),
            Math.abs(colOf(SIZE, cell) - colOf(SIZE, other)),
          );
          expect(apart).toBeGreaterThan(1);
        }
      }
    }
  });
});

describe('obstacles rules', () => {
  it('accepts a seed and keeps it out of the mode identity', () => {
    expect(isSeeded(OBSTACLES)).toBe(true);
    expect(isGameConfig(seededConfig(123))).toBe(true);
    expect(isGameConfig(seededConfig(-1))).toBe(false);
    expect(isGameConfig({ ...OBSTACLES, winLength: 4 })).toBe(false);
    expect(configKey(seededConfig(5))).toBe(configKey(OBSTACLES));
    expect(sameConfig(seededConfig(5), OBSTACLES)).toBe(true);
  });

  it('gives each new game a fresh seed', () => {
    const random = seeded(3);
    const first = withSeed(OBSTACLES, random);
    const second = withSeed(OBSTACLES, random);
    expect(first.seed).toBeTypeOf('number');
    expect(first.seed).not.toBe(second.seed);
  });

  it('starts with the seeded squares blocked and unplayable', () => {
    const config = seededConfig(99);
    const game = createGame(config, X);
    const rocks = obstacleCells(config);
    for (const cell of rocks) {
      expect(game.board[cell]).toBe(Blocked);
      expect(canPlay(game, cell)).toBe(false);
    }
    expect(legalMoves(game)).toHaveLength(SIZE * SIZE - rocks.length);
  });

  it('replays to the same board from the record alone', () => {
    const config = seededConfig(2024);
    let game = createGame(config, X);
    for (const move of legalMoves(game).slice(0, 6)) game = applyMove(game, move) ?? game;
    const record = toRecord(game);
    expect(record.config.seed).toBe(2024);
    expect(replay(record.config, record.startingPlayer, record.moves)).toEqual(game);
  });

  it('lets no line run through a rock', () => {
    const config = seededConfig(7);
    const game = createGame(config, X);
    const board = game.board.slice();
    const rock = obstacleCells(config)[0]!;
    const row = rowOf(SIZE, rock);
    // Fill the rock's row on both sides of it; whatever the run length either
    // side, nothing reaches across the rock.
    for (let col = 0; col < SIZE; col++) {
      const cell = row * SIZE + col;
      if (cell !== rock) board[cell] = X;
    }
    const left = row * SIZE + Math.max(0, colOf(SIZE, rock) - 1);
    const line = findWinLineFrom(board, SIZE, left === rock ? rock + 1 : left, 5);
    if (line) expect(line).not.toContain(rock);
  });
});
