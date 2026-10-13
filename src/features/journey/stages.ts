import {
  applyMove,
  type BotDifficulty,
  type BotStyle,
  type GameState,
  isModeId,
  type ModeId,
  O,
  opponentOf,
  type Player,
  replay,
  startingPlayerOf,
  X,
} from '@/game/engine';
import { type Rival, rivalById } from './rivals';
import { winsFor } from './threats';

export { type Rival, type RivalId, RIVALS } from './rivals';

/**
 * The journey: six rivals, a chapter each, every mode on the way.
 *
 * It exists to give the bot a shape. Six difficulty levels and a dozen modes
 * is far too many combinations, and a new player looking at that grid has no
 * idea where to start or what "good" looks like. A path does: it starts
 * somewhere winnable, introduces one new rule set at a time, and ends at the
 * levels that are meant to be hard.
 *
 * Each chapter ends in a boss stage with a twist - the rival moves first,
 * starts with marks on the board, or leans harder into its signature - and
 * some stages ask for something besides a fast win for their third star.
 *
 * Every stage is winnable. None of them puts the player against a level that
 * plays the 3x3 board perfectly - a stage nobody can win is a wall, not a
 * challenge. The player moves first unless a stage says otherwise, so the
 * stars measure the player rather than a coin toss.
 *
 * Stage ids are what saved progress is keyed by, so they never change: the
 * first eighteen are the original journey's, and the chapters grew around
 * them.
 */

/**
 * What the third star asks for, on top of a win within the two-star par.
 *
 * - `par`: a faster win still - within the three-star par.
 * - `no-hints`: the hint bulb is offered, and the star is for not using it.
 * - `fork`: the winning move came from two threats at once.
 * - `flawless`: the rival never once had a square to win on.
 */
export type StageObjective = 'par' | 'no-hints' | 'fork' | 'flawless';

export interface Stage {
  readonly id: string;
  readonly rival: Rival;
  readonly mode: ModeId;
  /**
   * Own moves at or under which a win earns two and three stars. A win in more
   * than `par[0]` moves still earns one.
   */
  readonly par: readonly [twoStars: number, threeStars: number];
  /**
   * A nudge shown before the game. This and the intro and twist are the English
   * source; screens read them in the player's language through `stageText`
   * (`i18n/messages/journey.ts`).
   */
  readonly tip: string;
  /** What the rival says to open this stage, in place of a general greeting. */
  readonly intro?: string;
  /** Who opens. The player, unless the stage says the rival does. */
  readonly opener: Player;
  /**
   * Marks on the board before anyone moves, played from the opener in turn.
   * Only on rule sets whose moves are plain squares.
   */
  readonly setup?: readonly number[];
  /** The chapter's last stage, played with a twist. */
  readonly boss?: boolean;
  /** The twist, said in a line on the stage sheet. */
  readonly twist?: string;
  readonly objective: StageObjective;
  /** Leans the rival's style further for this stage only. */
  readonly style?: BotStyle;
  /** Plays the rival at another level for this stage only - a boss who has been practising. */
  readonly difficulty?: BotDifficulty;
}

/** The mode a stage wants, if this build has it, or a stand-in that plays alike. */
function prefer(mode: string, fallback: ModeId): ModeId {
  return isModeId(mode) ? mode : fallback;
}

/** Flat index of a square, for writing setups readably. */
const at = (size: number, row: number, col: number): number => row * size + col;

type StageSpec = Omit<Stage, 'rival' | 'opener' | 'objective'> & {
  readonly opener?: Player;
  readonly objective?: StageObjective;
};

const spec = (rivalId: string, stages: readonly StageSpec[]): Stage[] => {
  const rival = rivalById(rivalId)!;
  return stages.map((stage) => ({ opener: X, objective: 'par', ...stage, rival }));
};

export const STAGES: readonly Stage[] = [
  ...spec('pip', [
    {
      id: 'pip-1',
      mode: 'classic',
      par: [4, 3],
      tip: 'Take the centre, then threaten two lines at once.',
    },
    {
      id: 'pip-2',
      mode: 'grid-6',
      par: [8, 5],
      tip: 'Four in a row. An open three — free at both ends — is already hard to stop.',
    },
    {
      id: 'pip-3',
      mode: 'vanish',
      par: [7, 4],
      tip: 'Only your newest three marks stay. The faded one is about to go.',
    },
    {
      id: 'pip-4',
      mode: 'misere',
      par: [4, 3],
      tip: 'Here three in a row loses. Fill safe squares and let Pip run out of them.',
      intro: 'Three in a row is BAD here? Ribbit. I’ll be super careful.',
    },
    {
      id: 'pip-5',
      mode: 'gravity',
      par: [9, 6],
      opener: O,
      tip: 'Pip drops first. Build where the next square up is one you want.',
      intro: 'Me first! Plop!',
    },
    {
      id: 'pip-6',
      mode: 'classic',
      par: [4, 3],
      objective: 'fork',
      tip: 'Corners and the centre make forks: two lines that one mark cannot block.',
      intro: 'Show me one of those two-line tricks. I want to see it!',
    },
    {
      id: 'pip-7',
      mode: 'grid-6',
      par: [8, 6],
      boss: true,
      objective: 'flawless',
      style: { mirror: 0.95 },
      twist: 'Copycat Pip mirrors nearly every move you make.',
      tip: 'A mirror cannot stop two threats. Build lines that cross the centre.',
    },
  ]),
  ...spec('mo', [
    {
      id: 'mo-1',
      mode: 'classic',
      par: [4, 3],
      tip: 'Mo blocks every single threat. Make two, and one gets through.',
    },
    {
      id: 'mo-2',
      mode: 'misere',
      par: [4, 3],
      tip: 'Three in a row loses here. Leave Mo nowhere safe to play.',
    },
    {
      id: 'mo-3',
      mode: 'gravity',
      par: [9, 6],
      tip: 'Marks fall. A threat one square up a column waits for somebody to fill the one below.',
    },
    {
      id: 'mo-4',
      mode: prefer('wild', 'classic'),
      par: [4, 3],
      tip: 'Every two-in-a-row is a gift to whoever moves next. Leave Mo none.',
      intro: 'Any mark, any line? I’ll just block all of them.',
    },
    {
      id: 'mo-5',
      mode: 'grid-6',
      par: [9, 6],
      opener: O,
      setup: [at(6, 2, 2), at(6, 0, 5), at(6, 3, 3)],
      objective: 'no-hints',
      tip: 'Mo starts with the middle diagonal. Block it from the open end, then build.',
      intro: 'I took the comfy squares. You can have the corner.',
    },
    {
      id: 'mo-6',
      mode: prefer('connect4', 'gravity'),
      par: [10, 7],
      tip: 'Seven columns, six high. Threats on the row above a full one are the ones that last.',
    },
    {
      id: 'mo-7',
      mode: 'grid-9',
      par: [12, 9],
      opener: O,
      boss: true,
      objective: 'fork',
      style: { defence: 2.4 },
      twist: 'Mo moves first and blocks harder than ever.',
      tip: 'Mo smothers every line it sees. Build two where it is only watching one.',
    },
  ]),
  ...spec('sage', [
    {
      id: 'sage-1',
      mode: 'grid-6',
      par: [9, 6],
      tip: 'Sage sees three moves out. Build shapes that become threats later.',
    },
    {
      id: 'sage-2',
      mode: 'vanish',
      par: [8, 5],
      tip: 'A line through Sage’s fading mark is no line at all — for either of you.',
    },
    {
      id: 'sage-3',
      mode: 'ultimate',
      par: [26, 19],
      tip: 'Every square you pick sends Sage to a board. Send them somewhere useless.',
    },
    {
      id: 'sage-4',
      mode: 'misere',
      par: [4, 3],
      objective: 'flawless',
      tip: 'Sage loves the centre. In misère the centre is a liability — let them have it.',
      intro: 'Doing less is a skill. Let us see who has more of it.',
    },
    {
      id: 'sage-5',
      mode: prefer('order-chaos', 'grid-6'),
      par: [14, 10],
      tip: 'You are Order. Any five alike in a row wins — even of Sage’s marks.',
      intro: 'Order and chaos. I have always preferred the quiet one.',
    },
    {
      id: 'sage-6',
      mode: 'gravity',
      par: [10, 7],
      opener: O,
      objective: 'no-hints',
      tip: 'Sage drops into the centre column first. Fight for the squares beside it.',
    },
    {
      id: 'sage-7',
      mode: 'ultimate',
      par: [28, 20],
      opener: O,
      boss: true,
      twist: 'Sage opens in the centre of the centre board.',
      tip: 'You will be sent to the middle board first. Answer by sending Sage somewhere dull.',
    },
  ]),
  ...spec('bruno', [
    {
      id: 'bruno-1',
      mode: 'grid-9',
      par: [14, 10],
      tip: 'Five in a row. A four and an open three together cannot both be blocked.',
    },
    {
      id: 'bruno-2',
      mode: 'gravity',
      par: [12, 9],
      tip: 'Stack two threats in one column and the lower one wins the upper.',
    },
    {
      id: 'bruno-3',
      mode: 'gomoku-13',
      par: [16, 12],
      tip: 'Play near the centre and keep your stones connected.',
    },
    {
      id: 'bruno-4',
      mode: prefer('pente', 'gomoku-13'),
      par: [16, 12],
      tip: 'Bruno builds long. Two of his in a row with your mark beyond are a capture waiting.',
      intro: 'Captures? Fine. I build faster than you can take.',
    },
    {
      id: 'bruno-5',
      mode: prefer('obstacles', 'grid-9'),
      par: [14, 10],
      objective: 'flawless',
      tip: 'Rocks break lines. Count which runs still have five squares of room.',
    },
    {
      id: 'bruno-6',
      mode: 'grid-6',
      par: [10, 7],
      setup: [at(6, 2, 2), at(6, 0, 0), at(6, 3, 3)],
      objective: 'fork',
      tip: 'Bruno spots you the centre diagonal. Turn it into two threats before he walls it.',
      intro: 'Have a head start. You’ll need it. Grrr.',
    },
    {
      id: 'bruno-7',
      mode: 'gomoku-15',
      par: [18, 14],
      opener: O,
      boss: true,
      style: { attack: 2.2 },
      twist: 'Bruno moves first and rushes every line he starts.',
      tip: 'Block his open threes at once, from the side that leaves your stones connected.',
    },
  ]),
  ...spec('vex', [
    {
      id: 'vex-1',
      mode: 'vanish',
      par: [10, 7],
      tip: 'Moving first, perfect play wins in seven. Start on an edge.',
    },
    {
      id: 'vex-2',
      mode: 'ultimate',
      par: [28, 21],
      tip: 'Win the centre board, and never send Vex to a board they can take.',
    },
    {
      id: 'vex-3',
      mode: 'gomoku-15',
      par: [18, 13],
      tip: 'Block open threes early. Vex turns them into fours with tempo.',
    },
    {
      id: 'vex-4',
      mode: prefer('qubic', 'grid-6'),
      par: [12, 9],
      tip: 'Lines run through the layers. A threat in two layers at once is a fork.',
      intro: 'Four layers. Plenty of room to hide something.',
    },
    {
      id: 'vex-5',
      mode: prefer('powers', 'grid-9'),
      par: [16, 12],
      tip: 'Save your bomb for the mark that holds two of Vex’s lines together.',
    },
    {
      id: 'vex-6',
      mode: 'gravity',
      par: [10, 7],
      setup: [at(7, 6, 3), at(7, 6, 0), at(7, 5, 3)],
      objective: 'fork',
      tip: 'You start with the centre column stacked. Vex will try to make you fill under its threats.',
      intro: 'Take the centre column. I insist. Really.',
    },
    {
      id: 'vex-7',
      mode: prefer('gomoku-pro', 'gomoku-15'),
      par: [20, 15],
      boss: true,
      twist: 'Exactly five, and Vex may steal your opening mark.',
      tip: 'Open with a mark you would be happy to play against. Vex swaps anything worth having.',
    },
  ]),
  ...spec('nyx', [
    {
      id: 'nyx-1',
      mode: 'grid-9',
      par: [16, 11],
      tip: 'Nyx searches until the clock runs out. Only a forced win will do.',
    },
    {
      id: 'nyx-2',
      mode: 'gravity',
      par: [14, 10],
      tip: 'Count which squares each of you will be forced to fill.',
    },
    {
      id: 'nyx-3',
      mode: 'gomoku-15',
      par: [20, 14],
      tip: 'The final test. Attack first, and never let go of the initiative.',
    },
    {
      id: 'nyx-4',
      mode: 'ultimate',
      par: [30, 22],
      tip: 'Nyx reads every send. Take small boards that line up with the ones you hold.',
    },
    {
      id: 'nyx-5',
      mode: prefer('pente', 'gomoku-13'),
      par: [20, 15],
      tip: 'Captures change the count. Never leave two of yours open to a flank.',
    },
    {
      id: 'nyx-6',
      mode: prefer('connect4', 'gravity'),
      par: [14, 10],
      objective: 'flawless',
      tip: 'Even and odd rows decide the endgame. Keep your threats on the rows you will reach.',
    },
    {
      id: 'nyx-7',
      mode: 'gomoku-15',
      par: [22, 16],
      setup: [at(15, 7, 7), at(15, 0, 0)],
      boss: true,
      objective: 'flawless',
      twist: 'Nyx lets its first stone drift to the corner. A gift — or bait?',
      tip: 'You have the centre and a free move. Attack before the ghost finds its way back.',
    },
  ]),
];

export const MAX_STARS = STAGES.length * 3;

export function stageById(id: string): Stage | undefined {
  return STAGES.find((stage) => stage.id === id);
}

/** The level the rival plays a stage at. */
export function stageDifficulty(stage: Stage): BotDifficulty {
  return stage.difficulty ?? stage.rival.difficulty;
}

/** The rival's style for a stage: theirs, leaned further where the stage says. */
export function stageStyle(stage: Stage): BotStyle {
  return stage.style ? { ...stage.rival.style, ...stage.style } : stage.rival.style;
}

/** The stages of one rival's chapter, in order. */
export function chapterOf(rivalId: string): Stage[] {
  return STAGES.filter((stage) => stage.rival.id === rivalId);
}

/** How a finished stage game went, beyond who won. */
export interface StageResult {
  readonly won: boolean;
  /** The player's own moves, not counting the setup. */
  readonly moves: number;
  readonly hintsUsed?: boolean;
  /** The win came from two threats at once. */
  readonly fork?: boolean;
  /** The rival never had a square to win on. */
  readonly flawless?: boolean;
}

/** Whether a result meets a stage's third-star objective. */
export function objectiveMet(stage: Stage, result: StageResult): boolean {
  if (!result.won) return false;
  switch (stage.objective) {
    case 'par':
      return result.moves <= stage.par[1];
    case 'no-hints':
      return !result.hintsUsed;
    case 'fork':
      return result.fork === true;
    case 'flawless':
      return result.flawless === true;
  }
}

/**
 * Stars for a finished stage game: none unless won; two for a win within the
 * two-star par; three when the stage's objective is met as well.
 *
 * The older signature - won and own moves - still works, and for a stage
 * whose objective is the par it gives exactly the stars it always did.
 */
export function starsFor(stage: Stage, won: boolean | StageResult, ownMoves = 0): number {
  const result: StageResult = typeof won === 'boolean' ? { won, moves: ownMoves } : won;
  if (!result.won) return 0;
  if (result.moves > stage.par[0]) return 1;
  return objectiveMet(stage, result) ? 3 : 2;
}

/**
 * Whether a stage can be played yet: the first always, the rest once the one
 * before has at least one star. A stage already starred stays open even if a
 * newer stage has since been added in front of it.
 */
export function isUnlocked(stage: Stage, earned: Record<string, number>): boolean {
  const index = STAGES.indexOf(stage);
  if (index <= 0 || (earned[stage.id] ?? 0) > 0) return true;
  return (earned[STAGES[index - 1]!.id] ?? 0) > 0;
}

/** The stage to offer next: the first unlocked one without a star, or the last one. */
export function nextStage(earned: Record<string, number>): Stage {
  return (
    STAGES.find((stage) => (earned[stage.id] ?? 0) === 0 && isUnlocked(stage, earned)) ??
    STAGES.find((stage) => (earned[stage.id] ?? 0) === 0) ??
    STAGES.at(-1)!
  );
}

/** The stage after `stage`, if there is one. */
export function stageAfter(stage: Stage): Stage | undefined {
  return STAGES[STAGES.indexOf(stage) + 1];
}

/** Own moves `player` has made in `game`, leaving out the stage's setup. */
export function playerMoves(game: GameState, stage: Stage | undefined, player: Player): number {
  const setup = stage?.setup?.length ?? 0;
  const opener = startingPlayerOf(game);
  // Who moved first once the setup was down.
  const first = setup % 2 === 0 ? opener : opponentOf(opener);
  const plies = Math.max(0, game.moves.length - setup);
  return first === player ? Math.ceil(plies / 2) : Math.floor(plies / 2);
}

/**
 * The parts of a finished game the objectives ask about: whether `player`
 * won with two threats on the board, and whether their opponent ever had one.
 *
 * Rebuilt from the move list rather than tracked as the game goes, so it
 * cannot drift out of step with what was actually played.
 */
export function analyseWin(
  game: GameState,
  stage: Stage | undefined,
  player: Player,
): { fork: boolean; flawless: boolean } {
  if (game.status !== 'won' || game.winner !== player) return { fork: false, flawless: false };
  const opener = startingPlayerOf(game);
  const rival = opponentOf(player);
  // A fork is two winning squares left for the rival to face: look at the
  // board the rival's last reply was made on. A misère win is the rival
  // completing a line, which has no fork to speak of.
  const facing = replay(game.config, opener, game.moves.slice(0, -2));
  const fork = facing !== null && facing.currentPlayer === rival && winsFor(facing, player) >= 2;

  let flawless = true;
  const setup = stage?.setup?.length ?? 0;
  let state = replay(game.config, opener, game.moves.slice(0, setup));
  for (const move of game.moves.slice(setup)) {
    if (!state || state.status !== 'playing') break;
    if (state.currentPlayer === player && winsFor(state, rival) > 0) {
      flawless = false;
      break;
    }
    state = applyMove(state, move);
  }
  return { fork, flawless };
}
