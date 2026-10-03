import { type GameState, VANISH_MOVE_LIMIT } from '@dooz/engine';
import { ClockIcon } from '@/components/art/ui-icons';
import { cx } from '@/lib/cx';

/**
 * The one extra fact a rule set needs said out loud under the board.
 *
 * Keep the variant's unusual rule next to the board where it can be used.
 * Vanish also warns before its move limit ends the round.
 */
export function VariantStatus({ game }: { game: GameState }) {
  if (game.status !== 'playing') return null;

  if (game.config.variant === 'misere') {
    return (
      <p className="text-center text-xs text-ink-muted">
        Avoid three in a row — making a line loses.
      </p>
    );
  }
  if (game.config.variant === 'gravity') {
    return (
      <p className="text-center text-xs text-ink-muted">Choose a column · Four in a row wins.</p>
    );
  }
  if (game.ultimate) {
    const active = game.ultimate.activeBoard;
    return (
      <p className="text-center text-xs text-ink-muted" aria-live="polite">
        {active === null
          ? 'Choose any unfinished small board.'
          : `Play in the highlighted small board (${active + 1}).`}{' '}
        Win three small boards in a row.
      </p>
    );
  }
  if (game.config.variant !== 'vanish') return null;

  const left = VANISH_MOVE_LIMIT - game.moves.length;
  const close = left <= 10;
  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-center text-xs text-ink-muted">
        Keep three marks · The dashed mark vanishes on your next move.
      </p>
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
    </div>
  );
}
