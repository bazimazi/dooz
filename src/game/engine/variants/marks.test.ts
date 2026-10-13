import { describe, expect, it } from 'vitest';
import { isGameConfig, moveSpace } from '../config.js';
import { applyMove, canPlay, createGame, legalMoves, replay, startingPlayerOf } from '../game.js';
import { modeById } from '../modes.js';
import { Empty, type GameConfig, O, type Player, X } from '../types.js';
import { CHAOS, decodeMarkMove, markMove, ORDER } from './marks.js';

const WILD = modeById('wild').config;
const WILD_4 = modeById('wild-4').config;
const ORDER_CHAOS = modeById('order-chaos').config;

/** Moves as `[cell, mark]` pairs, the way a player thinks of them. */
function play(config: GameConfig, starting: Player, moves: readonly [number, Player][]) {
  return replay(
    config,
    starting,
    moves.map(([cell, mark]) => markMove(config, cell, mark)),
  );
}

describe('mark-choice move codes', () => {
  it('pack a square and a mark into one integer', () => {
    expect(moveSpace(WILD)).toBe(18);
    expect(moveSpace(ORDER_CHAOS)).toBe(72);
    expect(markMove(WILD, 4, X)).toBe(4);
    expect(markMove(WILD, 4, O)).toBe(13);
    expect(decodeMarkMove(WILD, 13)).toEqual({ cell: 4, mark: O });
    expect(decodeMarkMove(WILD, 18)).toBeNull();
    expect(decodeMarkMove(WILD, -1)).toBeNull();
  });

  it('offers both marks on every empty square', () => {
    const fresh = createGame(WILD, X);
    expect(legalMoves(fresh)).toEqual(Array.from({ length: 18 }, (_, move) => move));
    const after = applyMove(fresh, markMove(WILD, 0, O))!;
    expect(legalMoves(after)).not.toContain(0);
    expect(legalMoves(after)).not.toContain(9);
    expect(canPlay(after, markMove(WILD, 0, X))).toBe(false);
    expect(after.board[0]).toBe(O);
    expect(after.lastMove).toBe(0);
    expect(after.currentPlayer).toBe(O);
  });
});

describe('wild rules', () => {
  it('is played on 3x3 and 4x4 with a full row to win', () => {
    expect(isGameConfig(WILD)).toBe(true);
    expect(isGameConfig(WILD_4)).toBe(true);
    expect(isGameConfig({ variant: 'wild', size: 4, winLength: 3 })).toBe(false);
    expect(isGameConfig({ variant: 'wild', size: 5, winLength: 5 })).toBe(false);
  });

  it('awards a line of either mark to whoever completed it', () => {
    // X's seat places two Os; O's seat places the third O and wins with it.
    const won = play(WILD, X, [
      [0, O],
      [4, X],
      [1, O],
      [2, O],
    ])!;
    expect(won.status).toBe('won');
    expect(won.winner).toBe(O);
    expect(won.winLine).toEqual([0, 1, 2]);

    const crosses = play(WILD, O, [
      [0, X],
      [3, O],
      [4, X],
      [5, O],
      [8, X],
    ])!;
    expect(crosses.winner).toBe(O);
  });

  it('draws a full board with no line', () => {
    const drawn = play(WILD, X, [
      [0, X],
      [1, O],
      [2, X],
      [3, O],
      [4, X],
      [5, O],
      [6, O],
      [7, X],
      [8, O],
    ])!;
    expect(drawn.status).toBe('draw');
    expect(drawn.winner).toBeNull();
    expect(startingPlayerOf(drawn)).toBe(X);
  });
});

describe('order and chaos rules', () => {
  it('is defined on 6x6 with five to win', () => {
    expect(isGameConfig(ORDER_CHAOS)).toBe(true);
    expect(isGameConfig({ variant: 'order-chaos', size: 7, winLength: 5 })).toBe(false);
    expect(ORDER).toBe(X);
    expect(CHAOS).toBe(O);
  });

  it('gives five alike to Order, even when Chaos makes it', () => {
    // Four Os across the top, placed by both seats; Chaos is to move.
    const moves: [number, Player][] = [
      [0, O],
      [20, X],
      [1, O],
      [21, X],
      [2, O],
      [22, X],
      [3, O],
    ];
    expect(play(ORDER_CHAOS, X, moves)!.currentPlayer).toBe(CHAOS);

    // Chaos, careless: the fifth O.
    const chaosBlunders = play(ORDER_CHAOS, X, [...moves, [4, O]])!;
    expect(chaosBlunders.status).toBe('won');
    expect(chaosBlunders.winner).toBe(ORDER);
    expect(chaosBlunders.winLine).toEqual([0, 1, 2, 3, 4]);

    // Chaos looks elsewhere, and Order finishes it.
    const orderFinishes = play(ORDER_CHAOS, X, [...moves, [30, X], [4, O]])!;
    expect(orderFinishes.status).toBe('won');
    expect(orderFinishes.winner).toBe(ORDER);
  });

  it('counts six alike as a line too', () => {
    const moves: [number, Player][] = [
      [0, X],
      [1, X],
      [2, X],
      [3, X],
      [5, X],
    ];
    // Interleave harmless spoilers so nobody completes five early.
    const spaced: [number, Player][] = [];
    moves.forEach((move, index) => {
      spaced.push(move);
      spaced.push([30 + index, index % 2 === 0 ? X : O]);
    });
    const six = play(ORDER_CHAOS, X, [...spaced, [4, X]])!;
    expect(six.status).toBe('won');
    expect(six.winLine).toHaveLength(6);
  });

  it('gives a full board without a line to Chaos - there are no draws', () => {
    // Pairs of each mark, shifted two squares a row: no run of three anywhere,
    // across, down or along either diagonal.
    const pattern = (cell: number): Player => {
      const row = Math.floor(cell / 6);
      const col = cell % 6;
      return (col + 2 * row) % 4 < 2 ? X : O;
    };
    const moves: [number, Player][] = Array.from({ length: 36 }, (_, cell) => [
      cell,
      pattern(cell),
    ]);
    const full = play(ORDER_CHAOS, X, moves)!;
    expect(full.board.every((cell) => cell !== Empty)).toBe(true);
    expect(full.status).toBe('won');
    expect(full.winner).toBe(CHAOS);
    expect(full.winLine).toBeNull();
  });
});
