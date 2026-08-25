import { type GameState, type Player, X } from '@dooz/engine';
import { type ReactNode, useEffect, useRef } from 'react';
import { Confetti } from '@/components/art/Confetti';
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
  /** Fires the confetti. Set only when the person at this device won. */
  celebrate?: boolean;
}

/**
 * The end-of-game panel.
 *
 * There is deliberately no dismiss affordance: the two ways out of a finished
 * game are to play again or to go home, and both are in the panel.
 *
 * It arrives in pieces — dim, then panel, then the face, the verdict and the
 * buttons — because the result is the one moment in the game worth pausing on.
 * The whole sequence is under half a second, so it never delays a rematch.
 */
export function ResultModal({
  title,
  art,
  onRestart,
  restartLabel,
  restartDisabled,
  note,
  celebrate = false,
}: ResultModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Move focus into the panel so the keyboard lands on the actions rather
    // than staying on the board behind it.
    panelRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-5 backdrop-blur-[2px]">
      {celebrate ? <Confetti /> : null}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(
          'relative w-full max-w-78 animate-panel-in rounded-[3.5rem] border border-b8 p-2 outline-none',
          'shadow-[0_30px_70px_-30px_rgb(0_0_0/0.9)]',
        )}
        style={{ animationDelay: '0.06s' }}
      >
        <div className="flex flex-col items-center gap-4 rounded-[3.125rem] bg-raised px-6 py-10">
          <div className="animate-pop text-[5rem] leading-none" style={{ animationDelay: '0.22s' }}>
            {/* A slow bob under the one-shot entrance, so the face stays alive
                while the panel waits for a decision. */}
            <span className="block animate-bob">{art}</span>
          </div>

          <h2
            className="animate-rise text-center font-display text-2xl text-g8"
            style={{ animationDelay: '0.34s' }}
          >
            {title}
          </h2>

          {note ? (
            <p
              className="-mt-2 animate-rise text-center text-sm text-g8/80"
              style={{ animationDelay: '0.4s' }}
            >
              {note}
            </p>
          ) : null}

          <div className="animate-rise pt-2" style={{ animationDelay: '0.46s' }}>
            <GameControls
              onRestart={onRestart}
              tone="solid"
              restartLabel={restartLabel}
              restartDisabled={restartDisabled}
            />
          </div>
        </div>
      </div>
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
