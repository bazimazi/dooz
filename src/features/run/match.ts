import {
  BOT_DIFFICULTIES,
  type BotDifficulty,
  modeById,
  profileFor,
  withSeed,
  X,
} from '@/game/engine';
import { difficultyLabel } from '@/game/bot/labels';
import { translate } from '@/i18n';
import { runMessages } from '@/i18n/messages/run';
import type { MatchSpec } from '@/features/arcade/ArcadeMatch';
import { blitzClockFor } from '@/features/arcade/daily';
import { handicapSetup } from '@/features/arcade/handicap';
import { hashSeed, seededRandom } from '@/features/arcade/random';
import { botGameXp, type Outcome, type XpLine, xpLine } from '@/features/progress/xp';
import { encounterFor, type MapNode } from './map';
import type { RelicId } from './relics';
import type { RunData } from './store';

/** One level weaker, never below the bottom. */
function weaker(difficulty: BotDifficulty): BotDifficulty {
  return BOT_DIFFICULTIES[Math.max(0, BOT_DIFFICULTIES.indexOf(difficulty) - 1)]!;
}

/**
 * The match a fight node holds, with the run's relics applied.
 *
 * The encounter decides the mode and the bot; the relics only change the
 * match around them. The storage key includes the attempt, so a boss faced a
 * second time is a fresh board rather than the lost one.
 */
export function runMatchSpec(run: RunData, node: MapNode): MatchSpec {
  const has = (relic: RelicId) => run.relics.includes(relic);
  const encounter = encounterFor(run.seed, node);
  const mode = modeById(encounter.mode);
  const random = seededRandom(hashSeed(`run-match-${run.seed}-${node.id}-${run.attempt}`));
  const config = withSeed(mode.config, random);
  const difficulty = has('fog') ? weaker(encounter.difficulty) : encounter.difficulty;
  const clock = encounter.timed ? blitzClockFor(mode) : undefined;

  return {
    config,
    difficulty,
    ...(has('head-start')
      ? { setup: handicapSetup(config, 1, X, random) }
      : has('initiative')
        ? { opener: X }
        : {}),
    ...(clock
      ? {
          clock: has('hourglass')
            ? { initialMs: Math.round(clock.initialMs * 1.5), incrementMs: clock.incrementMs }
            : clock,
        }
      : {}),
    ...(has('tempo')
      ? { botTimeBudgetMs: Math.max(40, Math.round(profileFor(difficulty).timeMs / 2)) }
      : {}),
    ...(has('second-chance') ? { undos: 1 } : {}),
    ...(has('insight') ? { hints: true } : {}),
    storageKey: `run:${run.seed}:${node.id}:${run.attempt}`,
    rival: encounter.rival
      ? { name: encounter.rival.name, avatar: encounter.rival.avatar }
      : {
          name:
            node.kind === 'elite'
              ? translate(runMessages, 'eliteName', { level: difficultyLabel(difficulty) })
              : difficultyLabel(difficulty),
        },
    badge: translate(
      runMessages,
      node.kind === 'boss' ? 'badgeBoss' : node.kind === 'elite' ? 'badgeElite' : 'badgeRun',
    ),
  };
}

/** XP for one fight: the bot game's own, plus a bounty on elites. */
export function runFightXp(node: MapNode, difficulty: BotDifficulty, outcome: Outcome): XpLine[] {
  const lines = botGameXp(difficulty, outcome);
  if (outcome === 'win' && node.kind === 'elite') lines.push(xpLine('xp.eliteBounty', 20));
  return lines;
}

/** XP for the end of a run: a little per floor, a lot for the boss. */
export function runEndXp(won: boolean, floor: number, flawless: boolean): XpLine[] {
  const lines: XpLine[] = [];
  if (floor > 0) lines.push(xpLine('xp.reachedFloor', floor * 10, { floor }));
  if (won) lines.push(xpLine('xp.bossDefeated', 150));
  if (won && flawless) lines.push(xpLine('xp.flawlessRun', 100));
  return lines;
}
