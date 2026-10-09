import { describe, expect, it } from 'vitest';
import { gravityLanding, gravityMoves, isGravityLanding } from '../board.js';
import { findBestMove } from '../bot/index.js';
import { applyMove, canPlay, createGame, legalMoves } from '../game.js';
import { modeById } from '../modes.js';
import { fromMoves, seeded } from '../testing.js';
import { Empty, isGameConfig, O, type Player, X } from '../types.js';

const GRAVITY = modeById('gravity').config;
const SIZE = GRAVITY.size;

/** The landing square of `col` on the board as it stands in `moves`. */
function drop(moves: readonly number[], col: number, starting: Player = X): number {
  const game = fromMoves(GRAVITY, starting, moves);
  return gravityLanding(game.board, SIZE, col);
}

/** Play a sequence of columns, the way a player sees gravity. */
function columns(cols: readonly number[], starting: Player = X) {
  let game = createGame(GRAVITY, starting);
  for (const col of cols) {
    const landing = gravityLanding(game.board, SIZE, col);
    game = applyMove(game, landing)!;
  }
  return game;
}

describe('gravity rules', () => {
  it('needs a board with room to stack', () => {
    expect(isGameConfig(GRAVITY)).toBe(true);
    expect(isGameConfig({ variant: 'gravity', size: 3, winLength: 3 })).toBe(false);
  });

  it('opens only the bottom row of an empty board', () => {
    const game = createGame(GRAVITY, X);
    const bottom = Array.from({ length: SIZE }, (_, col) => (SIZE - 1) * SIZE + col);
    expect(legalMoves(game)).toEqual(bottom);
    expect(canPlay(game, 0)).toBe(false);
  });

  it('stacks marks in a column', () => {
    const first = (SIZE - 1) * SIZE + 3;
    expect(drop([], 3)).toBe(first);
    expect(drop([first], 3)).toBe(first - SIZE);
    const game = fromMoves(GRAVITY, X, [first]);
    expect(isGravityLanding(game.board, SIZE, first - SIZE)).toBe(true);
    expect(isGravityLanding(game.board, SIZE, first - 2 * SIZE)).toBe(false);
  });

  it('closes a full column', () => {
    const game = columns(Array.from({ length: SIZE }, () => 0));
    expect(gravityLanding(game.board, SIZE, 0)).toBe(-1);
    expect(gravityMoves(game.board, SIZE)).toHaveLength(SIZE - 1);
    expect(legalMoves(game).every((move) => move % SIZE !== 0)).toBe(true);
  });

  it('wins across, down and on a diagonal', () => {
    // X drops into 0-3, O answers in 0-2 one row up: X completes the floor.
    const across = columns([0, 0, 1, 1, 2, 2, 3]);
    expect(across.status).toBe('won');
    expect(across.winner).toBe(X);

    const down = columns([4, 5, 4, 5, 4, 5, 4]);
    expect(down.status).toBe('won');
    expect(down.winLine).toHaveLength(4);

    // The classic staircase: X climbs 0,1,2,3 diagonally.
    const diagonal = columns([0, 1, 1, 2, 3, 2, 2, 3, 3, 6, 3]);
    expect(diagonal.status).toBe('won');
    expect(diagonal.winner).toBe(X);
  });

  it('ends every game, and only draws on a full board', () => {
    const random = seeded(3);
    for (let round = 0; round < 60; round++) {
      let game = createGame(GRAVITY, round % 2 === 0 ? X : O);
      while (game.status === 'playing') {
        const moves = legalMoves(game);
        expect(moves.length).toBeGreaterThan(0);
        game = applyMove(game, moves[Math.floor(random() * moves.length)]!)!;
      }
      if (game.status === 'draw') {
        expect(game.board.every((cell) => cell !== Empty)).toBe(true);
      }
    }
  });
});

describe('gravity bot', () => {
  it('only ever plays a landing square', () => {
    const random = seeded(7);
    for (const difficulty of ['beginner', 'easy', 'medium', 'hard'] as const) {
      let game = createGame(GRAVITY, X);
      for (let ply = 0; ply < 16 && game.status === 'playing'; ply++) {
        const move = findBestMove(game, { difficulty, random, timeBudgetMs: 60 })!;
        expect(canPlay(game, move)).toBe(true);
        game = applyMove(game, move)!;
      }
    }
  });

  it('completes four and blocks four', () => {
    // X has three on the floor in columns 0-2; O has three stacked above them.
    const win = columns([0, 0, 1, 1, 2, 2]);
    expect(findBestMove(win, { difficulty: 'beginner' })).toBe(drop(win.moves, 3));

    // Now O to move after X wastes a turn elsewhere: O must take column 3.
    const block = columns([0, 6, 1, 6, 2]);
    expect(findBestMove(block, { difficulty: 'beginner' })).toBe(drop(block.moves, 3));
  });

  it('does not fill the square under a threat', () => {
    //   row 5:  X O O O . . .   O needs (5,4), which opens only once (6,4) is taken
    //   row 6:  X X O X . . .
    const game = columns([0, 2, 1, 1, 3, 3, 0, 2]);
    expect(game.currentPlayer).toBe(X);
    expect(gravityLanding(game.board, SIZE, 4)).toBe(6 * SIZE + 4);

    // Every level that looks ahead at all stays out of column 4.
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const move = findBestMove(game, { difficulty, random: seeded(5), timeBudgetMs: 300 })!;
      expect(move % SIZE).not.toBe(4);
    }
  });
});
