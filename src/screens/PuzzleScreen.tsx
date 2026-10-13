import { ReturnLink } from '@/components/ui/ReturnLink';
import { X } from '@/game/engine';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { BackIcon, RefreshIcon, ShareIcon } from '@/components/art/icons';
import { Mark } from '@/components/art/marks';
import { BulbIcon } from '@/components/art/ui-icons';
import { Board, type BoardHint } from '@/game/components/Board';
import { ResultModal, revealDelayFor } from '@/game/components/ResultModal';
import { HintLegend } from '@/game/components/HintLegend';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { useGameFeedback } from '@/game/useGameFeedback';
import { useTurnTint } from '@/game/useTurnTint';
import { dayNumber, liveDailyStreak, useProgressStore } from '@/features/progress/store';
import { dailyPuzzle, type Puzzle, PUZZLE_INDEX, usePuzzle } from '@/features/puzzles/puzzles';
import { usePuzzleSolver } from '@/features/puzzles/useSolver';
import { cx } from '@/lib/cx';
import { useLocale, useT } from '@/i18n';
import { useModeText } from '@/i18n/messages/modes';
import { puzzleMessages, refutationText, themeName, tierName } from '@/i18n/messages/puzzles';
import { appUrl, shareOrCopy } from '@/lib/invite';
import { TierDots } from './PuzzlesScreen';

export function PuzzleScreen({ id, daily = false }: { id: string; daily?: boolean }) {
  const t = useT(puzzleMessages);
  const puzzle = usePuzzle(id);
  if (puzzle === undefined) {
    // The pack is its own chunk; this is the beat while it arrives.
    return (
      <Screen>
        <p className="m-auto animate-pulse-soft text-sm text-ink-muted" aria-live="polite">
          {t('settingUp')}
        </p>
      </Screen>
    );
  }
  if (puzzle === null) {
    return (
      <Screen scroll>
        <Card className="w-full">
          <EmptyState
            title={t('notFoundTitle')}
            body={t('notFoundBody')}
            action={
              <Button as={ReturnLink} to="/puzzles" size="small" className="w-auto px-4">
                {t('allPuzzles')}
              </Button>
            }
          />
        </Card>
      </Screen>
    );
  }
  // Keyed so moving to the next puzzle starts it clean.
  return <PuzzleBoard key={puzzle.id} puzzle={puzzle} daily={daily} />;
}

/**
 * Solving one puzzle.
 *
 * The board and its defence are the shared solver's; this screen adds the
 * tally, the hint, the daily streak and the way on to the next one. There is
 * no limit on tries and no penalty beyond the tally.
 */
function isToday(puzzle: Puzzle): boolean {
  return dailyPuzzle(dayNumber())?.id === puzzle.id;
}

function PuzzleBoard({ puzzle, daily }: { puzzle: Puzzle; daily: boolean }) {
  const navigate = useNavigate();
  const t = useT(puzzleMessages);
  const locale = useLocale();
  const recordPuzzle = useProgressStore((state) => state.recordPuzzle);
  const solvedIds = useProgressStore((state) => state.puzzles);

  const [misses, setMisses] = useState(0);
  const [hinted, setHinted] = useState(false);
  // Whether a hint was ever shown on this attempt; `hinted` clears per move.
  const [helped, setHelped] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  // A result reopened with "Show result" appears at once, not after the reveal.
  const [reopened, setReopened] = useState(false);
  // Only the daily, opened as the daily, counts towards the streak - and only
  // while it is still today's: a daily left open past midnight, or an old
  // daily link, is a plain puzzle.
  const [today, setToday] = useState(() => isToday(puzzle));
  const asDaily = daily && today;

  const solver = usePuzzleSolver(puzzle, {
    retract: true,
    onSolved: () => {
      const stillToday = isToday(puzzle);
      setToday(stillToday);
      recordPuzzle(puzzle.id, daily && stillToday);
    },
    onMiss: () => setMisses((count) => count + 1),
  });
  const { game, step, phase, refutation, accepted, start } = solver;
  const side = start.currentPlayer;

  useGameFeedback(game, { you: side });
  useTurnTint(game);

  const hints: BoardHint[] =
    hinted && phase === 'solving'
      ? accepted.map((index) => ({ index, kind: 'best' }))
      : refutation && refutation.move !== null
        ? [{ index: refutation.move, kind: 'threat' }]
        : [];

  function attempt(index: number) {
    // A hint is for one step; the next one is found unaided.
    if (phase === 'solving' && accepted.includes(index)) setHinted(false);
    solver.attempt(index);
  }

  function retry() {
    solver.retry();
    setReviewing(false);
    setReopened(false);
    setHinted(false);
    setHelped(false);
    setMisses(0);
  }

  const modeName = useModeText(puzzle.mode).name;
  const theme = themeName(puzzle.theme, locale);
  const nextPuzzle =
    PUZZLE_INDEX.find(
      (candidate) => candidate.number > puzzle.number && !solvedIds.includes(candidate.id),
    ) ??
    PUZZLE_INDEX.find(
      (candidate) => !solvedIds.includes(candidate.id) && candidate.id !== puzzle.id,
    );

  const message =
    phase === 'wrong'
      ? refutation
        ? refutationText(refutation.kind, locale)
        : t('notThatOne')
      : phase === 'replying'
        ? t('theyDefend')
        : phase === 'solved'
          ? t('solved')
          : step === 0
            ? t('findWin', { count: puzzle.mateIn })
            : step === puzzle.mateIn - 1
              ? t('finishIt')
              : t('keepPressure');

  return (
    <Screen>
      <header className="flex w-full items-center gap-3 pt-2">
        <IconButton as={ReturnLink} to="/puzzles" tone="bare" size="small" label={t('allPuzzles')}>
          <BackIcon className="rtl:-scale-x-100" />
        </IconButton>
        <div className="flex min-w-0 flex-col">
          <h1 className="font-display text-xl leading-tight">
            {asDaily ? t('dailyPuzzle') : t('puzzleNumber', { number: puzzle.number })}
          </h1>
          <span className="truncate text-xs text-ink-faint">
            {modeName} · {tierName(puzzle.tier, locale)}
            {theme ? ` · ${theme}` : ''}
          </span>
        </div>
        <span className="ms-auto">
          <TierDots tier={puzzle.tier} />
        </span>
      </header>

      <main className="flex w-full flex-1 animate-board-in flex-col items-center justify-center gap-4 py-4">
        <div className="flex items-center gap-3 rounded-full border border-stroke-soft bg-surface/70 py-1.5 ps-2 pe-4">
          <Mark
            player={side}
            hole="var(--color-surface)"
            className={cx('size-7', side === X && 'p-0.5')}
          />
          <span className="text-sm">
            {t('youPlayBefore')} <strong>{side === X ? 'X' : 'O'}</strong>{' '}
            {t('youPlayAfter', { count: puzzle.mateIn })}
          </span>
          {/* One pip per move of the combination, filled as they are found. */}
          <span
            className="flex gap-1"
            aria-label={t('moveOf', {
              move: Math.min(step + 1, puzzle.mateIn),
              total: puzzle.mateIn,
            })}
          >
            {Array.from({ length: puzzle.mateIn }, (_, pip) => (
              <span
                key={pip}
                className={cx(
                  'size-2 rounded-full transition-colors duration-300',
                  pip < step || phase === 'solved'
                    ? 'bg-ok'
                    : pip === step
                      ? 'bg-ink-muted'
                      : 'bg-stroke-soft',
                )}
              />
            ))}
          </span>
        </div>

        <Board
          game={game}
          onPlay={attempt}
          disabled={phase !== 'solving'}
          finishTone={phase === 'solved' ? 'win' : null}
          hints={hints}
        />
        {hinted ? <HintLegend hints={hints} /> : null}

        <p
          key={message}
          aria-live="polite"
          className={cx(
            'min-h-5 max-w-board animate-toast-in text-center text-sm',
            phase === 'wrong' ? 'text-danger' : phase === 'solved' ? 'text-ok' : 'text-ink-muted',
          )}
        >
          {message}
        </p>
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-3 pb-4">
        {phase === 'solved' && reviewing ? (
          <Button
            size="small"
            variant="ghost"
            onClick={() => {
              setReopened(true);
              setReviewing(false);
            }}
          >
            {t('showResult')}
          </Button>
        ) : null}
        <IconButton label={t('startOver')} onClick={retry} disabled={game === start}>
          <RefreshIcon />
        </IconButton>
        <IconButton
          label={hinted ? t('hintShown') : t('showHint')}
          aria-pressed={hinted}
          disabled={phase !== 'solving'}
          onClick={() => {
            setHinted(true);
            setHelped(true);
          }}
          className={hinted ? 'text-ok' : undefined}
        >
          <BulbIcon />
        </IconButton>
      </footer>

      {phase === 'solved' && !reviewing ? (
        <ResultModal
          onDismiss={() => setReviewing(true)}
          title={t('solved')}
          art={<Mark player={side} hole="var(--color-surface)" className="size-20" />}
          note={
            misses === 0
              ? helped
                ? t('withHelp')
                : t('firstTry')
              : t('solvedAfter', { count: misses })
          }
          celebrate
          revealDelay={reopened ? 0 : revealDelayFor(game)}
          actions={
            <>
              {nextPuzzle ? (
                <Button
                  variant="primary"
                  size="small"
                  block
                  onClick={() =>
                    void navigate({
                      to: '/puzzles/$id',
                      params: { id: nextPuzzle.id },
                      replace: true,
                    })
                  }
                >
                  {t('nextPuzzle')}
                </Button>
              ) : null}
              {asDaily ? <ShareDaily misses={misses} helped={helped} /> : null}
              <Button variant="ghost" size="small" block onClick={retry}>
                {t('playAgain')}
              </Button>
              <Button as={ReturnLink} to="/puzzles" variant="ghost" size="small" block>
                {t('allPuzzles')}
              </Button>
            </>
          }
        />
      ) : null}
    </Screen>
  );
}

/**
 * Share today's result: the date, how it went, the streak - and a link, so
 * the person it is sent to can try the same puzzle. No spoilers: it says how
 * the puzzle was solved, never where.
 */
function ShareDaily({ misses, helped }: { misses: number; helped: boolean }) {
  const t = useT(puzzleMessages);
  const locale = useLocale();
  const daily = useProgressStore((state) => state.daily);
  const [feedback, setFeedback] = useState<'idle' | 'shared' | 'copied' | 'failed'>('idle');
  const streak = liveDailyStreak(daily);
  const date = new Date().toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  async function share() {
    const how =
      misses === 0
        ? helped
          ? t('shareWithHint')
          : t('shareFirstTry')
        : t('shareTries', { count: misses + 1 });
    const lines = [
      t('shareHeading', { date }),
      `✓ ${how}`,
      ...(streak > 1 ? [`🔥 ${t('shareStreak', { count: streak })}`] : []),
      appUrl('/puzzles') ?? '',
    ].filter(Boolean);
    setFeedback(await shareOrCopy(lines.join('\n'), t('shareTitle')));
  }

  return (
    <Button size="small" block onClick={() => void share()} icon={<ShareIcon />}>
      {feedback === 'copied' ? t('copied') : feedback === 'shared' ? t('shared') : t('shareResult')}
    </Button>
  );
}
