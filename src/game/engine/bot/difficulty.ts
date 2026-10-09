/**
 * Six levels that play genuinely differently.
 *
 * The weak levels are not the strong one with noise added. They differ in three
 * independent ways, and those differences are what a player actually feels:
 *
 * - **How far ahead they look.** Beginner does not search at all; master
 *   searches until its clock runs out. This is the difference between a bot
 *   that walks into a double threat and one that sets them.
 * - **Which tactics they are allowed to use.** Every level takes a win it can
 *   see and blocks a loss it can see - missing those is not "easy", it is
 *   broken. Fork-finding and fork-defence unlock at medium, which is precisely
 *   the point where a human stops being able to win by setting a simple trap.
 * - **How close to the best move they insist on playing.** `slack` is a score
 *   window: a level with slack picks uniformly among the root moves within it,
 *   so it plays a defensible move that is simply not the strongest. A forced
 *   win or a forced loss is never subject to it - throwing away a won game is
 *   not weakness, it is a bug.
 */
export const BOT_DIFFICULTIES = ['beginner', 'easy', 'medium', 'hard', 'expert', 'master'] as const;

export type BotDifficulty = (typeof BOT_DIFFICULTIES)[number];

const DIFFICULTY_SET: ReadonlySet<string> = new Set(BOT_DIFFICULTIES);

/** Narrows untrusted input - a URL parameter, a stored preference. */
export function isBotDifficulty(value: unknown): value is BotDifficulty {
  return typeof value === 'string' && DIFFICULTY_SET.has(value);
}

export interface DifficultyProfile {
  /** Ceiling on search depth in plies. Zero means no search at all. */
  readonly plies: number;
  /** Thinking time in milliseconds. */
  readonly timeMs: number;
  /** Neighbourhood radius for candidate generation. */
  readonly radius: number;
  /** Candidates examined per node after ordering. */
  readonly branchLimit: number;
  /** Highest tactic the level is allowed to apply before searching. */
  readonly tactics: 'block' | 'fork';
  /** Score window within which any root move is acceptable. */
  readonly slack: number;
}

/**
 * The cost of a move by board area, used to scale time and depth.
 *
 * A 3x3 game is solved outright in a few milliseconds, so spending a second on
 * it would only make the bot look slow. A 15x15 game cannot be solved at all
 * and needs every millisecond it is given.
 */
const PROFILES: Record<BotDifficulty, DifficultyProfile> = {
  // No lookahead whatsoever. It sees the move in front of it and nothing else,
  // which is exactly why a human can beat it by setting up two threats at once.
  beginner: { plies: 0, timeMs: 0, radius: 1, branchLimit: 8, tactics: 'block', slack: 0 },
  // One ply: it can tell a good square from a bad one, and still cannot see a
  // trap being built.
  easy: { plies: 1, timeMs: 80, radius: 1, branchLimit: 10, tactics: 'block', slack: 600 },
  // The first level that looks ahead far enough to find and stop a fork, and
  // the last that will settle for a move that is merely reasonable.
  medium: { plies: 3, timeMs: 250, radius: 1, branchLimit: 10, tactics: 'fork', slack: 40 },
  hard: { plies: 6, timeMs: 600, radius: 1, branchLimit: 12, tactics: 'fork', slack: 0 },
  expert: { plies: 12, timeMs: 1200, radius: 2, branchLimit: 14, tactics: 'fork', slack: 0 },
  master: { plies: 20, timeMs: 2200, radius: 2, branchLimit: 16, tactics: 'fork', slack: 0 },
};

export function profileFor(difficulty: BotDifficulty): DifficultyProfile {
  return PROFILES[difficulty];
}

/**
 * How far from the existing marks to look, given how many there are.
 *
 * A wide radius is affordable while the board is nearly empty and ruinous once
 * it is not: every extra candidate multiplies through every remaining ply, and
 * a search that sees more moves one ply shallower is a worse search. So the
 * profile's radius is a ceiling used in the opening, and play settles to the
 * immediate neighbourhood as soon as there is a position to read.
 */
export function radiusFor(profile: DifficultyProfile, stonesOnBoard: number): number {
  return stonesOnBoard <= 4 ? profile.radius : 1;
}

/**
 * The profile adjusted for the board actually being played.
 *
 * Small boards get their depth raised to whatever solves them - a 3x3 game is
 * nine plies deep in total, so from hard upwards the bot simply plays it
 * perfectly and there is nothing below perfect to aim at. Big boards get their
 * time raised and their depth left alone, because on a 15x15 board an extra ply
 * costs more than the whole 3x3 game does.
 */
export function profileForBoard(
  difficulty: BotDifficulty,
  cells: number,
  emptyCells: number,
): DifficultyProfile {
  const base = PROFILES[difficulty];

  // A board this small can be searched to the end. Levels that are meant to be
  // strong take that; levels that are meant to be beatable keep their limit,
  // which is the only thing making them beatable here.
  if (
    cells <= 16 &&
    (difficulty === 'hard' || difficulty === 'expert' || difficulty === 'master')
  ) {
    return { ...base, plies: Math.max(base.plies, emptyCells), timeMs: Math.max(base.timeMs, 400) };
  }

  if (cells >= 150) {
    return { ...base, timeMs: Math.round(base.timeMs * 1.4), radius: Math.max(base.radius, 1) };
  }

  return base;
}
