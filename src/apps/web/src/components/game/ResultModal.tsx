import { type GameState, type Player, X } from '@dooz/engine';
import { type ReactNode, useEffect, useRef } from 'react';
import { HappyFace, NeutralFace, SadFace } from '@/components/art/faces';
import { Mark } from '@/components/art/marks';
import { cx } from '@/lib/cx';
import { GameControls } from './GameControls';

interface ResultModalProps {
  title: string;
  art: ReactNode;
  onRestart: () => void;
  restartLabel?: string;
  restartDisabled?: boolean;
  /** Extra line under the title — a rematch prompt, say. */
  note?: ReactNode;
}

/**
 * The end-of-game panel.
 *
 * There is deliberately no dismiss affordance: the two ways out of a finished
 * game are to play again or to go home, and both are in the panel.
 */
export function ResultModal({
  title,
  art,
  onRestart,
  restartLabel,
  restartDisabled,
  note,
}: ResultModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Move focus into the panel so the keyboard lands on the actions rather
    // than staying on the board behind it.
    panelRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5"
      style={{ animation: 'dooz-fade 0.25s ease-out both' }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(
          'w-full max-w-78 rounded-[3.5rem] border border-b8 p-2 outline-none',
          'animate-pop',
        )}
      >
        <div className="flex flex-col items-center gap-4 rounded-[3.125rem] bg-raised px-6 py-10">
          <div className="text-[5rem] leading-none">{art}</div>

          <h2 className="text-center font-display text-2xl text-g8">{title}</h2>
          {note ? <p className="-mt-2 text-center text-sm text-g8/80">{note}</p> : null}

          <div className="pt-2">
            <GameControls
              onRestart={onRestart}
              tone="solid"
              restartLabel={restartLabel}
              restartDisabled={restartDisabled}
            />
          </div>
        </div>
      </div>

      <style>{`@keyframes dooz-fade { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </div>
  );
}

/** The face shown for a game played against the bot. */
export function outcomeFace(outcome: 'win' | 'loss' | 'draw') {
  if (outcome === 'win') return <HappyFace />;
  if (outcome === 'loss') return <SadFace />;
  return <NeutralFace />;
}

/** The winner's mark, shown for two-human games. A draw has no mark. */
export function outcomeMark(winner: Player | null) {
  if (!winner) return <NeutralFace />;
  return (
    <Mark
      player={winner}
      hole="var(--color-raised)"
      className={cx('size-20', winner === X && 'p-0.5')}
    />
  );
}

/** Whether a finished game was a win, a loss, or a draw for `you`. */
export function outcomeFor(game: GameState, you: Player): 'win' | 'loss' | 'draw' {
  if (game.status !== 'won' || game.winner === null) return 'draw';
  return game.winner === you ? 'win' : 'loss';
}
