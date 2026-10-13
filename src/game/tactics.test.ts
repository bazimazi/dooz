import {
  applyMove,
  createGame,
  type GameState,
  legalMoves,
  modeById,
  GAME_MODES,
  X,
} from '@/game/engine';
import { describe, expect, it } from 'vitest';
import { calloutFor, collinear } from './tactics';

function play(config: Parameters<typeof createGame>[0], moves: number[]): GameState[] {
  const states = [createGame(config, X)];
  for (const move of moves) {
    const next = applyMove(states.at(-1)!, move);
    if (!next) throw new Error(`illegal move ${move}`);
    states.push(next);
  }
  return states;
}

const full = { revealThreats: true };
const safe = { revealThreats: false };

describe('calloutFor', () => {
  it('calls a fork on the classic board', () => {
    // X corners 0 and 8 with O in the centre and on 1; X at 6 threatens 3 and 7.
    const states = play(3, [0, 4, 8, 1, 6]);
    const callout = calloutFor(states.at(-2)!, states.at(-1)!, full);
    expect(callout).toMatchObject({ kind: 'fork', text: 'FORK!', player: X, cell: 6 });
  });

  it('calls a block when the mover takes the square the opponent would win on', () => {
    // X threatens 2 (0, 1); O takes it.
    const states = play(3, [0, 4, 1, 2]);
    expect(calloutFor(states.at(-2)!, states.at(-1)!, full)).toMatchObject({
      kind: 'blocked',
      text: 'BLOCKED!',
      cell: 2,
    });
  });

  it('names an open run when both winning squares share the move’s line', () => {
    // A row of four in the middle of a 15x15 board, open at both ends.
    const size = 15;
    const at = (row: number, col: number) => row * size + col;
    const config = modeById('gomoku-15').config;
    const states = play(config, [
      at(7, 5),
      at(0, 0),
      at(7, 6),
      at(0, 14),
      at(7, 7),
      at(14, 0),
      at(7, 8),
    ]);
    expect(calloutFor(states.at(-2)!, states.at(-1)!, full)).toMatchObject({
      kind: 'open',
      text: 'OPEN FOUR',
    });
  });

  it('keeps standing threats to itself when threats may not be revealed', () => {
    const fork = play(3, [0, 4, 8, 1, 6]);
    expect(calloutFor(fork.at(-2)!, fork.at(-1)!, safe)).toBeNull();
    // A block is old news to both players, so it is still called.
    const block = play(3, [0, 4, 1, 2]);
    expect(calloutFor(block.at(-2)!, block.at(-1)!, safe)?.kind).toBe('blocked');
  });

  it('says nothing for quiet moves, take-backs, or the move that ends the game', () => {
    const states = play(3, [4, 0]);
    expect(calloutFor(states[0]!, states[1]!, full)).toBeNull();
    expect(calloutFor(states[2]!, states[1]!, full)).toBeNull();
    const won = play(3, [0, 3, 1, 4, 2]);
    expect(calloutFor(won.at(-2)!, won.at(-1)!, full)).toBeNull();
  });
});

describe('calloutFor on other rule sets', () => {
  // Rule sets whose threats the line check does not model: random play must
  // never produce a threat callout on any of them.
  it.each(['pente', 'wild', 'order-chaos', 'powers', 'misere'] as const)(
    'never calls a fork, open run or block under %s',
    (id) => {
      const mode = GAME_MODES.find(
        (candidate) => candidate.config.variant === id || candidate.id === id,
      );
      if (!mode) return;
      let game = createGame(mode.config, X);
      let seed = 7;
      for (let ply = 0; ply < 40 && game.status === 'playing'; ply++) {
        const moves = legalMoves(game);
        if (moves.length === 0) break;
        seed = (seed * 16807) % 2147483647;
        const next = applyMove(game, moves[seed % moves.length]!);
        if (!next) break;
        const callout = calloutFor(game, next, full);
        expect(['fork', 'open', 'blocked']).not.toContain(callout?.kind);
        game = next;
      }
    },
  );
});

describe('collinear', () => {
  it('recognises rows, columns and both diagonals', () => {
    expect(collinear(5, [0, 1, 4])).toBe(true);
    expect(collinear(5, [2, 7, 22])).toBe(true);
    expect(collinear(5, [0, 6, 24])).toBe(true);
    expect(collinear(5, [4, 8, 20])).toBe(true);
    expect(collinear(5, [0, 6, 13])).toBe(false);
  });
});
