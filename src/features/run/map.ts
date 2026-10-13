import { BOT_DIFFICULTIES, type BotDifficulty, GAME_MODES, type ModeId } from '@/game/engine';
import { RIVALS, type Rival } from '@/features/journey/stages';
import { capDifficulty, isSolvedBoard } from '@/features/arcade/daily';
import { hashSeed, pick, randomInt, sample, seededRandom } from '@/features/arcade/random';
import { RELIC_IDS, type RelicId } from './relics';

/**
 * A run's map: floors of nodes, each joined to one or two on the floor above,
 * ending at a single boss.
 *
 * Everything is derived from the run's seed - the shape, what each node holds,
 * which mode a battle is played in, which relics a chest offers - so the run
 * itself only has to remember the seed and the path taken, and a reload
 * rebuilds exactly the map it left.
 */

export type NodeKind = 'battle' | 'elite' | 'rest' | 'relic' | 'boss';

export interface MapNode {
  /** `${floor}-${index}`, stable for a seed. */
  readonly id: string;
  readonly floor: number;
  readonly index: number;
  readonly kind: NodeKind;
  /** Indices of the nodes on the next floor this one leads to. */
  readonly next: readonly number[];
}

export interface RunMap {
  readonly floors: readonly (readonly MapNode[])[];
}

/** Floors before the boss. */
export const RUN_FLOORS = 7;

export function generateMap(seed: number): RunMap {
  const random = seededRandom(hashSeed(`run-map-${seed}`));
  const widths = Array.from({ length: RUN_FLOORS }, (_, floor) =>
    floor === 0 ? 2 : floor === RUN_FLOORS - 1 ? 2 : randomInt(random, 2, 3),
  );
  widths.push(1);

  const kinds = widths.map((width, floor) =>
    Array.from({ length: width }, (): NodeKind => {
      if (floor === RUN_FLOORS) return 'boss';
      if (floor === 0) return 'battle';
      // A breather before the boss, always.
      if (floor === RUN_FLOORS - 1) return random() < 0.5 ? 'rest' : 'relic';
      const roll = random();
      if (floor >= 2 && roll < 0.18) return 'elite';
      if (floor >= 2 && roll < 0.32) return 'rest';
      if (roll < 0.5) return 'relic';
      return 'battle';
    }),
  );
  // Every floor offers at least one fight, so no path skips the middle game.
  for (let floor = 1; floor < RUN_FLOORS - 1; floor++) {
    const row = kinds[floor]!;
    if (!row.some((kind) => kind === 'battle' || kind === 'elite')) row[0] = 'battle';
  }

  const floors = widths.map((width, floor) => {
    const above = widths[floor + 1] ?? 0;
    const links: number[][] = Array.from({ length: width }, () => []);
    if (above > 0) {
      for (let index = 0; index < width; index++) {
        // Straight up the map, scaled to the next floor's width…
        const target = width === 1 ? 0 : Math.round((index * (above - 1)) / (width - 1));
        links[index]!.push(target);
        // …and sometimes a fork to a neighbour.
        const side = target + (random() < 0.5 ? -1 : 1);
        if (side >= 0 && side < above && random() < 0.55) links[index]!.push(side);
      }
      // Nothing above may be unreachable.
      for (let target = 0; target < above; target++) {
        if (links.some((list) => list.includes(target))) continue;
        const from = Math.min(
          width - 1,
          Math.round((target * (width - 1)) / Math.max(1, above - 1)),
        );
        links[from]!.push(target);
      }
    }
    return Array.from({ length: width }, (_, index): MapNode => ({
      id: `${floor}-${index}`,
      floor,
      index,
      kind: kinds[floor]![index]!,
      next: [...new Set(links[index]!)].toSorted((a, b) => a - b),
    }));
  });
  return { floors };
}

export function nodeById(map: RunMap, id: string): MapNode | undefined {
  const [floor, index] = id.split('-').map(Number);
  return map.floors[floor ?? -1]?.[index ?? -1];
}

/** The nodes that may be chosen next from `at` (the start when null). */
export function reachable(map: RunMap, at: string | null): MapNode[] {
  if (at === null) return [...(map.floors[0] ?? [])];
  const node = nodeById(map, at);
  if (!node) return [];
  const above = map.floors[node.floor + 1] ?? [];
  return node.next.map((index) => above[index]).filter((entry): entry is MapNode => !!entry);
}

/** Bot level by floor for an ordinary battle; elites play one step higher. */
const FLOOR_LEVELS: readonly BotDifficulty[] = [
  'beginner',
  'easy',
  'easy',
  'medium',
  'medium',
  'hard',
  'hard',
];

export interface Encounter {
  readonly mode: ModeId;
  readonly difficulty: BotDifficulty;
  /** A face and a name for the boss; ordinary bots go by their level. */
  readonly rival?: Rival;
  readonly timed: boolean;
}

/** What a fight node holds. Deterministic for a seed and node. */
export function encounterFor(seed: number, node: MapNode): Encounter {
  const random = seededRandom(hashSeed(`run-fight-${seed}-${node.id}`));
  if (node.kind === 'boss') {
    // A rival at full strength, on a board where that strength can show.
    const rival = pick(
      random,
      RIVALS.filter((entry) => entry.difficulty === 'expert' || entry.difficulty === 'master'),
    );
    const mode = pick(
      random,
      GAME_MODES.filter((entry) => !isSolvedBoard(entry.config)),
    );
    return { mode: mode.id, difficulty: rival.difficulty, rival, timed: true };
  }
  const mode = pick(random, GAME_MODES);
  const base = FLOOR_LEVELS[Math.min(node.floor, FLOOR_LEVELS.length - 1)]!;
  const step = node.kind === 'elite' ? 1 : 0;
  const level =
    BOT_DIFFICULTIES[Math.min(BOT_DIFFICULTIES.length - 1, BOT_DIFFICULTIES.indexOf(base) + step)]!;
  return {
    mode: mode.id,
    difficulty: capDifficulty(mode.config, level),
    timed: node.kind === 'elite',
  };
}

/** Three relics to choose from, none already owned. */
export function relicOffer(seed: number, key: string, owned: readonly RelicId[]): RelicId[] {
  const random = seededRandom(hashSeed(`run-relics-${seed}-${key}`));
  const pool = RELIC_IDS.filter((id) => !owned.includes(id) || id === 'spare-heart');
  return sample(random, pool, 3);
}
