import {
  applyMove,
  type GameState,
  legalMoves,
  type Player,
  vanishWinningMoves,
} from '@/game/engine';

/**
 * Squares where `player` would win with their next mark.
 *
 * For the side to move, its winning moves; for the side waiting, the same
 * question asked with the turn handed over. Vanish asks its own helper,
 * because who moves decides which mark lifts first. Misère is left out: a
 * completed line loses there, so "a square that completes a line" is a
 * square to avoid, not a threat.
 */
export function winsFor(game: GameState, player: Player): number {
  if (game.status !== 'playing') return 0;
  const { variant } = game.config;
  if (variant === 'misere') return 0;
  try {
    if (variant === 'vanish') return vanishWinningMoves(game, player).length;
    const probe = player === game.currentPlayer ? game : { ...game, currentPlayer: player };
    let wins = 0;
    for (const move of legalMoves(probe)) {
      const next = applyMove(probe, move);
      if (next?.status === 'won' && next.winner === player) wins++;
    }
    return wins;
  } catch {
    // A variant whose state does not survive the turn being handed over has
    // nothing to say here; silence beats a crash.
    return 0;
  }
}
