import { applyMove, createGame, isModeId, modeById, O, replay, X } from '@/game/engine';
import { describe, expect, it } from 'vitest';
import {
  analyseWin,
  chapterOf,
  isUnlocked,
  nextStage,
  playerMoves,
  RIVALS,
  stageAfter,
  stageById,
  STAGES,
  starsFor,
} from './stages';

/** The journey as it first shipped. Saved stars are keyed by these ids. */
const ORIGINAL_IDS = ['pip', 'mo', 'sage', 'bruno', 'vex', 'nyx'].flatMap((rival) =>
  [1, 2, 3].map((n) => `${rival}-${n}`),
);

describe('journey', () => {
  it('has unique stage ids that the bot route will accept', () => {
    const ids = STAGES.map((stage) => stage.id);
    expect(new Set(ids).size).toBe(ids.length);
    // The route narrows `stage` with this pattern before it reaches the screen.
    for (const id of ids) expect(id).toMatch(/^[a-z]+-\d{1,2}$/);
  });

  it('keeps every original stage, on its original mode, so saved stars still count', () => {
    const original: Record<string, string> = {
      'pip-1': 'classic',
      'pip-2': 'grid-6',
      'pip-3': 'vanish',
      'mo-1': 'classic',
      'mo-2': 'misere',
      'mo-3': 'gravity',
      'sage-1': 'grid-6',
      'sage-2': 'vanish',
      'sage-3': 'ultimate',
      'bruno-1': 'grid-9',
      'bruno-2': 'gravity',
      'bruno-3': 'gomoku-13',
      'vex-1': 'vanish',
      'vex-2': 'ultimate',
      'vex-3': 'gomoku-15',
      'nyx-1': 'grid-9',
      'nyx-2': 'gravity',
      'nyx-3': 'gomoku-15',
    };
    for (const id of ORIGINAL_IDS) {
      const stage = stageById(id);
      expect(stage?.mode).toBe(original[id]);
      // The old stars were for pace alone; the same game must earn the same.
      expect(stage?.objective).toBe('par');
      expect(stage?.opener).toBe(X);
      expect(stage?.setup).toBeUndefined();
    }
  });

  it('gives every rival a chapter of seven, ending in a boss', () => {
    expect(STAGES.length).toBe(42);
    for (const rival of RIVALS) {
      const chapter = chapterOf(rival.id);
      expect(chapter).toHaveLength(7);
      expect(chapter.at(-1)?.boss).toBe(true);
      expect(chapter.slice(0, -1).some((stage) => stage.boss)).toBe(false);
    }
  });

  it('only uses real modes, with par values a win can meet', () => {
    for (const stage of STAGES) {
      expect(isModeId(stage.mode)).toBe(true);
      const [two, three] = stage.par;
      expect(three).toBeLessThan(two);
      // Nobody wins in fewer moves than the run is long.
      expect(three).toBeGreaterThanOrEqual(modeById(stage.mode).config.winLength);
    }
  });

  it('sets up only legal, live positions', () => {
    for (const stage of STAGES) {
      if (!stage.setup) continue;
      const config = modeById(stage.mode).config;
      // Setups are plain squares, so only on rule sets whose moves are squares.
      expect(['classic', 'gomoku', 'gravity']).toContain(config.variant);
      const game = replay(config, stage.opener, stage.setup);
      expect(game?.status, stage.id).toBe('playing');
    }
  });

  /**
   * The 3x3 board is solved from hard upwards, so a stage there against a
   * strong level could never be won - and a stage nobody can win is a wall.
   */
  it('never pits the player against a perfect 3x3 player', () => {
    for (const stage of STAGES) {
      const small = modeById(stage.mode).config.size === 3 && stage.mode !== 'vanish';
      if (small) expect(['beginner', 'easy', 'medium']).toContain(stage.rival.difficulty);
      // Vanish is solved outright, and the strong levels win every game they open.
      if (stage.mode === 'vanish') expect(stage.opener).toBe(X);
    }
  });

  it('gets harder as it goes', () => {
    const order = RIVALS.map((rival) => rival.id);
    const seen = STAGES.map((stage) => order.indexOf(stage.rival.id));
    expect(seen).toEqual(seen.toSorted((a, b) => a - b));
  });

  it('awards stars only for a win, more for a faster one', () => {
    const stage = STAGES[0]!;
    const [two, three] = stage.par;
    expect(starsFor(stage, false, 1)).toBe(0);
    expect(starsFor(stage, true, three)).toBe(3);
    expect(starsFor(stage, true, two)).toBe(2);
    expect(starsFor(stage, true, two + 1)).toBe(1);
  });

  it('asks for the objective, on top of the par, for the third star', () => {
    const fork = STAGES.find((stage) => stage.objective === 'fork')!;
    const [two] = fork.par;
    expect(starsFor(fork, { won: true, moves: two, fork: true })).toBe(3);
    expect(starsFor(fork, { won: true, moves: two, fork: false })).toBe(2);
    expect(starsFor(fork, { won: true, moves: two + 1, fork: true })).toBe(1);

    const unaided = STAGES.find((stage) => stage.objective === 'no-hints')!;
    expect(starsFor(unaided, { won: true, moves: 3, hintsUsed: true })).toBe(2);
    expect(starsFor(unaided, { won: true, moves: 3 })).toBe(3);
  });

  it('unlocks one stage at a time', () => {
    const [first, second, third] = STAGES;
    expect(isUnlocked(first!, {})).toBe(true);
    expect(isUnlocked(second!, {})).toBe(false);
    expect(isUnlocked(second!, { [first!.id]: 1 })).toBe(true);
    expect(isUnlocked(third!, { [first!.id]: 3 })).toBe(false);

    expect(nextStage({})).toBe(first);
    expect(nextStage({ [first!.id]: 2 })).toBe(second);
    expect(stageAfter(first!)).toBe(second);
    expect(stageAfter(STAGES.at(-1)!)).toBeUndefined();
  });

  it('keeps stages starred before the journey grew open, and offers the new ones', () => {
    // A player who cleared the original eighteen.
    const earned = Object.fromEntries(ORIGINAL_IDS.map((id) => [id, 2]));
    for (const id of ORIGINAL_IDS) expect(isUnlocked(stageById(id)!, earned)).toBe(true);
    // The new stages sit after a starred one, so the first of each is open.
    expect(nextStage(earned).id).toBe('pip-4');
    expect(isUnlocked(stageById('mo-4')!, earned)).toBe(true);
    expect(isUnlocked(stageById('mo-5')!, earned)).toBe(false);
  });

  it('counts the player’s own moves after the setup', () => {
    const stage = stageById('mo-5')!;
    const config = modeById(stage.mode).config;
    let game = replay(config, stage.opener, stage.setup!)!;
    expect(game.currentPlayer).toBe(X);
    expect(playerMoves(game, stage, X)).toBe(0);
    game = applyMove(game, 0)!;
    expect(playerMoves(game, stage, X)).toBe(1);
    expect(playerMoves(game, stage, O)).toBe(0);
  });

  it('tells a forked win from a plain one, and a flawless game from a scare', () => {
    const classic = modeById('classic').config;
    // X0 O4 X8 O1 - O threatens 7 - X7 blocks and threatens 6, O6, X2 O5 X3.
    let plain = createGame(classic, X);
    for (const move of [0, 4, 8, 1, 7, 6, 2, 5, 3]) plain = applyMove(plain, move)!;
    // A full board with no line: not a win at all.
    expect(analyseWin(plain, undefined, X)).toEqual({ fork: false, flawless: false });

    // X4 O1 X0 O8 X6: X threatens 2 (2-4-6) and 3 (0-3-6). O3, X2 wins.
    let fork = createGame(classic, X);
    for (const move of [4, 1, 0, 8, 6, 3, 2]) fork = applyMove(fork, move)!;
    expect(fork.winner).toBe(X);
    expect(analyseWin(fork, undefined, X)).toEqual({ fork: true, flawless: true });
    expect(analyseWin(fork, undefined, O)).toEqual({ fork: false, flawless: false });
  });
});
