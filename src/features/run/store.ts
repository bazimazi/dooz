import { create } from 'zustand';
import { freshSeed } from '@/features/arcade/random';
import type { Outcome } from '@/features/progress/store';
import { generateMap, nodeById, reachable, RUN_FLOORS } from './map';
import { isRelicId, type RelicId } from './relics';

const STORAGE_KEY = 'dooz.run';

/**
 * The run under way, if there is one.
 *
 * Kept apart from the progress store because it is a save game rather than a
 * record: it exists while a run does, and is thrown away when the run ends.
 * What outlives it - runs finished, best floor reached - goes to the progress
 * store when it does.
 *
 * Only decisions are stored. The map, the opponents and the relic offers are
 * all rebuilt from the seed, so a reload lands on the same node with the same
 * choices in front of it.
 */

export type RunPhase =
  /** Choosing a starting relic, once a run has been won before. */
  'start-relic' | 'map' | 'fight' | 'relic' | 'rest' | 'won' | 'lost';

export const START_HEARTS = 3;

export interface RunData {
  readonly seed: number;
  readonly hearts: number;
  readonly maxHearts: number;
  readonly relics: readonly RelicId[];
  /** Node ids visited, in order. The last is where the player stands. */
  readonly path: readonly string[];
  readonly phase: RunPhase;
  /** Fights at the current node so far, so a retried boss is a fresh game. */
  readonly attempt: number;
  readonly heartsLost: number;
  readonly fightsWon: number;
  readonly elites: number;
}

export function newRun(seed: number, veteran: boolean): RunData {
  return {
    seed,
    hearts: START_HEARTS,
    maxHearts: START_HEARTS,
    relics: [],
    path: [],
    phase: veteran ? 'start-relic' : 'map',
    attempt: 0,
    heartsLost: 0,
    fightsWon: 0,
    elites: 0,
  };
}

/** The node the player stands on, or null at the start. */
export function currentNodeId(run: RunData): string | null {
  return run.path.at(-1) ?? null;
}

/** The floor reached, counting from one; the boss is `RUN_FLOORS + 1`. */
export function floorReached(run: RunData): number {
  const at = currentNodeId(run);
  return at === null ? 0 : (nodeById(generateMap(run.seed), at)?.floor ?? 0) + 1;
}

/** Move onto `nodeId`, if it is one of the next steps. */
export function enterNode(run: RunData, nodeId: string): RunData {
  if (run.phase !== 'map') return run;
  const map = generateMap(run.seed);
  const node = reachable(map, currentNodeId(run)).find((entry) => entry.id === nodeId);
  if (!node) return run;
  const phase: RunPhase = node.kind === 'relic' ? 'relic' : node.kind === 'rest' ? 'rest' : 'fight';
  return { ...run, path: [...run.path, node.id], phase, attempt: 0 };
}

export function takeRelic(run: RunData, relic: RelicId): RunData {
  if (run.phase !== 'relic' && run.phase !== 'start-relic') return run;
  const heart = relic === 'spare-heart';
  return {
    ...run,
    relics: heart && run.relics.includes(relic) ? run.relics : [...run.relics, relic],
    maxHearts: run.maxHearts + (heart ? 1 : 0),
    hearts: run.hearts + (heart ? 1 : 0),
    phase: 'map',
  };
}

export function rest(run: RunData): RunData {
  if (run.phase !== 'rest') return run;
  return { ...run, hearts: Math.min(run.maxHearts, run.hearts + 1), phase: 'map' };
}

/** A relic choice can be passed over; the run simply moves on. */
export function skip(run: RunData): RunData {
  return run.phase === 'relic' || run.phase === 'start-relic' || run.phase === 'rest'
    ? { ...run, phase: 'map' }
    : run;
}

/**
 * The run after a fight at the current node.
 *
 * A loss costs a heart. Ordinary fights are behind you either way - lost
 * battles do not block the path - but the boss has to be beaten, so losing to
 * it means facing it again while hearts last. An elite won pays a relic.
 */
export function afterFight(
  run: RunData,
  outcome: Outcome,
): { run: RunData; counted: Outcome; elite: boolean } {
  const at = currentNodeId(run);
  const node = at ? nodeById(generateMap(run.seed), at) : undefined;
  if (run.phase !== 'fight' || !node) return { run, counted: outcome, elite: false };
  const counted: Outcome = outcome === 'draw' && run.relics.includes('iron-will') ? 'win' : outcome;
  const lost = counted === 'loss';
  const hearts = run.hearts - (lost ? 1 : 0);
  const base = {
    ...run,
    hearts,
    heartsLost: run.heartsLost + (lost ? 1 : 0),
    fightsWon: run.fightsWon + (counted === 'win' ? 1 : 0),
  };
  if (hearts <= 0) return { run: { ...base, phase: 'lost' }, counted, elite: false };

  if (node.kind === 'boss') {
    if (counted === 'win') return { run: { ...base, phase: 'won' }, counted, elite: false };
    return { run: { ...base, attempt: run.attempt + 1 }, counted, elite: false };
  }
  const elite = node.kind === 'elite' && counted === 'win';
  return {
    run: { ...base, elites: run.elites + (elite ? 1 : 0), phase: elite ? 'relic' : 'map' },
    counted,
    elite,
  };
}

/** A small whole number, or null. */
function whole(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 1000
    ? value
    : null;
}

function load(): RunData | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Record<
      string,
      unknown
    > | null;
    if (!parsed || typeof parsed['seed'] !== 'number') return null;
    const phases: readonly RunPhase[] = ['start-relic', 'map', 'fight', 'relic', 'rest'];
    const phase = parsed['phase'] as RunPhase;
    const path = Array.isArray(parsed['path'])
      ? parsed['path'].filter((id): id is string => typeof id === 'string')
      : null;
    const relics = Array.isArray(parsed['relics']) ? parsed['relics'].filter(isRelicId) : [];
    const numbers = ['hearts', 'maxHearts', 'attempt', 'heartsLost', 'fightsWon', 'elites'].map(
      (key) => whole(parsed[key]),
    );
    if (!path || !phases.includes(phase) || numbers.some((value) => value === null)) return null;
    const [hearts, maxHearts, attempt, heartsLost, fightsWon, elites] = numbers as number[];
    if (!hearts || path.length > RUN_FLOORS + 1) return null;
    // Every step must still be a legal step on the seed's map.
    const map = generateMap(parsed['seed'] >>> 0);
    let at: string | null = null;
    for (const id of path) {
      if (!reachable(map, at).some((node) => node.id === id)) return null;
      at = id;
    }
    return {
      seed: parsed['seed'] >>> 0,
      hearts,
      maxHearts: maxHearts!,
      relics,
      path,
      phase,
      attempt: attempt!,
      heartsLost: heartsLost!,
      fightsWon: fightsWon!,
      elites: elites!,
    };
  } catch {
    return null;
  }
}

function save(run: RunData | null): void {
  try {
    // A finished run is not resumed; its summary is shown from memory.
    if (!run || run.phase === 'won' || run.phase === 'lost') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(run));
  } catch {
    /* A run without storage lasts the session. */
  }
}

interface RunState {
  run: RunData | null;
  start: (veteran: boolean) => void;
  update: (next: RunData) => void;
  abandon: () => void;
}

export const useRunStore = create<RunState>((set) => ({
  run: load(),
  start(veteran) {
    const run = newRun(freshSeed(), veteran);
    set({ run });
    save(run);
  },
  update(next) {
    set({ run: next });
    save(next);
  },
  abandon() {
    set({ run: null });
    save(null);
  },
}));
