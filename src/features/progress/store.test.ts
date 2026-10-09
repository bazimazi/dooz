import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dayNumber, liveDailyStreak, totalBotWins, totalStars, useProgressStore } from './store';
import { freshUnlocks, isSkinUnlocked } from './unlocks';

describe('progress store', () => {
  beforeEach(() => {
    useProgressStore.getState().reset();
    vi.useRealTimers();
  });

  it('counts a bot streak and resets it on anything but a win', () => {
    const { recordBotGame } = useProgressStore.getState();
    recordBotGame('classic', 'easy', 'win');
    recordBotGame('classic', 'easy', 'win');
    const afterDraw = recordBotGame('classic', 'easy', 'draw');
    expect(afterDraw).toEqual({ won: 2, lost: 0, drawn: 1, streak: 0, best: 2 });

    recordBotGame('classic', 'easy', 'win');
    const record = recordBotGame('classic', 'easy', 'loss');
    expect(record).toEqual({ won: 3, lost: 1, drawn: 1, streak: 0, best: 2 });
    expect(totalBotWins(useProgressStore.getState().bot)).toBe(3);
  });

  it('keeps records per mode and level', () => {
    const { recordBotGame } = useProgressStore.getState();
    recordBotGame('classic', 'easy', 'win');
    recordBotGame('gravity', 'hard', 'loss');
    expect(Object.keys(useProgressStore.getState().bot).toSorted()).toEqual([
      'classic:easy',
      'gravity:hard',
    ]);
  });

  it('keeps only the best stars for a stage', () => {
    const { recordStage } = useProgressStore.getState();
    expect(recordStage('pip-1', 2)).toBe(true);
    expect(recordStage('pip-1', 1)).toBe(false);
    expect(recordStage('pip-1', 3)).toBe(true);
    expect(totalStars(useProgressStore.getState().journey)).toBe(3);
  });

  it('builds a daily streak on consecutive days and breaks it on a gap', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 1, 12));
    const { recordPuzzle } = useProgressStore.getState();

    recordPuzzle('a', true);
    // A second daily on the same day does not count twice.
    recordPuzzle('b', true);
    expect(useProgressStore.getState().daily.streak).toBe(1);

    vi.setSystemTime(new Date(2026, 8, 2, 9));
    recordPuzzle('c', true);
    expect(useProgressStore.getState().daily.streak).toBe(2);

    // Skip a day: the streak is shown as broken until the next solve restarts it.
    vi.setSystemTime(new Date(2026, 8, 4, 9));
    expect(liveDailyStreak(useProgressStore.getState().daily)).toBe(0);
    recordPuzzle('d', true);
    expect(useProgressStore.getState().daily).toMatchObject({ streak: 1, best: 2 });
    expect(useProgressStore.getState().puzzles).toEqual(['a', 'b', 'c', 'd']);
  });

  it('counts days in local time', () => {
    const late = new Date(2026, 8, 1, 23, 59);
    const early = new Date(2026, 8, 2, 0, 1);
    expect(dayNumber(early) - dayNumber(late)).toBe(1);
  });

  it('survives a reload', () => {
    useProgressStore.getState().recordPuzzle('kept', false);
    const stored = JSON.parse(localStorage.getItem('dooz.progress') ?? '{}') as {
      puzzles?: string[];
    };
    expect(stored.puzzles).toEqual(['kept']);
  });
});

describe('skin unlocks', () => {
  beforeEach(() => useProgressStore.getState().reset());

  it('unlocks neon at three bot wins, and announces it once', () => {
    const { recordBotGame, markAnnounced } = useProgressStore.getState();
    recordBotGame('classic', 'beginner', 'win');
    recordBotGame('classic', 'beginner', 'win');
    expect(isSkinUnlocked('neon', useProgressStore.getState())).toBe(false);

    recordBotGame('classic', 'beginner', 'win');
    expect(isSkinUnlocked('neon', useProgressStore.getState())).toBe(true);
    expect(freshUnlocks(useProgressStore.getState()).map((unlock) => unlock.skin)).toEqual([
      'neon',
    ]);

    markAnnounced(['skin:neon']);
    expect(freshUnlocks(useProgressStore.getState())).toEqual([]);
  });

  it('never locks the classic set', () => {
    expect(isSkinUnlocked('classic', useProgressStore.getState())).toBe(true);
  });
});
