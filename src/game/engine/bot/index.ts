import { countEmpty, emptyIndices, gravityMoves, ultimateBoardOf } from '../board.js';
import { applyMove, legalMoves } from '../game.js';
import { type Board, Empty, type GameState, opponentOf, type Player } from '../types.js';
import { TRIPLES } from '../variants/ultimate.js';
import { candidateMoves } from './candidates.js';
import { type BotDifficulty, profileForBoard, radiusFor } from './difficulty.js';
import { moveHeuristic, WIN_SCORE } from './evaluate.js';
import { chooseMarkMove } from './marks.js';
import { swapOpeningMove } from './opening.js';
import { powerTactic } from './powers.js';
import { chooseRuleSearchMove } from './rule-searches.js';
import { type RootScore, search } from './search.js';
import {
  type BotStyle,
  bookMoves,
  hasStyle,
  isOpening,
  mirrorOf,
  pickByStyle,
  styleAppeal,
} from './style.js';
import { completesLine, findForkDefence, findForkMove, findImmediateWin } from './threats.js';
import { UltimatePosition } from './ultimate.js';
import { searchUltimate } from './ultimate-search.js';
import { vanishPliesLeft, vanishQueues, vanishVerdict } from './vanish.js';

const MATE_THRESHOLD = WIN_SCORE - 1000;

export interface BotOptions {
  readonly difficulty?: BotDifficulty;
  /** Overrides the difficulty's default thinking time, in milliseconds. */
  readonly timeBudgetMs?: number;
  /** Injectable for deterministic tests. */
  readonly random?: () => number;
  /**
   * Polled during the search. Returning `true` abandons it, which is how the
   * worker drops work for a position the player has already moved on from.
   */
  readonly shouldStop?: () => boolean;
  /** Injectable clock, so a test can make the budget expire on demand. */
  readonly now?: () => number;
  /**
   * How the bot likes to play - which of the moves its level allows it
   * prefers. Never changes what the level can see; see {@link BotStyle}.
   */
  readonly style?: BotStyle;
}

export interface BotMove {
  readonly move: number;
  /** How the move was arrived at. Surfaced in diagnostics, never in the UI. */
  readonly reason:
    | 'only-move'
    | 'win'
    | 'block'
    | 'fork'
    | 'fork-defence'
    | 'search'
    | 'heuristic'
    /** A style's opening book. */
    | 'book'
    /** A style's signature move, such as a copycat's mirror image. */
    | 'style';
  readonly depth: number;
  readonly nodes: number;
  readonly score: number;
}

/**
 * Pick a move for the player to act in `state`.
 *
 * Returns `null` only when the game is already over or there is nothing legal
 * to play. The move is always legal in `state`: every path either comes from
 * the legal-move list or is checked against it before being returned, so a
 * search that ran out of time can degrade to a weaker move but never to an
 * invalid one.
 */
export function findBestMove(state: GameState, options: BotOptions = {}): number | null {
  return chooseMove(state, options)?.move ?? null;
}

/** As {@link findBestMove}, but with the reasoning attached. */
export function chooseMove(state: GameState, options: BotOptions = {}): BotMove | null {
  if (state.status !== 'playing') return null;

  const { random = Math.random } = options;
  const legal = legalMoves(state);
  if (legal.length === 0) return null;
  if (legal.length === 1) {
    return { move: legal[0]!, reason: 'only-move', depth: 0, nodes: 0, score: 0 };
  }

  if (state.config.variant === 'ultimate') {
    return chooseUltimateMove(state, legal, options, random);
  }

  if (state.config.variant === 'vanish') {
    return chooseVanishMove(state, legal, options, random);
  }

  // Pente, Qubic and Quantum each have a search of their own: captures, a cube
  // of lines and marks in two places do not fit the line search's model.
  if (
    state.config.variant === 'pente' ||
    state.config.variant === 'qubic' ||
    state.config.variant === 'quantum'
  ) {
    return chooseRuleSearchMove(state, legal, options);
  }

  // Wild and Order and Chaos: a mark belongs to nobody, so the line search's
  // whole model of whose window is whose does not apply.
  if (state.config.variant === 'wild' || state.config.variant === 'order-chaos') {
    return chooseMarkGameMove(state, legal, options, random);
  }

  // Powers is a line game with two one-time extras. The bot spends one only
  // when it changes the result; otherwise it places a mark like anybody else.
  if (state.config.variant === 'powers') {
    const tactic = powerTactic(state, options.difficulty ?? 'hard');
    if (tactic && legal.includes(tactic.move)) {
      return { move: tactic.move, reason: tactic.reason, depth: 0, nodes: 0, score: 0 };
    }
    const cells = state.board.length;
    const placements = legal.filter((move) => move < cells);
    return chooseLineMove(state, placements, options, random);
  }

  return chooseLineMove(state, legal, options, random);
}

function chooseMarkGameMove(
  state: GameState,
  legal: number[],
  options: BotOptions,
  random: () => number,
): BotMove {
  const picked = chooseMarkMove(state, {
    difficulty: options.difficulty ?? 'hard',
    random,
    ...(options.timeBudgetMs === undefined ? {} : { timeBudgetMs: options.timeBudgetMs }),
    ...(options.now ? { now: options.now } : {}),
    ...(options.shouldStop ? { shouldStop: options.shouldStop } : {}),
  });
  if (picked && legal.includes(picked.move)) {
    return {
      move: picked.move,
      reason: Math.abs(picked.score) >= MATE_THRESHOLD ? 'search' : 'heuristic',
      depth: picked.depth,
      nodes: picked.nodes,
      score: picked.score,
    };
  }
  return { move: randomFrom(legal, random), reason: 'heuristic', depth: 0, nodes: 0, score: 0 };
}

// ---------------------------------------------------------------------------
// Line variants: classic, gomoku, misere, gravity
// ---------------------------------------------------------------------------

function chooseLineMove(
  state: GameState,
  legal: number[],
  options: BotOptions,
  random: () => number,
): BotMove {
  const { difficulty = 'hard' } = options;
  const { board } = state;
  const { size, winLength, variant } = state.config;
  const me = state.currentPlayer;
  const misere = variant === 'misere';
  // Connect Four is gravity on a board with its top row blocked.
  const gravity = variant === 'gravity' || variant === 'connect4';
  const exact = state.config.exact === true;

  // The pie rule's first two moves are a negotiation, not a position: whether
  // to take the opening mark, and which mark to offer.
  const opening = swapOpeningMove(state, legal, difficulty, random);
  if (opening !== null) {
    return { move: opening, reason: 'heuristic', depth: 0, nodes: 0, score: 0 };
  }

  const profile = profileForBoard(difficulty, board.length, countEmpty(board));
  const budget = options.timeBudgetMs ?? profile.timeMs;
  const now = options.now ?? Date.now;

  // Candidates are the cells near existing marks. A legal move outside that
  // set is legal but pointless, and playing one is what makes a weak opponent
  // look broken rather than merely weak - so even the beginner draws from here.
  // Under gravity the columns already narrow it to one square each, all of them
  // reachable and none of them pointless.
  const radius = radiusFor(profile, board.length - countEmpty(board), board.length);
  const near = gravity ? gravityMoves(board, size) : candidateMoves(board, size, radius);
  const nearSet = new Set(near);
  const sensible = legal.filter((move) => nearSet.has(move));
  const nearby = sensible.length > 0 ? sensible : legal;
  // Under misere completing your own line is the one move that loses on the
  // spot, so the moves that pick without searching - the beginner's, and the
  // fallback when the clock beat the search - never take it while anything else
  // is left. The search proves it lost at the first ply and drops it itself.
  const safe = misere
    ? nearby.filter((move) => !completesLine(board, size, move, me, winLength))
    : nearby;
  const pool = safe.length > 0 ? safe : nearby;
  const legalSet = new Set(legal);

  // Under misere a completed line loses, so none of the tactical shortcuts
  // below mean what they say - "take the win" would be taking the loss. The
  // variant is only offered on a 3x3 board, which the search solves outright,
  // so it goes straight there.
  if (!misere) {
    // Winning and blocking are worth special-casing at every level: they are
    // the two moves a human immediately notices, and finding them here means
    // the bot never misses one because the search ran out of time.
    const winNow = findImmediateWin(board, size, me, winLength, near, exact);
    if (winNow !== null) {
      return { move: winNow, reason: 'win', depth: 0, nodes: 0, score: WIN_SCORE };
    }

    const blockNow = findImmediateWin(board, size, opponentOf(me), winLength, near, exact);
    if (blockNow !== null) {
      return { move: blockNow, reason: 'block', depth: 0, nodes: 0, score: 0 };
    }

    // The fork scan reads threats off one fixed candidate list, which under
    // gravity is wrong the moment a mark lands: the square above it opens and
    // is often exactly the threat that matters. The search regenerates moves
    // at every node, so gravity leaves forks to it.
    if (profile.tactics === 'fork' && !gravity && near.length <= FORK_SCAN_LIMIT) {
      // A double threat is a forced win and is safe to play on sight, now that
      // the opponent is known to have no win of their own this move.
      const fork = findForkMove(board, size, me, winLength, near, exact);
      if (fork !== null) {
        return { move: fork, reason: 'fork', depth: 0, nodes: 0, score: MATE_THRESHOLD };
      }

      // Fork *defence* is only a shortcut for the levels whose search is too
      // shallow to find it. From hard upwards the search sees it several plies
      // out and picks the best answer rather than the first adequate one -
      // letting the heuristic win there made the bot play a safe move when a
      // winning one was available.
      if (profile.plies <= 3) {
        const theirFork = findForkMove(board, size, opponentOf(me), winLength, near, exact);
        if (theirFork !== null) {
          const defence = findForkDefence(board, size, me, winLength, near, exact);
          // No defence means the position is already lost; fall through and let
          // the search pick the move that makes them work hardest for it.
          if (defence !== null) {
            return { move: defence, reason: 'fork-defence', depth: 0, nodes: 0, score: 0 };
          }
        }
      }
    }
  }

  const style = hasStyle(options.style) ? options.style : undefined;
  const appeal = style
    ? (move: number) => styleAppeal(board, state.config, move, me, style)
    : undefined;

  if (style) {
    const styled = styledOpening(state, pool, legal, style, random, {
      book: profile.plies <= 0 || board.length > 16 || (state.moves.length === 0 && !misere),
      mirror: profile.plies <= 0,
    });
    if (styled) return styled;
  }

  if (profile.plies <= 0) {
    // A level that does not search picks at random - or, with a style, by
    // taste, with enough noise left that it still blunders like a beginner.
    const move = appeal ? pickByStyle(pool, appeal, random, 12) : null;
    return {
      move: move ?? randomFrom(pool, random),
      reason: 'heuristic',
      depth: 0,
      nodes: 0,
      score: 0,
    };
  }

  const result = search(board, me, {
    size,
    winLength,
    misere,
    gravity,
    exact,
    // When the rules forbid squares the neighbourhood would pick - the pro
    // opening keeps the opener's second mark away from the centre - the root
    // is the legal moves instead, or the search would only find illegal ones.
    ...(near.some((move) => !legalSet.has(move)) ? { rootMoves: pool } : {}),
    // A gravity node has at most one move per column, so the strong levels can
    // afford to look further down it for the same time - and in a game decided
    // by who is forced to fill which square, the extra plies are the ones that
    // see it coming.
    maxDepth: gravity && profile.plies >= 6 ? profile.plies + 2 : profile.plies,
    deadline: now() + budget,
    radius,
    branchLimit: profile.branchLimit,
    // The tie-break below compares root moves against each other, and
    // alpha-beta only ever proves that a move is no better than the one in
    // hand - so the scores have to be exact for it to mean anything. That costs
    // pruning at the root, which is affordable on a small board and not on a
    // large one, where distinct positions rarely score identically anyway.
    // Gravity's root is one move per column, so it is always affordable there.
    exactRootScores: profile.slack > 0 || board.length <= 36 || gravity,
    // A style's defensive leaning reaches into the search itself, damped to a
    // quarter so a level keeps its strength: Mo still sees the line it would
    // rather block, Bruno the one he would rather build.
    ...(style?.defence !== undefined && style.defence !== 1
      ? { evalDefence: EVAL_TEMPO * (1 + (style.defence - 1) * 0.25) }
      : {}),
    ...(options.shouldStop ? { shouldStop: options.shouldStop } : {}),
    ...(options.now ? { now: options.now } : {}),
  });

  const picked = pickWithSlack(
    result.rootScores,
    profile.slack,
    random,
    legalSet,
    (move) =>
      moveHeuristic(board, size, move, me, winLength, exact) +
      (appeal ? appeal(move) * STYLE_TIE : 0),
    appeal,
  );

  if (picked !== null) {
    return {
      move: picked,
      reason: 'search',
      depth: result.depth,
      nodes: result.nodes,
      score: result.score,
    };
  }

  // The search found nothing usable - it was cut off before completing even one
  // root move. A static best is still a sound move, and never an illegal one.
  return {
    move: greedyMove(board, size, me, winLength, pool),
    reason: 'heuristic',
    depth: result.depth,
    nodes: result.nodes,
    score: 0,
  };
}

/**
 * Candidate ceiling above which the fork scan is skipped.
 *
 * It is quadratic in the candidate count, so on an open 15x15 board it would
 * cost more than the search it is meant to be helping. Past this point the
 * search finds forks on its own, several plies earlier than this could.
 */
const FORK_SCAN_LIMIT = 36;

// ---------------------------------------------------------------------------
// Ultimate
// ---------------------------------------------------------------------------

function chooseUltimateMove(
  state: GameState,
  legal: number[],
  options: BotOptions,
  random: () => number,
): BotMove {
  const { difficulty = 'hard' } = options;
  const profile = profileForBoard(difficulty, 81, countEmpty(state.board));
  const now = options.now ?? Date.now;
  const style = hasStyle(options.style) ? options.style : undefined;
  const appeal = style
    ? (move: number) => styleAppeal(state.board, state.config, move, state.currentPlayer, style)
    : undefined;

  // The opening move of an Ultimate game decides nothing yet, so a book move
  // there costs nothing at any level.
  if (style && state.board.every((cell) => cell === Empty)) {
    const styled = styledOpening(state, legal, legal, style, random, {
      book: true,
      mirror: false,
    });
    if (styled) return styled;
  }

  if (profile.plies <= 0) return ultimateReflexMove(state, legal, random, appeal);

  const result = searchUltimate(state, {
    // Ultimate's branching factor is small when a board is forced and large
    // when it is not, so it can afford roughly the depth the line search gets.
    maxDepth: profile.plies + 1,
    deadline: now() + (options.timeBudgetMs ?? profile.timeMs),
    // The tie-break below compares root moves against each other, and
    // alpha-beta only ever proves that a move is no better than the one in
    // hand - so the scores have to be exact for it to mean anything. That costs
    // pruning at the root, which is affordable on a small board and not on a
    // large one, where distinct positions rarely score identically anyway.
    // Ultimate's root is at most nine moves wide when a board is forced and
    // eighty-one only on the opening move, so exact root scores are cheap here.
    exactRootScores: true,
    ...(options.shouldStop ? { shouldStop: options.shouldStop } : {}),
    ...(options.now ? { now: options.now } : {}),
  });

  const picked = pickWithSlack(
    result.rootScores,
    profile.slack,
    random,
    new Set(legal),
    appeal,
    appeal,
  );
  if (picked !== null) {
    return {
      move: picked,
      reason: 'search',
      depth: result.depth,
      nodes: result.nodes,
      score: result.score,
    };
  }

  return { move: randomFrom(legal, random), reason: 'heuristic', depth: 0, nodes: 0, score: 0 };
}

/**
 * Ultimate without a search: the beginner's move.
 *
 * It still sees what every level sees. A move that wins the game is taken, and
 * a move that hands the opponent the game with their next mark is avoided while
 * anything else is left - which in Ultimate is what blocking means, because the
 * square that loses is usually one the opponent is *sent* to rather than one
 * already in their reach. Past that it takes a small board when one is on offer,
 * the one thing a beginner never misses, and otherwise plays at random.
 */
function ultimateReflexMove(
  state: GameState,
  legal: number[],
  random: () => number,
  appeal?: (move: number) => number,
): BotMove {
  const position = new UltimatePosition(state);
  const me = state.currentPlayer;
  const safe: number[] = [];
  const takesBoard: number[] = [];

  for (const move of legal) {
    position.play(move);
    const wins = position.winner === me;
    const takes = position.boards[ultimateBoardOf(move)] === me;
    const losing = !wins && opponentWinsNext(position);
    position.unplay();

    if (wins) return { move, reason: 'win', depth: 0, nodes: 0, score: WIN_SCORE };
    if (losing) continue;
    safe.push(move);
    if (takes) takesBoard.push(move);
  }

  if (takesBoard.length > 0) {
    return {
      move:
        (appeal && pickByStyle(takesBoard, appeal, random, 12)) ?? randomFrom(takesBoard, random),
      reason: 'heuristic',
      depth: 0,
      nodes: 0,
      score: 0,
    };
  }
  // Nothing safe means every move loses; any of them will do.
  const pool = safe.length > 0 ? safe : legal;
  return {
    move: (appeal && pickByStyle(pool, appeal, random, 12)) ?? randomFrom(pool, random),
    reason: safe.length < legal.length ? 'block' : 'heuristic',
    depth: 0,
    nodes: 0,
    score: 0,
  };
}

/** Whether the player to move in `position` can win the game with one mark. */
function opponentWinsNext(position: UltimatePosition): boolean {
  const player = position.toMove;
  for (const reply of position.moves()) {
    position.play(reply);
    const won = position.winner === player;
    position.unplay();
    if (won) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Vanish
// ---------------------------------------------------------------------------

/**
 * How many plies of the solved result each level is allowed to see.
 *
 * Vanish is solved, so there is no search to cut short - a level is weakened by
 * hiding the parts of the answer that are further away than it could plausibly
 * have calculated. Beginner sees exactly the immediate: a win on the board, and
 * a move that hands one over. Master sees everything, which from the opening
 * means it wins every game it starts.
 */
const VANISH_SIGHT: Record<BotDifficulty, number> = {
  beginner: 2,
  easy: 3,
  medium: 5,
  hard: 9,
  expert: 13,
  master: 255,
};

/**
 * Score window on the static scale below. The two weakest levels play any
 * move they cannot see losing; the rest pick among near-equals.
 */
const VANISH_SLACK: Record<BotDifficulty, number> = {
  beginner: 1_000,
  easy: 1_000,
  medium: 12,
  hard: 0,
  expert: 0,
  master: 0,
};

function chooseVanishMove(
  state: GameState,
  legal: number[],
  options: BotOptions,
  random: () => number,
): BotMove {
  const { difficulty = 'hard' } = options;
  const sight = VANISH_SIGHT[difficulty];
  const me = state.currentPlayer;
  // Plies the game has left after this move, before the limit draws it.
  const remaining = vanishPliesLeft(state) - 1;

  const scores: RootScore[] = legal.map((move) => {
    const next = applyMove(state, move)!;
    if (next.status === 'won') return { move, score: WIN_SCORE - 1 };
    if (next.status === 'draw') return { move, score: 0 };

    // The verdict is for the opponent, who moves next.
    const verdict = vanishVerdict(next);
    const plies = verdict.distance + 1;
    const decided = verdict.value !== 0 && verdict.distance <= remaining;
    if (decided && plies <= sight) {
      return { move, score: verdict.value < 0 ? WIN_SCORE - plies : -(WIN_SCORE - plies) };
    }
    return { move, score: vanishShape(next, me) };
  });

  const style = hasStyle(options.style) ? options.style : undefined;
  const appeal = style
    ? (move: number) => styleAppeal(state.board, state.config, move, me, style)
    : undefined;
  const picked =
    pickWithSlack(scores, VANISH_SLACK[difficulty], random, new Set(legal), appeal, appeal) ??
    legal[0]!;
  const score = scores.find((entry) => entry.move === picked)?.score ?? 0;
  return {
    move: picked,
    reason: Math.abs(score) >= MATE_THRESHOLD ? 'search' : 'heuristic',
    depth: Math.min(sight, 99),
    nodes: legal.length,
    score,
  };
}

/**
 * A small static score for a vanish position, from `player`'s side.
 *
 * Only live pairs count: two of a player's marks on a line whose third square
 * is free, neither of them the mark that player loses next. That is the whole
 * of what a position "threatens" in this variant, and counting a pair that
 * leans on a vanishing mark is exactly the mistake the variant punishes. The
 * centre adds a little, as it does on any 3x3 board. Kept far below the mate
 * band so it only ever orders moves the solver has not been allowed to decide.
 */
function vanishShape(state: GameState, player: Player): number {
  const { mover, other } = vanishQueues(state);
  const mine = player === state.currentPlayer ? mover : other;
  const theirs = player === state.currentPlayer ? other : mover;

  const live = (queue: readonly number[]): number => {
    const staying = queue.length >= 3 ? queue.slice(1) : queue;
    let pairs = 0;
    for (const line of TRIPLES) {
      const held = line.filter((cell) => staying.includes(cell)).length;
      const open = line.filter((cell) => state.board[cell] === Empty).length;
      if (held === 2 && open === 1) pairs++;
    }
    return pairs;
  };

  return (live(mine) - live(theirs)) * 10 + holdsCentre(mine) - holdsCentre(theirs);
}

/** The small bonus for holding the centre square, which sits on four lines. */
function holdsCentre(queue: readonly number[]): number {
  return queue.includes(4) ? 3 : 0;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * The move a level of this strength should play.
 *
 * With slack it is a uniform choice among the moves that are nearly as good -
 * but never among losing ones, and never instead of a forced win, because a
 * level being weaker should not mean it hands games away.
 *
 * With no slack it is the best move, and where several are exactly as good it
 * is the most threatening of them. That tie-break matters more than it sounds:
 * a solved game like 3x3 scores every sound move as a draw, so without it the
 * bot picks an arbitrary one and a weak opponent is never made to find the
 * difficult reply. Preferring the move that builds the most threats costs
 * nothing against a perfect defence and beats an imperfect one.
 */
function pickWithSlack(
  rootScores: readonly RootScore[],
  slack: number,
  random: () => number,
  legal: ReadonlySet<number>,
  threat?: (move: number) => number,
  prefer?: (move: number) => number,
): number | null {
  const usable = rootScores.filter((entry) => legal.has(entry.move));
  if (usable.length === 0) return null;

  let bestScore = Number.NEGATIVE_INFINITY;
  for (const entry of usable) if (entry.score > bestScore) bestScore = entry.score;

  if (slack > 0 && bestScore < MATE_THRESHOLD) {
    const pool = usable.filter(
      (entry) => entry.score >= bestScore - slack && entry.score > -MATE_THRESHOLD,
    );
    // A style chooses inside the window rather than a coin: the same set of
    // acceptable moves, so the level is no stronger and no weaker for it.
    const styled =
      prefer && pool.length > 0
        ? pickByStyle(
            pool.map((entry) => entry.move),
            prefer,
            random,
          )
        : null;
    if (styled !== null) return styled;
    if (pool.length > 0) {
      return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]!.move;
    }
    // Every move loses. A random one of them would hand the game over sooner
    // than it has to - under misere, often by completing a line on the spot -
    // so a lost position is played as the strong levels play it: the move
    // that holds out longest.
  }

  const tied = usable.filter((entry) => entry.score === bestScore);
  if (tied.length === 1 || !threat) return tied[0]!.move;

  let best = tied[0]!;
  let bestThreat = threat(best.move);
  for (const entry of tied) {
    const value = threat(entry.move);
    if (value > bestThreat) {
      bestThreat = value;
      best = entry;
    }
  }
  return best.move;
}

/** Best move by static heuristic alone - the fallback when there is no time to search. */
function greedyMove(
  board: Board,
  size: number,
  player: Player,
  winLength: number,
  pool: readonly number[],
): number {
  let best = -1;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const move of pool) {
    const score = moveHeuristic(board, size, move, player, winLength);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }

  return best >= 0 ? best : (pool[0] ?? emptyIndices(board)[0] ?? -1);
}

/**
 * How much a style's taste counts in the tie-break between equally scored
 * moves, against the threat heuristic that otherwise decides it. Enough to
 * choose between two quiet moves, not enough to pass up a real threat.
 */
const STYLE_TIE = 25;

/** The evaluation's own tempo weighting, which a style's defence leans from. */
const EVAL_TEMPO = 1.08;

/**
 * A style's own move, played before any search: its opening book, or a
 * copycat's mirror image of the move just played against it.
 *
 * `allow.book` says the choice cannot spoil the position - an empty board,
 * where every opening of a 3x3 game holds (except under misere, where only
 * the centre does) and a large board has nothing to read yet; a large board
 * in its first move or two; or a level that does not search anyway.
 * Elsewhere the
 * book is left to the tie-break after the search, which only takes it when it
 * scored as well as the best move, so a book move can never be the one that
 * loses a solved 3x3 game. The mirror is a beginner's habit and is only ever
 * allowed where nothing is searched.
 */
function styledOpening(
  state: GameState,
  pool: readonly number[],
  legal: readonly number[],
  style: BotStyle,
  random: () => number,
  allow: { readonly book: boolean; readonly mirror: boolean },
): BotMove | null {
  const me = state.currentPlayer;
  // A book is written for the empty board and the first reply, where the
  // neighbourhood rule has nothing to be near yet - so it is checked against
  // the legal moves rather than the usual candidates.
  const book = allow.book
    ? bookMoves(style, state.config).filter((move) => legal.includes(move))
    : [];
  if (book.length > 0 && isOpening(state.board, me) && state.moves.length <= 1) {
    return { move: randomFrom(book, random), reason: 'book', depth: 0, nodes: 0, score: 0 };
  }
  const last = state.lastMove;
  if (allow.mirror && style.mirror && last !== null && state.config.variant !== 'ultimate') {
    // The copycat answers anywhere it can, near or not: that is the habit a
    // player is meant to spot. Under gravity only left and right swap.
    const mirror = mirrorOf(last, state.config.size, state.config.variant === 'gravity');
    if (legal.includes(mirror) && pool.length > 0 && random() < style.mirror) {
      return { move: mirror, reason: 'style', depth: 0, nodes: 0, score: 0 };
    }
  }
  return null;
}

function randomFrom(moves: readonly number[], random: () => number): number {
  const at = Math.min(moves.length - 1, Math.floor(random() * moves.length));
  return moves[at] ?? moves[0]!;
}

/** True when `index` is empty on `board`. Used by callers validating a stale move. */
export function isEmptyCell(board: Board, index: number): boolean {
  return board[index] === Empty;
}

export {
  BOT_DIFFICULTIES,
  type BotDifficulty,
  isBotDifficulty,
  profileFor,
  type DifficultyProfile,
} from './difficulty.js';
export { search, type SearchOptions, type SearchResult, type RootScore } from './search.js';
export { evaluate, WIN_SCORE } from './evaluate.js';
export { searchUltimate } from './ultimate-search.js';
export { evaluateUltimate, UltimatePosition } from './ultimate.js';
export {
  completesLine,
  findForkDefence,
  findForkMove,
  findImmediateWin,
  winningMoves,
} from './threats.js';
export { candidateMoves } from './candidates.js';
export { type BotStyle, styleAppeal } from './style.js';
export {
  solveVanish,
  type VanishSolution,
  type VanishVerdict,
  vanishPliesLeft,
  vanishQueues,
  vanishVerdict,
  vanishWinningMoves,
} from './vanish.js';
export { penteWinningMoves } from './pente.js';
export { qubicWinningMoves } from './qubic.js';
