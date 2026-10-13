import { describe, expect, it } from 'vitest';
import { chooseMove, findBestMove } from '../bot/index.js';
import { isGameConfig, moveSpace } from '../config.js';
import { applyMove, canPlay, createGame, legalMoves, replay, startingPlayerOf } from '../game.js';
import { modeById } from '../modes.js';
import { seeded } from '../testing.js';
import { Empty, type GameState, O, type Player, X } from '../types.js';
import {
  decodeQuantumMove,
  encodeQuantumMove,
  QUANTUM_MOVE_SPACE,
  quantumOf,
  quantumOptions,
} from './quantum.js';

const QUANTUM = modeById('quantum').config;

const spooky = (a: number, b: number, collapse: 0 | 1 | null = null) =>
  encodeQuantumMove({ collapse, follow: { kind: 'spooky', cells: [a, b] } });
const nothing = (collapse: 0 | 1) => encodeQuantumMove({ collapse, follow: { kind: 'nothing' } });

function play(codes: number[], starting: Player = X): GameState {
  let game = createGame(QUANTUM, starting);
  for (const code of codes) {
    const next = applyMove(game, code);
    if (!next) throw new Error(`Illegal quantum move ${code} after ${game.moves.join(',')}`);
    game = next;
  }
  return game;
}

describe('quantum move codes', () => {
  it('round-trips every kind of move', () => {
    for (const move of [
      { collapse: null, follow: { kind: 'spooky', cells: [0, 8] } },
      { collapse: 0, follow: { kind: 'spooky', cells: [3, 4] } },
      { collapse: 1, follow: { kind: 'classical', cell: 7 } },
      { collapse: 1, follow: { kind: 'nothing' } },
    ] as const) {
      const code = encodeQuantumMove(move);
      expect(code).toBeLessThan(QUANTUM_MOVE_SPACE);
      expect(decodeQuantumMove(code)).toEqual(move);
    }
    // A pair given in either order is the same move.
    expect(spooky(5, 2)).toBe(spooky(2, 5));
  });

  it('rejects malformed codes', () => {
    expect(decodeQuantumMove(4 * 9 + 4)).toBeNull(); // the same square twice
    expect(decodeQuantumMove(5 * 9 + 2)).toBeNull(); // pair out of order
    expect(decodeQuantumMove(QUANTUM_MOVE_SPACE)).toBeNull();
    expect(decodeQuantumMove(-1)).toBeNull();
  });

  it('declares its move space', () => {
    expect(isGameConfig(QUANTUM)).toBe(true);
    expect(isGameConfig({ variant: 'quantum', size: 4, winLength: 3 })).toBe(false);
    expect(moveSpace(QUANTUM)).toBe(QUANTUM_MOVE_SPACE);
  });
});

describe('quantum rules', () => {
  it('places spooky marks without touching the classical board', () => {
    const game = play([spooky(0, 4)]);
    expect(game.board.every((cell) => cell === Empty)).toBe(true);
    const quantum = quantumOf(game);
    expect(quantum.marks).toEqual([{ player: X, move: 1, cells: [0, 4], at: null }]);
    expect(quantum.pending).toBeNull();
    expect(game.lastMove).toBe(4);
    expect(game.currentPlayer).toBe(O);
  });

  it('offers all 36 pairs on an empty board, and nothing else', () => {
    const legal = legalMoves(createGame(QUANTUM, X));
    expect(legal).toHaveLength(36);
    for (const code of legal) expect(decodeQuantumMove(code)!.follow.kind).toBe('spooky');
  });

  it('flags a cycle and makes the next player measure it', () => {
    // X 0-1, O 1-2, X 0-2 closes the triangle 0-1-2.
    const game = play([spooky(0, 1), spooky(1, 2), spooky(0, 2)]);
    const quantum = quantumOf(game);
    expect(quantum.pending).toBe(2);
    expect(new Set(quantum.cycle)).toEqual(new Set([0, 1, 2]));
    expect(game.currentPlayer).toBe(O);

    // A plain spooky move is no longer allowed; it needs a collapse first.
    expect(canPlay(game, spooky(3, 4))).toBe(false);
    expect(canPlay(game, spooky(3, 4, 0))).toBe(true);
    for (const code of legalMoves(game)) expect(decodeQuantumMove(code)!.collapse).not.toBeNull();
  });

  it('closes a two-square cycle too', () => {
    const game = play([spooky(3, 5), spooky(3, 5)]);
    expect(quantumOf(game).pending).toBe(1);
    expect(quantumOf(game).cycle).toEqual([3, 5]);
  });

  it('collapses the whole cycle and everything hanging off it', () => {
    // X1 0-1, O2 2-6, X3 1-2, then O4 0-2 closes the triangle 0-1-2 with
    // O2's square 6 hanging off it.
    const game = play([spooky(0, 1), spooky(2, 6), spooky(1, 2), spooky(0, 2)]);
    expect(quantumOf(game).pending).toBe(3);
    expect(game.currentPlayer).toBe(X);

    // X lands O4 in square 0 (choice 0): X1 must go to 1, X3 to 2, O2 to 6.
    const after = applyMove(game, spooky(4, 8, 0))!;
    expect(after.board[0]).toBe(O);
    expect(after.board[1]).toBe(X);
    expect(after.board[2]).toBe(X);
    expect(after.board[6]).toBe(O);
    const quantum = quantumOf(after);
    expect(quantum.classical[0]).toBe(4);
    expect(quantum.classical[1]).toBe(1);
    expect(quantum.classical[2]).toBe(3);
    expect(quantum.classical[6]).toBe(2);
    expect(new Set(quantum.collapsed)).toEqual(new Set([0, 1, 2, 6]));
    // The chooser's own spooky mark followed the collapse.
    expect(quantum.marks.at(-1)).toEqual({ player: X, move: 5, cells: [4, 8], at: null });
    expect(after.currentPlayer).toBe(O);
  });

  it('refuses spooky marks on classical squares', () => {
    const game = play([spooky(0, 1), spooky(0, 1)]);
    const after = applyMove(game, spooky(4, 5, 0))!;
    expect(after.board[0]).not.toBe(Empty);
    expect(canPlay(after, spooky(0, 7))).toBe(false);
    expect(canPlay(after, spooky(1, 7))).toBe(false);
    expect(canPlay(after, spooky(6, 7))).toBe(true);
  });

  it('ends the game on the collapse, with nothing more to place', () => {
    // O's three marks form the triangle 6-7-8. Whichever way X measures it,
    // all three land on the bottom row, and the game ends there - with X's
    // own marks still spooky and nothing left for X to place.
    const game = play([
      spooky(0, 3), // X1
      spooky(6, 7), // O2
      spooky(1, 4), // X3
      spooky(7, 8), // O4
      spooky(2, 5), // X5
      spooky(6, 8), // O6 closes 6-7-8
    ]);
    expect(quantumOf(game).pending).toBe(5);
    const options = quantumOptions(game, 0);
    expect(options.ends).toBe(true);
    expect(canPlay(game, spooky(0, 1, 0))).toBe(false);
    const ended = applyMove(game, nothing(0))!;
    expect(ended.status).toBe('won');
    expect(ended.winner).toBe(O);
    expect(ended.winLine).toEqual([6, 7, 8]);
    expect(ended.lastMove).toBe(6);
  });

  it('awards simultaneous lines to the one whose newest mark is older', () => {
    // X1 0-3, O2 2-5, X3 3-6, O4 5-8, then X5 0-6 closes X's 0-3-6
    // triangle. O measures it, and whichever way, X fills the left column.
    const game = play([spooky(0, 3), spooky(2, 5), spooky(3, 6), spooky(5, 8), spooky(0, 6)]);
    expect(quantumOf(game).pending).toBe(4);
    const ended = applyMove(game, nothing(0))!;
    expect(ended.winner).toBe(X);
    expect(new Set(ended.winLine)).toEqual(new Set([0, 3, 6]));

    // Now both at once: one ring through both columns, so a single
    // measurement completes a line for each player.
    const mixed = play([
      spooky(3, 6), // X1
      spooky(5, 8), // O2
      spooky(0, 3), // X3
      spooky(2, 5), // O4
      spooky(0, 2), // X5 joins both chains: 6-3-0-2-5-8, no cycle yet
      spooky(6, 8), // O6 closes the ring 6-3-0-2-5-8-6
    ]);
    expect(quantumOf(mixed).pending).toBe(5);
    // X lands O6 in 8: then O2 -> 5, O4 -> 2, X5 -> 0, X3 -> 3, X1 -> 6.
    // X has 0-3-6 (newest X5), O has 2-5-8 (newest O6): X's line is older.
    const both = applyMove(mixed, nothing(1))!;
    expect(both.status).toBe('won');
    expect(both.board.filter((cell) => cell === X)).toHaveLength(3);
    expect(both.board.filter((cell) => cell === O)).toHaveLength(3);
    expect(both.winner).toBe(X);
    expect(new Set(both.winLine)).toEqual(new Set([0, 3, 6]));

    // Landing O6 in 6 instead settles the ring the other way round, with no
    // line for anybody - and three squares left, so X places a spooky mark.
    const quiet = quantumOptions(mixed, 0);
    expect(quiet.ends).toBe(false);
    expect(quiet.free).toEqual([1, 4, 7]);
    expect(canPlay(mixed, nothing(0))).toBe(false);
    expect(canPlay(mixed, spooky(1, 4, 0))).toBe(true);
  });

  it('plays the ninth mark classically into the last square', () => {
    // Fill eight squares through collapses with no line, then one is left.
    const random = seeded(31);
    for (let round = 0; round < 200; round++) {
      let game = createGame(QUANTUM, X);
      while (game.status === 'playing') {
        const legal = legalMoves(game);
        expect(legal.length).toBeGreaterThan(0);
        game = applyMove(game, legal[Math.floor(random() * legal.length)]!)!;
      }
      const lastFollow = decodeQuantumMove(game.moves.at(-1)!)!.follow;
      if (lastFollow.kind === 'classical') {
        expect(game.board.every((cell) => cell !== Empty)).toBe(true);
        return;
      }
    }
    throw new Error('No random game reached a classical ninth mark');
  });

  it('keeps strict alternation, so the opener is derivable', () => {
    const random = seeded(7);
    for (let round = 0; round < 50; round++) {
      const starting = round % 2 === 0 ? X : O;
      let game = createGame(QUANTUM, starting);
      while (game.status === 'playing') {
        const legal = legalMoves(game);
        game = applyMove(game, legal[Math.floor(random() * legal.length)]!)!;
        expect(startingPlayerOf(game)).toBe(starting);
      }
      const again = replay(QUANTUM, starting, game.moves)!;
      expect(again.board).toEqual(game.board);
      expect(again.extra).toEqual(game.extra);
      expect(again.winner).toBe(game.winner);
      // Every mark's owner follows the parity of its subscript.
      for (const mark of quantumOf(game).marks) {
        expect(mark.player).toBe(mark.move % 2 === 1 ? starting : starting === X ? O : X);
      }
    }
  });

  it('lists exactly the codes it accepts', () => {
    const random = seeded(19);
    let game = createGame(QUANTUM, X);
    while (game.status === 'playing') {
      const legal = new Set(legalMoves(game));
      for (let code = 0; code < QUANTUM_MOVE_SPACE; code++) {
        expect(canPlay(game, code)).toBe(legal.has(code));
      }
      const list = [...legal];
      game = applyMove(game, list[Math.floor(random() * list.length)]!)!;
    }
  });
});

describe('quantum bot', () => {
  const quick = { timeBudgetMs: 120 } as const;

  /** Positions from random play, each with the player to move. */
  function positions(seed: number, count: number): GameState[] {
    const random = seeded(seed);
    const found: GameState[] = [];
    while (found.length < count) {
      let game = createGame(QUANTUM, random() < 0.5 ? X : O);
      while (game.status === 'playing' && found.length < count) {
        found.push(game);
        const legal = legalMoves(game);
        game = applyMove(game, legal[Math.floor(random() * legal.length)]!)!;
      }
    }
    return found;
  }

  const winsFor = (game: GameState) =>
    legalMoves(game).filter((move) => applyMove(game, move)!.winner === game.currentPlayer);
  const losesNext = (game: GameState, move: number) => {
    const after = applyMove(game, move)!;
    if (after.status !== 'playing')
      return after.winner !== null && after.winner !== game.currentPlayer;
    return winsFor(after).length > 0;
  };

  it('takes a win whenever one is on offer, at every level', () => {
    let checked = 0;
    for (const game of positions(41, 400)) {
      if (winsFor(game).length === 0) continue;
      checked++;
      for (const difficulty of ['beginner', 'master'] as const) {
        const move = chooseMove(game, { ...quick, difficulty, random: seeded(checked) })!;
        expect(applyMove(game, move.move)!.winner).toBe(game.currentPlayer);
      }
      if (checked >= 12) break;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('measures a cycle that wins for the other side and still plays legally', () => {
    // X5 closes X's own 0-1-2 triangle; O must measure it, and every choice
    // gives X the top row.
    const game = play([spooky(0, 1), spooky(3, 4), spooky(0, 2), spooky(4, 5), spooky(1, 2)]);
    const move = findBestMove(game, { ...quick, difficulty: 'hard', random: seeded(2) });
    expect(move).not.toBeNull();
    expect(applyMove(game, move!)!.winner).toBe(X);
  });

  it('never hands over a win while a safe move exists', () => {
    let checked = 0;
    for (const game of positions(57, 300)) {
      const legal = legalMoves(game);
      const unsafe = legal.filter((move) => losesNext(game, move));
      if (unsafe.length === 0 || unsafe.length === legal.length || winsFor(game).length > 0) {
        continue;
      }
      checked++;
      for (const difficulty of ['beginner', 'easy', 'hard'] as const) {
        const move = findBestMove(game, { ...quick, difficulty, random: seeded(checked) })!;
        expect(losesNext(game, move)).toBe(false);
      }
      if (checked >= 10) break;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('always plays legal moves to the end of a game, at every level', () => {
    const random = seeded(23);
    for (const difficulty of ['beginner', 'medium', 'master'] as const) {
      let game = createGame(QUANTUM, X);
      while (game.status === 'playing') {
        const move = findBestMove(game, { difficulty, timeBudgetMs: 60, random });
        expect(move).not.toBeNull();
        game = applyMove(game, move!)!;
        expect(game).not.toBeNull();
      }
    }
  });
});
