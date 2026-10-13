import { modeById, type ModeId } from '@/game/engine';
import { currentLocale, type Locale } from '@/i18n';
import { JOURNEY_DIALOGUE, journeyDialogueEn } from '@/i18n/messages/journeyDialogue';
import type { RivalId } from './rivals';

/**
 * What the rivals say, keyed by what just happened.
 *
 * Every line is tied to an event the game can detect exactly - a threat made,
 * a threat blocked, two at once - so a rival never taunts a threat that is not
 * on the board. The pools are deep enough that a player who replays a stage
 * hears new lines, and {@link LineDeck} deals each pool out in full before
 * any line comes round again.
 */
export type RivalEvent =
  /** Before the first move. Per mode family, falling back to `any`. */
  | 'greeting'
  /** Before the first move of a second or later round of the same stage. */
  | 'rematch'
  /** Before a chapter's boss stage. */
  | 'bossIntro'
  /** The rival's first threat of the game. */
  | 'firstThreat'
  /** Any later threat. */
  | 'threat'
  /** The rival has two ways to win at once. */
  | 'fork'
  /** The rival just stopped a threat of yours. */
  | 'blocked'
  /** The rival just played its signature move. */
  | 'signature'
  /** You just made a threat the rival must answer. */
  | 'worry'
  /** You have two ways to win at once. */
  | 'playerFork'
  /** The rival was under pressure and has turned it round. */
  | 'comeback'
  /** The rival is about to lose and knows it. */
  | 'nearLoss'
  | 'win'
  | 'loss'
  | 'draw';

/** Groups of modes that share a greeting. */
export type ModeFamily =
  'classic' | 'grid' | 'gomoku' | 'misere' | 'vanish' | 'gravity' | 'ultimate' | 'any';

export type RivalLines = { readonly greeting: Partial<Record<ModeFamily, readonly string[]>> } & {
  readonly [event in Exclude<RivalEvent, 'greeting'>]: readonly string[];
};

/** The family a mode's greeting comes from. */
export function familyOf(mode: ModeId): ModeFamily {
  const { variant, size } = modeById(mode).config;
  switch (variant) {
    case 'classic':
      return size === 3 ? 'classic' : 'grid';
    case 'gomoku':
    case 'pente':
      return 'gomoku';
    case 'gravity':
    case 'connect4':
      return 'gravity';
    case 'misere':
    case 'vanish':
    case 'ultimate':
      return variant;
    default:
      return 'any';
  }
}

/** A whole cast's lines, in one language. */
export type DialogueTable = Readonly<Record<RivalId, RivalLines>>;

/**
 * Every rival's lines in English. Other languages translate them line for
 * line in `i18n/messages/journeyDialogue.*.ts`; {@link rivalLine} speaks in
 * the player's.
 */
export const DIALOGUE: DialogueTable = journeyDialogueEn;

/** Every line a rival has, for counting and for tests. */
export function allLines(lines: RivalLines): string[] {
  const { greeting, ...events } = lines;
  return [...Object.values(greeting).flat(), ...Object.values(events).flat()];
}

/**
 * Deals lines out of a pool so none repeats until the whole pool has been
 * heard, and the last line of one pass is never the first of the next.
 *
 * Keyed by rival and event, and kept for the session: replaying a stage five
 * times should sound like a conversation, not a recording. {@link rivalLine}
 * deals a pool's positions rather than its words, so the deck carries on
 * where it was when the player switches language.
 */
export class LineDeck {
  private readonly decks = new Map<string, { order: unknown[]; last: unknown }>();

  constructor(private readonly random: () => number = Math.random) {}

  draw<T>(key: string, pool: readonly T[]): T | undefined {
    if (pool.length === 0) return undefined;
    let deck = this.decks.get(key);
    if (!deck || deck.order.length === 0) {
      const order: unknown[] = shuffle(pool, this.random);
      // The next pass starts with something other than what was just said.
      if (order.length > 1 && order[0] === deck?.last) order.push(order.shift());
      deck = { order, last: deck?.last };
      this.decks.set(key, deck);
    }
    const line = deck.order.shift() as T;
    deck.last = line;
    return line;
  }
}

function shuffle<T>(pool: readonly T[], random: () => number): T[] {
  const order = [...pool];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

const sessionDeck = new LineDeck();

/** A line of `pool`, dealt by its place so every language shares one deck. */
function deal(
  deck: LineDeck,
  key: string,
  pool: readonly string[],
  local: readonly string[] | undefined,
): string | undefined {
  const index = deck.draw(
    key,
    pool.map((_, at) => at),
  );
  return index === undefined ? undefined : (local?.[index] ?? pool[index]);
}

/**
 * A line for `rival` on `event`, in `locale` (the player's by default), or
 * undefined if the pool is empty.
 *
 * Greetings use the mode's family when the rival has a line for it - about
 * half the time, so the family lines stay special - and the general ones
 * otherwise.
 */
export function rivalLine(
  rival: RivalId,
  event: RivalEvent,
  mode?: ModeId,
  deck: LineDeck = sessionDeck,
  random: () => number = Math.random,
  locale: Locale = currentLocale(),
): string | undefined {
  const lines = DIALOGUE[rival];
  const local = JOURNEY_DIALOGUE[locale][rival];
  if (event !== 'greeting') return deal(deck, `${rival}:${event}`, lines[event], local[event]);
  const family = mode ? familyOf(mode) : 'any';
  const specific = family === 'any' ? undefined : lines.greeting[family];
  if (specific && specific.length > 0 && random() < 0.6) {
    return deal(deck, `${rival}:greeting:${family}`, specific, local.greeting[family]);
  }
  return deal(deck, `${rival}:greeting:any`, lines.greeting.any ?? [], local.greeting.any);
}
