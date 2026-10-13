import {
  GAME_MODES,
  type GameState,
  modeById,
  type ModeId,
  O,
  type Player,
  replay,
  X,
} from '@/game/engine';

/**
 * The lessons: short, hands-on walks through one idea at a time.
 *
 * A puzzle asks "can you find the win?"; a lesson says what to look for first
 * and then lets you find it. Each step is a real position on the real board,
 * written as the moves that reach it from an empty one, so `replay` rebuilds it
 * under the rules - a lesson can never show a position the game could not
 * reach. The player always plays the side to move.
 *
 * Every step stores the moves it accepts rather than asking the engine at
 * runtime. The engine has already been asked: `lessons.test.ts` replays every
 * step and proves its accepted moves are exactly the ones its `kind` claims -
 * the only wins, the only blocks, the only double threats - so a lesson that
 * says "only one square holds" is telling the truth.
 *
 * The words here are the English source. The interface reads them through
 * `lessonText` in `@/i18n/messages/lessonsContent`, which has the other
 * languages and falls back to these; a step's task label is
 * `stepKindLabel` in `@/i18n/messages/lessons`.
 */

/**
 * What a step asks for, and so what the test checks about its answer.
 *
 * - `win`: the accepted moves are every move that wins the game now.
 * - `block`: every move that leaves the opponent no win on their next move.
 * - `safe`: the same, where the danger is a move that would *open* their win
 *   rather than a win already waiting - gravity's square-underneath.
 * - `fork`: every move after which the opponent cannot stop a win next move.
 * - `prevent`: every move that leaves the opponent neither a win nor a double
 *   threat - stopping a three before it becomes one.
 * - `four-three`: every move that makes a four whose forced block leaves a
 *   double threat behind it.
 * - `avoid`: misère - every move that does not complete your own line, all of
 *   them holding the result.
 * - `best`: every move that keeps the best result with perfect play.
 * - `keep`: gravity - every move after which your own threat survives any reply.
 * - `claim`: Ultimate - every move that wins a small board.
 * - `deny`: Ultimate - every move after which the opponent cannot win a small
 *   board with their reply.
 */
export type LessonStepKind =
  | 'win'
  | 'block'
  | 'safe'
  | 'fork'
  | 'prevent'
  | 'four-three'
  | 'avoid'
  | 'best'
  | 'keep'
  | 'claim'
  | 'deny';

export interface LessonStep {
  readonly kind: LessonStepKind;
  /** What to do, shown above the board. */
  readonly prompt: string;
  readonly startingPlayer: Player;
  /** The moves that lead to the position, from an empty board. */
  readonly moves: readonly number[];
  /** Every move the step accepts. The hint rings these. */
  readonly accept: readonly number[];
  /** A nudge, shown with the accepted squares ringed. */
  readonly hint: string;
  /** Why the right move was right. */
  readonly success: string;
  /** Why the others fail, shown while a wrong move is taken back. */
  readonly wrong: string;
}

export interface Lesson {
  /** Stable, kebab-case: it is the URL and the completion record. */
  readonly id: string;
  readonly mode: ModeId;
  readonly title: string;
  /** Two to four sentences: the idea, before the board. */
  readonly intro: string;
  readonly steps: readonly LessonStep[];
}

/** Flat index of a row and column on a square board. */
function grid(size: number) {
  return (row: number, col: number) => row * size + col;
}

const g6 = grid(6);
const g9 = grid(9);
const g13 = grid(13);
const g15 = grid(15);

/**
 * Gravity positions as the columns played, which is how a player reads them;
 * a move is still the square it lands on, so they are converted here.
 */
const GRAVITY_SIZE = modeById('gravity').config.size;

function dropped(columns: readonly number[]): number[] {
  const heights = Array.from<number>({ length: GRAVITY_SIZE }).fill(0);
  return columns.map((column) => {
    const row = GRAVITY_SIZE - 1 - (heights[column] ?? 0);
    heights[column] = (heights[column] ?? 0) + 1;
    return row * GRAVITY_SIZE + column;
  });
}

/** The square a mark dropped into `column` lands on, after `columns` were played. */
function landing(columns: readonly number[], column: number): number {
  const height = columns.filter((played) => played === column).length;
  return (GRAVITY_SIZE - 1 - height) * GRAVITY_SIZE + column;
}

/** Ultimate squares as (small board, square within it), both 0-8 in reading order. */
function u(board: number, cell: number): number {
  const row = Math.floor(board / 3) * 3 + Math.floor(cell / 3);
  const col = (board % 3) * 3 + (cell % 3);
  return row * 9 + col;
}

function chain(pairs: readonly (readonly [number, number])[]): number[] {
  return pairs.map(([board, cell]) => u(board, cell));
}

/**
 * One Ultimate game, three lessons deep: X takes the top-left board, then the
 * centre, then is sent to the bottom-right with the diagonal one square away.
 */
const ULTIMATE_LINE = chain([
  [0, 6],
  [6, 0],
  [0, 7],
  [7, 0],
  [0, 8],
  [8, 4],
  [4, 6],
  [6, 4],
  [4, 7],
  [7, 4],
  [4, 8],
  [8, 8],
  [8, 0],
  [2, 8],
  [8, 3],
  [3, 8],
]);

const STAY_OUT_UNDER = [0, 2, 1, 1, 3, 3, 0, 2];
const KEEP_YOUR_THREAT = [1, 1, 3, 2, 2, 4, 3, 6, 4, 0];
const STACKED = [5, 4, 0, 2, 1, 1, 1, 2, 2, 0, 2, 3, 3, 0];

export const LESSONS: readonly Lesson[] = [
  // Classic
  {
    id: 'classic-three-in-a-row',
    mode: 'classic',
    title: 'Win and block',
    intro:
      'Every game of noughts and crosses turns on two questions, asked every move: can I win right now, and can they? Look for two in a row with the third square empty — yours to finish, theirs to stop.',
    steps: [
      {
        kind: 'win',
        prompt: 'You have two in a row. Finish it.',
        startingPlayer: X,
        moves: [4, 0, 2, 8],
        accept: [6],
        hint: 'Your diagonal runs corner to corner through the centre.',
        success: 'Three in a row. Always check for your own win first.',
        wrong: 'That is not three in a row — look along the diagonal.',
      },
      {
        kind: 'block',
        prompt: 'They have two in a row. Stop them.',
        startingPlayer: O,
        moves: [0, 1, 4],
        accept: [8],
        hint: 'Their two run down the diagonal. Take the end of it.',
        success: 'Blocked. Their diagonal is dead.',
        wrong: 'They still have a square that finishes their diagonal.',
      },
      {
        kind: 'win',
        prompt: 'You both have two in a row. What comes first?',
        startingPlayer: X,
        moves: [0, 4, 1, 3],
        accept: [2],
        hint: 'A win ends the game before their threat matters.',
        success: 'Winning beats blocking — there is no next move for them.',
        wrong: 'You can win this move. Take it before worrying about theirs.',
      },
    ],
  },
  {
    id: 'classic-forks',
    mode: 'classic',
    title: 'Forks',
    intro:
      'A fork is one move that makes two threats at once. Your opponent can only block one of them, so the other wins. Forks are how nearly every decided game of noughts and crosses is decided.',
    steps: [
      {
        kind: 'fork',
        prompt: 'Make two threats with one move.',
        startingPlayer: X,
        moves: [0, 1, 4, 8],
        accept: [3, 6],
        hint: 'Look for a square that lines up with two of your marks along different lines.',
        success: 'Two threats. Whichever they block, the other one wins.',
        wrong: 'That makes one threat at most — they block it and you have nothing.',
      },
      {
        kind: 'prevent',
        prompt: 'They hold opposite corners. Stop the fork before it happens.',
        startingPlayer: O,
        moves: [0, 4, 8],
        accept: [1, 3, 5, 7],
        hint: 'A corner looks natural, and that is the trap. Make a threat of your own from an edge.',
        success:
          'An edge forces them to answer you, and they never get the free move a fork needs.',
        wrong: 'A corner here lets them take the other corner with two threats at once.',
      },
    ],
  },
  {
    id: 'classic-first-reply',
    mode: 'classic',
    title: 'The first reply',
    intro:
      'Classic is a draw with good play from both sides, but only one reply to each opening keeps it that way. The opener’s mark decides where you must answer: a corner wants the centre, the centre wants a corner.',
    steps: [
      {
        kind: 'best',
        prompt: 'They opened in a corner. Find the only reply that holds.',
        startingPlayer: O,
        moves: [0],
        accept: [4],
        hint: 'Every other square leaves them a way to fork you later.',
        success: 'The centre. Against a corner it is the only reply that draws.',
        wrong: 'That loses against perfect play: a corner opening needs the centre.',
      },
      {
        kind: 'best',
        prompt: 'They opened in the centre. Answer it.',
        startingPlayer: O,
        moves: [4],
        accept: [0, 2, 6, 8],
        hint: 'Edges lose against the centre. Corners hold.',
        success: 'A corner. From there every fork they try can be met.',
        wrong: 'An edge against the centre loses by force. Take a corner.',
      },
      {
        kind: 'best',
        prompt: 'They opened on an edge. Several replies hold — find one.',
        startingPlayer: O,
        moves: [1],
        accept: [0, 2, 4, 7],
        hint: 'The centre, the far edge, or a corner next to their mark.',
        success: 'That holds. An edge opening gives you the most choice.',
        wrong: 'That one loses: it leaves them a fork two moves from now.',
      },
    ],
  },

  // Grid 6
  {
    id: 'grid-6-open-three',
    mode: 'grid-6',
    title: 'Open and closed threes',
    intro:
      'On Grid 6 you need four in a row. A three with both ends empty is open: it can become four at either end, so it is already two threats. A three with one end blocked is closed — one threat, easily stopped.',
    steps: [
      {
        kind: 'fork',
        prompt: 'Turn your two into an open three.',
        startingPlayer: X,
        moves: [g6(2, 2), g6(5, 0), g6(2, 3), g6(0, 5)],
        accept: [g6(2, 1), g6(2, 4)],
        hint: 'Extend your row right next to it, keeping both ends free.',
        success: 'An open three: four is waiting at both ends, and they can only cover one.',
        wrong: 'Leave a gap and the three has only one way to become four.',
      },
      {
        kind: 'block',
        prompt: 'Their three is closed at one end. Stop it.',
        startingPlayer: X,
        moves: [g6(3, 0), g6(3, 1), g6(0, 0), g6(3, 2), g6(5, 5), g6(3, 3)],
        accept: [g6(3, 4)],
        hint: 'Your mark already closes one end. Close the other.',
        success: 'A closed three has one way to grow, and you just took it.',
        wrong: 'Their row still has a square that makes four.',
      },
      {
        kind: 'prevent',
        prompt: 'They have an open two. Cap it before it becomes an open three.',
        startingPlayer: O,
        moves: [g6(2, 2), g6(4, 1), g6(2, 3)],
        accept: [g6(2, 1), g6(2, 4)],
        hint: 'Play right against one end of their pair.',
        success: 'Capped. Whatever they add now, the three is closed.',
        wrong: 'From here they can still make an open three — and that is two threats.',
      },
    ],
  },
  {
    id: 'grid-6-crossing-lines',
    mode: 'grid-6',
    title: 'Where lines cross',
    intro:
      'Two half-built lines that pass through the same empty square are a fork waiting to happen. Play the crossing point and both lines become threats at once. Learn to see them on your side of the board — and on theirs.',
    steps: [
      {
        kind: 'fork',
        prompt: 'Your row and your column meet at one square. Find it.',
        startingPlayer: X,
        moves: [g6(3, 1), g6(3, 0), g6(3, 2), g6(1, 4), g6(1, 3), g6(0, 3), g6(2, 3), g6(4, 0)],
        accept: [g6(3, 3)],
        hint: 'Follow your row to the right and your column down until they meet.',
        success: 'Both lines are now threes with a square to spare. Two threats, one block.',
        wrong: 'That only helps one line. The square that serves both is the fork.',
      },
      {
        kind: 'fork',
        prompt: 'A diagonal and a column this time. Make two threats.',
        startingPlayer: X,
        moves: [g6(1, 1), g6(0, 0), g6(3, 3), g6(5, 2), g6(3, 2), g6(5, 1), g6(4, 2), g6(3, 4)],
        accept: [g6(2, 2)],
        hint: 'The gap in your diagonal sits on top of your column.',
        success: 'The diagonal and the column both threaten four. They cannot cover both.',
        wrong: 'One threat is easy to block. Find the square that makes two.',
      },
    ],
  },

  // Grid 9
  {
    id: 'grid-9-both-ends',
    mode: 'grid-9',
    title: 'Watch both ends',
    intro:
      'Five in a row on a 9×9 board means long lines with room at both ends — and gaps. A four with a hole in it is still a four. An open three left alone becomes an open four, and nothing stops that.',
    steps: [
      {
        kind: 'block',
        prompt: 'They have four in a row. Block it.',
        startingPlayer: O,
        moves: [g9(4, 2), g9(4, 1), g9(4, 3), g9(0, 0), g9(4, 4), g9(8, 8), g9(4, 5)],
        accept: [g9(4, 6)],
        hint: 'One end is already yours.',
        success: 'Blocked. A four needs an immediate answer — always.',
        wrong: 'They make five next move. Their open end is the only square that matters.',
      },
      {
        kind: 'block',
        prompt: 'This four has a gap in it. Find the square that matters.',
        startingPlayer: O,
        moves: [g9(2, 2), g9(5, 5), g9(2, 3), g9(6, 1), g9(2, 5), g9(0, 8), g9(2, 6)],
        accept: [g9(2, 4)],
        hint: 'Fill the hole.',
        success: 'A broken four is still a four. Gaps count.',
        wrong: 'They make five through the gap next move.',
      },
      {
        kind: 'prevent',
        prompt: 'An open three. Block it before it becomes an open four.',
        startingPlayer: O,
        moves: [g9(4, 3), g9(7, 7), g9(4, 4), g9(1, 1), g9(4, 5)],
        accept: [g9(4, 2), g9(4, 6)],
        hint: 'Block right against the three, not a square further out.',
        success: 'Now their four, if they make it, has only one open end.',
        wrong: 'Too far away: they can still make a four open at both ends.',
      },
    ],
  },

  // Gomoku
  {
    id: 'gomoku-13-open-threes',
    mode: 'gomoku-13',
    title: 'The open three',
    intro:
      'In gomoku an open three — three in a row with space at both ends — is the threat that matters. Ignore it and it becomes an open four, which wins. A closed three can wait: it only ever makes a four you can block.',
    steps: [
      {
        kind: 'fork',
        prompt: 'You have an open three. Make it an open four.',
        startingPlayer: X,
        moves: [g13(6, 4), g13(9, 9), g13(6, 5), g13(2, 2), g13(6, 6), g13(9, 3)],
        accept: [g13(6, 3), g13(6, 7)],
        hint: 'Add to either end, right next to the three.',
        success: 'An open four: five is waiting at both ends.',
        wrong: 'That four has only one open end — they block it.',
      },
      {
        kind: 'prevent',
        prompt: 'They have two threes. Block the one that matters.',
        startingPlayer: O,
        moves: [
          g13(5, 9),
          g13(4, 9),
          g13(6, 9),
          g13(10, 10),
          g13(7, 9),
          g13(11, 2),
          g13(3, 4),
          g13(0, 12),
          g13(3, 5),
          g13(12, 6),
          g13(3, 6),
        ],
        accept: [g13(3, 3), g13(3, 7)],
        hint: 'Your mark already closes the column. The row is open at both ends.',
        success: 'Right. The closed three can only make a four you will block in time.',
        wrong: 'That leaves their open three free to become an open four.',
      },
    ],
  },
  {
    id: 'gomoku-15-four-three',
    mode: 'gomoku-15',
    title: 'The four-three',
    intro:
      'A four must be answered at once. A four-three is a move that makes a four and an open three together: they are forced to block the four, and the three becomes an open four while they do. It is the classic winning shape of gomoku.',
    steps: [
      {
        kind: 'four-three',
        prompt: 'Make a four and an open three with one move.',
        startingPlayer: X,
        moves: [
          g15(7, 4),
          g15(7, 3),
          g15(7, 5),
          g15(10, 10),
          g15(7, 6),
          g15(3, 11),
          g15(5, 7),
          g15(11, 3),
          g15(6, 7),
          g15(2, 2),
        ],
        accept: [g15(7, 7)],
        hint: 'Your row and your column meet at one square.',
        success: 'Four across, open three down. They must block the four — then the three wins.',
        wrong: 'That gives them time. Find the move that makes the four and the three at once.',
      },
      {
        kind: 'four-three',
        prompt: 'Another four-three, on the diagonal.',
        startingPlayer: X,
        moves: [
          g15(3, 3),
          g15(2, 2),
          g15(4, 4),
          g15(10, 12),
          g15(5, 5),
          g15(12, 3),
          g15(6, 4),
          g15(1, 9),
          g15(6, 5),
          g15(13, 13),
        ],
        accept: [g15(6, 6)],
        hint: 'Extend the diagonal so it also completes three in the row below.',
        success: 'Four on the diagonal, open three in the row. The block comes too late.',
        wrong: 'Not this one — look where the diagonal and your row share a square.',
      },
    ],
  },
  {
    id: 'gomoku-15-double-four',
    mode: 'gomoku-15',
    title: 'Fours first',
    intro:
      'Two fours at once cannot both be blocked. And when your opponent has a four, nothing you are building matters until it is stopped — not even an open three of your own.',
    steps: [
      {
        kind: 'fork',
        prompt: 'Make two fours with one move.',
        startingPlayer: X,
        moves: [
          g15(7, 3),
          g15(7, 2),
          g15(7, 4),
          g15(3, 5),
          g15(7, 6),
          g15(11, 11),
          g15(4, 5),
          g15(0, 14),
          g15(5, 5),
          g15(12, 1),
          g15(6, 5),
          g15(1, 1),
        ],
        accept: [g15(7, 5)],
        hint: 'The gap in your row is also the end of your column.',
        success: 'A double four. One block cannot stop two fives.',
        wrong: 'That makes one four at most. Find the square both lines share.',
      },
      {
        kind: 'block',
        prompt: 'You have an open three, but they have a four.',
        startingPlayer: O,
        moves: [
          g15(5, 3),
          g15(5, 2),
          g15(5, 4),
          g15(8, 8),
          g15(5, 5),
          g15(8, 9),
          g15(12, 12),
          g15(8, 10),
          g15(5, 6),
        ],
        accept: [g15(5, 7)],
        hint: 'Your three can wait one move. Their four cannot.',
        success: 'Blocked. Now your open three is the threat on the board.',
        wrong: 'They make five before your three ever gets the chance.',
      },
    ],
  },

  // Misère
  {
    id: 'misere-dont-finish',
    mode: 'misere',
    title: 'Don’t finish the line',
    intro:
      'In misère, three in a row loses. Late in the game the squares run out, and the question becomes which square you can play without completing a line of your own. Count them before you move.',
    steps: [
      {
        kind: 'avoid',
        prompt: 'Two of the empty squares finish a line of yours. Find the one that does not.',
        startingPlayer: X,
        moves: [0, 4, 1, 5, 6, 8],
        accept: [7],
        hint: 'Check your top row and your left column before you play.',
        success: 'Safe — and now every square left finishes a line of theirs.',
        wrong: 'That completes three of your own. In misère, that loses.',
      },
      {
        kind: 'avoid',
        prompt: 'Same idea, different board. Which square is safe?',
        startingPlayer: X,
        moves: [0, 3, 2, 4, 8, 7],
        accept: [6],
        hint: 'Your top row and your right column are both one square short.',
        success: 'The only safe square — and it leaves them none.',
        wrong: 'That square completes your own line.',
      },
    ],
  },
  {
    id: 'misere-centre-mirror',
    mode: 'misere',
    title: 'Centre and mirror',
    intro:
      'The first player can never lose misère. Take the centre, then answer every move with its mirror image through the centre. Your marks never line up with each other, so you can never be the one to make three.',
    steps: [
      {
        kind: 'best',
        prompt: 'You move first. Where?',
        startingPlayer: X,
        moves: [],
        accept: [4],
        hint: 'The one square that has a mirror image of every other square.',
        success: 'The centre. Every other opening loses against perfect play.',
        wrong: 'That loses with perfect play. Start in the centre.',
      },
      {
        kind: 'best',
        prompt: 'They took a corner. Mirror it.',
        startingPlayer: X,
        moves: [4, 0],
        accept: [8],
        hint: 'Straight through the centre to the far side.',
        success: 'The opposite corner. Keep mirroring and you cannot lose.',
        wrong: 'Only the mirror square holds. Go straight through the centre.',
      },
      {
        kind: 'best',
        prompt: 'They took an edge this time. Mirror it again.',
        startingPlayer: X,
        moves: [4, 1],
        accept: [7],
        hint: 'The edge directly opposite theirs.',
        success: 'Mirrored. Your marks and the centre stay out of each other’s lines.',
        wrong: 'That loses with perfect play. Answer with the opposite edge.',
      },
    ],
  },

  // Vanish
  {
    id: 'vanish-fading-marks',
    mode: 'vanish',
    title: 'The fading mark',
    intro:
      'In Vanish you keep only three marks. Your oldest one is shown fading: it leaves the board as you place your next, so it can never be part of the line that move makes. Lines through a fading mark only look like threats.',
    steps: [
      {
        kind: 'win',
        prompt: 'Three lines look one square short. Only one is real.',
        startingPlayer: X,
        moves: [0, 6, 1, 3, 4, 5],
        accept: [7],
        hint: 'Ignore every line that runs through your fading corner.',
        success: 'The only line without your fading mark in it. Three in a row.',
        wrong: 'Your fading mark leaves as you play, so that line is never complete.',
      },
      {
        kind: 'block',
        prompt: 'They seem to have two threats. Block the real one.',
        startingPlayer: X,
        moves: [7, 8, 2, 4, 6, 3],
        accept: [5],
        hint: 'One of their lines runs through their own fading mark.',
        success: 'Blocked. Their other line needed a mark that is about to vanish.',
        wrong: 'That leaves their real line open. The other one was never a threat.',
      },
    ],
  },
  {
    id: 'vanish-tempo',
    mode: 'vanish',
    title: 'Let their mark leave',
    intro:
      'Their fading mark is about to go too, and the square it leaves is yours to use. Line up two of your marks behind it: when it vanishes on their move, your line opens and they cannot close it in time.',
    steps: [
      {
        kind: 'best',
        prompt: 'Their fading mark is blocking a line. Get behind it.',
        startingPlayer: X,
        moves: [0, 1, 2, 3, 7, 5],
        accept: [4],
        hint: 'Their oldest mark sits at the top of a column. Make that column yours.',
        success: 'When they move, their mark leaves and the column is yours to finish.',
        wrong: 'That lets them off. Line your marks up behind the one about to vanish.',
      },
      {
        kind: 'best',
        prompt: 'Same trick, other side of the board.',
        startingPlayer: X,
        moves: [0, 1, 2, 5, 4, 6],
        accept: [7],
        hint: 'Which of their marks goes next, and what does it leave open?',
        success: 'Their fading mark is the only thing in your way — and it is leaving.',
        wrong: 'This one gives them time to set up a line of their own.',
      },
    ],
  },

  // Gravity
  {
    id: 'gravity-floors-and-stacks',
    mode: 'gravity',
    title: 'Floors and stacks',
    intro:
      'In Gravity you pick a column and your mark falls to the bottom. A square is only playable once the one beneath it is taken. Rows along the floor and stacks up a column are the first threats to look for.',
    steps: [
      {
        kind: 'win',
        prompt: 'Three along the floor. Finish it.',
        startingPlayer: X,
        moves: dropped([1, 1, 2, 2, 3, 3]),
        accept: [landing([1, 1, 2, 2, 3, 3], 0), landing([1, 1, 2, 2, 3, 3], 4)],
        hint: 'Either end of your row is on the floor, so either is playable.',
        success: 'Four along the floor.',
        wrong: 'That square does not complete your row.',
      },
      {
        kind: 'block',
        prompt: 'They have stacked three. Cap the column.',
        startingPlayer: O,
        moves: dropped([3, 0, 3, 6, 3]),
        accept: [landing([3, 0, 3, 6, 3], 3)],
        hint: 'Drop into their column.',
        success: 'Capped. A stack can only ever grow upward.',
        wrong: 'They drop a fourth on top next move.',
      },
    ],
  },
  {
    id: 'gravity-dont-fill-under',
    mode: 'gravity',
    title: 'Don’t fill underneath',
    intro:
      'A threat can sit above an empty square. Nobody can play it until something lands underneath — so whoever fills that square hands the threat to the other player. Often the best move is simply to stay out of that column.',
    steps: [
      {
        kind: 'safe',
        prompt: 'Their row needs a square that is not playable yet. Keep it that way.',
        startingPlayer: X,
        moves: dropped(STAY_OUT_UNDER),
        accept: [0, 1, 2, 3, 5, 6].map((column) => landing(STAY_OUT_UNDER, column)),
        hint: 'Any column but the one under their threat.',
        success: 'Their threat stays out of reach until someone fills beneath it.',
        wrong: 'That fills the square underneath, and they drop straight onto their four.',
      },
      {
        kind: 'keep',
        prompt: 'Now the threat above the empty square is yours. Keep it.',
        startingPlayer: X,
        moves: dropped(KEEP_YOUR_THREAT),
        accept: [0, 1, 2, 3, 4, 6].map((column) => landing(KEEP_YOUR_THREAT, column)),
        hint: 'Do not play in the column under your own threat.',
        success: 'Your threat waits. Every move they make in that column hands you the win.',
        wrong: 'You filled your own square: they drop on top and your threat is gone.',
      },
    ],
  },
  {
    id: 'gravity-stacked-threats',
    mode: 'gravity',
    title: 'Stacked threats',
    intro:
      'Two threats in the same column, one directly above the other, cannot both be stopped: blocking the lower one makes the upper one playable. On the floor, an open three works the same way it does on a flat board.',
    steps: [
      {
        kind: 'fork',
        prompt: 'Make two threats, one on top of the other.',
        startingPlayer: X,
        moves: dropped(STACKED),
        accept: [landing(STACKED, 3)],
        hint: 'One move can extend your row and complete three on your diagonal.',
        success: 'They must block the lower square, and that lifts your second threat into reach.',
        wrong: 'That makes one threat they can simply block.',
      },
      {
        kind: 'fork',
        prompt: 'Make an open three on the floor.',
        startingPlayer: X,
        moves: dropped([2, 2, 3, 3]),
        accept: [landing([2, 2, 3, 3], 1), landing([2, 2, 3, 3], 4)],
        hint: 'Extend your pair along the floor, keeping both ends free.',
        success: 'Two playable ends, one block. The floor is yours.',
        wrong: 'That leaves them one square to block and nothing more.',
      },
    ],
  },

  // Ultimate
  {
    id: 'ultimate-small-boards',
    mode: 'ultimate',
    title: 'Winning small boards',
    intro:
      'In Ultimate you win small boards to win the big one. The square you pick inside a small board decides which board your opponent must play next — and when they send you somewhere you already have two in a row, take the board.',
    steps: [
      {
        kind: 'claim',
        prompt: 'You have been sent to a board where you have two in a row. Take it.',
        startingPlayer: X,
        moves: ULTIMATE_LINE.slice(0, 4),
        accept: [u(0, 8)],
        hint: 'Finish the bottom row of the top-left board.',
        success: 'The top-left board is yours.',
        wrong: 'That does not finish your row in this board.',
      },
      {
        kind: 'claim',
        prompt: 'Sent to the centre board. Take that one too.',
        startingPlayer: X,
        moves: ULTIMATE_LINE.slice(0, 10),
        accept: [u(4, 8)],
        hint: 'Same shape as before: the bottom row.',
        success: 'Two boards on the diagonal.',
        wrong: 'That does not finish your row in the centre board.',
      },
      {
        kind: 'win',
        prompt: 'One more board on the diagonal wins the game.',
        startingPlayer: X,
        moves: ULTIMATE_LINE,
        accept: [u(8, 6)],
        hint: 'Your left column in this board is one short.',
        success: 'Three boards in a row — the game is yours.',
        wrong: 'That does not take this board, and this board is the game.',
      },
    ],
  },
  {
    id: 'ultimate-where-you-send',
    mode: 'ultimate',
    title: 'Where you send them',
    intro:
      'Every square you play sends your opponent to the matching small board. Never send them to a board they can win. And never send them to a finished board: that gives them a free move anywhere, including the board you were careful to keep them out of.',
    steps: [
      {
        kind: 'deny',
        prompt: 'Two squares here send them to a board they can take. Avoid both.',
        startingPlayer: X,
        moves: chain([
          [0, 1],
          [1, 0],
          [0, 3],
          [3, 3],
          [3, 1],
          [1, 1],
          [1, 4],
          [4, 1],
          [1, 7],
          [7, 6],
          [6, 7],
          [7, 7],
          [7, 4],
          [4, 6],
          [6, 3],
          [3, 4],
        ]),
        accept: [u(4, 0), u(4, 2), u(4, 4), u(4, 5), u(4, 8)],
        hint: 'Find the boards where they already have two in a row, and stay off the squares that point there.',
        success: 'They land on a board where they have nothing to finish.',
        wrong: 'That sends them to a board where they have two in a row. They take it.',
      },
      {
        kind: 'deny',
        prompt: 'The bottom-right board is finished. Mind the free move.',
        startingPlayer: X,
        moves: chain([
          [8, 0],
          [0, 7],
          [7, 0],
          [0, 8],
          [8, 4],
          [4, 5],
          [5, 1],
          [1, 0],
          [0, 1],
          [1, 1],
          [1, 6],
          [6, 8],
          [8, 8],
          [2, 4],
          [4, 2],
          [2, 8],
          [2, 6],
          [6, 5],
        ]),
        accept: [u(5, 3), u(5, 4), u(5, 5), u(5, 7)],
        hint: 'Avoid boards where they have two in a row — and the square that points at the finished board.',
        success: 'No board for them to take, and no free move to go looking for one.',
        wrong: 'From there they can win a small board — directly, or with a free move.',
      },
    ],
  },
];

const BY_ID = new Map(LESSONS.map((lesson) => [lesson.id, lesson]));

export function lessonById(id: string): Lesson | undefined {
  return BY_ID.get(id);
}

/** A lesson's id as an index into the curriculum, or -1. */
export function lessonIndex(id: string): number {
  return LESSONS.findIndex((lesson) => lesson.id === id);
}

export function lessonsForMode(mode: ModeId): readonly Lesson[] {
  return LESSONS.filter((lesson) => lesson.mode === mode);
}

/** Modes that have lessons, in the order the mode list gives them. */
export const LESSON_MODES: readonly ModeId[] = GAME_MODES.map((mode) => mode.id).filter((id) =>
  LESSONS.some((lesson) => lesson.mode === id),
);

/** The position a step starts from. Every step replays; the test proves it. */
export function stepStart(lesson: Lesson, step: LessonStep): GameState {
  return replay(modeById(lesson.mode).config, step.startingPlayer, step.moves)!;
}
