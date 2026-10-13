import {
  applyMove,
  createGame,
  type GameConfig,
  type GameState,
  legalMoves,
  opponentOf,
  type Player,
  winningMoves,
} from '@/game/engine';
import { type Random, seededRandom } from './random';

/**
 * Handicap starts: a few marks already on the board for the weaker side.
 *
 * No rule set lets a player pass, so a head start cannot be extra marks out of
 * turn. It is a replayed opening instead: the side being helped places its
 * marks on strong squares near the centre, the other side's interleaved marks
 * go to the far edges where they do the least, and the game starts from there
 * with the helped side's opponent to move. Built from ordinary legal moves, it
 * works under every rule set, saves and restores like any other position, and
 * a take-back cannot reach into it.
 *
 * The setup never hands over a ready-made win: a square that would leave the
 * helped side a line to complete next move is passed over, so the head start
 * is position, not a free game.
 */

/** The most marks a handicap may place. Beyond three it stops being a game. */
export const MAX_HANDICAP = 3;

export interface Setup {
  /** Who opened the replayed setup. */
  readonly opener: Player;
  /** The moves that build it, oldest first. */
  readonly moves: readonly number[];
}

/** The largest handicap that makes sense on `config`'s board. */
export function maxHandicapFor(config: GameConfig): number {
  if (config.variant === 'vanish') return 1;
  if (config.variant === 'ultimate') return 2;
  return Math.max(1, Math.min(MAX_HANDICAP, Math.floor((config.size * config.size) / 6)));
}

/**
 * The setup for `marks` pre-placed marks for `helped`.
 *
 * Returns an empty setup for zero marks. Deterministic for a given `random`,
 * so a seeded challenge places the same marks for everyone.
 */
export function handicapSetup(
  config: GameConfig,
  marks: number,
  helped: Player,
  random: Random = seededRandom(marks * 7919 + config.size),
): Setup {
  const count = Math.min(Math.max(0, Math.trunc(marks)), maxHandicapFor(config));
  if (count === 0) return { opener: helped, moves: [] };

  let game = createGame(config, helped);
  const moves: number[] = [];
  // helped, other, helped, … helped: the helped side places `count` marks and
  // the other side one fewer, so the other side is to move afterwards.
  for (let ply = 0; ply < count * 2 - 1; ply++) {
    const strong = game.currentPlayer === helped;
    const move = chooseSetupMove(game, helped, strong, random);
    if (move === null) break;
    const next = applyMove(game, move);
    if (!next || next.status !== 'playing') break;
    game = next;
    moves.push(move);
  }
  // A setup cut short must still end with the other side to move.
  if (moves.length % 2 === 0 && moves.length > 0) moves.pop();
  return { opener: helped, moves };
}

function chooseSetupMove(
  game: GameState,
  helped: Player,
  strong: boolean,
  random: Random,
): number | null {
  const { size } = game.config;
  const cells = size * size;
  // Only real squares: an opening rule's extra codes (the pie-rule swap) are
  // not placements.
  const options = legalMoves(game).filter((move) => move < cells);
  if (options.length === 0) return null;

  const scored = options
    .map((move) => {
      const next = applyMove(game, move);
      if (!next || next.status !== 'playing') return null;
      if (strong && handsOverAWin(next, helped)) return null;
      const centre = centreDistance(size, move);
      const near = nearestMark(next, move, helped);
      // Strong marks hug the centre and each other; weak ones keep away from
      // both. A little noise so two setups on one board are not identical.
      const score = strong ? -centre * 2 - near * 0.5 : centre * 2 + near;
      return { move, score: score + random() * 0.9 };
    })
    .filter((entry): entry is { move: number; score: number } => entry !== null);

  if (scored.length === 0) return null;
  return scored.reduce((best, entry) => (entry.score > best.score ? entry : best)).move;
}

/** Whether the helped side could complete a line on its next move. */
function handsOverAWin(game: GameState, helped: Player): boolean {
  const { size, winLength, exact } = game.config;
  if (game.config.variant === 'ultimate' || game.config.variant === 'misere') return false;
  const candidates = legalMoves(game).filter((move) => move < size * size);
  return (
    winningMoves(game.board, size, helped, winLength, candidates, 1, exact ?? false).length > 0
  );
}

function centreDistance(size: number, cell: number): number {
  const mid = (size - 1) / 2;
  const row = Math.floor(cell / size);
  const col = cell % size;
  return Math.max(Math.abs(row - mid), Math.abs(col - mid));
}

/** King-move distance from `cell` to the helped side's nearest other mark, capped. */
function nearestMark(game: GameState, cell: number, helped: Player): number {
  const { size } = game.config;
  let nearest = size;
  game.board.forEach((owner, at) => {
    if (owner !== helped || at === cell) return;
    const distance = Math.max(
      Math.abs(Math.floor(at / size) - Math.floor(cell / size)),
      Math.abs((at % size) - (cell % size)),
    );
    nearest = Math.min(nearest, distance);
  });
  return nearest;
}

/** The side a setup leaves to move: the helped side's opponent, or the opener if empty. */
export function sideToMoveAfter(setup: Setup): Player {
  return setup.moves.length === 0 ? setup.opener : opponentOf(setup.opener);
}
