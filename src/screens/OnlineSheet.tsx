import { useState } from 'react';
import { LinkIcon, SearchPlayerIcon } from '@/components/art/icons';
import { TrophyIcon, UsersIcon } from '@/components/art/ui-icons';
import { Button } from '@/components/ui/Button';
import { cx } from '@/lib/cx';
import { useClosing } from '@/lib/useClosing';
import { useDialog } from '@/lib/useDialog';

interface OnlineSheetProps {
  onClose: () => void;
  onQuick: (ranked: boolean) => void;
  onHost: () => void;
  onJoin: (code: string) => void;
  onWatch: (code: string) => void;
  rankedAvailable: boolean;
  modeName: string;
}

/**
 * The five ways into an online game.
 *
 * Ranked and casual are separated at the point of choice rather than behind a
 * toggle somewhere, because they are different games socially: one costs you
 * something if you walk away from it and the other does not, and a player
 * should know which they are starting.
 */
export function OnlineSheet({
  onClose,
  onQuick,
  onHost,
  onJoin,
  onWatch,
  rankedAvailable,
  modeName,
}: OnlineSheetProps) {
  const { closing, close } = useClosing(onClose);
  const panelRef = useDialog<HTMLDivElement>(close);
  const [code, setCode] = useState('');
  const ready = code.trim().length === 6;

  return (
    <div
      className={cx(
        'fixed inset-0 z-50 flex items-center justify-center bg-scrim p-5 backdrop-blur-[2px]',
        closing ? 'animate-fade-out' : 'animate-fade-in',
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Play ${modeName} online`}
        tabIndex={-1}
        className={cx(
          'w-full max-w-80 panel-shell rounded-[2rem] border border-stroke p-2 outline-none',
          'shadow-[0_30px_70px_-30px_var(--color-shadow)]',
          closing ? 'animate-panel-out' : 'animate-panel-in',
        )}
      >
        <div className="flex flex-col gap-3 panel-face rounded-[1.5rem] bg-surface px-5 py-6">
          <p className="text-center text-sm text-ink-faint">{modeName}</p>

          <SheetAction
            icon={<TrophyIcon />}
            title="Ranked match"
            body={
              rankedAvailable
                ? 'Counts towards your rating. Matched by skill.'
                : 'This mode has no ladder — try a standard board.'
            }
            disabled={!rankedAvailable}
            onClick={() => onQuick(true)}
          />

          <SheetAction
            icon={<SearchPlayerIcon />}
            title="Casual match"
            body="Play a stranger. Nothing at stake."
            onClick={() => onQuick(false)}
          />

          <SheetAction
            icon={<LinkIcon />}
            title="Invite a friend"
            body="Open a private room and share the link."
            onClick={onHost}
          />

          {/* The code gets a row of its own: six spaced-out characters need
              the width, and squeezed beside two buttons it showed four. */}
          <form
            className="grid grid-cols-2 gap-2 pt-1"
            onSubmit={(event) => {
              event.preventDefault();
              if (ready) onJoin(code.trim().toUpperCase());
            }}
          >
            <label className="col-span-2 flex flex-col gap-1 text-xs text-ink-faint">
              <span className="px-1">Have a code?</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABC123"
                aria-label="Room code"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className={cx(
                  'h-11 w-full min-w-0 rounded-tile border border-stroke bg-surface/60 px-3',
                  'text-center font-mono tracking-[0.25em] text-ink',
                  'placeholder:font-sans placeholder:tracking-normal placeholder:text-ink-faint',
                  'focus:outline-none focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-stroke)_35%,transparent)]',
                  ready && 'border-mark-x-soft',
                )}
              />
            </label>
            <Button type="submit" size="small" disabled={!ready} block>
              Join
            </Button>
            <Button
              type="button"
              size="small"
              variant="ghost"
              disabled={!ready}
              block
              icon={<UsersIcon />}
              onClick={() => onWatch(code.trim().toUpperCase())}
            >
              Watch
            </Button>
          </form>

          <Button variant="ghost" size="small" onClick={close} className="mt-1 self-center">
            Back
          </Button>
        </div>
      </div>
    </div>
  );
}

function SheetAction({
  icon,
  title,
  body,
  onClick,
  disabled = false,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'group flex items-center gap-3 rounded-2xl border border-stroke-soft px-3 py-3 text-left',
        'transition-[transform,border-color,background-color] duration-200 ease-spring',
        'hover:-translate-y-0.5 hover:border-stroke hover:bg-surface/60 active:scale-[0.98]',
        'disabled:pointer-events-none disabled:opacity-45',
      )}
    >
      <span className="text-xl transition-transform duration-200 ease-spring group-hover:scale-110">
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="text-base font-semibold">{title}</span>
        <span className="text-xs text-ink-faint">{body}</span>
      </span>
    </button>
  );
}
