import type { BotDifficulty, ModeId } from '@dooz/engine';
import type { Avatar } from '@dooz/protocol';

/**
 * The journey: six opponents, three games each, every mode on the way.
 *
 * It exists to give the bot a shape. Six difficulty levels and nine modes is
 * fifty-four combinations, and a new player looking at that grid has no idea
 * where to start or what "good" looks like. A path does: it starts somewhere
 * winnable, introduces one new rule set at a time, and ends at the levels that
 * are meant to be hard.
 *
 * Every stage is winnable. None of them puts the player against a level that
 * plays the 3x3 board perfectly - a stage nobody can win is a wall, not a
 * challenge - and the player always moves first, so the stars measure the
 * player rather than a coin toss.
 */

export interface Rival {
  readonly id: string;
  readonly name: string;
  readonly avatar: Avatar;
  readonly difficulty: BotDifficulty;
  /** One line, said before the first game. */
  readonly greeting: string;
  /** Said when they win. */
  readonly gloat: string;
  /** Said when they lose. */
  readonly concede: string;
  /** Said mid-game when they have just made a threat you must answer. */
  readonly taunts: readonly string[];
  /** Said mid-game when you have just made one they must answer. */
  readonly worries: readonly string[];
}

export interface Stage {
  readonly id: string;
  readonly rival: Rival;
  readonly mode: ModeId;
  /**
   * Own moves at or under which a win earns two and three stars. A win in more
   * than `par[0]` moves still earns one.
   */
  readonly par: readonly [twoStars: number, threeStars: number];
  /** A nudge shown before the game. */
  readonly tip: string;
}

export const RIVALS: readonly Rival[] = [
  {
    id: 'pip',
    name: 'Pip',
    avatar: 'frog',
    difficulty: 'beginner',
    greeting: 'Ribbit! I just learned the rules. Go easy on me?',
    gloat: 'Wait… I won? Beginner’s luck!',
    concede: 'Hop to it — you’re a natural.',
    taunts: ['Ooh, is this a line?', 'Ribbit? Ribbit!', 'Did I do that on purpose?'],
    worries: ['Uh-oh.', 'Wait, wait, wait—', 'Is that allowed?'],
  },
  {
    id: 'mo',
    name: 'Mo',
    avatar: 'cat',
    difficulty: 'easy',
    greeting: 'I always block. What I don’t see is what comes after.',
    gloat: 'Purrfect. Try again?',
    concede: 'Hmph. Two threats at once is cheating. (It isn’t.)',
    taunts: ['Your move. Choose wisely.', 'Paws off that square.', 'Mrrow.'],
    worries: ['Blocking. Obviously.', 'I saw that. Probably.', 'Hiss.'],
  },
  {
    id: 'sage',
    name: 'Sage',
    avatar: 'owl',
    difficulty: 'medium',
    greeting: 'I look three moves ahead. Set your traps further out than that.',
    gloat: 'Patience wins games. Hoo.',
    concede: 'A fine combination. I did not see it coming.',
    taunts: ['Consider the consequences.', 'Three moves ahead, remember.', 'Hoo, hoo.'],
    worries: ['Interesting…', 'A thoughtful move.', 'Let me think on that.'],
  },
  {
    id: 'bruno',
    name: 'Bruno',
    avatar: 'bear',
    difficulty: 'hard',
    greeting: 'Big boards, big plans. Don’t leave an open four lying around.',
    gloat: 'Grrr-eat game. For me.',
    concede: 'You out-built me. Respect.',
    taunts: ['Found a gap. Mine now.', 'Stack ’em up.', 'Grrr.'],
    worries: ['Oof. Big move.', 'Blocked it. I think.', 'You’re building something.'],
  },
  {
    id: 'vex',
    name: 'Vex',
    avatar: 'fox',
    difficulty: 'expert',
    greeting: 'Every quiet move of mine is a trap. Every one.',
    gloat: 'Too slow, too kind. Again?',
    concede: 'Clever. Annoyingly clever.',
    taunts: ['Did you see that one coming?', 'Tick, tock.', 'Another little trap.'],
    worries: ['Cute.', 'Not bad. Not enough.', 'I’ll allow it.'],
  },
  {
    id: 'nyx',
    name: 'Nyx',
    avatar: 'ghost',
    difficulty: 'master',
    greeting: 'I have already seen how this ends.',
    gloat: 'As foreseen.',
    concede: '…I did not foresee that. Well played.',
    taunts: ['Inevitable.', 'You are three moves too late.', 'I see every ending.'],
    worries: ['…', 'Unexpected.', 'A ripple in the pattern.'],
  },
];

const rival = (id: string): Rival => RIVALS.find((entry) => entry.id === id)!;

export const STAGES: readonly Stage[] = [
  {
    id: 'pip-1',
    rival: rival('pip'),
    mode: 'classic',
    par: [4, 3],
    tip: 'Take the centre, then threaten two lines at once.',
  },
  {
    id: 'pip-2',
    rival: rival('pip'),
    mode: 'grid-6',
    par: [8, 5],
    tip: 'Four in a row. An open three — free at both ends — is already hard to stop.',
  },
  {
    id: 'pip-3',
    rival: rival('pip'),
    mode: 'vanish',
    par: [7, 4],
    tip: 'Only your newest three marks stay. The faded one is about to go.',
  },
  {
    id: 'mo-1',
    rival: rival('mo'),
    mode: 'classic',
    par: [4, 3],
    tip: 'Mo blocks every single threat. Make two, and one gets through.',
  },
  {
    id: 'mo-2',
    rival: rival('mo'),
    mode: 'misere',
    par: [4, 3],
    tip: 'Three in a row loses here. Leave Mo nowhere safe to play.',
  },
  {
    id: 'mo-3',
    rival: rival('mo'),
    mode: 'gravity',
    par: [9, 6],
    tip: 'Marks fall. A threat one square up a column waits for somebody to fill the one below.',
  },
  {
    id: 'sage-1',
    rival: rival('sage'),
    mode: 'grid-6',
    par: [9, 6],
    tip: 'Sage sees three moves out. Build shapes that become threats later.',
  },
  {
    id: 'sage-2',
    rival: rival('sage'),
    mode: 'vanish',
    par: [8, 5],
    tip: 'A line through Sage’s fading mark is no line at all — for either of you.',
  },
  {
    id: 'sage-3',
    rival: rival('sage'),
    mode: 'ultimate',
    par: [26, 19],
    tip: 'Every square you pick sends Sage to a board. Send them somewhere useless.',
  },
  {
    id: 'bruno-1',
    rival: rival('bruno'),
    mode: 'grid-9',
    par: [14, 10],
    tip: 'Five in a row. A four and an open three together cannot both be blocked.',
  },
  {
    id: 'bruno-2',
    rival: rival('bruno'),
    mode: 'gravity',
    par: [12, 9],
    tip: 'Stack two threats in one column and the lower one wins the upper.',
  },
  {
    id: 'bruno-3',
    rival: rival('bruno'),
    mode: 'gomoku-13',
    par: [16, 12],
    tip: 'Play near the centre and keep your stones connected.',
  },
  {
    id: 'vex-1',
    rival: rival('vex'),
    mode: 'vanish',
    par: [10, 7],
    tip: 'Moving first, perfect play wins in seven. Start on an edge.',
  },
  {
    id: 'vex-2',
    rival: rival('vex'),
    mode: 'ultimate',
    par: [28, 21],
    tip: 'Win the centre board, and never send Vex to a board they can take.',
  },
  {
    id: 'vex-3',
    rival: rival('vex'),
    mode: 'gomoku-15',
    par: [18, 13],
    tip: 'Block open threes early. Vex turns them into fours with tempo.',
  },
  {
    id: 'nyx-1',
    rival: rival('nyx'),
    mode: 'grid-9',
    par: [16, 11],
    tip: 'Nyx searches until the clock runs out. Only a forced win will do.',
  },
  {
    id: 'nyx-2',
    rival: rival('nyx'),
    mode: 'gravity',
    par: [14, 10],
    tip: 'Count which squares each of you will be forced to fill.',
  },
  {
    id: 'nyx-3',
    rival: rival('nyx'),
    mode: 'gomoku-15',
    par: [20, 14],
    tip: 'The final test. Attack first, and never let go of the initiative.',
  },
];

export const MAX_STARS = STAGES.length * 3;

export function stageById(id: string): Stage | undefined {
  return STAGES.find((stage) => stage.id === id);
}

/** Stars for a finished stage game: none unless won, then by moves taken. */
export function starsFor(stage: Stage, won: boolean, ownMoves: number): number {
  if (!won) return 0;
  if (ownMoves <= stage.par[1]) return 3;
  if (ownMoves <= stage.par[0]) return 2;
  return 1;
}

/**
 * Whether a stage can be played yet: the first always, the rest once the one
 * before has at least one star.
 */
export function isUnlocked(stage: Stage, earned: Record<string, number>): boolean {
  const at = STAGES.indexOf(stage);
  if (at <= 0) return true;
  return (earned[STAGES[at - 1]!.id] ?? 0) > 0;
}

/** The stage to offer next: the first without a star, or the last one. */
export function nextStage(earned: Record<string, number>): Stage {
  return STAGES.find((stage) => (earned[stage.id] ?? 0) === 0) ?? STAGES.at(-1)!;
}

/** The stage after `stage`, if there is one. */
export function stageAfter(stage: Stage): Stage | undefined {
  return STAGES[STAGES.indexOf(stage) + 1];
}
