import {
  applyMove,
  createGame,
  findBestMove,
  type GameConfig,
  legalMoves,
  modeById,
  O,
  type Player,
  profileFor,
  X,
} from '@/game/engine';
import { seeded } from '@/game/engine/testing';
import { describe, expect, it } from 'vitest';
import { type Rival, RIVALS } from './rivals';
import { STAGES, stageStyle } from './stages';

/**
 * The rivals as the journey plays them: a level with a style on top.
 *
 * A style must never cost a level its guarantees or its place on the ladder,
 * so the same checks the engine makes of the bare levels are made here of the
 * styled ones - with each rival's own style, the way a stage runs it.
 */

const SLOW = 120_000;
const GRID_6 = modeById('grid-6').config;

/** Budgets a twentieth of the real ones, as the engine's own strength tests use. */
function budgetFor(rival: Rival): number {
  return Math.max(8, Math.round(profileFor(rival.difficulty).timeMs * 0.05));
}

function playMatch(
  config: GameConfig,
  seats: Record<'X' | 'O', Rival>,
  random: () => number,
): Player | null {
  let game = createGame(config, X);
  // Two random plies, or a duel of two deterministic bots is one game replayed.
  for (let ply = 0; ply < 2; ply++) {
    const moves = legalMoves(game);
    game = applyMove(game, moves[Math.floor(random() * moves.length)]!)!;
  }
  let guard = 0;
  while (game.status === 'playing' && guard++ < 400) {
    const rival = seats[game.currentPlayer === X ? 'X' : 'O'];
    const move = findBestMove(game, {
      difficulty: rival.difficulty,
      style: rival.style,
      random,
      timeBudgetMs: budgetFor(rival),
    });
    if (move === null) break;
    game = applyMove(game, move)!;
  }
  return game.winner;
}

function duel(strong: Rival, weak: Rival, games: number): number {
  const random = seeded(2024);
  let score = 0;
  for (let round = 0; round < games; round++) {
    const strongPlays: Player = round % 2 === 0 ? X : O;
    const seats = strongPlays === X ? { X: strong, O: weak } : { X: weak, O: strong };
    const winner = playMatch(GRID_6, seats, random);
    if (winner === strongPlays) score += 1;
    else if (winner === null) score += 0.5;
  }
  return score / games;
}

describe('rivals', () => {
  it('each have a style and a signature of their own', () => {
    expect(new Set(RIVALS.map((rival) => JSON.stringify(rival.style))).size).toBe(RIVALS.length);
    for (const rival of RIVALS) {
      expect(rival.signature.name).toBeTruthy();
      // Crosses into the bot worker by structured clone.
      expect(structuredClone(rival.style)).toEqual(rival.style);
    }
    for (const stage of STAGES)
      expect(structuredClone(stageStyle(stage))).toEqual(stageStyle(stage));
  });

  it.each(RIVALS.map((rival) => [rival.name, rival] as const))(
    '%s takes a win and blocks a loss, style or no style',
    (_name, rival) => {
      // X holds 18-19-20 on the left edge of a 6x6 board: 21 ends it.
      let blocks = createGame(GRID_6, X);
      for (const move of [18, 0, 19, 1, 20]) blocks = applyMove(blocks, move)!;
      const wins = applyMove(blocks, 2)!;
      const options = { difficulty: rival.difficulty, style: rival.style, timeBudgetMs: 20 };
      for (let seed = 0; seed < 6; seed++) {
        expect(findBestMove(blocks, { ...options, random: seeded(seed) })).toBe(21);
        expect(findBestMove(wins, { ...options, random: seeded(seed) })).toBe(21);
      }
    },
  );

  /** Each rival still beats the one before it - the journey's order is the ladder's. */
  it.each(
    RIVALS.slice(1).map((rival, at) => [rival.name, RIVALS[at]!.name, rival, RIVALS[at]!] as const),
  )(
    '%s beats %s on a 6x6 board',
    (_strong, _weak, strong, weak) => {
      expect(duel(strong, weak, 8)).toBeGreaterThan(0.5);
    },
    SLOW,
  );
});
