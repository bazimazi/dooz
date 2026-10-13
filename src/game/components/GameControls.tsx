import { ReturnLink } from '@/components/ui/ReturnLink';
import { type ReactNode, useState } from 'react';
import { HomeIcon, RefreshIcon } from '@/components/art/icons';
import { UndoIcon } from '@/components/art/ui-icons';
import { IconButton } from '@/components/ui/IconButton';
import { useT } from '@/i18n';
import { gameUiMessages } from '@/i18n/messages/gameUi';

interface GameControlsProps {
  onRestart: () => void;
  /** `solid` for use inside the result modal, where the surface is lighter. */
  tone?: 'glass' | 'solid';
  restartLabel?: string;
  restartDisabled?: boolean;
  /** Offered on the local screens only; an online game cannot take a move back. */
  onUndo?: () => void;
  canUndo?: boolean;
  /** Anything else this screen needs in the row - a hint toggle, say. */
  extra?: ReactNode;
}

/** The restart and home pair that appears under the board and in the modal. */
export function GameControls({
  onRestart,
  tone = 'glass',
  restartLabel,
  restartDisabled = false,
  onUndo,
  canUndo = false,
  extra,
}: GameControlsProps) {
  // Bumped on every restart. Using it as the icon's key remounts the element,
  // which is what lets the same one-shot spin replay on a second press -
  // re-applying a class alone would not restart the animation.
  const [spins, setSpins] = useState(0);
  const t = useT(gameUiMessages);

  return (
    <div className="flex items-center justify-center gap-3">
      {onUndo ? (
        <IconButton tone={tone} label={t('takeBack')} disabled={!canUndo} onClick={onUndo}>
          {/* A step back points the other way in a right-to-left language. */}
          <span className="block rtl:-scale-x-100">
            <UndoIcon />
          </span>
        </IconButton>
      ) : null}

      <IconButton
        tone={tone}
        label={restartLabel ?? t('playAgain')}
        disabled={restartDisabled}
        onClick={() => {
          setSpins((count) => count + 1);
          onRestart();
        }}
      >
        <span key={spins} className={spins > 0 ? 'block animate-spin-once' : 'block'}>
          <RefreshIcon />
        </span>
      </IconButton>

      {extra}

      <IconButton as={ReturnLink} to="/" tone={tone} label={t('backHome')}>
        <span className="block transition-transform duration-200 ease-spring group-hover:-translate-y-0.5">
          <HomeIcon />
        </span>
      </IconButton>
    </div>
  );
}
