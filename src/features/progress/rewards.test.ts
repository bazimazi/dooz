import { GAME_MODES } from '@/game/engine';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OFFLINE_ACHIEVEMENTS } from './achievements';
import { AVATAR_FRAMES, equippedCosmetic, WIN_EFFECTS } from './cosmetics';
import { migrate, type ProgressData, useProgressStore } from './store';
import { announcementIds, freshAnnouncements, isSkinUnlocked } from './unlocks';
import { levelFor, xpToReach } from './xp';

const state = () => useProgressStore.getState();

function data(): ProgressData {
  const {
    bot,
    localGames,
    puzzles,
    daily,
    journey,
    announced,
    xp,
    achievements,
    modes,
    lastWinDay,
    online,
    blitz,
    challenge,
    gauntlet,
    run,
  } = state();
  return {
    bot,
    localGames,
    puzzles,
    daily,
    journey,
    announced,
    xp,
    achievements,
    modes,
    lastWinDay,
    online,
    blitz,
    challenge,
    gauntlet,
    run,
  };
}

describe('XP and achievements', () => {
  beforeEach(() => {
    state().reset();
    vi.useRealTimers();
  });

  it('pays for a bot game and the first win of the day once', () => {
    state().recordBotGame('classic', 'medium', 'win');
    const first = state().lastAward!;
    expect(first.lines.map((line) => line.label)).toContain('First win today');
    state().recordBotGame('classic', 'medium', 'win');
    const second = state().lastAward!;
    expect(second.lines.map((line) => line.label)).not.toContain('First win today');
    expect(state().xp).toBe(first.after + second.xp);
  });

  it('awards achievements when earned, once, and pays for them', () => {
    state().recordBotGame('classic', 'beginner', 'win');
    const award = state().lastAward!;
    expect(award.achievements).toContain('bot-beginner');
    expect(award.lines.some((line) => line.label === 'Hello, bot')).toBe(true);
    state().recordBotGame('classic', 'beginner', 'win');
    expect(state().lastAward!.achievements).not.toContain('bot-beginner');
    expect(state().achievements.filter((id) => id === 'bot-beginner')).toHaveLength(1);
  });

  it('counts modes for the variety achievements', () => {
    for (const mode of GAME_MODES.slice(0, 3)) state().recordBotGame(mode.id, 'easy', 'loss');
    expect(state().achievements).toContain('variety-3');
    expect(state().achievements).not.toContain('variety-all');
  });

  it('records blitz games apart and unlocks their achievement', () => {
    state().recordBotGame('grid-6', 'easy', 'win', { blitz: true });
    expect(state().blitz).toEqual({ played: 1, won: 1 });
    expect(state().achievements).toContain('blitz-first');
  });

  it('pays the daily puzzle once a day and keeps the streak', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 1, 12));
    state().recordPuzzle('a', true);
    expect(state().lastAward!.lines.map((line) => line.label)).toContain('Daily puzzle');
    state().recordPuzzle('b', true);
    expect(state().lastAward!.lines.map((line) => line.label)).not.toContain('Daily puzzle');
    expect(state().daily.streak).toBe(1);
  });

  it('records one official challenge result a day', () => {
    const lines = [{ label: 'Daily challenge', xp: 25 }];
    const first = state().recordChallenge({
      day: 100,
      mode: 'classic',
      outcome: 'win',
      score: 1600,
      moves: 4,
      lines,
    });
    expect(first).not.toBeNull();
    expect(
      state().recordChallenge({
        day: 100,
        mode: 'classic',
        outcome: 'loss',
        score: 0,
        moves: 3,
        lines,
      }),
    ).toBeNull();
    state().recordChallenge({
      day: 101,
      mode: 'classic',
      outcome: 'loss',
      score: 0,
      moves: 3,
      lines,
    });
    expect(state().challenge).toMatchObject({ streak: 2, played: 2, won: 1, bestScore: 1600 });
    expect(state().achievements).toEqual(
      expect.arrayContaining(['challenge-first', 'challenge-score-1500']),
    );
  });

  it('keeps gauntlet and run records', () => {
    state().recordGauntletEnd(4);
    state().recordGauntletEnd(2);
    expect(state().gauntlet).toEqual({ runs: 2, best: 4, beaten: 6 });
    state().recordRunElite();
    state().recordRunEnd({ won: true, floor: 8, flawless: true, lines: [] });
    expect(state().run).toMatchObject({ runs: 1, won: 1, flawless: 1, elites: 1, bestFloor: 8 });
    expect(state().achievements).toEqual(
      expect.arrayContaining(['run-elite', 'run-win', 'run-flawless']),
    );
  });

  it('lists what a game unlocked in its award', () => {
    state().recordRunEnd({ won: true, floor: 8, flawless: false, lines: [] });
    expect(state().lastAward!.unlocked).toEqual(
      expect.arrayContaining(['cosmetic:frame:compass', 'cosmetic:effect:prism']),
    );
  });

  it('has unique achievement ids', () => {
    const ids = OFFLINE_ACHIEVEMENTS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(30);
  });
});

describe('announcements', () => {
  beforeEach(() => state().reset());

  it('announces a level, an achievement and an unlock once each', () => {
    for (let game = 0; game < 3; game++) state().recordBotGame('classic', 'medium', 'win');
    const fresh = freshAnnouncements(data());
    expect(fresh[0]?.kind).toBe('level');
    expect(fresh.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['skin:neon', 'achievement:bot-medium']),
    );
    state().markAnnounced(fresh.map((entry) => entry.id));
    expect(freshAnnouncements(data())).toEqual([]);
  });

  it('marks an old save as seen when it is first given XP', () => {
    const old = migrate({
      ...data(),
      bot: { 'classic:hard': { won: 10, lost: 0, drawn: 0, streak: 0, best: 3 } },
      puzzles: ['a', 'b', 'c', 'd', 'e'],
    });
    expect(old.xp).toBeGreaterThan(0);
    expect(old.achievements).toContain('bot-hard');
    expect(isSkinUnlocked('chalk', old)).toBe(true);
    expect(freshAnnouncements(old)).toEqual([]);
    expect(announcementIds(old)).toContain(`level:${levelFor(old.xp)}`);
  });
});

describe('cosmetics', () => {
  beforeEach(() => state().reset());

  it('falls back to the default for a locked or unknown choice', () => {
    expect(equippedCosmetic('frame', { frame: 'gold' }, data()).id).toBe(AVATAR_FRAMES[0]!.id);
    expect(equippedCosmetic('effect', { effect: 'nope' }, data()).id).toBe(WIN_EFFECTS[0]!.id);
  });

  it('equips an unlocked choice', () => {
    useProgressStore.setState({ xp: xpToReach(20) });
    expect(equippedCosmetic('frame', { frame: 'gold' }, data()).id).toBe('gold');
  });

  it('never repeats an id within a kind', () => {
    for (const list of [AVATAR_FRAMES, WIN_EFFECTS]) {
      const ids = list.map((entry) => entry.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
