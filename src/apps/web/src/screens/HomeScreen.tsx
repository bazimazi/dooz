import type { BoardSize } from '@dooz/engine';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { BotIcon, FriendsIcon, LinkIcon, SearchPlayerIcon } from '@/components/art/icons';
import { Logo } from '@/components/art/Logo';
import { BoardSizeCarousel } from '@/components/game/BoardSizeCarousel';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { BackIcon, HomeIcon } from '@/components/art/icons';
import { loadPreferences, savePreferences } from '@/lib/preferences';

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
        <Logo className="mt-2 h-40 w-auto shrink-0" />

        <BoardSizeCarousel value={boardSize} onChange={chooseSize} />

        <nav className="flex w-full flex-col items-center gap-4 pb-2">
          <Button
            variant="primary"
            onClick={() => void navigate({ to: '/play/local', search: { size: boardSize } })}
          >
            Play Now!
          </Button>
          <Button
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
          <Button icon={<FriendsIcon />} onClick={() => setFriendsOpen(true)}>
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
 */
function FriendsSheet({ onClose, onQuickMatch, onHost }: FriendsSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Play with friends"
        className="w-full max-w-78 animate-pop rounded-[3rem] border border-b8 p-2"
      >
        <div className="flex flex-col items-center gap-6 rounded-[2.75rem] bg-raised px-6 py-9">
          <button
            type="button"
            onClick={onQuickMatch}
            className="flex items-center gap-3 text-2xl transition-transform active:scale-95"
          >
            <SearchPlayerIcon className="size-7" />
            find opponent
          </button>

          <button
            type="button"
            onClick={onHost}
            className="flex items-center gap-3 text-2xl transition-transform active:scale-95"
          >
            <LinkIcon className="size-7" />
            invite via link
          </button>

          <div className="flex items-center gap-4 pt-2">
            <IconButton tone="solid" label="Back" onClick={onClose}>
              <BackIcon />
            </IconButton>
            <IconButton tone="solid" label="Back to home" onClick={onClose}>
              <HomeIcon />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
}
