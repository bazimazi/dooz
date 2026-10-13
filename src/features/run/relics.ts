import { translate } from '@/i18n';
import { runMessages } from '@/i18n/messages/run';

/**
 * Relics: the rule changes a run collects on your side.
 *
 * Each bends one thing in the player's favour - who starts, what is on the
 * board, how long the bot thinks, how a result is counted - and nothing else,
 * so a combination of them is still readable as a list of plain sentences.
 * None of them touches the rules of the mode itself: a relic changes the match
 * around the game, never the game.
 */
export const RELIC_IDS = [
  'head-start',
  'second-chance',
  'fog',
  'initiative',
  'hourglass',
  'spare-heart',
  'insight',
  'iron-will',
  'tempo',
] as const;

export type RelicId = (typeof RELIC_IDS)[number];

export interface Relic {
  readonly id: RelicId;
  /** In the current language, read from the run catalog by id. */
  readonly name: string;
  readonly description: string;
  /** A short glyph for the relic's badge. */
  readonly glyph: string;
}

/** A short glyph for each relic's badge. */
const GLYPHS: Record<RelicId, string> = {
  'head-start': '+1',
  'second-chance': '↶',
  fog: '≈',
  initiative: '»',
  hourglass: '+t',
  'spare-heart': '♥',
  insight: '◎',
  'iron-will': '=',
  tempo: '½',
};

function relic(id: RelicId): Relic {
  return {
    id,
    glyph: GLYPHS[id],
    get name() {
      return translate(runMessages, `relic.${id}.name`);
    },
    get description() {
      return translate(runMessages, `relic.${id}.description`);
    },
  };
}

/** Every relic by id. Names and descriptions are read in the current language. */
export const RELICS: Record<RelicId, Relic> = Object.fromEntries(
  RELIC_IDS.map((id) => [id, relic(id)]),
) as Record<RelicId, Relic>;

export function isRelicId(value: unknown): value is RelicId {
  return typeof value === 'string' && (RELIC_IDS as readonly string[]).includes(value);
}
