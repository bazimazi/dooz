import { modeById, type ModeId } from '@/game/engine';
import { Link, useNavigate } from '@tanstack/react-router';
import { lazy, Suspense, useEffect, useState } from 'react';
import { AvatarBadge } from '@/components/art/avatars';
import { BotIcon, CheckIcon, FriendsIcon } from '@/components/art/icons';
import { Logo } from '@/components/art/Logo';
import {
  BulbIcon,
  ChartIcon,
  MedalIcon,
  SettingsIcon,
  SparkIcon,
  TargetIcon,
  TrophyIcon,
  UsersIcon,
} from '@/components/art/ui-icons';
import { HeroBoard } from '@/game/components/HeroBoard';
import { ModePicker } from '@/game/components/ModePicker';
import { StarIcon } from '@/game/components/Stars';
import { MAX_STARS, nextStage } from '@/features/journey/stages';
import {
  dayNumber,
  liveDailyStreak,
  totalStars,
  useProgressStore,
} from '@/features/progress/store';
import { dailyPuzzle } from '@/features/puzzles/puzzles';
import { LevelBadge } from '@/features/collection/art';
import { levelFor } from '@/features/progress/xp';
import { Button } from '@/components/ui/Button';
import { IconButton, iconButtonClasses } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { useAccountStore } from '@/features/account/store';
import { cx } from '@/lib/cx';
import { useT } from '@/i18n';
import { homeMessages } from '@/i18n/messages/home';
import { useModeText } from '@/i18n/messages/modes';
import { loadPreferences, savePreferences } from '@/lib/preferences';
import { useClosing } from '@/lib/useClosing';
import { useDialog } from '@/lib/useDialog';

// The sheets open on demand, so the home screen paints without their code and
// fetches each the first time it is wanted.
const OnboardingSheet = lazy(async () => ({
  default: (await import('./OnboardingSheet')).OnboardingSheet,
}));
const SettingsSheet = lazy(async () => ({
  default: (await import('./SettingsSheet')).SettingsSheet,
}));
const OnlineSheet = lazy(async () => ({ default: (await import('./OnlineSheet')).OnlineSheet }));

export function HomeScreen() {
  const navigate = useNavigate();
  const initialise = useAccountStore((state) => state.initialise);
  const t = useT(homeMessages);

  const [mode, setMode] = useState<ModeId>(() => loadPreferences().mode);
  const modeText = useModeText(mode);
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
      {/* The shortest phones (568px) tighten the spacing so the footer stays on screen. */}
      <div className="flex w-full flex-1 flex-col items-center gap-4 pb-4 [@media(max-height:599px)]:gap-2">
        <div className="flex w-full items-center justify-between gap-2">
          <Link
            to="/learn"
            search={{ mode }}
            aria-label={t('howToPlay')}
            title={t('howToPlay')}
            className={iconButtonClasses({ tone: 'bare', size: 'small' })}
          >
            <BulbIcon />
          </Link>

          {/* The wordmark animates its own parts, so it is left out of the
              stagger below and only the block it sits in is timed. */}
          <Logo className="h-16 w-auto shrink-0 [@media(max-height:599px)]:h-12" />

          <IconButton
            tone="bare"
            size="small"
            label={t('settings')}
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon />
          </IconButton>
        </div>

        <div className="flex w-full flex-1 flex-col justify-center gap-4 py-3 [@media(max-height:599px)]:gap-3 [@media(max-height:599px)]:py-0">
          <section aria-label={t('play')} className="flex w-full flex-col gap-4">
            <button
              type="button"
              onClick={() => setModeOpen(true)}
              aria-haspopup="dialog"
              className="home-mode-card home-hero-card rounded-3xl border border-stroke-soft bg-surface/70 p-4 text-start"
            >
              <span aria-hidden="true" dir="ltr" className="home-mode-preview shrink-0">
                <HeroBoard key={mode} config={modeById(mode).config} className="w-full" />
              </span>
              <span className="flex w-full min-w-0 items-center justify-between gap-3">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-xs text-ink-faint">{t('gameMode')}</span>
                  <span className="font-display text-xl" aria-live="polite">
                    {modeText.name}
                  </span>
                  <span className="home-mode-tagline text-xs text-ink-muted">
                    {modeText.tagline}
                  </span>
                </span>
                <span className="shrink-0 rounded-full border border-stroke-soft px-3 py-2 text-xs text-ink-muted">
                  {t('change')}
                </span>
              </span>
            </button>

            <nav aria-label={t('startGame')} className="flex flex-col gap-3">
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
                {t('playBot')}
              </Button>
              {/* One row for the three other ways in, so the whole home screen
                fits a small phone without scrolling. */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  size="small"
                  block
                  className="px-2 whitespace-nowrap max-[359px]:text-sm"
                  onClick={() => void navigate({ to: '/play/local', search: { mode } })}
                >
                  {t('twoPlayers')}
                </Button>
                <Button
                  size="small"
                  block
                  className="px-2 max-[359px]:text-sm"
                  icon={<FriendsIcon />}
                  onClick={() => setOnlineOpen(true)}
                >
                  {t('online')}
                </Button>
                <Button
                  onClick={() =>
                    void navigate({
                      to: '/play/bot',
                      search: { mode, difficulty: 'beginner', practice: true },
                    })
                  }
                  variant="ghost"
                  size="small"
                  block
                  className="px-2 max-[359px]:text-sm"
                  aria-label={t('practiceLabel')}
                  icon={<TargetIcon />}
                >
                  {t('practice')}
                </Button>
              </div>
            </nav>
          </section>

          {/* More ways to play: the reasons to come back when nobody else is
            around. New modes and features add their card to this grid - each
            card is a compact `featureCard` link: an icon, a title and one line,
            three to a row. */}
          <div
            role="group"
            aria-label={t('moreWays')}
            className="home-cards grid w-full animate-rise grid-cols-3 gap-2"
            style={{ animationDelay: '0.36s' }}
          >
            <JourneyCard />
            <DailyCard />
            <ArcadeCard />
          </div>
        </div>
        <nav
          aria-label={t('explore')}
          className="flex w-full items-center justify-center gap-2 pt-2"
          style={{ animationDelay: '0.48s' }}
        >
          <FooterLink to="/leaderboard" icon={<TrophyIcon />} label={t('ranks')} />
          <FooterLink to="/tournaments" icon={<MedalIcon />} label={t('compete')} />
          <FooterLink to="/profile" icon={<ChartIcon />} label={t('profile')} />
          <FooterLink to="/puzzles" icon={<TargetIcon />} label={t('puzzles')} />
          <FooterLink to="/friends" icon={<UsersIcon />} label={t('friends')} />
        </nav>
      </div>

      {modeOpen ? (
        <ModeSheet mode={mode} onChange={chooseMode} onClose={() => setModeOpen(false)} />
      ) : null}

      <Suspense fallback={null}>
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
            modeName={modeText.name}
          />
        ) : null}

        {settingsOpen ? <SettingsSheet onClose={() => setSettingsOpen(false)} /> : null}
        {tutorialOpen ? <OnboardingSheet mode={mode} onClose={dismissTutorial} /> : null}
      </Suspense>
    </Screen>
  );
}

const featureCard = cx(
  'group relative flex min-w-0 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl border px-2 py-2.5 text-center no-underline',
  'border-stroke-soft bg-surface/80',
  'transition-[transform,border-color,box-shadow] duration-200 ease-spring',
  'hover:-translate-y-0.5 hover:border-stroke hover:shadow-[0_12px_26px_-16px_var(--color-shadow)]',
  'active:scale-[0.98]',
);

/** The journey's next stop: the rival waiting there, and the stars so far. */
function JourneyCard() {
  const t = useT(homeMessages);
  const earned = useProgressStore((state) => state.journey);
  const upNext = nextStage(earned);
  const stars = totalStars(earned);

  return (
    <Link
      to="/journey"
      className={featureCard}
      aria-label={t('journeyLabel', { stars, max: MAX_STARS, rival: upNext.rival.name })}
    >
      <span className="transition-transform duration-300 ease-spring group-hover:scale-110 group-hover:-rotate-6">
        <AvatarBadge
          avatar={upNext.rival.avatar}
          ring="var(--color-sunken)"
          className="size-9 max-[359px]:size-8"
        />
      </span>
      <span className="flex w-full min-w-0 flex-col items-center">
        <span className="text-sm font-semibold">{t('journey')}</span>
        <span className="tnum flex items-center gap-1 text-xs text-ink-muted">
          <StarIcon lit className="size-3.5 shrink-0" />{' '}
          {t('starsProgress', { stars, max: MAX_STARS })}
        </span>
      </span>
    </Link>
  );
}

/** The arcade: the daily challenge, the gauntlet, runs and blitz - and your level. */
function ArcadeCard() {
  const t = useT(homeMessages);
  const xp = useProgressStore((state) => state.xp);
  const level = levelFor(xp);
  return (
    <Link to="/arcade" className={featureCard} aria-label={t('arcadeLabel', { level })}>
      <LevelBadge level={level} className="size-9 text-sm max-[359px]:size-8" />
      <span className="flex w-full min-w-0 flex-col items-center">
        <span className="text-sm font-semibold">{t('arcade')}</span>
        <span className="w-full truncate text-xs text-ink-faint">{t('level', { level })}</span>
      </span>
    </Link>
  );
}

/** Today's puzzle, and whether the streak is alive. */
function DailyCard() {
  const t = useT(homeMessages);
  const daily = useProgressStore((state) => state.daily);
  const today = dayNumber();
  const puzzle = dailyPuzzle(today);
  const solved = daily.lastDay === today;
  const streak = liveDailyStreak(daily);

  const body = (
    <>
      <span
        className={cx(
          'flex size-9 shrink-0 items-center justify-center rounded-full text-xl max-[359px]:size-8',
          'transition-transform duration-300 ease-spring group-hover:scale-110 group-hover:rotate-12',
          solved ? 'bg-ok/15 text-ok' : 'bg-sunken text-ink',
        )}
      >
        {solved ? <CheckIcon className="size-5" /> : <TargetIcon />}
      </span>
      <span className="flex w-full min-w-0 flex-col items-center">
        <span className="text-sm font-semibold whitespace-nowrap">{t('dailyPuzzle')}</span>
        <span className="flex w-full min-w-0 items-center justify-center gap-1 text-xs text-ink-muted">
          {streak > 0 ? <SparkIcon className="size-3.5 shrink-0 text-warn" /> : null}
          <span className="truncate">
            {streak > 0
              ? t('streak', { count: streak })
              : solved
                ? t('solvedToday')
                : puzzle
                  ? t('winIn', { count: puzzle.mateIn })
                  : t('allPuzzles')}
          </span>
        </span>
      </span>
      {!solved && puzzle ? (
        <span
          aria-hidden="true"
          className="absolute end-2 top-2 size-2 animate-pulse-soft rounded-full bg-warn"
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
  const t = useT(homeMessages);

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
            {t('chooseMode')}
          </h2>
          <Button variant="ghost" size="small" className="w-auto" onClick={close}>
            {t('done')}
          </Button>
        </div>
        <div className="min-h-0 overflow-y-auto pb-1">
          <ModePicker value={mode} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}
