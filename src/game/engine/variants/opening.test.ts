import { describe, expect, it } from 'vitest';
import { configKey, isGameConfig, moveSpace, sameConfig, swapMove, withSeed } from '../config.js';
import { applyMove, canPlay, legalMoves, replay, startingPlayerOf, toRecord } from '../game.js';
import { O, X, type GameConfig } from '../types.js';
import { centreOf } from './opening.js';

const PRO: GameConfig = { variant: 'gomoku', size: 15, winLength: 5, opening: 'pro' };
const SWAP: GameConfig = { variant: 'gomoku', size: 15, winLength: 5, opening: 'swap' };
const EXACT: GameConfig = { variant: 'gomoku', size: 15, winLength: 5, exact: true };

describe('pro opening', () => {
  it('confines the first mark to the centre', () => {
    const fresh = replay(PRO, X, [])!;
    expect(legalMoves(fresh)).toEqual([centreOf(15)]);
    expect(canPlay(fresh, 0)).toBe(false);
  });

  it("keeps the opener's second mark three squares from the centre", () => {
    const centre = centreOf(15);
    const afterReply = replay(PRO, X, [centre, centre + 1])!;
    expect(canPlay(afterReply, centre + 2)).toBe(false);
    expect(canPlay(afterReply, centre + 3)).toBe(true);
    expect(applyMove(afterReply, centre - 15 * 2)).toBeNull();
    // From the opener's third mark on, anything goes.
    const later = replay(PRO, X, [centre, centre + 1, centre + 3, centre + 2])!;
    expect(canPlay(later, centre + 15)).toBe(true);
  });

  it('is rejected on boards too small for its distance', () => {
    expect(isGameConfig({ variant: 'classic', size: 6, winLength: 4, opening: 'pro' })).toBe(false);
    expect(isGameConfig(PRO)).toBe(true);
  });
});

describe('swap opening', () => {
  const code = swapMove(SWAP)!;

  it('offers the swap only as the second move', () => {
    expect(code).toBe(225);
    expect(moveSpace(SWAP)).toBe(226);
    expect(legalMoves(replay(SWAP, X, [])!)).not.toContain(code);
    expect(legalMoves(replay(SWAP, X, [112])!)).toContain(code);
    expect(canPlay(replay(SWAP, X, [112, 113])!, code)).toBe(false);
  });

  it('hands the opening mark to the swapper and the turn back to the opener', () => {
    const swapped = replay(SWAP, X, [112, code])!;
    expect(swapped.board[112]).toBe(O);
    expect(swapped.currentPlayer).toBe(X);
    expect(swapped.lastMove).toBe(112);
    expect(startingPlayerOf(swapped)).toBe(X);
    // A record of a swapped game replays to the same position.
    const record = toRecord(swapped);
    expect(replay(record.config, record.startingPlayer, record.moves)?.board).toEqual(
      swapped.board,
    );
  });

  it('is not offered by rule sets whose state is the move list', () => {
    expect(isGameConfig({ variant: 'vanish', size: 3, winLength: 3, opening: 'swap' })).toBe(false);
    expect(isGameConfig({ variant: 'gravity', size: 7, winLength: 4, opening: 'swap' })).toBe(true);
  });
});

describe('exact runs', () => {
  // X builds 0-1-2-3 and 5-6 on the top row, leaving 4 to join them into six.
  const opening = [0, 30, 1, 31, 2, 32, 3, 33, 5, 34 + 15, 6, 35 + 15];

  it('does not award an overline', () => {
    const exact = replay(EXACT, X, [...opening, 4])!;
    expect(exact.status).toBe('playing');
    const freestyle = replay({ ...EXACT, exact: undefined }, X, [...opening, 4])!;
    expect(freestyle.status).toBe('won');
  });

  it('still awards exactly five', () => {
    const won = replay(EXACT, X, [0, 30, 1, 31, 2, 32, 3, 48, 4])!;
    expect(won.status).toBe('won');
    expect(won.winLine).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('config identity', () => {
  it('keeps the keys every existing mode was stored under', () => {
    expect(configKey({ variant: 'gomoku', size: 15, winLength: 5 })).toBe('gomoku:15:5');
    expect(configKey(PRO)).toBe('gomoku:15:5:pro');
    expect(configKey({ ...EXACT, opening: 'swap' })).toBe('gomoku:15:5:exact:swap');
  });

  it('treats options as part of the mode', () => {
    expect(sameConfig(PRO, SWAP)).toBe(false);
    expect(sameConfig(EXACT, { ...EXACT, exact: true })).toBe(true);
    expect(sameConfig({ variant: 'gomoku', size: 15, winLength: 5 }, EXACT)).toBe(false);
  });

  it('rejects options a rule set does not support', () => {
    expect(isGameConfig({ variant: 'misere', size: 3, winLength: 3, exact: true })).toBe(false);
    expect(isGameConfig({ variant: 'classic', size: 3, winLength: 3, seed: 4 })).toBe(false);
  });

  it('leaves unseeded configs alone when seeding', () => {
    const config: GameConfig = { variant: 'classic', size: 3, winLength: 3 };
    expect(withSeed(config, () => 0.5)).toBe(config);
  });
});
