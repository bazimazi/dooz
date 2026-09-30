import { type GameState, VANISH_MOVE_LIMIT } from '@dooz/engine';
import { ClockIcon } from '@/components/art/ui-icons';
import { cx } from '@/lib/cx';

/**
 * The one extra fact a rule set needs said out loud under the board.
 *
 * Only vanish has one today: its games end in a draw at the move limit rather
 * than on a full board, and a limit nobody can see is a draw nobody saw
 * coming. It turns to a warning in the last ten moves.
 */
export function VariantStatus({ game }: { game: GameState }) {
  if (game.config.variant !== 'vanish' || game.status !== 'playing') return null;

  const left = VANISH_MOVE_LIMIT - game.moves.length;
  const close = left <= 10;
  return (
    <p
      className={cx(
        'tnum flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs',
        'transition-colors duration-300',
        close ? 'animate-pulse-soft border-warn text-warn' : 'border-stroke-soft text-ink-faint',
      )}
      aria-live={close ? 'polite' : 'off'}
    >
      <ClockIcon className="size-3.5" />
      {left === 1 ? 'Last move before a draw' : `${left} moves until a draw`}
    </p>
  );
}
