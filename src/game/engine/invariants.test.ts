import { describe, expect, it } from 'vitest';
import { isGravityLanding } from './board.js';
import { swapMove } from './config.js';
import { applyMove, createGame, legalMoves, replay, startingPlayerOf } from './game.js';
import { GAME_MODES, type GameMode } from './modes.js';
import { findAnyWinLine } from './rules.js';
import { seeded } from './testing.js';
import { Blocked, Empty, type GameState, O, type Player, X } from './types.js';
import { VANISH_KEEP, VANISH_MOVE_LIMIT, vanishedBy } from './variants/index.js';
import { capturedBy, PENTE_CAPTURES_TO_WIN, penteCaptures } from './variants/pente.js';
import { CHAOS, decodeMarkMove, ORDER } from './variants/marks.js';
import { decodePowerMove, powerCharges } from './variants/powers.js';
import { quantumOf } from './variants/quantum.js';
import { QUBIC_LINES } from './variants/qubic.js';

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
        // Rule sets whose moves are not simply "a mark on this square" check
        // their own version of the per-move invariants.
        if (checkOwnMove(mode, before, move, after)) return;
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
      if (checkOwnResult(mode, finished)) {
        // Checked by the rule set's own result invariants.
      } else if (mode.config.variant === 'ultimate') {
        const meta = finished.ultimate!;
        if (finished.status === 'won') {
          expect(meta.winBoards).not.toBeNull();
          for (const board of meta.winBoards!) expect(meta.boards[board]).toBe(finished.winner);
        } else {
          expect(finished.winner).toBeNull();
        }
      } else {
        const onBoard = findAnyWinLine(
          finished.board,
          mode.config.size,
          mode.config.winLength,
          mode.config.exact,
        );
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

/**
 * Per-move invariants for the rule sets whose moves do more than put one mark
 * on one square. Returns `false` for every other rule set, which the shared
 * checks above cover.
 */
function checkOwnMove(mode: GameMode, before: GameState, move: number, after: GameState): boolean {
  if (checkCodedMove(mode, before, move, after)) return true;
  const { variant } = mode.config;
  if (variant !== 'pente' && variant !== 'quantum') return false;

  expect(after.moves).toEqual([...before.moves, move]);
  if (after.status === 'playing') expect(after.currentPlayer).not.toBe(before.currentPlayer);
  else expect(after.currentPlayer).toBe(before.currentPlayer);
  expect(startingPlayerOf(after)).toBe(startingPlayerOf(before));

  if (variant === 'pente') {
    // The mark lands, and the only other squares that change are the captured
    // pairs: the opponent's marks, emptied, counted to the mover.
    const captured = capturedBy(after);
    expect(captured.length % 2).toBe(0);
    expect(before.board[move]).toBe(Empty);
    expect(after.board[move]).toBe(before.currentPlayer);
    for (let cell = 0; cell < after.board.length; cell++) {
      if (cell === move) continue;
      if (captured.includes(cell)) {
        expect(before.board[cell]).toBe(before.currentPlayer === X ? O : X);
        expect(after.board[cell]).toBe(Empty);
      } else {
        expect(after.board[cell]).toBe(before.board[cell]);
      }
    }
    const slot = before.currentPlayer === X ? 0 : 1;
    expect(penteCaptures(after)[slot]).toBe(penteCaptures(before)[slot] + captured.length / 2);
    expect(after.lastMove).toBe(move);
    return true;
  }

  // Quantum: a classical mark is never lost or changed, the classical board
  // is exactly the marks that have collapsed, and a code places at most one
  // new mark.
  for (let cell = 0; cell < before.board.length; cell++) {
    if (before.board[cell] !== Empty) expect(after.board[cell]).toBe(before.board[cell]);
  }
  const quantum = quantumOf(after);
  expect(quantum.marks.length - quantumOf(before).marks.length).toBeLessThanOrEqual(1);
  const settled = quantum.marks.filter((mark) => mark.at !== null);
  expect(after.board.filter((cell) => cell !== Empty)).toHaveLength(settled.length);
  for (const mark of settled) {
    expect(after.board[mark.at!]).toBe(mark.player);
    expect(quantum.classical[mark.at!]).toBe(mark.move);
  }
  expect(after.lastMove).not.toBeNull();
  return true;
}

/** Result invariants for rule sets that are not decided by a plain line scan. */
function checkOwnResult(mode: GameMode, finished: GameState): boolean {
  if (checkCodedResult(mode, finished)) return true;
  const { variant } = mode.config;
  if (variant === 'qubic') {
    const line = QUBIC_LINES.find((cells) =>
      cells.every(
        (cell) =>
          finished.board[cell] !== Empty && finished.board[cell] === finished.board[cells[0]!],
      ),
    );
    if (finished.status === 'won') expect(line && finished.board[line[0]!]).toBe(finished.winner);
    else expect(line).toBeUndefined();
    return true;
  }
  if (variant === 'pente') {
    if (finished.status !== 'won') return true;
    const onBoard = findAnyWinLine(finished.board, mode.config.size, mode.config.winLength);
    const slot = finished.winner === X ? 0 : 1;
    const byCaptures = penteCaptures(finished)[slot] >= PENTE_CAPTURES_TO_WIN;
    expect(onBoard?.player === finished.winner || byCaptures).toBe(true);
    return true;
  }
  if (variant === 'quantum') {
    if (finished.status === 'won') {
      expect(finished.winLine).not.toBeNull();
      for (const cell of finished.winLine!) expect(finished.board[cell]).toBe(finished.winner);
    } else {
      expect(finished.board.every((cell) => cell !== Empty)).toBe(true);
    }
    return true;
  }
  return false;
}

/**
 * Per-move invariants for the rule sets with blocked squares or with move
 * codes beyond "this player's mark on this square": Connect Four, Obstacles,
 * Wild, Order and Chaos, and Powers. Exactly one square changes per move, in
 * the way the code says, and a blocked square never changes at all.
 */
function checkCodedMove(
  mode: GameMode,
  before: GameState,
  move: number,
  after: GameState,
): boolean {
  const { variant } = mode.config;

  // The pie rule's swap hands the opening mark over: one square changes hands
  // and nothing else moves.
  if (move === swapMove(mode.config)) {
    const opening = before.lastMove!;
    expect(before.moves).toHaveLength(1);
    expect(before.board[opening]).toBe(before.currentPlayer === X ? O : X);
    expect(after.board[opening]).toBe(before.currentPlayer);
    expect(after.currentPlayer).not.toBe(before.currentPlayer);
    expect(startingPlayerOf(after)).toBe(startingPlayerOf(before));
    for (let other = 0; other < after.board.length; other++) {
      if (other !== opening) expect(after.board[other]).toBe(before.board[other]);
    }
    return true;
  }

  const coded =
    variant === 'connect4' ||
    variant === 'obstacles' ||
    variant === 'wild' ||
    variant === 'order-chaos' ||
    variant === 'powers' ||
    // A swapped game has one mark fewer than it has moves.
    mode.config.opening === 'swap';
  if (!coded) return false;

  expect(after.moves).toEqual([...before.moves, move]);
  if (after.status === 'playing') expect(after.currentPlayer).not.toBe(before.currentPlayer);
  else expect(after.currentPlayer).toBe(before.currentPlayer);
  expect(startingPlayerOf(after)).toBe(startingPlayerOf(before));

  let cell = move;
  let expected: number = before.currentPlayer;
  if (variant === 'wild' || variant === 'order-chaos') {
    const decoded = decodeMarkMove(mode.config, move)!;
    cell = decoded.cell;
    expected = decoded.mark;
    expect(before.board[cell]).toBe(Empty);
  } else if (variant === 'powers') {
    const decoded = decodePowerMove(mode.config, move)!;
    cell = decoded.cell;
    const mover = before.currentPlayer;
    const spent = (kind: 'bomb' | 'wall') =>
      powerCharges(before, mover)[kind] - powerCharges(after, mover)[kind];
    if (decoded.kind === 'bomb') {
      expect(before.board[cell]).toBe(mover === X ? O : X);
      expected = Empty;
      expect(spent('bomb')).toBe(1);
    } else if (decoded.kind === 'wall') {
      expect(before.board[cell]).toBe(Empty);
      expected = Blocked;
      expect(spent('wall')).toBe(1);
    } else {
      expect(before.board[cell]).toBe(Empty);
      expect(spent('bomb') + spent('wall')).toBe(0);
    }
  } else {
    expect(before.board[cell]).toBe(Empty);
    if (variant === 'connect4')
      expect(isGravityLanding(before.board, mode.config.size, cell)).toBe(true);
  }

  expect(after.board[cell]).toBe(expected);
  expect(after.lastMove).toBe(cell);
  for (let other = 0; other < after.board.length; other++) {
    if (other !== cell) expect(after.board[other]).toBe(before.board[other]);
  }
  return true;
}

/** Result invariants for the same rule sets. */
function checkCodedResult(mode: GameMode, finished: GameState): boolean {
  const { variant, size, winLength } = mode.config;
  const onBoard = findAnyWinLine(finished.board, size, winLength);

  if (variant === 'order-chaos') {
    // Never a draw: a line is Order's, a full board without one Chaos's.
    expect(finished.status).toBe('won');
    if (onBoard) expect(finished.winner).toBe(ORDER);
    else {
      expect(finished.winner).toBe(CHAOS);
      expect(finished.board.every((cell) => cell !== Empty)).toBe(true);
    }
    return true;
  }

  const coded =
    variant === 'connect4' || variant === 'obstacles' || variant === 'wild' || variant === 'powers';
  if (!coded) return false;

  if (finished.status === 'won') {
    expect(onBoard).not.toBeNull();
    // Wild's marks belong to nobody: the line is the last mover's whatever it
    // is made of. Everywhere else it is made of the winner's marks.
    if (variant === 'wild') expect(finished.winner).toBe(finished.currentPlayer);
    else expect(onBoard!.player).toBe(finished.winner);
  } else {
    expect(onBoard).toBeNull();
    expect(finished.board.every((cell) => cell !== Empty)).toBe(true);
  }
  return true;
}
