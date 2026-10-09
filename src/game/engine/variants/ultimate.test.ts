import { describe, expect, it } from 'vitest';
import { ultimateBoardOf, ultimateCellOf, ultimateCells } from '../board.js';
import { applyMove, canPlay, createGame, legalMoves, replay } from '../game.js';
import { modeById } from '../modes.js';
import { seeded } from '../testing.js';
import { Empty, type GameState, O, X } from '../types.js';

const ULTIMATE = modeById('ultimate').config;

/** Flat index of (board, cell), both 0-8. */
function at(board: number, cell: number): number {
  return ultimateCells(board)[cell]!;
}

/**
 * Ultimate positions are built by playing rather than by hand.
 *
 * The forced-board rule means a hand-written move list is almost always illegal
 * after the third move - where the opponent may play is decided by the square
 * you chose, not by which board you would like them in - so the tests below
 * walk seeded random games and stop at the first position of the shape they
 * need. Same seed, same game, every run.
 */
function* randomGames(seed: number): Generator<GameState[]> {
  const random = seeded(seed);
  for (let round = 0; round < 400; round++) {
    const frames: GameState[] = [createGame(ULTIMATE, round % 2 === 0 ? X : O)];
    let guard = 0;
    while (frames.at(-1)!.status === 'playing' && guard++ < 200) {
      const game = frames.at(-1)!;
      const moves = legalMoves(game);
      frames.push(applyMove(game, moves[Math.floor(random() * moves.length)]!)!);
    }
    yield frames;
  }
}

describe('ultimate geometry', () => {
  it('maps every cell to a board and a position within it', () => {
    for (let board = 0; board < 9; board++) {
      for (let cell = 0; cell < 9; cell++) {
        const index = at(board, cell);
        expect(ultimateBoardOf(index)).toBe(board);
        expect(ultimateCellOf(index)).toBe(cell);
      }
    }
  });

  it('covers all 81 cells exactly once', () => {
    const seen = new Set<number>();
    for (let board = 0; board < 9; board++) {
      for (const cell of ultimateCells(board)) seen.add(cell);
    }
    expect(seen.size).toBe(81);
  });
});

describe('ultimate rules', () => {
  it('lets the opening move go anywhere', () => {
    const game = createGame(ULTIMATE, X);
    expect(game.ultimate?.activeBoard).toBeNull();
    expect(legalMoves(game)).toHaveLength(81);
  });

  it('sends the opponent to the board the square points at', () => {
    // Board 4, cell 0 -> the opponent must answer in board 0.
    const game = applyMove(createGame(ULTIMATE, X), at(4, 0))!;
    expect(game.ultimate?.activeBoard).toBe(0);
    expect(legalMoves(game)).toEqual(ultimateCells(0).toSorted((a, b) => a - b));
    expect(canPlay(game, at(4, 1))).toBe(false);
    expect(canPlay(game, at(0, 1))).toBe(true);
  });

  it('records a sub-board win and closes that board to both players', () => {
    const found = firstWhere(([before, , after]) => {
      const won = after.ultimate!.boards.findIndex(
        (winner, board) => winner !== Empty && before.ultimate!.boards[board] === Empty,
      );
      return won >= 0 ? won : null;
    });

    expect(found).not.toBeNull();
    const [board, , , after] = found!;
    expect(after.ultimate!.boards[board]).not.toBe(Empty);
    for (const cell of ultimateCells(board)) expect(canPlay(after, cell)).toBe(false);
    expect(legalMoves(after).some((move) => ultimateBoardOf(move) === board)).toBe(false);
  });

  it('frees the mover when the board they are sent to is already settled', () => {
    const found = firstWhere(([before, move, after]) => {
      if (after.status !== 'playing') return null;
      const target = ultimateCellOf(move);
      const settled =
        before.ultimate!.boards[target] !== Empty || before.ultimate!.drawn[target] === true;
      // A board the move itself just settled counts too.
      const settledNow =
        after.ultimate!.boards[target] !== Empty || after.ultimate!.drawn[target] === true;
      return settled || settledNow ? target : null;
    });

    expect(found).not.toBeNull();
    const [, , , after] = found!;
    expect(after.ultimate!.activeBoard).toBeNull();
    // A free move may go anywhere that is still open, which is more than one board.
    const boards = new Set(legalMoves(after).map(ultimateBoardOf));
    expect(boards.size).toBeGreaterThan(0);
  });

  it('wins the game on three sub-boards in a row', () => {
    const won = [...randomGames(11)]
      .map((frames) => frames.at(-1)!)
      .find((game) => game.status === 'won');

    expect(won).toBeDefined();
    const meta = won!.ultimate!;
    expect(meta.winBoards).not.toBeNull();
    expect(meta.winBoards).toHaveLength(3);
    for (const board of meta.winBoards!) expect(meta.boards[board]).toBe(won!.winner);
    // The win is three boards, not three cells, so there is no run to draw.
    expect(won!.winLine).toBeNull();
    expect(legalMoves(won!)).toEqual([]);
    for (let cell = 0; cell < 81; cell++) expect(applyMove(won!, cell)).toBeNull();
  });

  it('never offers a move into a settled board or an occupied cell', () => {
    // Millions of individual assertions made this the slowest test in the
    // suite, so offending moves are collected and asserted on once.
    const offending: number[] = [];
    for (const frames of randomGames(3)) {
      for (const game of frames) {
        const meta = game.ultimate!;
        for (const move of legalMoves(game)) {
          const board = ultimateBoardOf(move);
          if (
            game.board[move] !== Empty ||
            meta.boards[board] !== Empty ||
            meta.drawn[board] ||
            (meta.activeBoard !== null && board !== meta.activeBoard)
          ) {
            offending.push(move);
          }
        }
      }
    }
    expect(offending).toEqual([]);
  });

  it('replays deterministically', () => {
    for (const frames of [...randomGames(5)].slice(0, 20)) {
      const final = frames.at(-1)!;
      const opener = frames[0]!.currentPlayer;
      expect(replay(ULTIMATE, opener, final.moves)).toEqual(final);
    }
  });

  it('ends every random game in a win or a draw', () => {
    for (const frames of randomGames(17)) {
      const final = frames.at(-1)!;
      expect(final.status).not.toBe('playing');
      if (final.status === 'draw') {
        const meta = final.ultimate!;
        expect(meta.winBoards).toBeNull();
        expect(meta.boards.every((won, board) => won !== Empty || meta.drawn[board])).toBe(true);
      }
    }
  });
});

/**
 * Walk seeded games and return the first transition `pick` accepts, as
 * `[picked, before, move, after]`.
 */
function firstWhere<T>(
  pick: (transition: [GameState, number, GameState]) => T | null,
): [T, GameState, number, GameState] | null {
  for (const frames of randomGames(23)) {
    for (let i = 1; i < frames.length; i++) {
      const before = frames[i - 1]!;
      const after = frames[i]!;
      const move = after.lastMove!;
      const picked = pick([before, move, after]);
      if (picked !== null) return [picked, before, move, after];
    }
  }
  return null;
}
