import { describe, expect, it } from 'vitest';
import {
  applyMove,
  canPlay,
  configForSize,
  createGame,
  defaultWinLength,
  fromRecord,
  legalMoves,
  randomStartingPlayer,
  replay,
  replayFrames,
  startingPlayerOf,
  toRecord,
} from './game.js';
import { GAME_MODES, modeById } from './modes.js';
import { fromMoves, seeded } from './testing.js';
import { Empty, type GameConfig, isGameConfig, O, X } from './types.js';

describe('createGame', () => {
  it('starts empty and playing', () => {
    const game = createGame(3, X);
    expect(game.board).toHaveLength(9);
    expect(game.board.every((cell) => cell === Empty)).toBe(true);
    expect(game.status).toBe('playing');
    expect(game.currentPlayer).toBe(X);
    expect(game.lastMove).toBeNull();
  });

  it('sizes the board from the board size', () => {
    expect(createGame(6).board).toHaveLength(36);
    expect(createGame(9).board).toHaveLength(81);
    expect(createGame(15).board).toHaveLength(225);
  });

  it('keeps the classic win lengths for the sizes that shipped with them', () => {
    expect(defaultWinLength(3)).toBe(3);
    expect(defaultWinLength(6)).toBe(4);
    expect(defaultWinLength(9)).toBe(5);
  });

  it('accepts a full config as well as a bare size', () => {
    const config: GameConfig = { variant: 'gomoku', size: 13, winLength: 5 };
    expect(createGame(config).config).toEqual(config);
    expect(createGame(6).config).toEqual(configForSize(6));
  });

  it('creates every shipped mode', () => {
    for (const mode of GAME_MODES) {
      const game = createGame(mode.config, X);
      expect(game.status).toBe('playing');
      expect(game.board).toHaveLength(mode.config.size * mode.config.size);
      expect(legalMoves(game).length).toBeGreaterThan(0);
    }
  });
});

describe('applyMove', () => {
  it('places a mark and passes the turn', () => {
    const game = applyMove(createGame(3, X), 4);
    expect(game?.board[4]).toBe(X);
    expect(game?.currentPlayer).toBe(O);
    expect(game?.lastMove).toBe(4);
    expect(game?.moves).toEqual([4]);
  });

  it('does not mutate the previous state', () => {
    const before = createGame(3, X);
    applyMove(before, 0);
    expect(before.board[0]).toBe(Empty);
    expect(before.moves).toEqual([]);
  });

  it('rejects an occupied cell', () => {
    const game = applyMove(createGame(3, X), 0)!;
    expect(applyMove(game, 0)).toBeNull();
  });

  it('rejects out-of-range and non-integer indices', () => {
    const game = createGame(3, X);
    expect(applyMove(game, -1)).toBeNull();
    expect(applyMove(game, 9)).toBeNull();
    expect(applyMove(game, 1.5)).toBeNull();
    expect(applyMove(game, Number.NaN)).toBeNull();
  });

  it('detects a win and freezes the game', () => {
    const won = replay(3, X, [0, 3, 1, 4, 2])!;
    expect(won.status).toBe('won');
    expect(won.winner).toBe(X);
    expect(won.winLine).toEqual([0, 1, 2]);
    expect(applyMove(won, 5)).toBeNull();
    expect(canPlay(won, 5)).toBe(false);
    expect(legalMoves(won)).toEqual([]);
  });

  it('detects a draw on a full board', () => {
    // X O X / X O O / O X X
    const drawn = replay(3, X, [0, 1, 2, 4, 3, 5, 7, 6, 8])!;
    expect(drawn.status).toBe('draw');
    expect(drawn.winner).toBeNull();
    expect(drawn.board.every((cell) => cell !== Empty)).toBe(true);
  });

  it('wins on a 6x6 board with four in a row', () => {
    // X builds 0,1,2,3 across the top while O answers on the row below.
    const won = replay(6, X, [0, 6, 1, 7, 2, 8, 3])!;
    expect(won.status).toBe('won');
    expect(won.winner).toBe(X);
    expect(won.winLine).toEqual([0, 1, 2, 3]);
  });

  it('does not win on a 6x6 board with only three', () => {
    const running = replay(6, X, [0, 6, 1, 7, 2])!;
    expect(running.status).toBe('playing');
  });
});

describe('replay', () => {
  it('rebuilds the same state the moves produced', () => {
    const played = fromMoves(3, X, [4, 0, 8]);
    const rebuilt = replay(3, X, [4, 0, 8]);
    expect(rebuilt).toEqual(played);
  });

  it('rejects a move list that does not play out', () => {
    expect(replay(3, X, [4, 4])).toBeNull();
    expect(replay(3, X, [0, 3, 1, 4, 2, 5])).toBeNull();
  });

  it('is deterministic across every mode', () => {
    for (const mode of GAME_MODES) {
      const random = seeded(7);
      let game = createGame(mode.config, X);
      const moves: number[] = [];
      while (game.status === 'playing') {
        const options = legalMoves(game);
        const move = options[Math.floor(random() * options.length)]!;
        moves.push(move);
        game = applyMove(game, move)!;
      }

      const again = replay(mode.config, X, moves);
      expect(again).toEqual(game);
      expect(fromRecord(toRecord(game))).toEqual(game);
    }
  });
});

describe('replayFrames', () => {
  it('produces one frame per position, starting from empty', () => {
    const frames = replayFrames(3, X, [4, 0, 8])!;
    expect(frames).toHaveLength(4);
    expect(frames[0]?.moves).toEqual([]);
    expect(frames[3]?.moves).toEqual([4, 0, 8]);
    expect(frames[3]).toEqual(replay(3, X, [4, 0, 8]));
  });

  it('returns null for a record that does not play out', () => {
    expect(replayFrames(3, X, [4, 4])).toBeNull();
  });
});

describe('startingPlayerOf', () => {
  it('recovers the opener at every point in a game', () => {
    for (const starting of [X, O] as const) {
      let game = createGame(3, starting);
      expect(startingPlayerOf(game)).toBe(starting);
      for (const move of [0, 3, 1, 4, 2]) {
        game = applyMove(game, move)!;
        expect(startingPlayerOf(game)).toBe(starting);
      }
      expect(game.status).toBe('won');
    }
  });
});

describe('randomStartingPlayer', () => {
  it('returns each player for the halves of the unit interval', () => {
    expect(randomStartingPlayer(() => 0.1)).toBe(X);
    expect(randomStartingPlayer(() => 0.9)).toBe(O);
  });
});

describe('isGameConfig', () => {
  it('accepts every shipped mode', () => {
    for (const mode of GAME_MODES) expect(isGameConfig(mode.config)).toBe(true);
  });

  it('rejects a run longer than the board', () => {
    expect(isGameConfig({ variant: 'classic', size: 3, winLength: 4 })).toBe(false);
  });

  it('rejects boards outside the supported range', () => {
    expect(isGameConfig({ variant: 'classic', size: 2, winLength: 3 })).toBe(false);
    expect(isGameConfig({ variant: 'classic', size: 16, winLength: 5 })).toBe(false);
    expect(isGameConfig({ variant: 'classic', size: 5.5, winLength: 3 })).toBe(false);
  });

  it('rejects an Ultimate game on any board but 9x9', () => {
    expect(isGameConfig({ variant: 'ultimate', size: 9, winLength: 3 })).toBe(true);
    expect(isGameConfig({ variant: 'ultimate', size: 6, winLength: 3 })).toBe(false);
    expect(isGameConfig({ variant: 'ultimate', size: 9, winLength: 5 })).toBe(false);
  });

  it('rejects junk', () => {
    expect(isGameConfig(null)).toBe(false);
    expect(isGameConfig('classic')).toBe(false);
    expect(isGameConfig({ variant: 'nope', size: 3, winLength: 3 })).toBe(false);
  });
});

describe('modes', () => {
  it('gives every mode a config the rules accept', () => {
    for (const mode of GAME_MODES) {
      expect(isGameConfig(mode.config)).toBe(true);
      expect(mode.rules.length).toBeGreaterThan(1);
      expect(mode.clock.initialSeconds).toBeGreaterThan(0);
    }
  });

  it('has unique ids and configs', () => {
    const ids = new Set(GAME_MODES.map((mode) => mode.id));
    const configs = new Set(GAME_MODES.map((mode) => JSON.stringify(mode.config)));
    expect(ids.size).toBe(GAME_MODES.length);
    expect(configs.size).toBe(GAME_MODES.length);
  });

  it('looks a mode up by id', () => {
    expect(modeById('classic').config.size).toBe(3);
    expect(() => modeById('nope' as 'classic')).toThrow();
  });
});
