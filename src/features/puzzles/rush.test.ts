import { applyMove, createGame, modeById, O, X } from '@/game/engine';
import { seeded } from '@/game/engine/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { PUZZLE_INDEX } from './puzzles';
import { quickRefutation } from './refute';
import { nextRushPuzzle, targetRating, useRushStore } from './rush';

describe('puzzle rush', () => {
  beforeEach(() => {
    localStorage.clear();
    useRushStore.setState({ best: 0, runs: 0, recent: [] });
  });

  it('climbs from easy puzzles to hard ones as the score rises', () => {
    const random = seeded(4);
    const early = nextRushPuzzle(PUZZLE_INDEX, new Set(), 0, random)!;
    const late = nextRushPuzzle(PUZZLE_INDEX, new Set(), 18, random)!;
    expect(targetRating(18)).toBeGreaterThan(targetRating(0));
    expect(late.rating).toBeGreaterThan(early.rating);
  });

  it('does not deal a puzzle twice while there are fresh ones', () => {
    const played = new Set<string>();
    for (let score = 0; score < 30; score++) {
      const next = nextRushPuzzle(PUZZLE_INDEX, played, score, seeded(score))!;
      expect(played.has(next.id)).toBe(false);
      played.add(next.id);
    }
  });

  it('keeps the best score and tells anyone listening', () => {
    const heard: unknown[] = [];
    const listen = (event: Event) => heard.push((event as CustomEvent).detail);
    window.addEventListener('dooz:rush-complete', listen);
    expect(useRushStore.getState().finishRun(7)).toBe(true);
    expect(useRushStore.getState().finishRun(4)).toBe(false);
    window.removeEventListener('dooz:rush-complete', listen);
    expect(useRushStore.getState()).toMatchObject({ best: 7, runs: 2, recent: [4, 7] });
    expect(heard).toEqual([
      { score: 7, best: 7, improved: true },
      { score: 4, best: 7, improved: false },
    ]);
    expect(JSON.parse(localStorage.getItem('dooz.rush')!)).toMatchObject({ best: 7 });
  });
});

describe('refutations', () => {
  const classic = modeById('classic').config;
  const play = (moves: number[]) =>
    moves.reduce((game, move) => applyMove(game, move)!, createGame(classic, X));

  it('shows the win a wrong move leaves the defender', () => {
    // O holds 3-4; X ignores it.
    const after = play([0, 3, 8, 4, 1]);
    expect(quickRefutation(after, X, false)).toEqual({ kind: 'wins', move: 5 });
  });

  it('leaves a double threat to the engine, and names a win walked past', () => {
    // X0 O4 X6 O8 X1: X threatens 2 (0-1-2) and 3 (0-3-6) - two threats, so no
    // single block refutes it and the engine has to be asked.
    const lone = play([0, 4, 6, 8, 1]);
    expect(quickRefutation(lone, X, false)).toBeNull();
    // A win at 3 was on the board at the last step and X played 2 instead.
    const missed = play([0, 4, 6, 8, 2]);
    expect(quickRefutation(missed, X, true)).toMatchObject({ kind: 'missed' });
  });

  it('calls a self-made line under misère a loss', () => {
    let game = createGame(modeById('misere').config, X);
    for (const move of [0, 4, 1, 8, 2]) game = applyMove(game, move)!;
    expect(game.winner).toBe(O);
    expect(quickRefutation(game, X, false)).toEqual({ kind: 'self-line', move: null });
  });
});
