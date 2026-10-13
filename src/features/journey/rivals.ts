import type { BotDifficulty, BotStyle } from '@/game/engine';
import type { Avatar } from '@/protocol';

/**
 * The six journey rivals: who they are, and how they play.
 *
 * Each one is a bot level with a personality on top. The level decides how
 * strong they are; the {@link BotStyle} decides how that strength shows - Mo
 * blocks a line you have barely started, Bruno ignores it to build his own,
 * Vex sets quiet traps. A style only ever chooses among moves the level would
 * accept anyway, so the ladder of difficulty the journey climbs is the same
 * ladder the bench measures.
 *
 * The signature is the one habit each rival is known by. It is something the
 * player can learn to see coming and punish, which is what makes a rival a
 * character rather than a difficulty with a face.
 */
export interface Rival {
  readonly id: RivalId;
  readonly name: string;
  readonly avatar: Avatar;
  readonly difficulty: BotDifficulty;
  /**
   * One line, said before the first game. The text here is the English source;
   * screens read it, the signature and the chapter in the player's language
   * through `rivalText` (`i18n/messages/journey.ts`).
   */
  readonly greeting: string;
  /** Said when they win. */
  readonly gloat: string;
  /** Said when they lose. */
  readonly concede: string;
  /** Said mid-game when they have just made a threat you must answer. */
  readonly taunts: readonly string[];
  /** Said mid-game when you have just made one they must answer. */
  readonly worries: readonly string[];
  readonly style: BotStyle;
  readonly signature: { readonly name: string; readonly description: string };
  /** The chapter of the journey this rival owns. */
  readonly chapter: { readonly title: string; readonly blurb: string };
}

export type RivalId = 'pip' | 'mo' | 'sage' | 'bruno' | 'vex' | 'nyx';

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
    // A beginner that hops about the rim and copies what it sees.
    style: {
      centre: -1.2,
      mirror: 0.55,
      tempo: 0.7,
      book: { 'classic:3:3': [1, 3, 5, 7], 'misere:3:3': [1, 3, 5, 7] },
    },
    signature: {
      name: 'Copycat',
      description: 'Answers your move with its mirror image across the board.',
    },
    chapter: {
      title: 'The Lily Pond',
      blurb: 'Learn the board against a frog who copies more than it plans.',
    },
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
    // All defence: Mo would rather spoil your line than start one.
    style: {
      defence: 1.9,
      attack: 0.75,
      tempo: 0.85,
      book: { 'classic:3:3': [0, 2, 6, 8], 'misere:3:3': [4] },
    },
    signature: {
      name: 'Pounce',
      description: 'Smothers your lines before they become threats.',
    },
    chapter: {
      title: 'The Rooftops',
      blurb: 'A cat who blocks everything. Make two threats and one gets through.',
    },
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
    // Centre first, shape before threats, and in no hurry about any of it.
    style: {
      centre: 2.5,
      attack: 1.1,
      defence: 1.1,
      tempo: 1.35,
      book: {
        'classic:3:3': [4],
        'misere:3:3': [4],
        'classic:6:4': [14, 15, 20, 21],
        'classic:9:5': [40],
        'gravity:7:4': [45],
        'ultimate:9:3': [40],
      },
    },
    signature: {
      name: 'The Centre Holds',
      description: 'Takes the middle of every board and builds outwards, quietly.',
    },
    chapter: {
      title: 'The Old Oak',
      blurb: 'An owl who sees three moves ahead. Plan four.',
    },
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
    // A builder: extends his own longest line before he looks at yours.
    style: {
      attack: 1.7,
      defence: 0.85,
      centre: 0.5,
      tempo: 0.75,
      book: {
        'classic:6:4': [14, 21],
        'classic:9:5': [30, 32, 48, 50],
        'gravity:7:4': [44, 46],
        'gomoku:13:5': [84],
        'gomoku:15:5': [112],
      },
    },
    signature: {
      name: 'Bear Rush',
      description: 'Always extends his longest line — and leaves gaps behind it.',
    },
    chapter: {
      title: 'The Big Woods',
      blurb: 'A bear who builds big. Block early, then out-build him.',
    },
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
    // Quiet moves that bring two lines to the brink at once.
    style: {
      traps: 2.5,
      attack: 1.2,
      centre: -0.3,
      tempo: 1,
      book: {
        'vanish:3:3': [1, 3, 5, 7],
        'ultimate:9:3': [30, 32, 48, 50],
      },
    },
    signature: {
      name: 'Fox Trap',
      description: 'Quiet moves that grow into two threats at once.',
    },
    chapter: {
      title: 'The Fox Den',
      blurb: 'Every quiet move is a trap. Count the lines before you answer.',
    },
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
    // No leaning at all: Nyx plays the strongest move it can find, slowly.
    style: { tempo: 1.25 },
    signature: {
      name: 'Foresight',
      description: 'Says so the moment it sees a forced win. It is usually right.',
    },
    chapter: {
      title: 'The Veil',
      blurb: 'A ghost who searches until the clock runs out. Only a forced win will do.',
    },
  },
];

export function rivalById(id: string): Rival | undefined {
  return RIVALS.find((rival) => rival.id === id);
}
