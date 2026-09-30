import { modeById } from '@dooz/engine';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { BackIcon, CheckIcon } from '@/components/art/icons';
import { SparkIcon, TargetIcon } from '@/components/art/ui-icons';
import { MiniBoard } from '@/components/game/MiniBoard';
import { buttonClasses, buttonStyle } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { Tabs } from '@/components/ui/Tabs';
import { dayNumber, liveDailyStreak, useProgressStore } from '@/features/progress/store';
import {
  dailyPuzzle,
  type Puzzle,
  PUZZLES,
  TIER_NAMES,
  themeName,
} from '@/features/puzzles/puzzles';
import { cx } from '@/lib/cx';

type Filter = 'all' | '1' | '2' | '3';

/**
 * Every puzzle, with today's at the top.
 *
 * The daily puzzle leads because it is the reason to come back tomorrow; the
 * list below is for anyone who wants more than one a day. Solved puzzles stay
 * in the list, ticked, rather than disappearing - a solved puzzle is still
 * worth replaying, and a list that shrinks as you use it feels like it is
 * running out.
 */
export function PuzzlesScreen() {
  const solved = useProgressStore((state) => state.puzzles);
  const daily = useProgressStore((state) => state.daily);
  const [filter, setFilter] = useState<Filter>('all');

  const today = dayNumber();
  const todays = dailyPuzzle(today);
  const solvedToday = daily.lastDay === today;
  const streak = liveDailyStreak(daily);
  const shown =
    filter === 'all' ? PUZZLES : PUZZLES.filter((puzzle) => String(puzzle.tier) === filter);

  return (
    <Screen width="wide" scroll>
      <header className="flex w-full items-center gap-3 pt-2 pb-4">
        <IconButton as={Link} to="/" tone="bare" size="small" label="Back to home">
          <BackIcon />
        </IconButton>
        <h1 className="font-display text-xl">Puzzles</h1>
        <span className="tnum ml-auto text-sm text-ink-muted">
          {solved.filter((id) => PUZZLES.some((puzzle) => puzzle.id === id)).length} /{' '}
          {PUZZLES.length} solved
        </span>
      </header>

      {PUZZLES.length === 0 || !todays ? (
        <Card className="w-full">
          <EmptyState title="No puzzles here" body="The puzzle pack did not load. Try reloading." />
        </Card>
      ) : (
        <div className="flex w-full flex-col gap-4 pb-6">
          <Card className="w-full animate-rise">
            <div className="flex items-center gap-4">
              <MiniBoard config={modeById(todays.mode).config} active className="w-20 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-xs tracking-wide text-ink-faint uppercase">
                  Daily puzzle ·{' '}
                  {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                <span className="font-display text-xl leading-tight">
                  {modeById(todays.mode).name} · Win in {todays.mateIn}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <SparkIcon
                    className={cx('size-4', streak > 0 ? 'text-warn' : 'text-ink-faint')}
                  />
                  {streak > 0 ? `${streak}-day streak` : 'Start a streak today'}
                  {daily.best > 1 ? ` · best ${daily.best}` : ''}
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
                {solvedToday ? 'Solved — play it again' : 'Solve today’s puzzle'}
              </span>
            </Link>
          </Card>

          <Tabs<Filter>
            label="Difficulty"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: '1', label: TIER_NAMES[1] },
              { value: '2', label: TIER_NAMES[2] },
              { value: '3', label: TIER_NAMES[3] },
            ]}
          />

          <ul className="grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-2 sm:grid-cols-3">
            {shown.map((puzzle) => (
              <li key={puzzle.id}>
                <PuzzleTile puzzle={puzzle} solved={solved.includes(puzzle.id)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Screen>
  );
}

function PuzzleTile({ puzzle, solved }: { puzzle: Puzzle; solved: boolean }) {
  const mode = modeById(puzzle.mode);
  const theme = themeName(puzzle.theme);

  return (
    <Link
      to="/puzzles/$id"
      params={{ id: puzzle.id }}
      className={cx(
        'group flex items-center gap-2.5 rounded-2xl border p-2 text-left no-underline',
        'transition-[transform,border-color,background-color] duration-200 ease-spring',
        'hover:-translate-y-0.5 active:scale-[0.98]',
        solved
          ? 'border-stroke-soft bg-surface/55'
          : 'border-stroke-soft bg-surface/85 hover:border-stroke',
      )}
      aria-label={`Puzzle ${puzzle.number}: ${mode.name}, win in ${puzzle.mateIn}, ${TIER_NAMES[puzzle.tier]}${solved ? ', solved' : ''}`}
    >
      <span className="relative w-11 shrink-0">
        <MiniBoard config={mode.config} className="w-11" />
        {solved ? (
          <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-ok text-g10">
            <CheckIcon className="size-3" />
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold">Win in {puzzle.mateIn}</span>
        <span className="truncate text-xs text-ink-faint">
          #{puzzle.number} · {mode.name}
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
    <span className="ml-auto flex shrink-0 gap-0.5" aria-hidden="true">
      {[1, 2, 3].map((dot) => (
        <span
          key={dot}
          className={cx('size-1.5 rounded-full', dot <= tier ? 'bg-ink-muted' : 'bg-stroke-soft')}
        />
      ))}
    </span>
  );
}
