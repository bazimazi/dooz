import type { BoardSize } from '@dooz/engine';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  BackIcon,
  BotIcon,
  FriendsIcon,
  HomeIcon,
  LinkIcon,
  SearchPlayerIcon,
} from '@/components/art/icons';
import { Logo } from '@/components/art/Logo';
import { BoardSizeCarousel } from '@/components/game/BoardSizeCarousel';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { cx } from '@/lib/cx';
import { loadPreferences, savePreferences } from '@/lib/preferences';
import { useClosing } from '@/lib/useClosing';

export function HomeScreen() {
  const navigate = useNavigate();
  const [boardSize, setBoardSize] = useState<BoardSize>(() => loadPreferences().boardSize);
  const [friendsOpen, setFriendsOpen] = useState(false);

  function chooseSize(size: BoardSize) {
    setBoardSize(size);
    savePreferences({ boardSize: size });
  }

  return (
    <Screen backdrop="home">
      <div className="flex w-full flex-1 flex-col items-center justify-between gap-4 py-2">
        {/* The wordmark animates its own parts, so it is left out of the
            stagger below and only the block it sits in is timed. */}
        <Logo className="mt-2 h-40 w-auto shrink-0" />

        <div className="w-full animate-rise" style={{ animationDelay: '0.5s' }}>
          <BoardSizeCarousel value={boardSize} onChange={chooseSize} />
        </div>

        {/* The three actions come in last and one at a time, after the
            wordmark has finished assembling itself. */}
        <nav className="flex w-full flex-col items-center gap-4 pb-2">
          <Button
            className="animate-rise"
            style={{ animationDelay: '0.6s' }}
            variant="primary"
            onClick={() => void navigate({ to: '/play/local', search: { size: boardSize } })}
          >
            Play Now!
          </Button>
          <Button
            className="animate-rise"
            style={{ animationDelay: '0.68s' }}
            icon={<BotIcon />}
            onClick={() =>
              void navigate({
                to: '/play/bot',
                search: { size: boardSize, difficulty: loadPreferences().difficulty },
              })
            }
          >
            Play with bot
          </Button>
          <Button
            className="animate-rise"
            style={{ animationDelay: '0.76s' }}
            icon={<FriendsIcon />}
            onClick={() => setFriendsOpen(true)}
          >
            Play with friends
          </Button>
        </nav>
      </div>

      {friendsOpen ? (
        <FriendsSheet
          onClose={() => setFriendsOpen(false)}
          onQuickMatch={() => void navigate({ to: '/play/online', search: { size: boardSize } })}
          onHost={() =>
            void navigate({ to: '/play/online', search: { size: boardSize, host: true } })
          }
        />
      ) : null}
    </Screen>
  );
}

interface FriendsSheetProps {
  onClose: () => void;
  onQuickMatch: () => void;
  onHost: () => void;
}

/**
 * The overlay behind "Play with friends": be matched with whoever is waiting,
 * or open a private room and send the link.
 *
 * It animates out as well as in. `useClosing` holds the unmount back for the
 * length of the exit, so dismissing it is a movement rather than a cut — which
 * matters more here than on the result panel, since this is the one overlay a
 * player can back out of.
 */
function FriendsSheet({ onClose, onQuickMatch, onHost }: FriendsSheetProps) {
  const { closing, close } = useClosing(onClose);

  return (
    <div
      className={cx(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5 backdrop-blur-[2px]',
        closing ? 'animate-fade-out' : 'animate-fade-in',
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Play with friends"
        className={cx(
          'w-full max-w-78 rounded-[3rem] border border-b8 p-2',
          'shadow-[0_30px_70px_-30px_rgb(0_0_0/0.9)]',
          closing ? 'animate-panel-out' : 'animate-panel-in',
        )}
      >
        <div className="flex flex-col items-center gap-6 rounded-[2.75rem] bg-raised px-6 py-9">
          <SheetAction icon={<SearchPlayerIcon className="size-7" />} onClick={onQuickMatch}>
            find opponent
          </SheetAction>

          <SheetAction icon={<LinkIcon className="size-7" />} onClick={onHost}>
            invite via link
          </SheetAction>

          <div className="flex items-center gap-4 pt-2">
            <IconButton tone="solid" label="Back" onClick={close}>
              <BackIcon />
            </IconButton>
            <IconButton tone="solid" label="Back to home" onClick={close}>
              <HomeIcon />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function SheetAction({
  icon,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'group flex items-center gap-3 rounded-2xl px-3 py-1 text-2xl',
        'transition-[transform,color] duration-200 ease-spring',
        'hover:translate-x-1 hover:text-g9 active:scale-95 active:duration-75',
      )}
    >
      <span className="transition-transform duration-200 ease-spring group-hover:scale-115">
        {icon}
      </span>
      {children}
    </button>
  );
}
