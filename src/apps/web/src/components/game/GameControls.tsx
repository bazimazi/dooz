import { Link } from '@tanstack/react-router';
import { HomeIcon, RefreshIcon } from '@/components/art/icons';
import { IconButton } from '@/components/ui/IconButton';

interface GameControlsProps {
  onRestart: () => void;
  /** `solid` for use inside the result modal, where the surface is lighter. */
  tone?: 'glass' | 'solid';
  restartLabel?: string;
  restartDisabled?: boolean;
}

/** The restart and home pair that appears under the board and in the modal. */
export function GameControls({
  onRestart,
  tone = 'glass',
  restartLabel = 'Play again',
  restartDisabled = false,
}: GameControlsProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <IconButton tone={tone} label={restartLabel} onClick={onRestart} disabled={restartDisabled}>
        <RefreshIcon />
      </IconButton>
      <IconButton as={Link} to="/" tone={tone} label="Back to home">
        <HomeIcon />
      </IconButton>
    </div>
  );
}
