import { applyMove, createGame, O, type Player, X } from '@/game/engine';
import { describe, expect, it } from 'vitest';
import { lastSeatName, movesBy, nextSeatName, seatFor, type Teams, teamName } from './teams';

const TEAMS: Teams = { x: ['Ana', 'Ben'], o: ['Cy', 'Dee'] };

function after(moves: number[], opener: Player = X) {
  let game = createGame(3, opener);
  for (const move of moves) game = applyMove(game, move)!;
  return game;
}

describe('team rotation', () => {
  it('goes P1, P3, P2, P4 round the table when X opens', () => {
    const order: string[] = [];
    let game = createGame(3, X);
    for (const move of [0, 1, 2, 3, 4, 5]) {
      order.push(nextSeatName(game, game.currentPlayer, TEAMS, 0));
      game = applyMove(game, move)!;
    }
    expect(order).toEqual(['Ana', 'Cy', 'Ben', 'Dee', 'Ana', 'Cy']);
  });

  it('starts with the opening team when O opens', () => {
    const game = createGame(3, O);
    expect(nextSeatName(game, O, TEAMS, 0)).toBe('Cy');
    expect(nextSeatName(game, X, TEAMS, 0)).toBe('Ana');
    const next = applyMove(game, 4)!;
    expect(nextSeatName(next, X, TEAMS, 0)).toBe('Ana');
    expect(nextSeatName(next, O, TEAMS, 0)).toBe('Dee');
  });

  it('swaps who leads each team from one game to the next', () => {
    const game = createGame(3, X);
    expect(nextSeatName(game, X, TEAMS, 1)).toBe('Ben');
    expect(nextSeatName(game, O, TEAMS, 1)).toBe('Dee');
    expect(seatFor(0, 2)).toBe(0);
  });

  it('counts each side’s moves from the opener', () => {
    const game = after([0, 1, 2], O);
    expect(movesBy(game, O)).toBe(2);
    expect(movesBy(game, X)).toBe(1);
  });

  it('names the teammate whose move won', () => {
    // X: Ana 0, Ben 1, Ana 2 - Ana completes the top row.
    const won = after([0, 3, 1, 4, 2], X);
    expect(won.winner).toBe(X);
    expect(lastSeatName(won, X, TEAMS, 0)).toBe('Ana');
    expect(teamName(X, TEAMS)).toBe('Ana & Ben');
  });
});
