import {
  type BotDifficulty,
  chooseMove,
  type GameConfig,
  type GameState,
  legalMoves,
  type Player,
  replayFrames,
} from '@/game/engine';

/**
 * Engine work the server does off the event loop: a bot's move, and the
 * post-game comparison of a player's moves with the engine's.
 *
 * Jobs carry a config, an opener and a move list rather than a game state.
 * The worker rebuilds the position with the same rules the lobby refereed, so
 * nothing but plain numbers crosses the thread boundary and a job is cheap to
 * copy, log and test.
 *
 * This module is pure: the worker runs it, and so do the tests, directly.
 */

export interface MoveJob {
  readonly type: 'move';
  readonly config: GameConfig;
  readonly startingPlayer: Player;
  readonly moves: readonly number[];
  readonly difficulty: BotDifficulty;
  readonly timeBudgetMs: number;
  /** Seeds the bot's choices among equal moves, so a job can be replayed exactly. */
  readonly seed: number;
}

export interface AnalyseJob {
  readonly type: 'analyse';
  readonly config: GameConfig;
  readonly startingPlayer: Player;
  readonly moves: readonly number[];
  readonly moveTimesMs: readonly number[];
  /** Which sides to analyse. */
  readonly players: readonly Player[];
  /** Search time per position. */
  readonly budgetMs: number;
  /** At most this many positions per side are searched, spread across the game. */
  readonly maxPositions: number;
}

export type EngineJob = MoveJob | AnalyseJob;

export interface MoveResult {
  readonly move: number | null;
}

export interface SideAnalysis {
  readonly player: Player;
  /** Non-trivial positions this side moved in that were searched. */
  readonly positions: number;
  /** How many of those the player answered with the engine's own first choice. */
  readonly matched: number;
  readonly topRate: number;
  /** Mean think time, in milliseconds, over this side's moves after its first. */
  readonly meanMs: number;
  /** Coefficient of variation of those think times. Humans are uneven; scripts are not. */
  readonly timeCv: number;
}

export interface AnalyseResult {
  readonly sides: readonly SideAnalysis[];
}

export type JobResult<J extends EngineJob> = J extends MoveJob ? MoveResult : AnalyseResult;

/**
 * Plies at the start of a game that are never analysed. Openings are
 * memorised, not calculated, and matching the engine there means nothing.
 */
const OPENING_PLIES = 4;
/** A position with fewer legal moves than this is close enough to forced to prove nothing. */
const MIN_CHOICES = 4;
/** Engine answers that any competent player finds; agreeing with them proves nothing either. */
const TRIVIAL_REASONS = new Set(['only-move', 'win', 'block']);

export function runJob<J extends EngineJob>(job: J): JobResult<J> {
  if (job.type === 'move') return runMove(job) as JobResult<J>;
  return runAnalyse(job) as JobResult<J>;
}

function runMove(job: MoveJob): MoveResult {
  const frames = replayFrames(job.config, job.startingPlayer, job.moves);
  const state = frames?.at(-1);
  if (!state || state.status !== 'playing') return { move: null };

  const chosen = chooseMove(state, {
    difficulty: job.difficulty,
    timeBudgetMs: job.timeBudgetMs,
    random: seeded(job.seed),
  });
  if (chosen) return { move: chosen.move };
  // The engine always returns a legal move while one exists; this is a belt
  // to its braces, so a bot can never stall a game it is seated in.
  return { move: legalMoves(state)[0] ?? null };
}

function runAnalyse(job: AnalyseJob): AnalyseResult {
  const frames = replayFrames(job.config, job.startingPlayer, job.moves);
  if (!frames) return { sides: [] };

  return {
    sides: job.players.map((player) => analyseSide(job, frames, player)),
  };
}

function analyseSide(job: AnalyseJob, frames: readonly GameState[], player: Player): SideAnalysis {
  // The positions this side was to move in, past the opening, with a real choice.
  const candidates: number[] = [];
  const times: number[] = [];
  let ownMoves = 0;
  for (let ply = 0; ply < job.moves.length; ply++) {
    const position = frames[ply];
    if (!position || position.currentPlayer !== player || position.status !== 'playing') continue;
    ownMoves++;
    const time = job.moveTimesMs[ply];
    // The first move of a game includes the time it took to notice it began.
    if (ownMoves > 1 && time !== undefined) times.push(time);
    if (ply < OPENING_PLIES) continue;
    if (legalMoves(position).length < MIN_CHOICES) continue;
    candidates.push(ply);
  }

  // Spread the sample across the whole game rather than taking the first N.
  const sample =
    candidates.length <= job.maxPositions
      ? candidates
      : Array.from(
          { length: job.maxPositions },
          (_, index) =>
            candidates[Math.floor((index * candidates.length) / job.maxPositions)] ??
            candidates[0]!,
        );

  let positions = 0;
  let matched = 0;
  for (const ply of sample) {
    const position = frames[ply]!;
    const engine = chooseMove(position, {
      difficulty: 'master',
      timeBudgetMs: job.budgetMs,
      random: seeded(ply + 1),
    });
    if (!engine || TRIVIAL_REASONS.has(engine.reason)) continue;
    positions++;
    if (engine.move === job.moves[ply]) matched++;
  }

  const meanMs = times.length ? times.reduce((sum, time) => sum + time, 0) / times.length : 0;
  const variance = times.length
    ? times.reduce((sum, time) => sum + (time - meanMs) ** 2, 0) / times.length
    : 0;

  return {
    player,
    positions,
    matched,
    topRate: positions ? matched / positions : 0,
    meanMs,
    timeCv: meanMs > 0 ? Math.sqrt(variance) / meanMs : 0,
  };
}

/** A small, fast, seedable generator, so bot and analysis runs are reproducible. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}
