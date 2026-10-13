import {
  applyMove,
  completesLine,
  type GameState,
  isModeId,
  legalMoves,
  modeById,
  type Player,
  replay,
  ultimateBoardOf,
  vanishVerdict,
} from '@/game/engine';
import { describe, expect, it } from 'vitest';
import { type LessonStep, LESSONS, lessonById, LESSON_MODES, lessonsForMode } from './lessons';

/**
 * Every lesson step, checked against the engine.
 *
 * A lesson that accepts a losing move, or rejects one that works, teaches the
 * wrong thing with total confidence - worse than no lesson. So each step's
 * accepted moves are recomputed here from the rules and compared as a set: not
 * "the answer is among the good moves" but "the good moves are exactly these".
 */

function after(state: GameState, move: number): GameState {
  const next = applyMove(state, move);
  if (!next) throw new Error(`Illegal move ${move}`);
  return next;
}

/** Whether the player to move wins the game by playing `move`. */
function winsWith(state: GameState, move: number): boolean {
  const next = applyMove(state, move);
  return next !== null && next.status === 'won' && next.winner === state.currentPlayer;
}

function canWin(state: GameState): boolean {
  return state.status === 'playing' && legalMoves(state).some((move) => winsWith(state, move));
}

/** After `move`, the opponent has no win on their reply. */
function safeAfter(state: GameState, move: number): boolean {
  const next = after(state, move);
  if (next.status === 'won') return next.winner === state.currentPlayer;
  if (next.status === 'draw') return true;
  return !canWin(next);
}

/** After `move`, the opponent cannot stop a win next move: the rules-level fork. */
function forks(state: GameState, move: number): boolean {
  const next = after(state, move);
  if (next.status !== 'playing' || canWin(next)) return false;
  return legalMoves(next).every((reply) => {
    const answered = after(next, reply);
    return answered.status === 'playing' && canWin(answered);
  });
}

/**
 * Empty squares that would complete a run for `player`, regardless of whose
 * turn it is. Only meaningful for the plain line rules - classic and gomoku -
 * where a square's worth does not depend on the move order.
 */
function lineWins(state: GameState, board: readonly number[], player: Player, near?: number) {
  const { size, winLength } = state.config;
  const scratch = board.slice() as GameState['board'];
  const found: number[] = [];
  for (let index = 0; index < board.length; index++) {
    if (board[index] !== 0) continue;
    if (near !== undefined) {
      const rows = Math.abs(Math.floor(index / size) - Math.floor(near / size));
      const cols = Math.abs((index % size) - (near % size));
      if (Math.max(rows, cols) >= winLength) continue;
    }
    if (completesLine(scratch, size, index, player, winLength)) found.push(index);
  }
  return found;
}

function placed(board: readonly number[], index: number, player: Player): number[] {
  const next = board.slice();
  next[index] = player;
  return next;
}

/**
 * After `move`, the opponent has neither a win nor a move that leaves them two.
 * A double threat of theirs only counts when it does not walk past a threat of
 * ours, which they would have to answer instead.
 */
function prevents(state: GameState, move: number): boolean {
  const next = after(state, move);
  if (next.status !== 'playing') return false;
  const rival = next.currentPlayer;
  if (lineWins(next, next.board, rival).length > 0) return false;
  const ours = lineWins(next, next.board, state.currentPlayer);
  for (let index = 0; index < next.board.length; index++) {
    if (next.board[index] !== 0) continue;
    if (ours.some((square) => square !== index)) continue;
    // Any new threat runs through the mark just placed, so look only near it.
    const board = placed(next.board, index, rival);
    if (lineWins(next, board, rival, index).length >= 2) return false;
  }
  return true;
}

/** A four, the forced block, and then a double threat. */
function fourThree(state: GameState, move: number): boolean {
  const next = after(state, move);
  if (next.status !== 'playing') return false;
  const me = state.currentPlayer;
  const rival = next.currentPlayer;
  const fours = lineWins(next, next.board, me);
  if (fours.length !== 1 || lineWins(next, next.board, rival).length > 0) return false;
  const blocked = placed(next.board, fours[0]!, rival);
  if (lineWins(next, blocked, rival).length > 0) return false;
  return blocked.some(
    (cell, index) =>
      cell === 0 && lineWins(next, placed(blocked, index, me), me, index).length >= 2,
  );
}

/** Perfect-play value of a small-board position for the player to move. */
const solved = new Map<string, number>();
function solve(state: GameState): number {
  const key = `${state.config.variant}|${state.moves.join(',')}`;
  const known = solved.get(key);
  if (known !== undefined) return known;
  const value = Math.max(...legalMoves(state).map((move) => moveValue(state, move)));
  solved.set(key, value);
  return value;
}

function moveValue(state: GameState, move: number): number {
  const next = after(state, move);
  if (next.status === 'won') return next.winner === state.currentPlayer ? 1 : -1;
  if (next.status === 'draw') return 0;
  // Vanish never fills up, so it has its own solver rather than this search.
  if (state.config.variant === 'vanish') return -vanishVerdict(next).value;
  return -solve(next);
}

/** Whether `move` wins the small board it is played in. */
function claims(state: GameState, move: number): boolean {
  return after(state, move).ultimate?.boards[ultimateBoardOf(move)] === state.currentPlayer;
}

/** After `move`, no reply wins a small board. */
function denies(state: GameState, move: number): boolean {
  const next = after(state, move);
  return next.status === 'playing' && legalMoves(next).every((reply) => !claims(next, reply));
}

/** After `move`, our own threat - a square that completes a line - survives every reply. */
function keeps(state: GameState, move: number): boolean {
  if (!safeAfter(state, move)) return false;
  const next = after(state, move);
  return legalMoves(next).every((reply) => {
    const answered = after(next, reply);
    return (
      answered.status === 'playing' &&
      lineWins(answered, answered.board, state.currentPlayer).length > 0
    );
  });
}

function sorted(moves: readonly number[]): number[] {
  return [...moves].toSorted((a, b) => a - b);
}

/** The moves the engine says a step of this kind should accept. */
function expected(state: GameState, step: LessonStep): number[] {
  const legal = legalMoves(state);
  const variant = state.config.variant;
  const lineRules = variant === 'classic' || variant === 'gomoku';

  switch (step.kind) {
    case 'win':
      return legal.filter((move) => winsWith(state, move));
    case 'block':
    case 'safe':
      expect(canWin(state), 'a block step must have no win of its own').toBe(false);
      return legal.filter((move) => safeAfter(state, move));
    case 'fork':
      expect(canWin(state), 'a fork step must have no immediate win').toBe(false);
      return legal.filter((move) => forks(state, move));
    case 'prevent':
      expect(lineRules, 'prevent steps need the plain line rules').toBe(true);
      expect(canWin(state)).toBe(false);
      return legal.filter((move) => prevents(state, move));
    case 'four-three':
      expect(lineRules, 'four-three steps need the plain line rules').toBe(true);
      expect(canWin(state)).toBe(false);
      // A four-three is the answer only when nothing quicker is on the board.
      expect(legal.filter((move) => forks(state, move))).toEqual([]);
      return legal.filter((move) => fourThree(state, move));
    case 'avoid': {
      expect(variant).toBe('misere');
      const survives = legal.filter((move) => {
        const next = after(state, move);
        return !(next.status === 'won' && next.winner !== state.currentPlayer);
      });
      // Every safe square must also be a sound one, so "not finishing your own
      // line" is the whole lesson rather than half of it.
      const best = solve(state);
      for (const move of survives) expect(moveValue(state, move)).toBe(best);
      return survives;
    }
    case 'best': {
      expect(state.config.size, 'best steps are solved exactly, on 3x3 boards').toBe(3);
      const values = legal.map((move) => moveValue(state, move));
      const best = Math.max(...values);
      // A best move has to be better than something, or there is nothing to learn.
      expect(Math.min(...values)).toBeLessThan(best);
      return legal.filter((_, at) => values[at] === best);
    }
    case 'keep':
      expect(variant).toBe('gravity');
      return legal.filter((move) => keeps(state, move));
    case 'claim':
      expect(variant).toBe('ultimate');
      return legal.filter((move) => claims(state, move));
    case 'deny':
      expect(variant).toBe('ultimate');
      return legal.filter((move) => denies(state, move));
  }
}

describe('lessons', () => {
  it('has a full curriculum with unique kebab-case ids', () => {
    expect(LESSONS.length).toBeGreaterThanOrEqual(15);
    const ids = LESSONS.map((lesson) => lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const lesson of LESSONS) {
      expect(lesson.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(isModeId(lesson.mode)).toBe(true);
      expect(lesson.steps.length).toBeGreaterThanOrEqual(2);
      expect(lesson.steps.length).toBeLessThanOrEqual(4);
      expect(lesson.title.length).toBeGreaterThan(0);
      expect(lesson.intro.length).toBeGreaterThan(0);
      expect(lessonById(lesson.id)).toBe(lesson);
    }
    expect(lessonById('no-such-lesson')).toBeUndefined();
  });

  it('covers every mode it lists, in mode order', () => {
    for (const mode of [
      'classic',
      'grid-6',
      'grid-9',
      'gomoku-13',
      'gomoku-15',
      'misere',
      'vanish',
      'gravity',
      'ultimate',
    ] as const) {
      expect(lessonsForMode(mode).length, mode).toBeGreaterThan(0);
      expect(LESSON_MODES).toContain(mode);
    }
  });

  for (const lesson of LESSONS) {
    describe(lesson.id, () => {
      lesson.steps.forEach((step, at) => {
        it(`step ${at + 1} (${step.kind}) accepts exactly what the engine says`, () => {
          const state = replay(modeById(lesson.mode).config, step.startingPlayer, step.moves);
          expect(state, 'the position replays').not.toBeNull();
          if (!state) return;
          expect(state.status).toBe('playing');

          const legal = legalMoves(state);
          expect(step.accept.length).toBeGreaterThan(0);
          expect(new Set(step.accept).size).toBe(step.accept.length);
          for (const move of step.accept) expect(legal).toContain(move);
          // Something has to be wrong, or the step asks nothing.
          expect(step.accept.length).toBeLessThan(legal.length);

          expect(sorted(step.accept)).toEqual(sorted(expected(state, step)));
        });
      });
    });
  }
});
