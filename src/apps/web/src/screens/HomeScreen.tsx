import { modeById, type ModeId } from '@dooz/engine';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { AvatarBadge } from '@/components/art/avatars';
import {
  BotIcon,
  CheckIcon,
  FriendsIcon,
  LinkIcon,
  SearchPlayerIcon,
} from '@/components/art/icons';
import { Logo } from '@/components/art/Logo';
import {
  BulbIcon,
  ChartIcon,
  SettingsIcon,
  SparkIcon,
  TargetIcon,
  TrophyIcon,
  UsersIcon,
} from '@/components/art/ui-icons';
import { ModePicker } from '@/components/game/ModePicker';
import { StarIcon } from '@/components/game/Stars';
import { MAX_STARS, nextStage } from '@/features/journey/stages';
import {
  dayNumber,
  liveDailyStreak,
  totalStars,
  useProgressStore,
} from '@/features/progress/store';
import { dailyPuzzle } from '@/features/puzzles/puzzles';
import { Button } from '@/components/ui/Button';
import { IconButton, iconButtonClasses } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { useAccountStore } from '@/features/account/store';
import { cx } from '@/lib/cx';
import { loadPreferences, savePreferences } from '@/lib/preferences';
import { useClosing } from '@/lib/useClosing';
import { useDialog } from '@/lib/useDialog';
import { OnboardingSheet } from './OnboardingSheet';
import { SettingsSheet } from './SettingsSheet';

export function HomeScreen() {
  const navigate = useNavigate();
  const initialise = useAccountStore((state) => state.initialise);

  const [mode, setMode] = useState<ModeId>(() => loadPreferences().mode);
  const [onlineOpen, setOnlineOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Shown once, on the very first launch. After that it lives behind the
  // "How to play" link rather than in the way.
  const [tutorialOpen, setTutorialOpen] = useState(() => !loadPreferences().onboarded);

  // The account is created silently on first launch so that by the time anyone
  // presses an online button there is an identity to play with.
  useEffect(() => {
    void initialise();
  }, [initialise]);

  function chooseMode(next: ModeId) {
    setMode(next);
    savePreferences({ mode: next });
  }

  function dismissTutorial() {
    setTutorialOpen(false);
    savePreferences({ onboarded: true });
  }

  return (
    <Screen backdrop="home" scroll>
      <div className="flex w-full flex-1 flex-col items-center gap-4 pb-4">
        <div className="flex w-full items-center justify-between gap-2">
          <Link
            to="/learn"
            search={{ mode }}
            aria-label="How to play"
            title="How to play"
            className={iconButtonClasses({ tone: 'bare', size: 'small' })}
          >
            <BulbIcon />
          </Link>

          {/* The wordmark animates its own parts, so it is left out of the
              stagger below and only the block it sits in is timed. */}
          <Logo className="h-20 w-auto shrink-0" />

          <IconButton
            tone="bare"
            size="small"
            label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon />
          </IconButton>
        </div>

        {/* The three ways to start, above the mode list: whatever the player
            came here to do, the button that does it is on screen without a
            scroll. The chosen mode is named on it so the pairing is obvious. */}
        <nav className="flex w-full flex-col items-center gap-2.5">
          <Button
            className="animate-rise"
            style={{ animationDelay: '0.2s' }}
            variant="primary"
            block
            onClick={() => void navigate({ to: '/play/local', search: { mode } })}
          >
            Play Now!
          </Button>

          <div className="grid w-full grid-cols-2 gap-2.5">
            <Button
              className="animate-rise"
              style={{ animationDelay: '0.26s' }}
              size="small"
              block
              icon={<BotIcon />}
              onClick={() =>
                void navigate({
                  to: '/play/bot',
                  search: { mode, difficulty: loadPreferences().difficulty },
                })
              }
            >
              Bot
            </Button>
            <Button
              className="animate-rise"
              style={{ animationDelay: '0.32s' }}
              size="small"
              block
              icon={<FriendsIcon />}
              onClick={() => setOnlineOpen(true)}
            >
              Online
            </Button>
          </div>

          <p className="text-xs text-ink-faint" aria-live="polite">
            Playing <span className="text-ink-muted">{modeById(mode).name}</span> ·{' '}
            {modeById(mode).tagline.toLowerCase()}
          </p>
        </nav>

        {/* The two reasons to come back when nobody else is around: the next
            rival on the journey, and today's puzzle. */}
        <div
          className="grid w-full animate-rise grid-cols-2 gap-2.5"
          style={{ animationDelay: '0.36s' }}
        >
          <JourneyCard />
          <DailyCard />
        </div>

        <div className="w-full animate-rise" style={{ animationDelay: '0.42s' }}>
          <ModePicker value={mode} onChange={chooseMode} />
        </div>

        <div
          className="flex w-full animate-rise items-center justify-center gap-2"
          style={{ animationDelay: '0.48s' }}
        >
          <FooterLink to="/leaderboard" icon={<TrophyIcon />} label="Ranks" />
          <FooterLink to="/profile" icon={<ChartIcon />} label="Profile" />
          <FooterLink to="/puzzles" icon={<TargetIcon />} label="Puzzles" />
          <FooterLink to="/learn" icon={<BulbIcon />} label="Learn" search={{ mode }} />
        </div>
      </div>

      {onlineOpen ? (
        <OnlineSheet
          onClose={() => setOnlineOpen(false)}
          onQuick={(ranked) =>
            void navigate({ to: '/play/online', search: { mode, ranked: ranked || undefined } })
          }
          onHost={() => void navigate({ to: '/play/online', search: { mode, host: true } })}
          onJoin={(code) => void navigate({ to: '/play/online', search: { mode, code } })}
          onWatch={(code) => void navigate({ to: '/play/online', search: { mode, watch: code } })}
          rankedAvailable={modeById(mode).ranked}
          modeName={modeById(mode).name}
        />
      ) : null}

      {settingsOpen ? <SettingsSheet onClose={() => setSettingsOpen(false)} /> : null}
      {tutorialOpen ? <OnboardingSheet mode={mode} onClose={dismissTutorial} /> : null}
    </Screen>
  );
}

const featureCard = cx(
  'group relative flex min-h-[4.75rem] items-center gap-2.5 overflow-hidden rounded-2xl border px-3 py-2.5 text-left no-underline',
  'border-stroke-soft bg-surface/80',
  'transition-[transform,border-color,box-shadow] duration-200 ease-spring',
  'hover:-translate-y-0.5 hover:border-stroke hover:shadow-[0_12px_26px_-16px_var(--color-shadow)]',
  'active:scale-[0.98]',
);

/** The journey's next stop: the rival waiting there, and the stars so far. */
function JourneyCard() {
  const earned = useProgressStore((state) => state.journey);
  const upNext = nextStage(earned);
  const stars = totalStars(earned);

  return (
    <Link
      to="/journey"
      className={featureCard}
      aria-label={`Journey: ${stars} of ${MAX_STARS} stars. Next, ${upNext.rival.name}.`}
    >
      <span className="transition-transform duration-300 ease-spring group-hover:scale-110 group-hover:-rotate-6">
        <AvatarBadge avatar={upNext.rival.avatar} ring="var(--color-sunken)" className="size-11" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold">Journey</span>
        <span className="truncate text-xs text-ink-faint">Next: {upNext.rival.name}</span>
        <span className="tnum mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
          <StarIcon lit className="size-3.5" /> {stars}/{MAX_STARS}
        </span>
      </span>
    </Link>
  );
}

/** Today's puzzle, and whether the streak is alive. */
function DailyCard() {
  const daily = useProgressStore((state) => state.daily);
  const today = dayNumber();
  const puzzle = dailyPuzzle(today);
  const solved = daily.lastDay === today;
  const streak = liveDailyStreak(daily);

  const body = (
    <>
      <span
        className={cx(
          'flex size-11 shrink-0 items-center justify-center rounded-full text-2xl',
          'transition-transform duration-300 ease-spring group-hover:scale-110 group-hover:rotate-12',
          solved ? 'bg-ok/15 text-ok' : 'bg-sunken text-ink',
        )}
      >
        {solved ? <CheckIcon className="size-5" /> : <TargetIcon />}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold">Daily puzzle</span>
        <span className="truncate text-xs text-ink-faint">
          {solved ? 'Solved today' : puzzle ? `Win in ${puzzle.mateIn}` : 'All puzzles'}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-xs whitespace-nowrap text-ink-muted">
          <SparkIcon
            className={cx('size-3.5 shrink-0', streak > 0 ? 'text-warn' : 'text-ink-faint')}
          />
          {streak > 0 ? `${streak}-day streak` : 'Start a streak'}
        </span>
      </span>
      {!solved && puzzle ? (
        <span
          aria-hidden="true"
          className="absolute top-2 right-2 size-2 animate-pulse-soft rounded-full bg-warn"
        />
      ) : null}
    </>
  );

  return puzzle ? (
    <Link
      to="/puzzles/$id"
      params={{ id: puzzle.id }}
      search={{ daily: true }}
      className={featureCard}
    >
      {body}
    </Link>
  ) : (
    <Link to="/puzzles" className={featureCard}>
      {body}
    </Link>
  );
}

function FooterLink({
  to,
  icon,
  label,
  search,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  search?: Record<string, unknown>;
}) {
  return (
    <Link
      to={to}
      search={search}
      className={cx(
        'flex flex-1 flex-col items-center gap-1 rounded-tile border border-stroke-soft py-2',
        'text-xs text-ink-muted no-underline',
        'transition-[transform,border-color,color] duration-200 ease-spring',
        'hover:-translate-y-0.5 hover:border-stroke hover:text-ink',
      )}
    >
      <span className="text-lg">{icon}</span>
      {label}
    </Link>
  );
}

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
function OnlineSheet({
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
          'w-full max-w-80 rounded-[2rem] border border-stroke p-2 outline-none',
          'shadow-[0_30px_70px_-30px_var(--color-shadow)]',
          closing ? 'animate-panel-out' : 'animate-panel-in',
        )}
      >
        <div className="flex flex-col gap-3 rounded-[1.5rem] bg-surface px-5 py-6">
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
