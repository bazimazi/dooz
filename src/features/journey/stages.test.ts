import { isModeId, modeById } from '@/game/engine';
import { describe, expect, it } from 'vitest';
import { isUnlocked, nextStage, RIVALS, stageAfter, STAGES, starsFor } from './stages';

describe('journey', () => {
  it('has unique stage ids that the bot route will accept', () => {
    const ids = STAGES.map((stage) => stage.id);
    expect(new Set(ids).size).toBe(ids.length);
    // The route narrows `stage` with this pattern before it reaches the screen.
    for (const id of ids) expect(id).toMatch(/^[a-z]+-\d{1,2}$/);
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

  /**
   * The 3x3 board is solved from hard upwards, so a stage there against a
   * strong level could never be won - and a stage nobody can win is a wall.
   */
  it('never pits the player against a perfect 3x3 player', () => {
    for (const stage of STAGES) {
      const small = modeById(stage.mode).config.size === 3 && stage.mode !== 'vanish';
      if (small) expect(['beginner', 'easy', 'medium']).toContain(stage.rival.difficulty);
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
});
