import { describe, expect, it } from 'vitest';
import {
  type BotDifficulty,
  candidateMoves,
  chooseMove,
  findBestMove,
  findImmediateWin,
} from './bot/index.js';
import { evaluate } from './bot/evaluate.js';
import { powerTactic } from './bot/powers.js';
import { swapMove } from './config.js';
import { applyMove, createGame, legalMoves, replay } from './game.js';
import { type ModeId, modeById } from './modes.js';
import { blank, board, seeded } from './testing.js';
import { Blocked, type GameConfig, type GameState, O, type Player, X } from './types.js';
import { centreOf, markMove, powerMove } from './variants/index.js';

const CONNECT4 = modeById('connect4').config;
const GOMOKU_PRO = modeById('gomoku-pro').config;
const WILD = modeById('wild').config;
const WILD_4 = modeById('wild-4').config;
const ORDER_CHAOS = modeById('order-chaos').config;
const OBSTACLES = modeById('obstacles').config;
const POWERS = modeById('powers').config;

const SLOW = 120_000;

/** A clock that advances a millisecond per read, so a budget is a fixed amount of work. */
function tickingClock(): () => number {
  let time = 0;
  return () => time++;
}

/** A position drawn as a picture, with `toMove` to play. */
function position(config: GameConfig, toMove: Player, ...rows: string[]): GameState {
  const cells = board(config.size, ...rows);
  rows.forEach((row, r) =>
    Array.from(row).forEach((char, c) => {
      if (char === '#') cells[r * config.size + c] = Blocked;
    }),
  );
  return {
    ...createGame(config, toMove),
    board: cells,
  };
}

/** Plays `game` out between `bot` and uniformly random moves; every bot move must be legal. */
function playAgainstRandom(
  config: GameConfig,
  botSide: Player,
  difficulty: BotDifficulty,
  random: () => number,
): GameState {
  let game = createGame(config, random() < 0.5 ? X : O);
  for (let guard = 0; game.status === 'playing' && guard < 400; guard++) {
    const legal = legalMoves(game);
    let move: number;
    if (game.currentPlayer === botSide) {
      move = findBestMove(game, { difficulty, random, timeBudgetMs: 40 })!;
      expect(legal).toContain(move);
    } else {
      move = legal[Math.floor(random() * legal.length)]!;
    }
    game = applyMove(game, move)!;
  }
  expect(game.status).not.toBe('playing');
  return game;
}

describe('bots stay legal in every new rule set', () => {
  const modes: ModeId[] = [
    'connect4',
    'gomoku-pro',
    'wild',
    'wild-4',
    'order-chaos',
    'obstacles',
    'powers',
  ];
  for (const id of modes) {
    it(
      id,
      () => {
        const random = seeded(id.length * 31);
        const config = modeById(id).config;
        for (const difficulty of ['beginner', 'medium', 'hard'] as const) {
          playAgainstRandom(
            { ...config, ...(id === 'obstacles' ? { seed: 77 } : {}) },
            X,
            difficulty,
            random,
          );
        }
      },
      SLOW,
    );
  }
});

describe('blocked squares', () => {
  it('are dead ground to the evaluation, not an opponent', () => {
    // Connect Four's blocked top row would otherwise read as seven-in-a-row
    // of somebody's marks.
    const fresh = createGame({ ...CONNECT4, opening: undefined }, X);
    expect(Math.abs(evaluate(fresh.board, 7, X, 4))).toBeLessThan(100);
    expect(evaluate(fresh.board, 7, X, 4)).toBe(evaluate(fresh.board, 7, O, 4));
  });

  it('do not count as marks for where to play', () => {
    const game = createGame({ ...OBSTACLES, seed: 5 }, X);
    expect(candidateMoves(game.board, 9, 2)).toEqual([centreOf(9)]);
  });

  it('block a run in the bot as in the rules', () => {
    // X has four in the top row, but a rock closes the fifth square.
    const game = position(OBSTACLES, X, 'XXXX#....', blank(9), '....O....', '....O....');
    expect(findImmediateWin(game.board, 9, X, 5, legalMoves(game))).toBeNull();
  });
});

describe('connect four bot', () => {
  const plain = { ...CONNECT4, opening: undefined };

  it('blocks a vertical three', () => {
    const game = replay(plain, X, [45, 46, 38, 39, 31])!;
    // X has three stacked in column 3; O must cap it.
    expect(findBestMove(game, { difficulty: 'easy', random: seeded(1) })).toBe(24);
  });

  it('takes a win across the bottom', () => {
    const game = replay(plain, X, [42, 35, 43, 36, 44, 37])!;
    expect(findBestMove(game, { difficulty: 'beginner', random: seeded(2) })).toBe(45);
  });
});

describe('exact five', () => {
  it('is not a win to the bot when it would be an overline', () => {
    // X: 0-1-2-3 and 5, so square 4 makes six, which does not count.
    const game = position(GOMOKU_PRO, X, 'XXXX.X.........', blank(15), 'OOO.O..........');
    const cells = legalMoves(game).filter((move) => move < 225);
    expect(findImmediateWin(game.board, 15, X, 5, cells, true)).toBeNull();
    expect(findImmediateWin(game.board, 15, X, 5, cells, false)).toBe(4);
    // And O, who does have a real five on offer, takes it.
    const turn: GameState = { ...game, currentPlayer: O, moves: [1, 2] };
    expect(findBestMove(turn, { difficulty: 'hard', random: seeded(3) })).toBe(30 + 3);
  });
});

describe('swap opening', () => {
  it('takes a strong opening mark and leaves a weak one', () => {
    const code = swapMove(GOMOKU_PRO)!;
    const centre = replay(GOMOKU_PRO, X, [centreOf(15)])!;
    expect(findBestMove(centre, { difficulty: 'medium', random: seeded(4) })).toBe(code);
    const corner = replay(GOMOKU_PRO, X, [0])!;
    expect(findBestMove(corner, { difficulty: 'medium', random: seeded(4) })).not.toBe(code);
  });

  it('offers a balanced first mark rather than the centre', () => {
    const fresh = createGame(GOMOKU_PRO, X);
    const move = findBestMove(fresh, { difficulty: 'hard', random: seeded(5) })!;
    expect(move).not.toBe(centreOf(15));
    // And the bot itself would not swap it.
    const offered = applyMove(fresh, move)!;
    expect(findBestMove(offered, { difficulty: 'hard', random: seeded(6) })).not.toBe(
      swapMove(GOMOKU_PRO),
    );
  });

  it('swaps the middle column of Connect Four', () => {
    const opened = replay(CONNECT4, X, [45])!;
    expect(findBestMove(opened, { difficulty: 'hard', random: seeded(7) })).toBe(
      swapMove(CONNECT4),
    );
  });

  it('plays a legal second mark under the pro rule', () => {
    const pro: GameConfig = { variant: 'gomoku', size: 15, winLength: 5, opening: 'pro' };
    const game = replay(pro, X, [centreOf(15), centreOf(15) + 1])!;
    const move = findBestMove(game, { difficulty: 'hard', random: seeded(8), timeBudgetMs: 60 });
    expect(legalMoves(game)).toContain(move);
  });
});

describe('wild bot', () => {
  it('finds the first player’s forced win on 3x3', () => {
    const result = chooseMove(createGame(WILD, X), { difficulty: 'master', random: seeded(9) })!;
    expect(result.score).toBeGreaterThan(900_000);
  });

  it('never loses to random play as the opener', () => {
    const random = seeded(10);
    for (let round = 0; round < 6; round++) {
      let game = createGame(WILD, X);
      while (game.status === 'playing') {
        const legal = legalMoves(game);
        const move =
          game.currentPlayer === X
            ? findBestMove(game, { difficulty: 'master', random })!
            : legal[Math.floor(random() * legal.length)]!;
        game = applyMove(game, move)!;
      }
      expect(game.winner).toBe(X);
    }
  });

  it('takes a win with either mark, and never leaves two alike', () => {
    const win = replay(WILD, X, [markMove(WILD, 0, O), markMove(WILD, 8, X)])!;
    // X's seat to move: O at 0, X at 8. Nothing wins yet; a single mark must
    // not make two-alike-with-a-gap for the opponent.
    const move = findBestMove(win, { difficulty: 'easy', random: seeded(11) })!;
    const after = applyMove(win, move)!;
    const replies = legalMoves(after).map((reply) => applyMove(after, reply)!);
    expect(replies.some((reply) => reply.status === 'won')).toBe(false);

    const ready = replay(WILD, X, [markMove(WILD, 0, O), markMove(WILD, 1, O)])!;
    expect(findBestMove(ready, { difficulty: 'beginner', random: seeded(12) })).toBe(
      markMove(WILD, 2, O),
    );
  });

  it('plays 4x4 within its budget', () => {
    const now = tickingClock();
    const result = chooseMove(createGame(WILD_4, X), {
      difficulty: 'master',
      random: seeded(13),
      now,
      timeBudgetMs: 200,
    })!;
    expect(legalMoves(createGame(WILD_4, X))).toContain(result.move);
  });
});

describe('order and chaos bot', () => {
  it('completes five alike as Order', () => {
    const game = position(ORDER_CHAOS, X, 'OOOO..', 'X.....', '.X....');
    expect(findBestMove(game, { difficulty: 'beginner', random: seeded(14) })).toBe(
      markMove(ORDER_CHAOS, 4, O),
    );
  });

  it('spoils four alike with the other mark as Chaos', () => {
    const game = position(ORDER_CHAOS, O, 'XXXX..', '.O....', '..O...');
    const move = findBestMove(game, { difficulty: 'medium', random: seeded(15) })!;
    // Square 4 must be spoiled with an O - an X there would hand Order the game.
    expect(move).toBe(markMove(ORDER_CHAOS, 4, O));
  });

  it('never completes a line itself as Chaos while it has a choice', () => {
    const random = seeded(16);
    for (let round = 0; round < 3; round++) {
      let game = createGame(ORDER_CHAOS, X);
      while (game.status === 'playing') {
        const legal = legalMoves(game);
        const chaos = game.currentPlayer === O;
        const move = chaos
          ? findBestMove(game, { difficulty: 'hard', random, timeBudgetMs: 30 })!
          : legal[Math.floor(random() * legal.length)]!;
        const next = applyMove(game, move)!;
        if (chaos && next.status === 'won' && next.winner === X) {
          // Only acceptable if every move would have done it.
          const all = legal.map((option) => applyMove(game, option)!);
          expect(all.every((option) => option.winner === X)).toBe(true);
        }
        game = next;
      }
    }
  });
});

describe('powers bot', () => {
  it('bombs the middle of an open four it cannot otherwise stop', () => {
    // O has .OOOO. on row 4 with both ends open; X to move.
    const game = position(
      POWERS,
      X,
      blank(9),
      blank(9),
      '.X.X.....',
      blank(9),
      '..OOOO...',
      blank(9),
      '.X.......',
    );
    const tactic = powerTactic(game, 'medium');
    expect(tactic?.reason).toBe('block');
    const target = tactic!.move - 81;
    expect([38, 39, 40, 41]).toContain(target);
    expect(findBestMove(game, { difficulty: 'hard', random: seeded(17) })).toBe(tactic!.move);
  });

  it('places a mark when a mark is enough', () => {
    const game = position(POWERS, X, blank(9), blank(9), blank(9), blank(9), '..OOO....');
    expect(powerTactic(game, 'hard')).toBeNull();
    expect(findBestMove(game, { difficulty: 'hard', random: seeded(18) })).toBeLessThan(81);
  });

  it('spends nothing it does not have', () => {
    const game = replay(POWERS, X, [40, 41, powerMove(POWERS, 41, 'bomb'), 30])!;
    // X has spent the bomb; whatever O threatens, X cannot bomb again.
    const threatened = { ...game, board: game.board.slice() };
    for (const cell of [37, 38, 39]) threatened.board[cell] = O;
    expect(powerTactic(threatened, 'hard')).toBeNull();
  });
});
