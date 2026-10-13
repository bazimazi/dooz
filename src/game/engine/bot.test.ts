import { describe, expect, it } from 'vitest';
import { emptyIndices, ultimateCells } from './board.js';
import {
  BOT_DIFFICULTIES,
  type BotDifficulty,
  candidateMoves,
  chooseMove,
  findBestMove,
  findForkMove,
  profileFor,
} from './bot/index.js';
import { MATE_THRESHOLD, search, withProvenScores } from './bot/search.js';
import { applyMove, createGame, legalMoves } from './game.js';
import { GAME_MODES, modeById } from './modes.js';
import { blank, board, fromMoves, seeded } from './testing.js';
import { type Cell, Empty, type GameConfig, type GameState, O, type Player, X } from './types.js';

const CLASSIC = modeById('classic').config;
const GRID_6 = modeById('grid-6').config;
const MISERE = modeById('misere').config;
const ULTIMATE = modeById('ultimate').config;
const GOMOKU_15 = modeById('gomoku-15').config;

/**
 * Timeout for the tests that play whole games rather than checking a position.
 * The default five seconds is a sensible default for a unit test and the wrong
 * budget for a forty-game match.
 */
const SLOW = 120_000;

/**
 * A clock that advances one millisecond each time it is read. The search reads
 * it every thousand-odd nodes, so a budget measured on it is a fixed amount of
 * work rather than wall time - and a test that compares two searches does not
 * depend on how fast the machine running it happens to be.
 */
function tickingClock(): () => number {
  let time = 0;
  return () => time++;
}

/** A game whose board is drawn as a picture, with `toMove` to play. */
function position(config: GameConfig, toMove: Player, ...rows: string[]): GameState {
  return {
    config,
    board: board(config.size, ...rows),
    currentPlayer: toMove,
    status: 'playing',
    winner: null,
    winLine: null,
    lastMove: null,
    moves: [],
    ultimate: null,
  };
}

describe('findBestMove', () => {
  it('returns null once the game is over', () => {
    expect(findBestMove(fromMoves(3, X, [0, 3, 1, 4, 2]))).toBeNull();
  });

  it('opens in the centre on an empty board', () => {
    expect(findBestMove(createGame(3, X))).toBe(4);
    expect(findBestMove(createGame(6, X))).toBe(3 * 6 + 3);
  });

  it('plays the only move left without searching for it', () => {
    const game = fromMoves(3, X, [0, 1, 2, 4, 3, 5, 7, 6]);
    const move = chooseMove(game)!;
    expect(move.move).toBe(8);
    expect(move.reason).toBe('only-move');
    expect(move.nodes).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tactics that must hold at every level
// ---------------------------------------------------------------------------

describe.each(BOT_DIFFICULTIES)('%s', (difficulty: BotDifficulty) => {
  const options = { difficulty, random: seeded(4) };

  it('takes an immediate win', () => {
    // X holds 0 and 1; 2 completes the top row.
    expect(findBestMove(fromMoves(3, X, [0, 3, 1, 4]), options)).toBe(2);
  });

  it('blocks an immediate loss', () => {
    // O to move. X threatens 0-1-2, so O must take 2.
    expect(findBestMove(fromMoves(3, X, [0, 4, 1]), options)).toBe(2);
  });

  it('prefers winning over blocking when it can do either', () => {
    // O to move: O holds 3 and 4 (5 wins); X holds 0 and 1 (2 blocks).
    expect(findBestMove(fromMoves(3, X, [0, 3, 1, 4, 8]), options)).toBe(5);
  });

  it('takes a four-in-a-row win on a bigger board', () => {
    // X holds three of the top row on 6x6; the fourth wins.
    const game = position(GRID_6, X, 'XXX...', 'OOO...', ...Array<string>(4).fill(blank(6)));
    expect(findBestMove(game, options)).toBe(3);
  });

  it('blocks a four-in-a-row on a bigger board', () => {
    const game = position(GRID_6, O, 'XXX...', 'OO....', ...Array<string>(4).fill(blank(6)));
    expect(findBestMove(game, options)).toBe(3);
  });

  it(
    'only ever returns a legal move, in every mode',
    () => {
      const random = seeded(90 + BOT_DIFFICULTIES.indexOf(difficulty));
      for (const mode of GAME_MODES) {
        let game = createGame(mode.config, X);
        let guard = 0;
        while (game.status === 'playing' && guard++ < 14) {
          const move = findBestMove(game, { difficulty, random, timeBudgetMs: 12 });
          expect(move).not.toBeNull();
          expect(legalMoves(game)).toContain(move!);
          game = applyMove(game, move!)!;
        }
      }
    },
    SLOW,
  );
});

// ---------------------------------------------------------------------------
// Where the levels actually differ
// ---------------------------------------------------------------------------

describe('difficulty', () => {
  it('finds a double threat from medium upwards', () => {
    // X to move with corners 0 and 8 and the centre. Playing 2 (or 6) makes two
    // threats at once, which cannot both be answered.
    const game = position(CLASSIC, X, 'X..', '.XO', 'O.X');
    const forking = ['medium', 'hard', 'expert', 'master'] as const;

    for (const difficulty of forking) {
      const chosen = chooseMove(game, { difficulty, random: seeded(1) })!;
      const after = applyMove(game, chosen.move)!;
      const threats = emptyIndices(after.board).filter((cell) => {
        const trial = applyMove({ ...after, currentPlayer: X }, cell);
        return trial?.winner === X;
      });
      expect(threats.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('finds a fork whose second threat is next to the new mark only', () => {
    // X holds 13 and 14 on 6x6, four in a row. Playing 15 threatens both 12 and
    // 16 - and 16 is two squares from every mark already down, so a scan that
    // only looks at the old neighbourhood sees one threat and no fork.
    const game = position(GRID_6, X, '.....O', blank(6), '.XX...', blank(6), blank(6), '.....O');
    expect(findForkMove(game.board.slice(), 6, X, 4, candidateMoves(game.board, 6, 1))).toBe(15);

    const chosen = chooseMove(game, { difficulty: 'medium', random: seeded(3) })!;
    expect(chosen).toMatchObject({ move: 15, reason: 'fork' });
  });

  it('sees the far corner of a 3x3 board from hard upwards', () => {
    // X on 0, O on 8, X to move: 2 and 6 win by force, and neither is next to
    // a mark. 1, the obvious-looking move, loses.
    const game = position(CLASSIC, X, 'X..', '...', '..O');
    for (const difficulty of ['hard', 'expert', 'master'] as const) {
      const chosen = chooseMove(game, { difficulty, random: seeded(5) })!;
      expect([2, 6]).toContain(chosen.move);
      expect(chosen.score).toBeGreaterThanOrEqual(MATE_THRESHOLD);
    }
  });

  it('is deterministic for a given position and seed', () => {
    for (const difficulty of BOT_DIFFICULTIES) {
      const game = position(
        GRID_6,
        X,
        '.XO...',
        '..X...',
        '...O..',
        ...Array<string>(3).fill(blank(6)),
      );
      const options = { difficulty, timeBudgetMs: 20 };
      const first = findBestMove(game, { ...options, random: seeded(12), now: tickingClock() });
      const second = findBestMove(game, { ...options, random: seeded(12), now: tickingClock() });
      expect(second).toBe(first);
    }
  });

  it(
    'gives the weaker levels a wider spread of acceptable moves',
    () => {
      const game = position(
        GRID_6,
        X,
        '.XO...',
        '..X...',
        '...O..',
        ...Array<string>(3).fill(blank(6)),
      );
      const spread = (difficulty: BotDifficulty) => {
        const moves = new Set<number>();
        for (let seed = 0; seed < 24; seed++) {
          moves.add(
            findBestMove(game, {
              difficulty,
              random: seeded(seed),
              timeBudgetMs: 10,
              now: tickingClock(),
            })!,
          );
        }
        return moves.size;
      };

      // A level with slack picks among near-equal moves; a level without one
      // always plays the same best move.
      expect(spread('easy')).toBeGreaterThan(1);
      expect(spread('hard')).toBe(1);
      expect(spread('master')).toBe(1);
    },
    SLOW,
  );
});

// ---------------------------------------------------------------------------
// Strength: the levels have to actually be stronger, not just configured that way
// ---------------------------------------------------------------------------

/**
 * Head-to-head play between two levels.
 *
 * Budgets are scaled down from each level's real thinking time rather than
 * equalised. Equalising them would hide the thing being measured: from hard
 * upwards the levels differ mainly in how long they are allowed to think, so a
 * duel at one fixed budget compares two bots that both simply ran out of time.
 * Scaling keeps the ratio and keeps the suite quick; `bench/ladder.ts` runs the
 * same ladder at the budgets the game actually uses.
 */
const BUDGET_SCALE = 0.05;

function budgetFor(difficulty: BotDifficulty): number {
  return Math.max(8, Math.round(profileFor(difficulty).timeMs * BUDGET_SCALE));
}

/**
 * Plays one game between two levels and returns the winner, or `null` for a draw.
 *
 * `openingPlies` random moves come first. Without them both bots are
 * deterministic and a twelve-game duel is two games played six times each,
 * which reads as a crushing result or a dead heat and means neither.
 */
function playMatch(
  config: GameConfig,
  levels: Record<'X' | 'O', BotDifficulty>,
  random: () => number,
  openingPlies = 2,
): Player | null {
  let game = createGame(config, X);
  for (let ply = 0; ply < openingPlies && game.status === 'playing'; ply++) {
    const moves = legalMoves(game);
    game = applyMove(game, moves[Math.floor(random() * moves.length)]!)!;
  }
  let guard = 0;
  while (game.status === 'playing' && guard++ < 400) {
    const difficulty = levels[game.currentPlayer === X ? 'X' : 'O'];
    const move = findBestMove(game, {
      difficulty,
      random,
      timeBudgetMs: budgetFor(difficulty),
    });
    if (move === null) break;
    game = applyMove(game, move)!;
  }
  return game.winner;
}

/** Score for `strong` over `weak`, playing both colours. Win 1, draw 0.5. */
function duel(
  config: GameConfig,
  strong: BotDifficulty,
  weak: BotDifficulty,
  games: number,
  openingPlies = 2,
): number {
  const random = seeded(2024);
  let score = 0;
  for (let round = 0; round < games; round++) {
    const strongPlays: Player = round % 2 === 0 ? X : O;
    const levels: Record<'X' | 'O', BotDifficulty> =
      strongPlays === X ? { X: strong, O: weak } : { X: weak, O: strong };
    const winner = playMatch(config, levels, random, openingPlies);
    if (winner === strongPlays) score += 1;
    else if (winner === null) score += 0.5;
  }
  return score / games;
}

describe('strength', () => {
  it(
    'never loses a 3x3 game at master',
    () => {
      // 3x3 is solved, so a perfect bot draws everything it cannot win. Beating a
      // beginner needs them to walk into a fork, which they sometimes decline to
      // do - so the guarantee worth asserting is that master never loses. From
      // the empty board, because a random opening can hand the game away before
      // either bot has had a move.
      expect(duel(CLASSIC, 'master', 'beginner', 12, 0)).toBeGreaterThanOrEqual(0.5);
    },
    SLOW,
  );

  /**
   * Every level beats the one below it, one rung per test.
   *
   * Separate tests rather than one, because each duel is bounded by wall clock
   * rather than by work: on a machine also running the rest of the suite the
   * searches get less done in the same milliseconds, and five of them in a row
   * under one timeout is a test that fails for want of a spare core rather
   * than for want of a working AI. Budgets here are a twentieth of the real
   * ones; `bench/ladder.ts` runs the same ladder at full strength.
   */
  it.each([
    ['easy', 'beginner'],
    ['medium', 'easy'],
    ['hard', 'medium'],
    ['expert', 'hard'],
    ['master', 'expert'],
  ] as const)(
    '%s beats %s on a 6x6 board',
    (strong, weak) => {
      expect(duel(GRID_6, strong, weak, 8)).toBeGreaterThan(0.5);
    },
    SLOW,
  );

  it(
    'crushes a beginner on the bigger boards',
    () => {
      expect(duel(modeById('grid-9').config, 'hard', 'beginner', 4)).toBeGreaterThanOrEqual(0.75);
      expect(duel(GRID_6, 'master', 'beginner', 6)).toBeGreaterThanOrEqual(0.75);
    },
    SLOW,
  );

  it(
    'never loses a 3x3 game from hard upwards, against anything',
    () => {
      // A solved game: a perfect player cannot be beaten from the start, as
      // either colour, by any sequence of legal replies.
      for (const difficulty of ['hard', 'expert', 'master'] as const) {
        const random = seeded(31);
        for (let round = 0; round < 40; round++) {
          const botPlays: Player = round % 2 === 0 ? X : O;
          let game = createGame(CLASSIC, X);
          while (game.status === 'playing') {
            const move =
              game.currentPlayer === botPlays
                ? findBestMove(game, { difficulty, random, timeBudgetMs: 200 })!
                : randomMove(game, random);
            game = applyMove(game, move)!;
          }
          expect(game.winner).not.toBe(botPlays === X ? O : X);
        }
      }
    },
    SLOW,
  );

  it('draws 3x3 against itself at the top level', () => {
    // From the empty board, with no random opening: two perfect players draw.
    const random = seeded(8);
    for (let round = 0; round < 4; round++) {
      expect(playMatch(CLASSIC, { X: 'master', O: 'master' }, random, 0)).toBeNull();
    }
  });
});

function randomMove(game: GameState, random: () => number): number {
  const moves = legalMoves(game);
  return moves[Math.floor(random() * moves.length)]!;
}

// ---------------------------------------------------------------------------
// Budgets, cancellation and degradation
// ---------------------------------------------------------------------------

describe('time budget', () => {
  it('still returns a legal move on an impossible budget', () => {
    const game = position(
      modeById('gomoku-15').config,
      X,
      ...Array.from({ length: 15 }, (_, row) => (row === 7 ? '.......XO......' : blank(15))),
    );
    const move = findBestMove(game, { difficulty: 'master', timeBudgetMs: 0 });
    expect(move).not.toBeNull();
    expect(legalMoves(game)).toContain(move!);
  });

  it('stops when asked to, and still answers', () => {
    const game = createGame(modeById('gomoku-13').config, X);
    const played = applyMove(game, 6 * 13 + 6)!;
    const move = findBestMove(played, {
      difficulty: 'master',
      timeBudgetMs: 5000,
      shouldStop: () => true,
    });
    expect(move).not.toBeNull();
    expect(legalMoves(played)).toContain(move!);
  });

  it('respects a wall-clock budget on a large board', () => {
    const game = applyMove(createGame(modeById('gomoku-15').config, X), 7 * 15 + 7)!;
    const started = Date.now();
    findBestMove(game, { difficulty: 'master', timeBudgetMs: 150 });
    // The clock is only sampled every so often, so the ceiling is generous;
    // what it is checking is that the budget is honoured at all.
    expect(Date.now() - started).toBeLessThan(2500);
  });

  it(
    'plays a forced win that a pass cut short by the clock had proved',
    () => {
      // The win here is first seen five plies deep. Stopping the search part way
      // through that pass leaves its proof in hand but the pass unfinished, and
      // the proof still has to decide the move - not the shallower scores of the
      // last pass that completed.
      const game = fromMoves(GOMOKU_15, X, [112, 98, 114, 97, 113, 111, 84, 99, 96, 85]);
      let provenMidPass = 0;
      for (let stopAfter = 1; stopAfter <= 8; stopAfter++) {
        let polls = 0;
        const chosen = chooseMove(game, {
          difficulty: 'expert',
          timeBudgetMs: 60_000,
          shouldStop: () => ++polls >= stopAfter,
        })!;
        // Only the runs that proved the win are being checked.
        if (chosen.score < MATE_THRESHOLD) continue;
        if (chosen.depth < 5) provenMidPass++;

        // The move played is one that wins: after it, O is lost.
        const after = applyMove(game, chosen.move)!;
        const reply = search(after.board, O, {
          size: 15,
          winLength: 5,
          maxDepth: 6,
          deadline: Number.POSITIVE_INFINITY,
          radius: 1,
          branchLimit: 14,
        });
        expect(reply.score).toBeLessThanOrEqual(-MATE_THRESHOLD);
      }
      expect(provenMidPass).toBeGreaterThan(0);
    },
    SLOW,
  );

  it('keeps the proofs from an unfinished pass, and nothing else from it', () => {
    const complete = [
      { move: 1, score: 40 },
      { move: 2, score: 30 },
      { move: 3, score: 20 },
    ];
    const partial = [
      { move: 1, score: -(MATE_THRESHOLD + 5) },
      { move: 2, score: 25 },
    ];
    expect(withProvenScores(complete, partial)).toEqual([
      { move: 1, score: -(MATE_THRESHOLD + 5) },
      { move: 2, score: 30 },
      { move: 3, score: 20 },
    ]);
  });

  it('never takes a stale move from an earlier position', () => {
    // A move found for one board must be checked against the board it is
    // played on, which is what the legality assertion here stands for.
    const game = position(
      GRID_6,
      X,
      'XO....',
      '.X....',
      '..O...',
      ...Array<string>(3).fill(blank(6)),
    );
    for (let budget = 0; budget <= 40; budget += 8) {
      const move = findBestMove(game, { difficulty: 'expert', timeBudgetMs: budget })!;
      expect(game.board[move]).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

describe('misere bot', () => {
  it('does not complete a line when it has any other move', () => {
    // O to move. Taking 2 would complete O's top row and lose the game - at
    // every level, beginner included: a move that loses on the spot is not
    // weak play, it is a bot that does not know the rules.
    const game = position(MISERE, O, 'OO.', 'X..', '..X');
    for (const difficulty of BOT_DIFFICULTIES) {
      for (let seed = 0; seed < 12; seed++) {
        expect(findBestMove(game, { difficulty, random: seeded(seed) })).not.toBe(2);
      }
    }
  });

  it('holds out rather than completing a line when every move loses', () => {
    // X to move. 6 and 8 complete a diagonal at once; 7 loses too, but only
    // after O has had to find 6. A level with slack used to pick among the
    // three at random once all of them were lost.
    const game = position(MISERE, X, 'XOX', 'OXO', '...');
    for (const difficulty of BOT_DIFFICULTIES) {
      for (let seed = 0; seed < 12; seed++) {
        expect(findBestMove(game, { difficulty, random: seeded(seed) })).toBe(7);
      }
    }
  });

  it(
    'never loses a misere game a perfect player would not',
    () => {
      const random = seeded(55);
      let losses = 0;
      for (let round = 0; round < 20; round++) {
        const botPlays: Player = round % 2 === 0 ? X : O;
        let game = createGame(MISERE, X);
        while (game.status === 'playing') {
          const move =
            game.currentPlayer === botPlays
              ? findBestMove(game, { difficulty: 'master', random, timeBudgetMs: 300 })!
              : randomMove(game, random);
          game = applyMove(game, move)!;
        }
        if (game.winner === (botPlays === X ? O : X)) losses++;
      }
      expect(losses).toBe(0);
    },
    SLOW,
  );

  it(
    'beats a random opponent more often than it loses',
    () => {
      expect(duel(MISERE, 'master', 'beginner', 12)).toBeGreaterThan(0.5);
    },
    SLOW,
  );
});

describe('ultimate bot', () => {
  it('plays legal moves through a whole game', () => {
    const random = seeded(6);
    let game = createGame(ULTIMATE, X);
    let guard = 0;
    while (game.status === 'playing' && guard++ < 100) {
      const move = findBestMove(game, { difficulty: 'hard', random, timeBudgetMs: 60 })!;
      expect(legalMoves(game)).toContain(move);
      game = applyMove(game, move)!;
    }
    expect(game.status).not.toBe('playing');
  });

  it('completes a sub-board when the move is free', () => {
    // X is sent to board 0 and already holds two of its top row.
    let game = createGame(ULTIMATE, X);
    game = applyMove(game, 0)!; // X board 0 cell 0 -> O to board 0
    game = applyMove(game, 9)!; // O board 0 cell 3 -> X to board 3
    game = applyMove(game, 27)!; // X board 3 cell 0 -> O to board 0
    game = applyMove(game, 18)!; // O board 0 cell 6 -> X to board 6
    game = applyMove(game, 54)!; // X board 6 cell 0 -> O to board 0
    game = applyMove(game, 10)!; // O board 0 cell 4 -> X to board 4
    game = applyMove(game, 30)!; // X board 4 cell 0 -> O to board 0
    game = applyMove(game, 11)!; // O board 0 cell 5 -> X to board 5

    // X now plays in board 5; nothing here asserts a sub-board win, only that
    // the bot keeps producing legal moves under the forced-board rule.
    const move = findBestMove(game, { difficulty: 'expert', timeBudgetMs: 200 })!;
    expect(legalMoves(game)).toContain(move);
  });

  it('takes a game-winning move at every level, beginner included', () => {
    // X holds boards 0 and 1 and two of board 2's top row, and is sent to
    // board 2: its third square wins the game.
    const game = ultimatePosition(X, 2, { 0: X, 1: X, 3: O, 5: O }, [
      [X, 2, 0],
      [X, 2, 1],
      [O, 2, 4],
    ]);
    for (const difficulty of BOT_DIFFICULTIES) {
      for (let seed = 0; seed < 6; seed++) {
        const move = findBestMove(game, { difficulty, random: seeded(seed), timeBudgetMs: 40 });
        expect(move).toBe(ultimateCells(2)[2]);
      }
    }
  });

  it('does not send the opponent where they win the game, even as a beginner', () => {
    // O holds boards 3 and 4 and two of board 5's top row, so O wins the game
    // the moment it is let into board 5. X is in board 2: its square 5 sends O
    // there directly, and 3 and 4 point at finished boards, which frees O to
    // go there anyway.
    const game = ultimatePosition(X, 2, { 0: X, 3: O, 4: O }, [
      [O, 5, 0],
      [O, 5, 1],
      [X, 5, 4],
      [X, 2, 0],
      [O, 2, 8],
    ]);
    const losing = [3, 4, 5].map((cell) => ultimateCells(2)[cell]);
    for (let seed = 0; seed < 24; seed++) {
      const chosen = chooseMove(game, { difficulty: 'beginner', random: seeded(seed) })!;
      expect(losing).not.toContain(chosen.move);
      expect(chosen.reason).toBe('block');
    }
  });

  it(
    'beats a beginner over a series',
    () => {
      expect(duel(ULTIMATE, 'expert', 'beginner', 4)).toBeGreaterThan(0.5);
    },
    SLOW,
  );
});

/**
 * An Ultimate position built by hand.
 *
 * `won` lists the sub-boards already taken, each drawn as its owner's top row,
 * and `marks` the other marks as (player, board, cell). The rules never ask how
 * a position was reached, only what is on it, so this is enough to test what
 * the bot does next.
 */
function ultimatePosition(
  toMove: Player,
  active: number | null,
  won: Partial<Record<number, Player>>,
  marks: readonly (readonly [Player, number, number])[],
): GameState {
  const cells: Cell[] = Array.from({ length: 81 }, () => Empty);
  const boards: Cell[] = Array.from({ length: 9 }, () => Empty);
  for (let sub = 0; sub < 9; sub++) {
    const owner = won[sub];
    if (owner === undefined) continue;
    boards[sub] = owner;
    for (const cell of [0, 1, 2]) cells[ultimateCells(sub)[cell]!] = owner;
  }
  for (const [player, sub, cell] of marks) cells[ultimateCells(sub)[cell]!] = player;
  return {
    config: ULTIMATE,
    board: cells,
    currentPlayer: toMove,
    status: 'playing',
    winner: null,
    winLine: null,
    lastMove: null,
    moves: [],
    ultimate: {
      boards,
      drawn: Array.from({ length: 9 }, () => false),
      activeBoard: active,
      winBoards: null,
    },
  };
}
