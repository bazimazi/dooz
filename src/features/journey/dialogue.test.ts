import { applyMove, createGame, GAME_MODES, modeById, O, type GameState, X } from '@/game/engine';
import { seeded } from '@/game/engine/testing';
import { describe, expect, it } from 'vitest';
import { allLines, DIALOGUE, familyOf, LineDeck, type RivalEvent, rivalLine } from './dialogue';
import { FRESH_MEMORY, nextRemark, type RemarkContext, remarkEvent } from './remarks';
import { RIVALS } from './rivals';

const EVENTS: readonly Exclude<RivalEvent, 'greeting'>[] = [
  'rematch',
  'bossIntro',
  'firstThreat',
  'threat',
  'fork',
  'blocked',
  'signature',
  'worry',
  'playerFork',
  'comeback',
  'nearLoss',
  'win',
  'loss',
  'draw',
];

function play(moves: readonly number[], mode = 'classic' as const): GameState {
  let game = createGame(modeById(mode).config, X);
  for (const move of moves) game = applyMove(game, move)!;
  return game;
}

describe('rival dialogue', () => {
  it.each(RIVALS.map((rival) => [rival.id] as const))(
    '%s has thirty-odd lines, with something for every event',
    (id) => {
      const lines = DIALOGUE[id];
      expect(allLines(lines).length).toBeGreaterThanOrEqual(30);
      expect(lines.greeting.any?.length).toBeGreaterThan(0);
      for (const event of EVENTS) expect(lines[event].length, event).toBeGreaterThan(0);
      // A line said twice in one pool would be heard twice in a row.
      for (const event of EVENTS) expect(new Set(lines[event]).size).toBe(lines[event].length);
    },
  );

  it('greets every mode from some pool', () => {
    for (const mode of GAME_MODES) {
      for (const rival of RIVALS) {
        expect(rivalLine(rival.id, 'greeting', mode.id, new LineDeck(seeded(1)))).toBeTruthy();
      }
      expect(familyOf(mode.id)).toBeTruthy();
    }
  });

  it('deals a whole pool before repeating, and never the same line twice running', () => {
    const deck = new LineDeck(seeded(7));
    const pool = ['a', 'b', 'c', 'd'];
    const heard: string[] = [];
    for (let i = 0; i < 40; i++) heard.push(deck.draw('k', pool)!);
    for (let pass = 0; pass < 10; pass++) {
      expect(heard.slice(pass * 4, pass * 4 + 4).toSorted()).toEqual(pool);
    }
    for (let i = 1; i < heard.length; i++) expect(heard[i]).not.toBe(heard[i - 1]);
  });
});

describe('rival remarks', () => {
  const context = (overrides: Partial<RemarkContext> = {}): RemarkContext => ({
    rival: RIVALS[1]!,
    mode: 'classic',
    bot: O,
    setupPlies: 0,
    note: null,
    rematch: false,
    boss: false,
    random: () => 0.9,
    ...overrides,
  });

  it('worries when you make a threat, and taunts with its first', () => {
    // X0 O4 X1: X threatens 2.
    const worried = remarkEvent(FRESH_MEMORY, play([0, 4, 1]), context());
    expect(worried.event).toBe('worry');
    expect(worried.memory.playerThreats).toBe(1);

    // O blocks at 2 and now threatens 6 (2-4-6).
    const blocked = remarkEvent(worried.memory, play([0, 4, 1, 2]), context());
    expect(blocked.event).toBe('comeback');

    const fresh = remarkEvent(FRESH_MEMORY, play([0, 4, 8, 2]), context());
    expect(fresh.event).toBe('firstThreat');
  });

  it('says you have it when you hold two winning squares', () => {
    // X4 O1 X0 O8 X6: X wins on 2 or 3.
    const { event } = remarkEvent(FRESH_MEMORY, play([4, 1, 0, 8, 6]), context());
    expect(['playerFork', 'nearLoss']).toContain(event);
  });

  it('plays a copycat line when the bot says it mirrored', () => {
    const pip = RIVALS[0]!;
    const game = play([0, 8]);
    const { event } = remarkEvent(
      FRESH_MEMORY,
      game,
      context({ rival: pip, note: { move: 8, reason: 'style', score: 0 } }),
    );
    expect(event).toBe('signature');
  });

  it('opens with an introduction and spaces out the routine lines', () => {
    const start = nextRemark(
      { remark: null, memory: FRESH_MEMORY },
      play([]),
      context({ intro: 'Hello.' }),
    );
    expect(start.remark?.text).toBe('Hello.');

    const boss = nextRemark(
      { remark: null, memory: FRESH_MEMORY },
      play([]),
      context({ boss: true }),
    );
    expect(DIALOGUE.mo.bossIntro).toContain(boss.remark?.text);

    const first = nextRemark(start, play([0, 4, 1]), context());
    expect(first.remark?.event).toBe('worry');
    // One ply later a routine line has to wait its turn.
    const quiet = nextRemark(first, play([0, 4, 1, 2]), context());
    expect(quiet.remark).toBe(first.remark);
  });
});
