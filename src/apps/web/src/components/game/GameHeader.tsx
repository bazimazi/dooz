import { type GameState, describeConfig, O, X } from '@dooz/engine';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { PlayerCard, type SeatInfo } from './PlayerCard';

interface GameHeaderProps {
  game: GameState;
  /** The X seat, always drawn on the left. */
  left: SeatInfo;
  /** The O seat, always drawn on the right. */
  right: SeatInfo;
  /** Replaces the mode label - the mode picker, on the screens that have one. */
  centre?: ReactNode;
  /** A word under the mode name: "Ranked", "Practice", "Watching". */
  badge?: string;
}

export function GameHeader({ game, left, right, centre, badge }: GameHeaderProps) {
  const playing = game.status === 'playing';

  return (
    <header className="flex w-full items-start justify-center gap-2.5 pt-4">
      <PlayerCard {...left} player={X} active={playing && game.currentPlayer === X} />

      <div className="flex w-[5.5rem] shrink-0 flex-col items-center gap-1 self-start pt-3">
        {centre ?? (
          <span className="text-center text-sm leading-tight text-ink-muted">
            {describeConfig(game.config)}
          </span>
        )}
        {badge ? (
          <span
            className={cx(
              'rounded-full border border-stroke-soft px-2 py-0.5',
              'text-[0.6875rem] tracking-wide text-ink-muted uppercase',
            )}
          >
            {badge}
          </span>
        ) : null}
      </div>

      <PlayerCard {...right} player={O} active={playing && game.currentPlayer === O} />
    </header>
  );
}
