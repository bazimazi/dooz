import { describe, expect, it } from 'vitest';
import { chooseMove, findBestMove } from '../bot/index.js';
import { PenteBoard } from '../bot/pente.js';
import { isGameConfig, moveSpace } from '../config.js';
import { applyMove, createGame, legalMoves, replay, startingPlayerOf } from '../game.js';
import { modeById } from '../modes.js';
import { fromMoves, seeded } from '../testing.js';
import { Empty, type GameState, O, X } from '../types.js';
import { capturedBy, PENTE_CAPTURES_TO_WIN, penteCaptures } from './pente.js';

const PENTE = modeById('pente').config;
const SIZE = PENTE.size;
const at = (row: number, col: number) => row * SIZE + col;

/**
 * A position built from placements in turn order, with fillers far away so
 * each side's marks land where the test wants them. `xs` and `os` alternate
 * starting with X, so they must be the same length or `xs` one longer.
 */
function position(xs: number[], os: number[]): GameState {
  const moves: number[] = [];
  for (let ply = 0; ply < xs.length + os.length; ply++) {
    moves.push(ply % 2 === 0 ? xs[ply / 2]! : os[(ply - 1) / 2]!);
  }
  return fromMoves(PENTE, X, moves);
}

describe('pente rules', () => {
  it('is a five-in-a-row game on a board with room for it', () => {
    expect(isGameConfig(PENTE)).toBe(true);
    expect(isGameConfig({ variant: 'pente', size: 13, winLength: 4 })).toBe(false);
    expect(isGameConfig({ variant: 'pente', size: 7, winLength: 5 })).toBe(false);
    expect(isGameConfig({ ...PENTE, opening: 'swap' })).toBe(false);
    expect(moveSpace(PENTE)).toBe(SIZE * SIZE);
  });

  it('starts with no captures', () => {
    const game = createGame(PENTE, X);
    expect(penteCaptures(game)).toEqual([0, 0]);
    expect(capturedBy(game)).toEqual([]);
  });

  it('captures exactly two flanked marks', () => {
    // X at (6,3), O at (6,4) and (6,5); X plays (6,6) and takes both.
    const before = position([at(6, 3), at(0, 0)], [at(6, 4), at(6, 5)]);
    expect(before.currentPlayer).toBe(X);
    const after = applyMove(before, at(6, 6))!;
    expect(after.board[at(6, 4)]).toBe(Empty);
    expect(after.board[at(6, 5)]).toBe(Empty);
    expect(penteCaptures(after)).toEqual([1, 0]);
    expect(capturedBy(after).toSorted((a, b) => a - b)).toEqual([at(6, 4), at(6, 5)]);
    expect(after.status).toBe('playing');
  });

  it('captures along diagonals and in several directions at once', () => {
    // X at (2,2) and (2,8); O pairs at (3,3),(4,4) and (3,7),(4,6). X at (5,5)
    // flanks both diagonals.
    const before = position(
      [at(2, 2), at(2, 8), at(12, 12)],
      [at(3, 3), at(4, 4), at(3, 7), at(4, 6)].slice(0, 3),
    );
    const withFourth = applyMove(before, at(12, 0))!; // X filler
    const ready = applyMove(withFourth, at(4, 6))!; // O completes its pair
    expect(ready.currentPlayer).toBe(X);
    const after = applyMove(ready, at(5, 5))!;
    expect(penteCaptures(after)[0]).toBe(2);
    for (const cell of [at(3, 3), at(4, 4), at(3, 7), at(4, 6)]) {
      expect(after.board[cell]).toBe(Empty);
    }
  });

  it('does not capture three in a row, or a single mark', () => {
    const three = position([at(6, 2), at(0, 0), at(0, 2)], [at(6, 3), at(6, 4), at(6, 5)]);
    const after = applyMove(three, at(6, 6))!;
    expect(penteCaptures(after)).toEqual([0, 0]);
    expect(after.board[at(6, 4)]).toBe(O);

    const single = position([at(6, 2)], [at(6, 3)]);
    expect(penteCaptures(applyMove(single, at(6, 4))!)).toEqual([0, 0]);
  });

  it('lets a player move into a flanked spot safely', () => {
    // X at (6,3) and (6,6); O at (6,4). O plays (6,5): X O O X, but O placed it.
    const game = position([at(6, 3), at(6, 6)], [at(6, 4)]);
    const after = applyMove(game, at(6, 5))!;
    expect(after.board[at(6, 4)]).toBe(O);
    expect(after.board[at(6, 5)]).toBe(O);
    expect(penteCaptures(after)).toEqual([0, 0]);
  });

  it('wins with five in a row, overlines included', () => {
    const game = position(
      [at(0, 0), at(0, 1), at(0, 2), at(0, 3)],
      [at(12, 0), at(12, 2), at(12, 4), at(12, 6)],
    );
    const won = applyMove(game, at(0, 4))!;
    expect(won.status).toBe('won');
    expect(won.winner).toBe(X);
    expect(won.winLine).toEqual([at(0, 0), at(0, 1), at(0, 2), at(0, 3), at(0, 4)]);
  });

  it('wins on the fifth captured pair, with no line to draw', () => {
    // Five separate X . O O shapes along the left; X plays the far end of each.
    let game = createGame(PENTE, X);
    const play = (move: number) => {
      game = applyMove(game, move)!;
      expect(game).not.toBeNull();
    };
    for (let pair = 0; pair < PENTE_CAPTURES_TO_WIN; pair++) {
      const row = pair * 2;
      play(at(row, 0)); // X
      play(at(row, 1)); // O
      play(at(12, pair * 2)); // X filler on the bottom row
      play(at(row, 2)); // O
      expect(game.status).toBe('playing');
      play(at(row, 3)); // X captures
      expect(penteCaptures(game)[0]).toBe(pair + 1);
      if (pair < PENTE_CAPTURES_TO_WIN - 1) play(at(row + 1, 12)); // O filler
    }
    expect(game.status).toBe('won');
    expect(game.winner).toBe(X);
    expect(game.winLine).toBeNull();
  });

  it('replays to the same captures, and keeps the opener derivable', () => {
    const random = seeded(4);
    let game = createGame(PENTE, O);
    for (let ply = 0; ply < 80 && game.status === 'playing'; ply++) {
      const legal = legalMoves(game);
      game = applyMove(game, legal[Math.floor(random() * legal.length)]!)!;
    }
    const again = replay(PENTE, O, game.moves)!;
    expect(again.board).toEqual(game.board);
    expect(again.extra).toEqual(game.extra);
    expect(startingPlayerOf(game)).toBe(O);
  });

  it('treats a captured square as open again', () => {
    const game = applyMove(position([at(6, 3), at(0, 0)], [at(6, 4), at(6, 5)]), at(6, 6))!;
    expect(legalMoves(game)).toContain(at(6, 4));
    expect(applyMove(game, at(6, 4))).not.toBeNull();
  });
});

describe('pente board undo', () => {
  it('restores captured stones and counts', () => {
    const game = position([at(6, 3), at(0, 0)], [at(6, 4), at(6, 5)]);
    const board = new PenteBoard(game);
    const before = Array.from(board.cells);
    board.play(at(6, 6), X);
    expect(board.captures[X]).toBe(1);
    board.undo();
    expect(Array.from(board.cells)).toEqual(before);
    expect(board.captures[X]).toBe(0);
  });
});

describe('pente bot', () => {
  const quick = { timeBudgetMs: 150 } as const;

  it('takes five in a row', () => {
    const game = position(
      [at(6, 2), at(6, 3), at(6, 4), at(6, 5)],
      [at(0, 0), at(0, 2), at(0, 4), at(0, 6)],
    );
    for (const difficulty of ['beginner', 'medium', 'master'] as const) {
      const move = chooseMove(game, { ...quick, difficulty, random: seeded(1) });
      expect(move?.reason).toBe('win');
      expect([at(6, 1), at(6, 6)]).toContain(move?.move);
    }
  });

  it('takes the fifth pair', () => {
    let game = createGame(PENTE, X);
    for (let pair = 0; pair < 4; pair++) {
      const row = pair * 2;
      for (const move of [
        at(row, 0),
        at(row, 1),
        at(12, pair * 2),
        at(row, 2),
        at(row, 3),
        at(row + 1, 12),
      ]) {
        game = applyMove(game, move)!;
      }
    }
    // A fifth X . O O shape, O having just played into it.
    for (const move of [at(10, 5), at(10, 6), at(12, 10), at(10, 7)]) game = applyMove(game, move)!;
    expect(penteCaptures(game)[0]).toBe(4);
    const move = chooseMove(game, { ...quick, difficulty: 'easy', random: seeded(2) });
    expect(move?.move).toBe(at(10, 8));
    expect(applyMove(game, move!.move)!.winner).toBe(X);
  });

  it('stops an open four, by blocking or capturing out of it', () => {
    // O has four in a row with both ends open: X cannot stop both ends, but
    // here only one end is open, so any level must close it.
    const game = position(
      [at(6, 1), at(0, 0), at(0, 2), at(0, 4)],
      [at(6, 2), at(6, 3), at(6, 4), at(6, 5)],
    );
    expect(game.currentPlayer).toBe(X);
    for (const difficulty of ['beginner', 'hard'] as const) {
      const move = findBestMove(game, { ...quick, difficulty, random: seeded(3) })!;
      const after = applyMove(game, move)!;
      // Whatever it played, O must not have a winning reply.
      for (const reply of legalMoves(after)) {
        expect(applyMove(after, reply)!.winner).not.toBe(O);
      }
    }
  });

  it('always plays a legal move through a whole game', () => {
    let game = createGame(PENTE, X);
    const random = seeded(9);
    for (let ply = 0; ply < 40 && game.status === 'playing'; ply++) {
      const move = findBestMove(game, {
        difficulty: ply % 2 === 0 ? 'medium' : 'easy',
        timeBudgetMs: 40,
        random,
      });
      expect(move).not.toBeNull();
      const next = applyMove(game, move!);
      expect(next).not.toBeNull();
      game = next!;
    }
  });
});
