import { GAME_MODES, modeById, O, replay, sameConfig, winningMoves, X } from '@/game/engine';
import { beforeEach, describe, expect, it } from 'vitest';
import { capDifficulty, dailyChallenge, parFor, scoreChallenge, shareText } from './daily';
import {
  afterMatch,
  GAUNTLET_LIVES,
  type GauntletData,
  gauntletOpponent,
  useGauntletStore,
} from './gauntlet';
import { handicapSetup, maxHandicapFor, sideToMoveAfter } from './handicap';
import { hashSeed, sample, seededRandom } from './random';

describe('seeded randomness', () => {
  it('repeats for a seed and differs between seeds', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const c = seededRandom(43);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
    expect(hashSeed('x')).toBe(hashSeed('x'));
    expect(hashSeed('x')).not.toBe(hashSeed('y'));
  });

  it('samples distinct entries', () => {
    const picked = sample(seededRandom(1), [1, 2, 3, 4, 5], 3);
    expect(new Set(picked).size).toBe(3);
  });
});

describe('handicap setups', () => {
  it('places the helped side one mark ahead, with the other side to move', () => {
    for (const mode of GAME_MODES) {
      const marks = maxHandicapFor(mode.config);
      const setup = handicapSetup(mode.config, marks, X);
      const game = replay(mode.config, setup.opener, setup.moves);
      expect(game, mode.id).not.toBeNull();
      expect(game!.status, mode.id).toBe('playing');
      expect(setup.moves.length % 2, mode.id).toBe(1);
      expect(game!.currentPlayer, mode.id).toBe(O);
      expect(sideToMoveAfter(setup)).toBe(O);
    }
  });

  it('never hands over a ready-made line', () => {
    const config = modeById('grid-9').config;
    const setup = handicapSetup(config, 3, X);
    const game = replay(config, setup.opener, setup.moves)!;
    const cells = game.board.map((_, at) => at).filter((at) => game.board[at] === 0);
    expect(winningMoves(game.board, config.size, X, config.winLength, cells)).toEqual([]);
  });

  it('is empty for no marks and the same for the same seed', () => {
    const config = modeById('grid-6').config;
    expect(handicapSetup(config, 0, X).moves).toEqual([]);
    expect(handicapSetup(config, 2, O, seededRandom(5))).toEqual(
      handicapSetup(config, 2, O, seededRandom(5)),
    );
  });
});

describe('daily challenge', () => {
  it('is the same for everyone on a day, and changes day to day', () => {
    const today = dailyChallenge(20_750);
    expect(dailyChallenge(20_750)).toEqual(today);
    const week = Array.from({ length: 7 }, (_, at) => dailyChallenge(20_750 + at));
    expect(new Set(week.map((entry) => JSON.stringify(entry))).size).toBeGreaterThan(1);
  });

  it('builds playable challenges across a year', () => {
    for (let day = 20_000; day < 20_365; day++) {
      const challenge = dailyChallenge(day);
      expect(sameConfig(challenge.config, modeById(challenge.mode).config)).toBe(true);
      expect(challenge.modifiers.length).toBeGreaterThan(0);
      expect(challenge.difficulty).toBe(capDifficulty(challenge.config, challenge.difficulty));
      if (challenge.setup) {
        const game = replay(challenge.config, challenge.setup.opener, challenge.setup.moves);
        expect(game?.status).toBe('playing');
      }
    }
  });

  it('scores wins over draws over losses, with par and time bonuses', () => {
    const challenge = { ...dailyChallenge(20_750), par: 5 };
    const loss = scoreChallenge(challenge, { outcome: 'loss', moves: 9, timeLeftMs: null });
    const draw = scoreChallenge(challenge, { outcome: 'draw', moves: 9, timeLeftMs: null });
    const slow = scoreChallenge(challenge, { outcome: 'win', moves: 9, timeLeftMs: null });
    const fast = scoreChallenge(challenge, { outcome: 'win', moves: 4, timeLeftMs: 20_000 });
    expect(loss.total).toBe(0);
    expect(draw.total).toBeGreaterThan(0);
    expect(slow.total).toBeGreaterThan(draw.total);
    expect(fast.total).toBeGreaterThan(slow.total);
    expect([loss.stars, draw.stars, slow.stars, fast.stars]).toEqual([0, 1, 2, 3]);
  });

  it('shares a result without the moves', () => {
    const challenge = dailyChallenge(20_750);
    const text = shareText(challenge, 'Classic', { outcome: 'win', score: 1240, stars: 2 }, 5);
    expect(text).toContain(`#${challenge.number}`);
    expect(text).toContain('1,240 pts');
    expect(text).toContain('Streak: 5 days');
    // Four lines of verdict and nothing else: no squares, no move list.
    expect(text.split('\n')).toHaveLength(4);
    expect(challenge.number).toBeGreaterThan(0);
  });

  it('gives every mode a positive par', () => {
    for (const mode of GAME_MODES) expect(parFor(mode.config)).toBeGreaterThan(0);
  });
});

describe('gauntlet', () => {
  beforeEach(() => useGauntletStore.getState().abandon());

  it('climbs on wins, holds on draws and ends when the lives run out', () => {
    let data: GauntletData = { seed: 1, lives: GAUNTLET_LIVES, beaten: 0, played: 0 };
    data = afterMatch(data, 'win');
    data = afterMatch(data, 'draw');
    expect(data).toMatchObject({ beaten: 1, lives: GAUNTLET_LIVES, played: 2 });
    let over = false;
    for (let at = 0; at < GAUNTLET_LIVES; at++) ({ over, ...data } = afterMatch(data, 'loss'));
    expect(over).toBe(true);
  });

  it('picks the same opponent for the same step and gets harder', () => {
    expect(gauntletOpponent(9, 0, 0)).toEqual(gauntletOpponent(9, 0, 0));
    expect(gauntletOpponent(9, 0, 0).difficulty).toBe('beginner');
    const late = gauntletOpponent(9, 20, 25);
    expect(['medium', 'master']).toContain(late.difficulty);
  });

  it('persists a gauntlet under way', () => {
    useGauntletStore.getState().start();
    useGauntletStore.getState().report('win');
    const stored = JSON.parse(localStorage.getItem('dooz.gauntlet') ?? '{}') as {
      beaten?: number;
    };
    expect(stored.beaten).toBe(1);
  });
});
