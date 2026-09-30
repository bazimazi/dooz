import { describe, expect, it } from 'vitest';
import { isGravityLanding } from './board.js';
import { applyMove, createGame, legalMoves, replay, startingPlayerOf } from './game.js';
import { GAME_MODES, type GameMode } from './modes.js';
import { findAnyWinLine } from './rules.js';
import { seeded } from './testing.js';
import { Empty, type GameState, O, type Player, X } from './types.js';
import { VANISH_KEEP, VANISH_MOVE_LIMIT, vanishedBy } from './variants/index.js';

/**
 * Invariants every variant has to hold, checked against thousands of positions
 * reached by random play rather than against hand-picked ones.
 *
 * A hand-written test proves the case it describes. These prove the properties
 * that have to be true of every position the rules can produce, which is where
 * a variant added later is most likely to go wrong.
 */

const ROUNDS_PER_MODE = 25;

function playRandomGame(
  mode: GameMode,
  random: () => number,
  starting: Player,
  check: (before: GameState, move: number, after: GameState) => void,
): GameState {
  let game = createGame(mode.config, starting);
  let guard = 0;

  while (game.status === 'playing' && guard++ < 500) {
    const moves = legalMoves(game);
    expect(moves.length).toBeGreaterThan(0);
    const move = moves[Math.floor(random() * moves.length)]!;
    const next = applyMove(game, move);
    expect(next).not.toBeNull();
    check(game, move, next!);
    game = next!;
  }

  expect(game.status).not.toBe('playing');
  return game;
}

describe.each(GAME_MODES.map((mode) => [mode.name, mode] as const))('%s invariants', (_, mode) => {
  it('holds every rule invariant across random games', () => {
    const random = seeded(0xd0_0c ^ mode.config.size);

    for (let round = 0; round < ROUNDS_PER_MODE; round++) {
      const starting: Player = round % 2 === 0 ? X : O;

      const finished = playRandomGame(mode, random, starting, (before, move, after) => {
        // A cell cannot contain two marks, and the only cell that changed is
        // the one that was played - apart from the mark vanish lifts off.
        const lifted = vanishedBy(after);
        expect(before.board[move]).toBe(Empty);
        expect(after.board[move]).toBe(before.currentPlayer);
        let changed = 0;
        for (let cell = 0; cell < after.board.length; cell++) {
          if (cell !== move && cell !== lifted && after.board[cell] !== before.board[cell]) {
            changed++;
          }
        }
        expect(changed).toBe(0);
        if (lifted !== null) {
          // Only ever the mover's own oldest mark, and only once they have a full set.
          expect(before.board[lifted]).toBe(before.currentPlayer);
          expect(after.board[lifted]).toBe(Empty);
        }

        // Under gravity nothing floats: the mark rests on the floor or on another.
        if (mode.config.variant === 'gravity') {
          expect(isGravityLanding(before.board, mode.config.size, move)).toBe(true);
        }

        // The move count is the length of the move list, and matches the number
        // of marks on the board - capped at a full set each under vanish.
        expect(after.moves.length).toBe(before.moves.length + 1);
        const expectedMarks =
          mode.config.variant === 'vanish'
            ? Math.min(after.moves.length, VANISH_KEEP * 2)
            : after.moves.length;
        expect(after.board.filter((cell) => cell !== Empty)).toHaveLength(expectedMarks);
        expect(after.lastMove).toBe(move);

        // Only the current player ever moves, and the turn always passes while
        // the game is still running.
        if (after.status === 'playing') {
          expect(after.currentPlayer).not.toBe(before.currentPlayer);
        } else {
          expect(after.currentPlayer).toBe(before.currentPlayer);
        }

        // The opener is recoverable from any position.
        expect(startingPlayerOf(after)).toBe(startingPlayerOf(before));
      });

      // A finished game accepts no further moves, by either route.
      expect(legalMoves(finished)).toEqual([]);
      for (let cell = 0; cell < finished.board.length; cell++) {
        expect(applyMove(finished, cell)).toBeNull();
      }

      // The result is derivable from the board rather than merely asserted.
      if (mode.config.variant === 'ultimate') {
        const meta = finished.ultimate!;
        if (finished.status === 'won') {
          expect(meta.winBoards).not.toBeNull();
          for (const board of meta.winBoards!) expect(meta.boards[board]).toBe(finished.winner);
        } else {
          expect(finished.winner).toBeNull();
        }
      } else {
        const onBoard = findAnyWinLine(finished.board, mode.config.size, mode.config.winLength);
        if (finished.status === 'won') {
          expect(onBoard).not.toBeNull();
          const completed = onBoard!.player;
          // Classic and gomoku award the line to whoever made it; misere gives
          // the game to the other side.
          const expected = mode.config.variant === 'misere' ? (completed === X ? O : X) : completed;
          expect(finished.winner).toBe(expected);
        } else if (mode.config.variant === 'vanish') {
          // The board never fills under vanish; the move limit ends it instead.
          expect(onBoard).toBeNull();
          expect(finished.moves).toHaveLength(VANISH_MOVE_LIMIT);
        } else {
          expect(onBoard).toBeNull();
          expect(finished.board.every((cell) => cell !== Empty)).toBe(true);
        }
      }

      // The move list replays to exactly the same final state.
      expect(replay(mode.config, starting, finished.moves)).toEqual(finished);
    }
  });
});
