import {
  BOT_DIFFICULTIES,
  type BotDifficulty,
  findBestMove,
  profileFor,
} from '../src/bot/index.js';
import { applyMove, createGame, legalMoves } from '../src/game.js';
import { GAME_MODES, modeById } from '../src/modes.js';
import { seeded } from '../src/testing.js';
import { type GameConfig, O, type Player, X } from '../src/types.js';

/**
 * The AI strength ladder, at the budgets the game actually uses.
 *
 * Run with `npm run bench --workspace @dooz/engine`. The test suite runs the
 * same duels at a fraction of the time so it stays quick; this is the version
 * to look at when changing the evaluation or the profiles.
 */

const scale = Number(process.env['BENCH_SCALE'] ?? 1);
const games = Number(process.env['BENCH_GAMES'] ?? 10);
const modes = (process.env['BENCH_MODES'] ?? 'classic,grid-6,grid-9,ultimate').split(',');

function budget(difficulty: BotDifficulty): number {
  return Math.max(8, Math.round(profileFor(difficulty).timeMs * scale));
}

/**
 * Both bots are deterministic from the top level down, so an unvaried start
 * plays the same two games over and over and a "6-0" means one game won twice
 * by colour. Each round therefore opens with a couple of random plies, which is
 * how engine ladders are run for exactly this reason.
 */
const OPENING_PLIES = Number(process.env['BENCH_OPENING'] ?? 2);

function play(config: GameConfig, levels: Record<'X' | 'O', BotDifficulty>, random: () => number) {
  let game = createGame(config, X);
  for (let ply = 0; ply < OPENING_PLIES && game.status === 'playing'; ply++) {
    const moves = legalMoves(game);
    const pick = moves[Math.floor(random() * moves.length)] ?? 0;
    game = applyMove(game, pick)!;
  }
  let guard = 0;
  while (game.status === 'playing' && guard++ < 400) {
    const difficulty = levels[game.currentPlayer === X ? 'X' : 'O'];
    const move = findBestMove(game, { difficulty, random, timeBudgetMs: budget(difficulty) });
    if (move === null) break;
    game = applyMove(game, move)!;
  }
  return game.winner;
}

function duel(config: GameConfig, strong: BotDifficulty, weak: BotDifficulty) {
  const random = seeded(2024);
  let wins = 0;
  let draws = 0;
  let losses = 0;
  for (let round = 0; round < games; round++) {
    const strongPlays: Player = round % 2 === 0 ? X : O;
    const levels: Record<'X' | 'O', BotDifficulty> =
      strongPlays === X ? { X: strong, O: weak } : { X: weak, O: strong };
    const winner = play(config, levels, random);
    if (winner === strongPlays) wins++;
    else if (winner === null) draws++;
    else losses++;
  }
  return { wins, draws, losses, score: (wins + draws / 2) / games };
}

for (const id of modes) {
  const mode = GAME_MODES.find((entry) => entry.id === id) ?? modeById('classic');
  console.log(
    `\n=== ${mode.name} (${mode.config.size}x${mode.config.size}, ${mode.config.winLength} in a row) ===`,
  );
  for (let i = 1; i < BOT_DIFFICULTIES.length; i++) {
    const strong = BOT_DIFFICULTIES[i];
    const weak = BOT_DIFFICULTIES[i - 1];
    const started = Date.now();
    const r = duel(mode.config, strong, weak);
    console.log(
      `${strong.padEnd(8)} vs ${weak.padEnd(8)} ${r.wins}W ${r.draws}D ${r.losses}L  score=${r.score.toFixed(2)}  (${Date.now() - started}ms)`,
    );
  }
  const spread = duel(mode.config, 'master', 'beginner');
  console.log(
    `master   vs beginner ${spread.wins}W ${spread.draws}D ${spread.losses}L  score=${spread.score.toFixed(2)}`,
  );
}
