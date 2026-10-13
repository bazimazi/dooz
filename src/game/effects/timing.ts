/** Seconds a gravity mark takes to fall `rows` squares. Grows like real falling: with the root. */
export function dropTime(rows: number): number {
  return 0.22 + Math.sqrt(rows) * 0.13;
}

/**
 * Seconds until the mark just played at `index` is actually on the board.
 *
 * Under gravity it has to fall first, and it touches down two thirds of the
 * way through the drop animation (the rest is the bounce); everywhere else it
 * lands on the first beat of its entrance.
 */
export function landingDelay(variant: string, index: number, size: number): number {
  if (variant !== 'gravity' && variant !== 'connect4') return 0.12;
  // Connect Four's blocked top row is not drawn, so its discs fall one row less.
  const hidden = variant === 'connect4' ? 1 : 0;
  return dropTime(Math.floor(index / size) + 1 - hidden) * 0.66;
}
