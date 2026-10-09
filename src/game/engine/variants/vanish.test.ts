import { describe, expect, it } from 'vitest';
import { chooseMove, findBestMove } from '../bot/index.js';
import { solveVanish, vanishQueues, vanishVerdict, vanishWinningMoves } from '../bot/vanish.js';
import { applyMove, canPlay, createGame, legalMoves } from '../game.js';
import { modeById } from '../modes.js';
import { fromMoves, seeded } from '../testing.js';
import { Empty, isGameConfig, O, X } from '../types.js';
import { VANISH_MOVE_LIMIT, vanishedBy, vanishingNext } from './vanish.js';

const VANISH = modeById('vanish').config;

describe('vanish rules', () => {
  it('is only defined on a 3x3 board with three in a row', () => {
    expect(isGameConfig(VANISH)).toBe(true);
    expect(isGameConfig({ variant: 'vanish', size: 4, winLength: 3 })).toBe(false);
    expect(isGameConfig({ variant: 'vanish', size: 3, winLength: 4 })).toBe(false);
  });

  it('plays like classic until a player has three marks down', () => {
    const game = fromMoves(VANISH, X, [0, 4, 8, 2, 6]);
    expect(game.board.filter((cell) => cell !== Empty)).toHaveLength(5);
    expect(vanishedBy(game)).toBeNull();
  });

  it('lifts the oldest mark when a fourth is placed', () => {
    // X: 0, 2, 7, then 5 (lifting 0). O: 4, 1, 3 - and now O's fourth lifts 4.
    const before = fromMoves(VANISH, X, [0, 4, 2, 1, 7, 3, 5]);
    expect(before.board[0]).toBe(Empty);
    expect(vanishingNext(before)).toEqual({ mover: 4, waiting: 2 });

    const after = applyMove(before, 8)!;
    expect(after.status).toBe('playing');
    expect(after.board[4]).toBe(Empty);
    expect(after.board[8]).toBe(O);
    expect(vanishedBy(after)).toBe(4);
    expect(after.board.filter((cell) => cell !== Empty)).toHaveLength(6);
  });

  it('will not count a line through the mark that is leaving', () => {
    // X holds 0 (oldest), 1 and 8. Playing 2 would finish the top row, but 0 is
    // lifted first - so the move is legal and wins nothing.
    const game = fromMoves(VANISH, X, [0, 4, 1, 3, 8, 6]);
    expect(vanishingNext(game).mover).toBe(0);
    const after = applyMove(game, 2)!;
    expect(after.status).toBe('playing');
    expect(after.board[0]).toBe(Empty);
    expect(vanishWinningMoves(game, X)).toEqual([]);
  });

  it('refuses the square of the mark about to vanish', () => {
    const game = fromMoves(VANISH, X, [0, 4, 8, 2, 6, 7]);
    expect(vanishingNext(game).mover).toBe(0);
    expect(canPlay(game, 0)).toBe(false);
    expect(legalMoves(game)).not.toContain(0);
  });

  it('wins on a line made of marks that stay', () => {
    // X: 0, 1 then 2 completes the top row on the fifth ply.
    const won = fromMoves(VANISH, X, [0, 4, 1, 5, 2]);
    expect(won.status).toBe('won');
    expect(won.winner).toBe(X);
    expect(won.winLine).toEqual([0, 1, 2]);
  });

  it('never fills the board and draws at the move limit', () => {
    const random = seeded(12);
    let game = createGame(VANISH, X);
    let longest = 0;
    for (let round = 0; round < 200 && game.status === 'playing'; round++) {
      game = createGame(VANISH, round % 2 === 0 ? X : O);
      while (game.status === 'playing') {
        const moves = legalMoves(game);
        expect(moves.length).toBeGreaterThanOrEqual(3);
        game = applyMove(game, moves[Math.floor(random() * moves.length)]!)!;
        expect(game.board.filter((cell) => cell !== Empty).length).toBeLessThanOrEqual(6);
      }
      longest = Math.max(longest, game.moves.length);
      if (game.status === 'draw') {
        expect(game.moves).toHaveLength(VANISH_MOVE_LIMIT);
        expect(game.winner).toBeNull();
      }
    }
    expect(longest).toBeLessThanOrEqual(VANISH_MOVE_LIMIT);
  });
});

describe('vanish solution', () => {
  it('reaches every position from the empty board', () => {
    expect(solveVanish().stateCount).toBe(73_450);
  });

  it('is a first-player win in thirteen plies, from an edge', () => {
    const verdict = vanishVerdict(createGame(VANISH, X));
    expect(verdict).toEqual({ value: 1, distance: 13 });

    // Only the four edge openings keep the win; corners and the centre let the
    // second player hold.
    for (const edge of [1, 3, 5, 7]) {
      expect(vanishVerdict(fromMoves(VANISH, X, [edge]))).toEqual({ value: -1, distance: 12 });
    }
    for (const other of [0, 2, 4, 6, 8]) {
      expect(vanishVerdict(fromMoves(VANISH, X, [other])).value).toBe(0);
    }
  });

  it('reads the queues oldest first, mover first', () => {
    const game = fromMoves(VANISH, X, [0, 4, 8, 2, 6, 7, 1]);
    // O to move. O has 4, 2, 7 down; X has 8, 6, 1 (0 was lifted).
    expect(game.currentPlayer).toBe(O);
    expect(vanishQueues(game)).toEqual({ mover: [4, 2, 7], other: [8, 6, 1] });
  });
});

describe('vanish bot', () => {
  it('takes a win at every level', () => {
    const game = fromMoves(VANISH, X, [0, 4, 1, 5]);
    for (const difficulty of ['beginner', 'easy', 'medium', 'hard', 'expert', 'master'] as const) {
      expect(findBestMove(game, { difficulty, random: seeded(1) })).toBe(2);
    }
  });

  it('blocks a real threat and ignores one leaning on a vanishing mark', () => {
    // O to move. X threatens 0-1-2 with 0 and 1, neither leaving next - O must block 2.
    const threatened = fromMoves(VANISH, X, [0, 4, 1]);
    for (const difficulty of ['beginner', 'medium', 'master'] as const) {
      expect(findBestMove(threatened, { difficulty, random: seeded(2) })).toBe(2);
    }
  });

  it('wins every game it opens at master', () => {
    for (let seed = 0; seed < 6; seed++) {
      const random = seeded(seed);
      let game = createGame(VANISH, X);
      while (game.status === 'playing') {
        const move =
          game.currentPlayer === X
            ? findBestMove(game, { difficulty: 'master', random })!
            : findBestMove(game, { difficulty: 'expert', random })!;
        game = applyMove(game, move)!;
      }
      expect(game.winner).toBe(X);
      expect(game.moves.length).toBeLessThanOrEqual(13);
    }
  });

  it('always plays a legal move, at every level', () => {
    const random = seeded(99);
    for (const difficulty of ['beginner', 'easy', 'medium', 'hard'] as const) {
      let game = createGame(VANISH, O);
      while (game.status === 'playing') {
        const choice = chooseMove(game, { difficulty, random })!;
        expect(canPlay(game, choice.move)).toBe(true);
        game = applyMove(game, choice.move)!;
      }
    }
  });
});
