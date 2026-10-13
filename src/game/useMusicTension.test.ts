import { applyMove, createGame, type GameState, X } from '@/game/engine';
import { describe, expect, it } from 'vitest';
import { tensionOf } from './useMusicTension';

function play(moves: number[]): GameState {
  let game = createGame(3, X);
  for (const move of moves) game = applyMove(game, move)!;
  return game;
}

describe('tensionOf', () => {
  it('starts calm and rises as the game goes on', () => {
    const empty = tensionOf(play([]), true);
    const later = tensionOf(play([4, 0]), true);
    expect(empty).toBeLessThan(0.2);
    expect(later).toBeGreaterThan(empty);
  });

  it('jumps when a square wins or loses the game next move', () => {
    // X has 0 and 1; O to move must block 2.
    const quiet = tensionOf(play([0, 4, 8]), true);
    const threatened = tensionOf(play([0, 4, 1]), true);
    expect(threatened).toBeGreaterThan(quiet + 0.25);
  });

  it('leaves threats out when assistance is off, and calms once the game is over', () => {
    const threatened = play([0, 4, 1]);
    expect(tensionOf(threatened, false)).toBeLessThan(tensionOf(threatened, true));
    expect(tensionOf(play([0, 3, 1, 4, 2]), true)).toBe(0.15);
  });

  it('stays within 0 and 1', () => {
    const full = play([0, 1, 2, 4, 3, 5, 7, 6]);
    const value = tensionOf(full, true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  });
});
