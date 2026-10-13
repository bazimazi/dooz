import { type GameState, type ModeId, opponentOf, type Player } from '@/game/engine';
import { WIN_SCORE } from '@/game/engine/bot';
import type { Locale } from '@/i18n';
import { rivalText } from '@/i18n/messages/journey';
import { type RivalEvent, rivalLine } from './dialogue';
import type { Rival, RivalId } from './rivals';
import { winsFor } from './threats';

export { winsFor } from './threats';

/**
 * Turning a game into things a rival says.
 *
 * Everything here is read off the position exactly - who could win with
 * their next mark, and how many ways - so a rival never taunts a threat that
 * is not on the board, and never worries about one that is not there either.
 * Not every event gets a line: a character who comments on every move is one
 * you mute, so routine remarks wait their turn and only the big moments (a
 * fork, a signature move, the end coming) may interrupt.
 */

/** What the bot said about the move it just played, as the worker reports it. */
export interface BotMoveNote {
  readonly move: number;
  readonly reason: string;
  readonly score: number;
}

/** What a rival remembers between moves of one game. */
export interface RemarkMemory {
  /** Ply of the last line spoken, so routine lines are spaced out. */
  readonly lastSpoke: number;
  /** The rival has made a threat this game, so the next is not its first. */
  readonly threatened: boolean;
  /** The player had a threat on the board after their last move. */
  readonly playerThreats: number;
  /** The player has had the rival under pressure since the rival last threatened. */
  readonly pressed: boolean;
  /** The signature has been announced once already this game. */
  readonly signed: boolean;
}

export const FRESH_MEMORY: RemarkMemory = {
  lastSpoke: -10,
  threatened: false,
  playerThreats: 0,
  pressed: false,
  signed: false,
};

/** Which moment each rival's signature line belongs to. */
const SIGNATURE_MOMENT: Record<RivalId, 'style' | 'book' | 'blocked' | 'threat' | 'fork' | 'mate'> =
  {
    pip: 'style',
    mo: 'blocked',
    sage: 'book',
    bruno: 'threat',
    vex: 'fork',
    nyx: 'mate',
  };

/** Events important enough to speak over the spacing rule. */
const URGENT: ReadonlySet<RivalEvent> = new Set(['fork', 'playerFork', 'signature', 'nearLoss']);

/** Plies between routine lines. */
const SPACING = 3;

export interface RemarkContext {
  readonly rival: Rival;
  readonly mode: ModeId;
  /** The rival's mark. */
  readonly bot: Player;
  /** Plies that were on the board before anyone moved: a stage's setup. */
  readonly setupPlies: number;
  /** The bot's own account of its most recent move, if it has made one. */
  readonly note: BotMoveNote | null;
  /** First round of this stage in this visit, or a rematch. */
  readonly rematch: boolean;
  readonly boss: boolean;
  /** A stage's own opening line, in the player's language, used instead of a generic greeting. */
  readonly intro?: string;
  /** The language the rival speaks: the player's, unless a caller says otherwise. */
  readonly locale?: Locale;
  readonly random?: () => number;
}

export interface Remark {
  readonly id: number;
  readonly text: string;
  readonly event: RivalEvent | 'intro';
}

/**
 * The event the latest move amounts to, from the rival's point of view, and
 * the memory to carry to the next one.
 */
export function remarkEvent(
  memory: RemarkMemory,
  game: GameState,
  context: RemarkContext,
): { event: RivalEvent | null; memory: RemarkMemory } {
  const { bot, rival, note } = context;
  const player = opponentOf(bot);
  const random = context.random ?? Math.random;

  if (game.status !== 'playing') {
    const event: RivalEvent =
      game.status === 'draw' ? 'draw' : game.winner === bot ? 'win' : 'loss';
    return { event, memory };
  }

  const lastMover = opponentOf(game.currentPlayer);
  if (lastMover === bot) {
    const rivalWins = winsFor(game, bot);
    const blocked = memory.playerThreats > 0 && winsFor(game, player) === 0;
    const moment = SIGNATURE_MOMENT[rival.id];
    const playedNote = note !== null && note.move === game.lastMove;

    let event: RivalEvent | null = null;
    if (rivalWins >= 2) event = 'fork';
    else if (rivalWins === 1) {
      event = memory.pressed ? 'comeback' : memory.threatened ? 'threat' : 'firstThreat';
    } else if (blocked) event = 'blocked';

    // The signature replaces the routine line for its moment, now and then,
    // or arrives on its own when the bot says it played one.
    const signature =
      (moment === 'style' && playedNote && note.reason === 'style') ||
      (moment === 'book' && playedNote && note.reason === 'book') ||
      (moment === 'mate' && playedNote && note.score >= WIN_SCORE - 1000 && rivalWins < 2) ||
      (event !== null && event === moment && random() < 0.5) ||
      (moment === 'threat' && event === 'firstThreat' && random() < 0.5);
    if (signature && !(moment === 'mate' && memory.signed)) event = 'signature';

    return {
      event,
      memory: {
        ...memory,
        threatened: memory.threatened || rivalWins > 0,
        pressed: rivalWins > 0 ? false : memory.pressed,
        playerThreats: 0,
        signed: memory.signed || event === 'signature',
      },
    };
  }

  const playerWins = winsFor(game, player);
  const rivalCanWin = winsFor(game, bot) > 0;
  let event: RivalEvent | null = null;
  if (playerWins >= 2 && !rivalCanWin) event = random() < 0.5 ? 'playerFork' : 'nearLoss';
  else if (playerWins >= 1) event = 'worry';
  return {
    event,
    memory: {
      ...memory,
      playerThreats: playerWins,
      pressed: memory.pressed || playerWins > 0,
    },
  };
}

/**
 * The next remark, given the last one and the game as it now stands.
 *
 * Returns the previous remark unchanged when there is nothing new to say, so
 * the bubble is keyed on a new id only when a new line arrives.
 */
export function nextRemark(
  previous: { remark: Remark | null; memory: RemarkMemory },
  game: GameState,
  context: RemarkContext,
): { remark: Remark | null; memory: RemarkMemory } {
  const ply = game.moves.length;
  const random = context.random ?? Math.random;

  // The start of a round: an introduction, then quiet until there is a reason.
  if (ply <= context.setupPlies) {
    const event: RivalEvent | 'intro' =
      context.boss && !context.rematch
        ? 'bossIntro'
        : context.rematch
          ? 'rematch'
          : context.intro
            ? 'intro'
            : 'greeting';
    const text =
      event === 'intro'
        ? context.intro
        : rivalLine(context.rival.id, event, context.mode, undefined, random, context.locale);
    return {
      remark: text ? { id: -1 - ply - (context.rematch ? 100 : 0), text, event } : null,
      memory: FRESH_MEMORY,
    };
  }

  const { event, memory } = remarkEvent(previous.memory, game, context);
  // The result screen speaks for the rival once the game is over.
  if (event === null || game.status !== 'playing') {
    return { remark: previous.remark, memory };
  }
  const since = ply - previous.memory.lastSpoke;
  if (since < (URGENT.has(event) ? 2 : SPACING)) return { remark: previous.remark, memory };

  const text = rivalLine(context.rival.id, event, context.mode, undefined, random, context.locale);
  if (!text) return { remark: previous.remark, memory };
  return { remark: { id: ply, text, event }, memory: { ...memory, lastSpoke: ply } };
}

/**
 * The line for the result screen: what the rival says about how it ended, in
 * `locale` (the player's by default).
 */
export function resultLine(
  rival: Rival,
  outcome: 'win' | 'loss' | 'draw',
  locale?: Locale,
): string {
  // The outcome is the player's; the rival's event is the opposite.
  const event: RivalEvent = outcome === 'win' ? 'loss' : outcome === 'loss' ? 'win' : 'draw';
  const line = rivalLine(rival.id, event, undefined, undefined, undefined, locale);
  if (line) return line;
  if (outcome === 'draw') return '…';
  const text = rivalText(rival, locale);
  return outcome === 'win' ? text.concede : text.gloat;
}
