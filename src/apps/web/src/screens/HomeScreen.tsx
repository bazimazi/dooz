import { modeById, type ModeId } from '@dooz/engine';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { AvatarBadge } from '@/components/art/avatars';
import { BotIcon, CheckIcon, FriendsIcon } from '@/components/art/icons';
import { Logo } from '@/components/art/Logo';
import {
  BulbIcon,
  ChartIcon,
  SettingsIcon,
  SparkIcon,
  TargetIcon,
  TrophyIcon,
} from '@/components/art/ui-icons';
import { MiniBoard } from '@/components/game/MiniBoard';
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
import { OnlineSheet } from './OnlineSheet';

export function HomeScreen() {
  const navigate = useNavigate();
  const initialise = useAccountStore((state) => state.initialise);

  const [mode, setMode] = useState<ModeId>(() => loadPreferences().mode);
  const [modeOpen, setModeOpen] = useState(false);
  const [onlineOpen, setOnlineOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Shown once, on the very first launch. After that it lives behind the
  // "How to play" link rather than in the way.
  const [tutorialOpen, setTutorialOpen] = useState(() => !loadPreferences().onboarded);

  // Ensure the device profile exists without requiring a server account.
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
          <Logo className="h-16 w-auto shrink-0" />

          <IconButton
            tone="bare"
            size="small"
            label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon />
          </IconButton>
        </div>

        <div className="flex w-full flex-1 flex-col justify-center gap-4 py-3">
          <section aria-label="Play" className="flex w-full flex-col gap-4">
            <button
              type="button"
              onClick={() => setModeOpen(true)}
              aria-haspopup="dialog"
              className="home-mode-card rounded-3xl border border-stroke-soft bg-surface/70 p-4 text-left"
            >
              <span aria-hidden="true" className="home-mode-preview shrink-0">
                <MiniBoard key={mode} config={modeById(mode).config} active className="w-full" />
              </span>
              <span className="flex w-full min-w-0 items-center justify-between gap-3">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-xs text-ink-faint">Game mode</span>
                  <span className="font-display text-xl" aria-live="polite">
                    {modeById(mode).name}
                  </span>
                  <span className="home-mode-tagline text-xs text-ink-muted">
                    {modeById(mode).tagline}
                  </span>
                </span>
                <span className="shrink-0 rounded-full border border-stroke-soft px-3 py-2 text-xs text-ink-muted">
                  Change
                </span>
              </span>
            </button>

            <nav aria-label="Start a game" className="flex flex-col gap-3">
              <Button
                variant="primary"
                block
                icon={<BotIcon />}
                onClick={() =>
                  void navigate({
                    to: '/play/bot',
                    search: { mode, difficulty: loadPreferences().difficulty },
                  })
                }
              >
                Play vs bot
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  size="small"
                  block
                  className="whitespace-nowrap max-[359px]:text-sm"
                  onClick={() => void navigate({ to: '/play/local', search: { mode } })}
                >
                  Two players
                </Button>
                <Button
                  size="small"
                  block
                  icon={<FriendsIcon />}
                  onClick={() => setOnlineOpen(true)}
                >
                  Online
                </Button>
              </div>
            </nav>
          </section>

          {/* The two reasons to come back when nobody else is around: the next
            rival on the journey, and today's puzzle. */}
          <div
            className="grid w-full animate-rise grid-cols-2 gap-2.5"
            style={{ animationDelay: '0.36s' }}
          >
            <JourneyCard />
            <DailyCard />
          </div>
        </div>
        <nav
          aria-label="Explore"
          className="flex w-full items-center justify-center gap-2 pt-2"
          style={{ animationDelay: '0.48s' }}
        >
          <FooterLink to="/leaderboard" icon={<TrophyIcon />} label="Ranks" />
          <FooterLink to="/profile" icon={<ChartIcon />} label="Profile" />
          <FooterLink to="/puzzles" icon={<TargetIcon />} label="Puzzles" />
        </nav>
      </div>

      {modeOpen ? (
        <ModeSheet mode={mode} onChange={chooseMode} onClose={() => setModeOpen(false)} />
      ) : null}

      {onlineOpen ? (
        <OnlineSheet
          onClose={() => setOnlineOpen(false)}
          onQuick={(ranked) =>
            void navigate({
              to: '/play/online',
              replace: true,
              search: { mode, ranked: ranked || undefined },
            })
          }
          onHost={() =>
            void navigate({ to: '/play/online', replace: true, search: { mode, host: true } })
          }
          onJoin={(code) =>
            void navigate({ to: '/play/online', replace: true, search: { mode, code } })
          }
          onWatch={(code) =>
            void navigate({ to: '/play/online', replace: true, search: { mode, watch: code } })
          }
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
  'group relative flex min-h-[4.75rem] items-center gap-2.5 overflow-hidden rounded-2xl border px-3 py-2.5 text-left no-underline max-[359px]:gap-2 max-[359px]:px-2',
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
        <AvatarBadge
          avatar={upNext.rival.avatar}
          ring="var(--color-sunken)"
          className="size-11 max-[359px]:size-8"
        />
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
          'flex size-11 shrink-0 items-center justify-center rounded-full text-2xl max-[359px]:size-8',
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
          <span className="truncate">{streak > 0 ? `${streak}-day streak` : 'Start a streak'}</span>
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
        'flex min-h-12 flex-1 flex-col items-center gap-1 rounded-tile py-2',
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

function ModeSheet({
  mode,
  onChange,
  onClose,
}: {
  mode: ModeId;
  onChange: (mode: ModeId) => void;
  onClose: () => void;
}) {
  const { closing, close } = useClosing(onClose);
  const panelRef = useDialog<HTMLDivElement>(close);

  return (
    <div
      className={cx(
        'fixed inset-0 z-50 flex items-end justify-center bg-scrim backdrop-blur-[2px] sm:items-center sm:p-5',
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
        aria-labelledby="mode-sheet-title"
        tabIndex={-1}
        className={cx(
          'sheet-surface flex max-h-[90dvh] w-full max-w-screen flex-col gap-4 rounded-t-[2rem] border px-5 pt-3 outline-none sm:rounded-[2rem]',
          closing
            ? 'animate-sheet-out sm:animate-panel-out'
            : 'animate-sheet-in sm:animate-panel-in',
        )}
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <span aria-hidden="true" className="mx-auto h-1 w-10 shrink-0 rounded-full bg-ink/25" />
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stroke-soft pb-4">
          <h2 id="mode-sheet-title" className="font-display text-xl">
            Choose a mode
          </h2>
          <Button variant="ghost" size="small" className="w-auto" onClick={close}>
            Done
          </Button>
        </div>
        <div className="min-h-0 overflow-y-auto pb-1">
          <ModePicker value={mode} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}
