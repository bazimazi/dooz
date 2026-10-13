import { ReturnLink } from '@/components/ui/ReturnLink';
import { X } from '@/game/engine';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BackIcon, CheckIcon } from '@/components/art/icons';
import { Mark } from '@/components/art/marks';
import { ClockIcon, SparkIcon, TrophyIcon } from '@/components/art/ui-icons';
import { Board, type BoardHint } from '@/game/components/Board';
import { ResultModal } from '@/game/components/ResultModal';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { useGameFeedback } from '@/game/useGameFeedback';
import { useTurnTint } from '@/game/useTurnTint';
import {
  type Puzzle,
  PUZZLE_INDEX,
  transformPuzzle,
  turnsFor,
  usePuzzlePack,
} from '@/features/puzzles/puzzles';
import { nextRushPuzzle, RUSH_SECONDS, RUSH_STRIKES, useRushStore } from '@/features/puzzles/rush';
import { usePuzzleSolver } from '@/features/puzzles/useSolver';
import { cx } from '@/lib/cx';
import { formatNumber, type Locale, useLocale, useT } from '@/i18n';
import { useModeText } from '@/i18n/messages/modes';
import { puzzleMessages, refutationText, themeName } from '@/i18n/messages/puzzles';

/** A solved puzzle stays on the board this long before the next one arrives. */
const SOLVED_PAUSE_MS = 650;

type Run =
  | { phase: 'ready' }
  | {
      phase: 'running' | 'over';
      endsAt: number;
      score: number;
      strikes: number;
      played: ReadonlySet<string>;
      /** The puzzle on the board, numbered so the same one twice still remounts. */
      current: { puzzle: Puzzle; turn: number } | null;
      round: number;
      /** The best before this run, so a new one can say what it beat. */
      previous: number;
    };

/**
 * Puzzle Rush: three minutes, five strikes, puzzles that get harder as you go.
 *
 * Each puzzle is one try. Solve it and the next is a little harder; miss and
 * the refutation plays - the defence that beats the move - and the next one
 * comes up at once. A run ends when the clock runs out or the fifth miss
 * lands, and its score is the number solved.
 */
export function PuzzleRushScreen() {
  const t = useT(puzzleMessages);
  const locale = useLocale();
  const pack = usePuzzlePack();
  const best = useRushStore((state) => state.best);
  const finishRun = useRushStore((state) => state.finishRun);
  const runs = useRushStore((state) => state.runs);
  const [run, setRun] = useState<Run>({ phase: 'ready' });
  const [now, setNow] = useState(() => Date.now());

  const byId = useMemo(() => new Map((pack ?? []).map((puzzle) => [puzzle.id, puzzle])), [pack]);
  const pool = useMemo(() => PUZZLE_INDEX.filter((entry) => byId.has(entry.id)), [byId]);

  function pick(score: number, played: ReadonlySet<string>) {
    const summary = nextRushPuzzle(pool, played, score);
    const puzzle = summary ? byId.get(summary.id) : undefined;
    if (!puzzle) return null;
    // A random turn of the board, so a puzzle met before is not met the same way.
    const turns = turnsFor(puzzle.mode);
    const turn = turns[Math.floor(Math.random() * turns.length)] ?? 0;
    return { puzzle: (turn === 0 ? puzzle : transformPuzzle(puzzle, turn)) ?? puzzle, turn };
  }

  function start() {
    const played = new Set<string>();
    const current = pick(0, played);
    if (current) played.add(current.puzzle.id.split('~')[0]!);
    setNow(Date.now());
    setRun({
      phase: 'running',
      endsAt: Date.now() + RUSH_SECONDS * 1000,
      score: 0,
      strikes: 0,
      played,
      current,
      round: 0,
      previous: best,
    });
  }

  function end(state: Exclude<Run, { phase: 'ready' }>) {
    finishRun(state.score);
    setRun({ ...state, phase: 'over' });
  }

  /** The current puzzle is done, one way or the other: score it and deal the next. */
  function advance(solved: boolean) {
    if (run.phase !== 'running') return;
    const score = run.score + (solved ? 1 : 0);
    const strikes = run.strikes + (solved ? 0 : 1);
    const next = { ...run, score, strikes };
    if (strikes >= RUSH_STRIKES || Date.now() >= run.endsAt) {
      end(next);
      return;
    }
    const played = new Set(run.played);
    const current = pick(score, played);
    if (current) played.add(current.puzzle.id.split('~')[0]!);
    setRun({ ...next, played, current, round: run.round + 1 });
  }

  // The clock. It ticks while a run is on and stops the run when it is out.
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });
  const running = run.phase === 'running';
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const current = runRef.current;
      setNow(Date.now());
      if (current.phase === 'running' && Date.now() >= current.endsAt) {
        finishRun(current.score);
        setRun({ ...current, phase: 'over' });
      }
    }, 250);
    return () => clearInterval(timer);
  }, [running, finishRun]);

  if (!pack) {
    return (
      <Screen>
        <p className="m-auto animate-pulse-soft text-sm text-ink-muted" aria-live="polite">
          {t('loading')}
        </p>
      </Screen>
    );
  }

  const header = (
    <header className="flex w-full items-center gap-3 pt-2 pb-2">
      <IconButton as={ReturnLink} to="/puzzles" tone="bare" size="small" label={t('allPuzzles')}>
        <BackIcon className="rtl:-scale-x-100" />
      </IconButton>
      <h1 className="font-display text-xl">{t('rush')}</h1>
      {best > 0 ? (
        <span className="tnum ms-auto flex items-center gap-1.5 text-sm text-ink-muted">
          <TrophyIcon className="size-4" /> {t('best', { count: best })}
        </span>
      ) : null}
    </header>
  );

  if (run.phase === 'ready' || pool.length === 0) {
    return (
      <Screen scroll>
        {header}
        {pool.length === 0 ? (
          <Card className="w-full">
            <EmptyState title={t('emptyTitle')} body={t('emptyBody')} />
          </Card>
        ) : (
          <Card className="w-full animate-rise">
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-sunken text-3xl text-warn">
                <ClockIcon />
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="font-display text-2xl">{t('rushTitle')}</h2>
                <p className="text-sm text-ink-muted">{t('rushBody')}</p>
              </div>
              <dl className="grid grid-cols-3 gap-3 text-center text-xs text-ink-faint">
                <div>
                  <dt>{t('time')}</dt>
                  <dd className="font-display text-lg text-ink">
                    {clockText(RUSH_SECONDS, locale)}
                  </dd>
                </div>
                <div>
                  <dt>{t('strikes')}</dt>
                  <dd className="font-display text-lg text-ink">
                    {formatNumber(RUSH_STRIKES, locale)}
                  </dd>
                </div>
                <div>
                  <dt>{t('bestLabel')}</dt>
                  <dd className="font-display text-lg text-ink">{formatNumber(best, locale)}</dd>
                </div>
              </dl>
              <Button variant="primary" size="small" block onClick={start}>
                {t('startRush')}
              </Button>
            </div>
          </Card>
        )}
      </Screen>
    );
  }

  const left = Math.max(0, Math.ceil((run.endsAt - now) / 1000));
  const improved = run.phase === 'over' && run.score > run.previous;
  const clock = clockText(left, locale);

  return (
    <Screen>
      {header}
      <div className="flex w-full items-center justify-between gap-3 rounded-full border border-stroke-soft bg-surface/70 px-4 py-1.5 text-sm">
        <span
          role="timer"
          aria-label={t('secondsLeft', { count: left })}
          className={cx(
            'tnum flex items-center gap-1.5 font-semibold',
            left <= 15 && 'text-danger',
          )}
        >
          <ClockIcon className="size-4" /> {clock}
        </span>
        <span className="tnum flex items-center gap-1.5" aria-live="polite">
          <CheckIcon className="size-4 text-ok" /> {formatNumber(run.score, locale)}
        </span>
        <span
          className="flex gap-1"
          role="img"
          aria-label={t('strikesOf', { count: run.strikes, total: RUSH_STRIKES })}
        >
          {Array.from({ length: RUSH_STRIKES }, (_, strike) => (
            <span
              key={strike}
              className={cx(
                'size-2.5 rounded-full transition-colors duration-300',
                strike < run.strikes ? 'bg-danger' : 'bg-stroke-soft',
              )}
            />
          ))}
        </span>
      </div>

      {run.current ? (
        <RushPuzzle
          key={`${run.round}:${run.current.puzzle.id}`}
          puzzle={run.current.puzzle}
          active={run.phase === 'running'}
          onDone={advance}
        />
      ) : null}

      {run.phase === 'over' ? (
        <ResultModal
          onDismiss={() => setRun({ phase: 'ready' })}
          title={
            improved ? t('newBest') : run.strikes >= RUSH_STRIKES ? t('fiveStrikes') : t('timeUp')
          }
          art={
            <span className="flex size-[1em] items-center justify-center rounded-full bg-sunken text-[0.5em] text-warn">
              <SparkIcon />
            </span>
          }
          note={t(run.strikes >= RUSH_STRIKES ? 'rushSolvedStruck' : 'rushSolved', {
            count: run.score,
          })}
          detail={
            <p className="tnum text-xs text-ink-faint">
              {improved && run.previous > 0
                ? t('previousBest', { count: run.previous })
                : t('best', { count: best })}
              {t('runNumber', { count: runs })}
            </p>
          }
          celebrate={improved}
          revealDelay={0}
          actions={
            <>
              <Button variant="primary" size="small" block onClick={start}>
                {t('goAgain')}
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

/** One puzzle of a run: a single try, reported back when it is over. */
function RushPuzzle({
  puzzle,
  active,
  onDone,
}: {
  puzzle: Puzzle;
  active: boolean;
  onDone: (solved: boolean) => void;
}) {
  const t = useT(puzzleMessages);
  const locale = useLocale();
  const modeName = useModeText(puzzle.mode).name;
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const solver = usePuzzleSolver(puzzle, {
    retract: false,
    onSolved: () => {
      timer.current = setTimeout(() => done.current(true), SOLVED_PAUSE_MS);
    },
    onMiss: () => done.current(false),
  });
  const { game, step, phase, refutation, start } = solver;
  const side = start.currentPlayer;
  useGameFeedback(game, { you: side });
  useTurnTint(game);

  const hints: BoardHint[] =
    refutation && refutation.move !== null ? [{ index: refutation.move, kind: 'threat' }] : [];
  const theme = themeName(puzzle.theme, locale);
  const message =
    phase === 'wrong'
      ? refutation
        ? refutationText(refutation.kind, locale)
        : t('notThatOneShort')
      : phase === 'solved'
        ? t('solved')
        : phase === 'replying'
          ? t('theyDefendShort')
          : step === 0
            ? t('winInShort', { count: puzzle.mateIn })
            : t('keepGoing');

  return (
    <main className="flex w-full flex-1 animate-board-in flex-col items-center justify-center gap-3 py-3">
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <Mark
          player={side}
          hole="var(--color-surface)"
          className={cx('size-6', side === X && 'p-0.5')}
        />
        <span>
          {t('rushHeading', { mode: modeName, count: puzzle.mateIn })}
          {theme ? ` · ${theme}` : ''}
        </span>
      </div>
      <Board
        game={game}
        onPlay={solver.attempt}
        disabled={!active || phase !== 'solving'}
        finishTone={phase === 'solved' ? 'win' : null}
        hints={hints}
      />
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
  );
}

/** A clock reading, "2:05", in the locale's digits. */
function clockText(seconds: number, locale: Locale): string {
  const padded = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 }).format(seconds % 60);
  return `${formatNumber(Math.floor(seconds / 60), locale)}:${padded}`;
}
