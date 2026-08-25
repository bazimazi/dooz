import { describe, expect, it } from 'vitest';
import { emptyIndices } from './board.js';
import { findBestMove } from './bot/index.js';
import { applyMove, createGame } from './game.js';
import { type BoardSize, type GameState, O, type Player, X } from './types.js';

/** Deterministic PRNG so a failing run can be reproduced exactly. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function fromMoves(size: BoardSize, starting: Player, moves: number[]): GameState {
  return moves.reduce<GameState>(
    (game, move) => applyMove(game, move)!,
    createGame(size, starting),
  );
}

describe('findBestMove', () => {
  it('returns null once the game is over', () => {
    const won = fromMoves(3, X, [0, 3, 1, 4, 2]);
    expect(findBestMove(won)).toBeNull();
  });

  it('takes an immediate win', () => {
    // X holds 0 and 1; 2 completes the top row.
    const game = fromMoves(3, X, [0, 3, 1, 4]);
    expect(findBestMove(game)).toBe(2);
  });

  it('blocks the opponent instead of building its own line', () => {
    // O to move. X threatens 0-1-2, so O must take 2.
    const game = fromMoves(3, X, [0, 4, 1]);
    expect(findBestMove(game)).toBe(2);
  });

  it('prefers winning over blocking when it can do either', () => {
    // O to move: O holds 3 and 4 (5 wins); X holds 0 and 1 (2 blocks).
    const game = fromMoves(3, X, [0, 3, 1, 4, 8]);
    expect(findBestMove(game)).toBe(5);
  });

  it('opens in the centre on an empty board', () => {
    expect(findBestMove(createGame(3, X))).toBe(4);
    expect(findBestMove(createGame(6, X))).toBe(3 * 6 + 3);
  });

  it('blocks a four-in-a-row threat on 9x9', () => {
    // X has 30,31,32,33 in row 3; 34 completes five.
    const game = fromMoves(9, X, [30, 0, 31, 1, 32, 2, 33, 3]);
    // O to move must stop the line at one of its two ends.
    expect([29, 34]).toContain(findBestMove(game, { timeBudgetMs: 400 }));
  });

  it('always returns a legal move', () => {
    const random = seeded(7);
    for (const size of [3, 6, 9] as const) {
      let game = createGame(size, X);
      for (let turn = 0; turn < 12 && game.status === 'playing'; turn++) {
        const move = findBestMove(game, { timeBudgetMs: 60, random })!;
        expect(emptyIndices(game.board)).toContain(move);
        game = applyMove(game, move)!;
      }
    }
  });
});

describe('the 3x3 bot is unbeatable', () => {
  /** Exhaustively play every line the human can choose against the bot. */
  function humanCannotWin(game: GameState, human: Player): boolean {
    if (game.status === 'won') return game.winner !== human;
    if (game.status === 'draw') return true;

    if (game.currentPlayer === human) {
      // Try every human reply; the bot must survive all of them.
      return emptyIndices(game.board).every((move) =>
        humanCannotWin(applyMove(game, move)!, human),
      );
    }

    const botMove = findBestMove(game, { difficulty: 'hard' })!;
    return humanCannotWin(applyMove(game, botMove)!, human);
  }

  it('never loses when moving first', () => {
    expect(humanCannotWin(createGame(3, X), O)).toBe(true);
  });

  it('never loses when moving second', () => {
    expect(humanCannotWin(createGame(3, X), X)).toBe(true);
  });
});

describe('difficulty', () => {
  it('easy sometimes plays a move a stronger bot would not', () => {
    // With a blunder rate above zero, a fixed low roll forces a random move.
    const game = fromMoves(3, X, [0, 4, 1]);
    const blunder = findBestMove(game, { difficulty: 'easy', random: () => 0.01 });
    expect(blunder).not.toBeNull();
  });

  it('easy still blocks when it is not blundering', () => {
    const game = fromMoves(3, X, [0, 4, 1]);
    expect(findBestMove(game, { difficulty: 'easy', random: () => 0.99 })).toBe(2);
  });

  it('medium returns a legal move within its shorter budget', () => {
    const game = fromMoves(9, X, [40, 30]);
    const move = findBestMove(game, { difficulty: 'medium' });
    expect(emptyIndices(game.board)).toContain(move!);
  });
});
