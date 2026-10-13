import { describe, expect, it } from 'vitest';
import { applyMove, createGame } from '../game.js';
import { modeById } from '../modes.js';
import { seeded } from '../testing.js';
import { O, X } from '../types.js';
import { BOT_DIFFICULTIES, chooseMove, findBestMove } from './index.js';
import { type BotStyle, styleAppeal } from './style.js';

const CLASSIC = modeById('classic').config;
const GRID_6 = modeById('grid-6').config;
const GOMOKU_15 = modeById('gomoku-15').config;

/** A clock that ticks once per read, so a budget is a fixed amount of work. */
function tickingClock(): () => number {
  let time = 0;
  return () => time++;
}

describe('bot style', () => {
  it('changes nothing when it asks for nothing', () => {
    const game = applyMove(applyMove(createGame(GRID_6, X), 14)!, 15)!;
    for (const difficulty of BOT_DIFFICULTIES) {
      const plain = findBestMove(game, {
        difficulty,
        random: seeded(3),
        timeBudgetMs: 10,
        now: tickingClock(),
      });
      const empty = findBestMove(game, {
        difficulty,
        random: seeded(3),
        timeBudgetMs: 10,
        now: tickingClock(),
        style: { tempo: 2 },
      });
      expect(empty).toBe(plain);
    }
  });

  it('opens from its book on an empty board', () => {
    const style: BotStyle = { book: { 'gomoku:15:5': [96], 'classic:3:3': [0] } };
    expect(chooseMove(createGame(GOMOKU_15, X), { difficulty: 'master', style })).toMatchObject({
      move: 96,
      reason: 'book',
    });
    // 3x3 is solved, so the book only wins the tie between equally drawn moves.
    expect(findBestMove(createGame(CLASSIC, X), { difficulty: 'master', style })).toBe(0);
  });

  it('never plays a book move that loses a solved game', () => {
    // Answering a corner with an edge loses 3x3; only the centre holds.
    const corner = applyMove(createGame(CLASSIC, X), 0)!;
    const style: BotStyle = { book: { 'classic:3:3': [1, 3, 5, 7] } };
    for (const difficulty of ['hard', 'expert', 'master'] as const) {
      expect(findBestMove(corner, { difficulty, style, random: seeded(1) })).toBe(4);
    }
  });

  it('copies a move through the centre as a copycat beginner', () => {
    const game = applyMove(createGame(GRID_6, X), 7)!;
    const chosen = chooseMove(game, {
      difficulty: 'beginner',
      random: seeded(2),
      style: { mirror: 1 },
    });
    expect(chosen).toMatchObject({ move: 35 - 7, reason: 'style' });
  });

  it('still takes a win and blocks a loss, whatever it leans towards', () => {
    const styles: BotStyle[] = [
      { defence: 3, attack: 0.2 },
      { attack: 3, defence: 0.2 },
      { traps: 4, centre: -2 },
      { mirror: 1, centre: -3 },
    ];
    // X holds 18-19-20 on the left edge, so 21 is the only square that ends it.
    let blocks = createGame(GRID_6, X);
    for (const move of [18, 0, 19, 1, 20]) blocks = applyMove(blocks, move)!;
    // The same with O's third mark down: O threatens 3, but X simply wins.
    const wins = applyMove(blocks, 2)!;
    for (const style of styles) {
      for (const difficulty of BOT_DIFFICULTIES) {
        const options = { difficulty, style, random: seeded(5), timeBudgetMs: 10 };
        expect(findBestMove(blocks, options)).toBe(21);
        expect(findBestMove(wins, options)).toBe(21);
      }
    }
  });

  it('weighs building and blocking by its leanings', () => {
    let game = createGame(GRID_6, X);
    for (const move of [14, 21, 15]) game = applyMove(game, move)!;
    const blocker: BotStyle = { defence: 3, attack: 0.5 };
    const builder: BotStyle = { attack: 3, defence: 0.5 };
    // 16 extends X's pair - a block; 28 extends O's own mark - a build.
    const appeal = (style: BotStyle, move: number) =>
      styleAppeal(game.board, game.config, move, O, style);
    expect(appeal(blocker, 16) - appeal(blocker, 28)).toBeGreaterThan(
      appeal(builder, 16) - appeal(builder, 28),
    );
  });

  it('is plain data, so it survives the trip into the worker', () => {
    const style: BotStyle = { attack: 1.5, book: { 'classic:3:3': [4] }, tempo: 1.2 };
    expect(structuredClone(style)).toEqual(style);
  });
});
