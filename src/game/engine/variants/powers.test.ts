import { describe, expect, it } from 'vitest';
import { isGameConfig, moveSpace } from '../config.js';
import { applyMove, canPlay, createGame, legalMoves, replay, toRecord } from '../game.js';
import { modeById } from '../modes.js';
import { Blocked, Empty, O, X } from '../types.js';
import { decodePowerMove, POWER_CHARGES, powerCharges, powerMove } from './powers.js';

const POWERS = modeById('powers').config;
const CELLS = POWERS.size * POWERS.size;
const bomb = (cell: number) => powerMove(POWERS, cell, 'bomb');
const wall = (cell: number) => powerMove(POWERS, cell, 'wall');

describe('powers move codes', () => {
  it('put each power above the cell range', () => {
    expect(isGameConfig(POWERS)).toBe(true);
    expect(moveSpace(POWERS)).toBe(CELLS * 3);
    expect(bomb(10)).toBe(10 + CELLS);
    expect(wall(10)).toBe(10 + CELLS * 2);
    expect(decodePowerMove(POWERS, wall(10))).toEqual({ cell: 10, kind: 'wall' });
    expect(decodePowerMove(POWERS, CELLS * 3)).toBeNull();
  });
});

describe('powers rules', () => {
  it('starts both players with one of each power', () => {
    const fresh = createGame(POWERS, X);
    expect(powerCharges(fresh, X)).toEqual(POWER_CHARGES);
    expect(powerCharges(fresh, O)).toEqual(POWER_CHARGES);
    // Nothing to bomb yet, but the wall is open on every empty square.
    expect(legalMoves(fresh).filter((move) => move >= CELLS && move < CELLS * 2)).toEqual([]);
    expect(legalMoves(fresh).filter((move) => move >= CELLS * 2)).toHaveLength(CELLS);
  });

  it('bombs one opposing mark, once, as a whole turn', () => {
    const game = replay(POWERS, X, [40, 41])!;
    expect(canPlay(game, bomb(40))).toBe(false); // X's own mark
    expect(canPlay(game, bomb(0))).toBe(false); // an empty square
    expect(canPlay(game, bomb(41))).toBe(true);

    const bombed = applyMove(game, bomb(41))!;
    expect(bombed.board[41]).toBe(Empty);
    expect(bombed.currentPlayer).toBe(O);
    expect(bombed.lastMove).toBe(41);
    expect(powerCharges(bombed, X).bomb).toBe(0);
    expect(powerCharges(bombed, O).bomb).toBe(1);

    const later = applyMove(applyMove(bombed, 41)!, 50)!;
    expect(canPlay(later, bomb(41))).toBe(false);
  });

  it('walls an empty square for good, and no line runs through it', () => {
    const walled = replay(POWERS, X, [wall(4)])!;
    expect(walled.board[4]).toBe(Blocked);
    expect(powerCharges(walled, X).wall).toBe(0);
    expect(canPlay(walled, 4)).toBe(false);
    expect(canPlay(walled, bomb(4))).toBe(false);

    // X builds 0-1-2-3 and 5-6-7-8 around the wall: eight in the row, and
    // neither side of the wall is five.
    const around = replay(POWERS, O, [
      wall(4),
      0,
      18,
      1,
      20,
      2,
      22,
      3,
      24,
      5,
      26,
      6,
      36,
      7,
      38,
      8,
    ])!;
    expect(around.status).toBe('playing');
    expect(around.board.slice(0, 9).filter((cell) => cell === X)).toHaveLength(8);
  });

  it('still wins with five in a row', () => {
    const won = replay(POWERS, X, [0, 9, 1, 10, 2, 11, 3, 12, 4])!;
    expect(won.status).toBe('won');
    expect(won.winner).toBe(X);
    expect(won.winLine).toEqual([0, 1, 2, 3, 4]);
  });

  it('is rebuilt exactly from the moves, charges included', () => {
    const game = replay(POWERS, O, [40, 41, bomb(41), wall(0), 30])!;
    expect(powerCharges(game, O)).toEqual({ bomb: 0, wall: 1 });
    expect(powerCharges(game, X)).toEqual({ bomb: 1, wall: 0 });
    const record = toRecord(game);
    expect(replay(record.config, record.startingPlayer, record.moves)).toEqual(game);
  });
});
