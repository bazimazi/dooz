import { ReturnLink } from '@/components/ui/ReturnLink';
import { modeById } from '@/game/engine';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { BackIcon, CheckIcon } from '@/components/art/icons';
import { ClockIcon, SparkIcon, TargetIcon, TrophyIcon } from '@/components/art/ui-icons';
import { MiniBoard } from '@/game/components/MiniBoard';
import { Button, buttonClasses, buttonStyle } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { Tabs } from '@/components/ui/Tabs';
import { dayNumber, liveDailyStreak, useProgressStore } from '@/features/progress/store';
import {
  dailyPuzzle,
  type Puzzle,
  PUZZLE_INDEX,
  type PuzzleSummary,
} from '@/features/puzzles/puzzles';
import { RUSH_SECONDS, RUSH_STRIKES, useRushStore } from '@/features/puzzles/rush';
import { cx } from '@/lib/cx';
import { formatNumber, useLocale, useT } from '@/i18n';
import { useModeTexts } from '@/i18n/messages/modes';
import { puzzleMessages, themeName, tierName } from '@/i18n/messages/puzzles';

type Filter = 'all' | '1' | '2' | '3';

/**
 * Tiles drawn at first, and added per "Show more". The pack runs to hundreds
 * of puzzles, each tile with its own little board; drawing them all at once
 * would make the list slow to open for no benefit.
 */
const PAGE = 48;

/**
 * Every puzzle, with today's at the top.
 *
 * The daily puzzle leads because it is the reason to come back tomorrow; the
 * list below is for anyone who wants more than one a day. Solved puzzles stay
 * in the list, ticked, rather than disappearing - a solved puzzle is still
 * worth replaying, and a list that shrinks as you use it feels like it is
 * running out.
 */
export function PuzzlesScreen({ filter = 'all' }: { filter?: Filter }) {
  const navigate = useNavigate();
  const t = useT(puzzleMessages);
  const locale = useLocale();
  const modeText = useModeTexts();
  const solved = useProgressStore((state) => state.puzzles);
  const daily = useProgressStore((state) => state.daily);

  const today = dayNumber();
  const todays = dailyPuzzle(today);
  const solvedToday = daily.lastDay === today;
  const streak = liveDailyStreak(daily);
  const rushBest = useRushStore((state) => state.best);
  const [limit, setLimit] = useState(PAGE);
  const matching =
    filter === 'all'
      ? PUZZLE_INDEX
      : PUZZLE_INDEX.filter((puzzle) => String(puzzle.tier) === filter);
  const shown = matching.slice(0, limit);
  const solvedCount = solved.filter((id) => PUZZLE_INDEX.some((puzzle) => puzzle.id === id)).length;

  return (
    <Screen width="wide" scroll>
      <header className="flex w-full items-center gap-3 pt-2 pb-4">
        <IconButton as={ReturnLink} to="/" tone="bare" size="small" label={t('backHome')}>
          <BackIcon className="rtl:-scale-x-100" />
        </IconButton>
        <h1 className="font-display text-xl">{t('puzzles')}</h1>
        <span className="tnum ms-auto text-sm text-ink-muted">
          {t('solvedCount', { solved: solvedCount, total: PUZZLE_INDEX.length })}
        </span>
      </header>

      {PUZZLE_INDEX.length === 0 || !todays ? (
        <Card className="w-full">
          <EmptyState title={t('emptyTitle')} body={t('emptyBody')} />
        </Card>
      ) : (
        <div className="flex w-full flex-col gap-4 pb-6">
          <Card className="w-full animate-rise">
            <div className="flex items-center gap-4">
              <MiniBoard config={modeById(todays.mode).config} active className="w-20 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-xs tracking-wide text-ink-faint uppercase">
                  {t('dailyHeading', {
                    date: new Date().toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
                  })}
                </span>
                <span className="font-display text-xl leading-tight">
                  {t('modeWinIn', { mode: modeText(todays.mode).name, count: todays.mateIn })}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <SparkIcon
                    className={cx('size-4', streak > 0 ? 'text-warn' : 'text-ink-faint')}
                  />
                  {streak > 0 ? t('streak', { count: streak }) : t('startStreak')}
                  {daily.best > 1 ? t('bestStreak', { count: daily.best }) : ''}
                </span>
              </div>
            </div>
            <Link
              to="/puzzles/$id"
              params={{ id: todays.id }}
              search={{ daily: true }}
              className={buttonClasses({
                variant: solvedToday ? 'ghost' : 'primary',
                size: 'small',
                block: true,
                className: 'mt-4',
              })}
              style={buttonStyle(solvedToday ? 'ghost' : 'primary')}
            >
              <span className="relative z-2 flex items-center gap-2">
                {solvedToday ? <CheckIcon className="size-4" /> : <TargetIcon />}
                {solvedToday ? t('solvedAgain') : t('solveToday')}
              </span>
            </Link>
          </Card>

          <Link
            to="/puzzles/rush"
            className={cx(
              'group flex items-center gap-3 rounded-2xl border border-stroke-soft bg-surface/85 p-3 no-underline',
              'transition-[transform,border-color] duration-200 ease-spring hover:-translate-y-0.5 hover:border-stroke active:scale-[0.98]',
            )}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sunken text-2xl text-warn">
              <ClockIcon />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold">{t('rush')}</span>
              <span className="truncate text-xs text-ink-faint">
                {t('rushSummary', { minutes: RUSH_SECONDS / 60, strikes: RUSH_STRIKES })}
              </span>
            </span>
            {rushBest > 0 ? (
              <span className="tnum flex shrink-0 items-center gap-1 text-sm text-ink-muted">
                <TrophyIcon className="size-4" /> {formatNumber(rushBest, locale)}
              </span>
            ) : null}
          </Link>

          <Tabs<Filter>
            label={t('difficulty')}
            value={filter}
            onChange={(next) =>
              void navigate({
                to: '/puzzles',
                search: { tier: next === 'all' ? undefined : next },
                replace: true,
                viewTransition: false,
                resetScroll: false,
              })
            }
            options={[
              { value: 'all', label: t('all') },
              { value: '1', label: tierName(1, locale) },
              { value: '2', label: tierName(2, locale) },
              { value: '3', label: tierName(3, locale) },
            ]}
          />

          <ul className="grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-2 sm:grid-cols-3">
            {shown.map((puzzle) => (
              <li key={puzzle.id}>
                <PuzzleTile puzzle={puzzle} solved={solved.includes(puzzle.id)} />
              </li>
            ))}
          </ul>
          {matching.length > shown.length ? (
            <Button
              variant="ghost"
              size="small"
              className="w-auto self-center px-5"
              onClick={() => setLimit((count) => count + PAGE)}
            >
              {t('showMore', { count: matching.length - shown.length })}
            </Button>
          ) : null}
        </div>
      )}
    </Screen>
  );
}

function PuzzleTile({ puzzle, solved }: { puzzle: PuzzleSummary; solved: boolean }) {
  const t = useT(puzzleMessages);
  const locale = useLocale();
  const mode = modeById(puzzle.mode);
  const modeName = useModeTexts()(puzzle.mode).name;
  const theme = themeName(puzzle.theme, locale);
  const labelValues = {
    number: puzzle.number,
    mode: modeName,
    count: puzzle.mateIn,
    tier: tierName(puzzle.tier, locale),
  };

  return (
    <Link
      to="/puzzles/$id"
      params={{ id: puzzle.id }}
      className={cx(
        'group flex items-center gap-2.5 rounded-2xl border p-2 text-start no-underline',
        'transition-[transform,border-color,background-color] duration-200 ease-spring',
        'hover:-translate-y-0.5 active:scale-[0.98]',
        solved
          ? 'border-stroke-soft bg-surface/55'
          : 'border-stroke-soft bg-surface/85 hover:border-stroke',
      )}
      aria-label={t(solved ? 'tileLabelSolved' : 'tileLabel', labelValues)}
    >
      <span className="relative w-11 shrink-0">
        <MiniBoard config={mode.config} className="w-11" />
        {solved ? (
          <span className="absolute -end-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-ok text-g10">
            <CheckIcon className="size-3" />
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold">
          {t('winIn', { count: puzzle.mateIn })}
        </span>
        <span className="truncate text-xs text-ink-faint">
          {t('numberMode', { number: puzzle.number, mode: modeName })}
        </span>
        {theme ? <span className="truncate text-xs text-ink-faint">{theme}</span> : null}
      </span>
      <TierDots tier={puzzle.tier} />
    </Link>
  );
}

/** One to three dots: difficulty at a glance, without a word to read. */
export function TierDots({ tier }: { tier: Puzzle['tier'] }) {
  return (
    <span className="ms-auto flex shrink-0 gap-0.5" aria-hidden="true">
      {[1, 2, 3].map((dot) => (
        <span
          key={dot}
          className={cx('size-1.5 rounded-full', dot <= tier ? 'bg-ink-muted' : 'bg-stroke-soft')}
        />
      ))}
    </span>
  );
}
