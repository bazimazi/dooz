import {
  candidateMoves,
  type GameState,
  legalMoves,
  opponentOf,
  vanishWinningMoves,
  winningMoves,
} from '@dooz/engine';

export interface Hint {
  index: number;
  kind: 'win' | 'threat';
}

/**
 * The squares worth pointing at, for the practice screen.
 *
 * Two things and no more: where the game is won this move, and where it is lost
 * if it is not answered. That is the pair a beginner keeps missing, and it is
 * also the pair that can be computed exactly rather than guessed at - a hint
 * that says "this is probably good" teaches nothing, because the player cannot
 * tell whether it was right.
 *
 * Deliberately not offered in ranked or casual online play. A hint system in a
 * rated game is an engine at the elbow, and the ladder would mean nothing.
 */
export function hintsFor(game: GameState): Hint[] {
  if (game.status !== 'playing') return [];
  const { variant } = game.config;

  // Vanish threats are only real if the marks they lean on stay put, which
  // the engine works out for each side from the marks they are about to lose.
  if (variant === 'vanish') {
    const wins = vanishWinningMoves(game, game.currentPlayer);
    if (wins.length > 0) return wins.map((index) => ({ index, kind: 'win' as const }));
    return vanishWinningMoves(game, opponentOf(game.currentPlayer)).map((index) => ({
      index,
      kind: 'threat' as const,
    }));
  }

  // Misere inverts what a completed line is worth, and Ultimate's threats are
  // at the sub-board level rather than the board's. Neither is served by this,
  // and a wrong hint is worse than none. Gravity is: its legal squares are the
  // landing squares, and a line completed on one is a line like any other.
  if (variant !== 'classic' && variant !== 'gomoku' && variant !== 'gravity') return [];

  const { board, config, currentPlayer } = game;
  const legal = new Set(legalMoves(game));
  const near = candidateMoves(board, config.size, 1).filter((move: number) => legal.has(move));

  const wins = winningMoves(board, config.size, currentPlayer, config.winLength, near);
  if (wins.length > 0) return wins.map((index: number) => ({ index, kind: 'win' as const }));

  const threats = winningMoves(
    board,
    config.size,
    opponentOf(currentPlayer),
    config.winLength,
    near,
  );
  return threats.map((index: number) => ({ index, kind: 'threat' as const }));
}
