import { describe, expect, it } from 'vitest';
import { gravityLanding } from '../board.js';
import { isGameConfig, swapMove } from '../config.js';
import { applyMove, canPlay, createGame, legalMoves, replay } from '../game.js';
import { modeById } from '../modes.js';
import { Blocked, Empty, O, type Player, X } from '../types.js';

const CONNECT4 = modeById('connect4').config;
const PLAIN = { ...CONNECT4, opening: undefined };
const SIZE = 7;

/** Play a sequence of columns, the way a player sees Connect Four. */
function columns(cols: readonly number[], starting: Player = X) {
  let game = createGame(PLAIN, starting);
  for (const col of cols) {
    const landing = gravityLanding(game.board, SIZE, col);
    const next = applyMove(game, landing);
    if (!next) throw new Error(`Column ${col} refused`);
    game = next;
  }
  return game;
}

/** A full game with no line, found by random play and kept as a fixture. */
const DRAWN = [
  2, 4, 0, 5, 3, 2, 6, 1, 5, 0, 2, 1, 0, 5, 3, 1, 0, 6, 1, 0, 3, 3, 0, 6, 5, 5, 5, 2, 4, 4, 2, 4, 6,
  6, 6, 1, 3, 4, 1, 2, 4, 3,
];

describe('connect four rules', () => {
  it('is only defined as seven columns of six, four to win', () => {
    expect(isGameConfig(CONNECT4)).toBe(true);
    expect(isGameConfig({ variant: 'connect4', size: 6, winLength: 4 })).toBe(false);
    expect(isGameConfig({ variant: 'connect4', size: 7, winLength: 5 })).toBe(false);
    expect(isGameConfig({ ...CONNECT4, opening: 'pro' })).toBe(false);
  });

  it('blocks the top row so each column holds six', () => {
    const game = createGame(PLAIN, X);
    for (let col = 0; col < SIZE; col++) expect(game.board[col]).toBe(Blocked);
    expect(game.board.slice(SIZE).every((cell) => cell === Empty)).toBe(true);
    expect(legalMoves(game)).toEqual(Array.from({ length: SIZE }, (_, col) => 6 * SIZE + col));
  });

  it('closes a column once six discs are in it', () => {
    const full = columns([3, 3, 3, 3, 3, 3]);
    expect(full.board.slice(SIZE).filter((cell) => cell !== Empty)).toHaveLength(6);
    expect(gravityLanding(full.board, SIZE, 3)).toBe(-1);
    expect(legalMoves(full).some((move) => move % SIZE === 3)).toBe(false);
    expect(canPlay(full, 3)).toBe(false);
  });

  it('wins with four in a column, row or diagonal', () => {
    const vertical = columns([0, 1, 0, 1, 0, 1, 0]);
    expect(vertical.status).toBe('won');
    expect(vertical.winner).toBe(X);
    expect(vertical.winLine).toHaveLength(4);

    const diagonal = columns([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]);
    expect(diagonal.status).toBe('won');
    expect(diagonal.winner).toBe(X);
  });

  it('draws a full board with no line', () => {
    const drawn = columns(DRAWN);
    expect(drawn.status).toBe('draw');
    expect(drawn.board.every((cell) => cell !== Empty)).toBe(true);
    expect(drawn.board.slice(0, SIZE).every((cell) => cell === Blocked)).toBe(true);
  });

  it('offers the swap on the second move only', () => {
    const code = swapMove(CONNECT4)!;
    expect(code).toBe(49);
    const opened = replay(CONNECT4, X, [6 * SIZE + 3])!;
    expect(legalMoves(opened)).toContain(code);
    const swapped = applyMove(opened, code)!;
    expect(swapped.board[6 * SIZE + 3]).toBe(O);
    expect(swapped.currentPlayer).toBe(X);
    expect(legalMoves(swapped)).not.toContain(code);
  });
});
