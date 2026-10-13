import { modeById, replay, sameConfig } from '@/game/engine';
import { describe, expect, it } from 'vitest';
import { encounterFor, generateMap, reachable, relicOffer, RUN_FLOORS } from './map';
import { runMatchSpec } from './match';
import {
  afterFight,
  currentNodeId,
  enterNode,
  newRun,
  rest,
  type RunData,
  START_HEARTS,
  takeRelic,
} from './store';

/** Walk to the first reachable node of the wanted kind, or any. */
function step(run: RunData, kind?: string): RunData {
  const options = reachable(generateMap(run.seed), currentNodeId(run));
  const node = options.find((entry) => entry.kind === kind) ?? options[0]!;
  return enterNode(run, node.id);
}

describe('run map', () => {
  it('is rebuilt identically from its seed', () => {
    expect(generateMap(77)).toEqual(generateMap(77));
    expect(generateMap(77)).not.toEqual(generateMap(78));
  });

  it('reaches every node and ends in one boss', () => {
    for (let seed = 0; seed < 50; seed++) {
      const map = generateMap(seed);
      expect(map.floors).toHaveLength(RUN_FLOORS + 1);
      expect(map.floors.at(-1)!.map((node) => node.kind)).toEqual(['boss']);
      map.floors.slice(1).forEach((floor, at) => {
        const below = map.floors[at]!;
        for (const node of floor) {
          expect(below.some((entry) => entry.next.includes(node.index))).toBe(true);
        }
      });
      for (const floor of map.floors.slice(1, -2)) {
        expect(floor.some((node) => node.kind === 'battle' || node.kind === 'elite')).toBe(true);
      }
    }
  });

  it('builds playable matches for every fight, with relics applied', () => {
    const run: RunData = { ...newRun(5, false), relics: ['head-start', 'second-chance', 'fog'] };
    for (const floor of generateMap(5).floors) {
      for (const node of floor) {
        if (node.kind === 'rest' || node.kind === 'relic') continue;
        const spec = runMatchSpec(run, node);
        const encounter = encounterFor(5, node);
        expect(sameConfig(spec.config, modeById(encounter.mode).config)).toBe(true);
        expect(spec.undos).toBe(1);
        const game = replay(spec.config, spec.setup!.opener, spec.setup!.moves);
        expect(game?.status).toBe('playing');
      }
    }
  });

  it('offers three relics not already owned', () => {
    const offer = relicOffer(3, '1-0', ['fog', 'tempo']);
    expect(offer).toHaveLength(3);
    expect(offer).not.toContain('fog');
    expect(offer).not.toContain('tempo');
  });
});

describe('run progress', () => {
  it('moves only to reachable nodes', () => {
    const run = newRun(11, false);
    expect(enterNode(run, '5-0')).toBe(run);
    const moved = step(run);
    expect(moved.path).toHaveLength(1);
    expect(moved.phase).toBe('fight');
  });

  it('costs a heart for a loss and ends the run at none', () => {
    let run = step(newRun(11, false));
    ({ run } = afterFight(run, 'loss'));
    expect(run.hearts).toBe(START_HEARTS - 1);
    expect(run.phase).toBe('map');
    run = { ...step(run, 'battle'), hearts: 1 };
    if (run.phase === 'fight') {
      ({ run } = afterFight(run, 'loss'));
      expect(run.phase).toBe('lost');
    }
  });

  it('counts a draw as a win with iron will', () => {
    const run = { ...step(newRun(11, false)), relics: ['iron-will' as const] };
    const { counted } = afterFight(run, 'draw');
    expect(counted).toBe('win');
  });

  it('heals at rest and grows with a spare heart', () => {
    const resting: RunData = { ...newRun(1, false), hearts: 1, phase: 'rest' };
    expect(rest(resting)).toMatchObject({ hearts: 2, phase: 'map' });
    const choosing: RunData = { ...newRun(1, false), phase: 'relic' };
    expect(takeRelic(choosing, 'spare-heart')).toMatchObject({
      maxHearts: START_HEARTS + 1,
      hearts: START_HEARTS + 1,
    });
  });

  it('retries the boss until it falls or the hearts run out', () => {
    const map = generateMap(4);
    const boss = map.floors.at(-1)![0]!;
    const path = map.floors.slice(0, -1).map((floor) => floor[0]!.id);
    const run: RunData = { ...newRun(4, false), path: [...path, boss.id], phase: 'fight' };
    const lost = afterFight(run, 'loss').run;
    expect(lost).toMatchObject({ phase: 'fight', attempt: 1, hearts: START_HEARTS - 1 });
    expect(afterFight(lost, 'win').run.phase).toBe('won');
  });

  it('starts a veteran with a relic choice', () => {
    expect(newRun(1, true).phase).toBe('start-relic');
    expect(newRun(1, false).phase).toBe('map');
  });
});
