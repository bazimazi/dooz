import { applyMove, DEFAULT_MODE_ID, type GameState, type ModeId, X } from '@/game/engine';
import { Link, useNavigate } from '@tanstack/react-router';
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { BackIcon, RefreshIcon } from '@/components/art/icons';
import { Mark } from '@/components/art/marks';
import { BulbIcon } from '@/components/art/ui-icons';
import { Board, type BoardHint } from '@/game/components/Board';
import { HintLegend } from '@/game/components/HintLegend';
import { ResultModal, revealDelayFor } from '@/game/components/ResultModal';
import { Button, buttonClasses, buttonStyle } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { IconButton, iconButtonClasses } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { useGameFeedback } from '@/game/useGameFeedback';
import { useTurnTint } from '@/game/useTurnTint';
import {
  type Lesson,
  lessonById,
  lessonIndex,
  LESSONS,
  stepStart,
} from '@/features/lessons/lessons';
import { completedLessonCount, useLessonStore } from '@/features/lessons/store';
import { useT } from '@/i18n';
import { lessonMessages } from '@/i18n/messages/lessons';
import { useLessonText } from '@/i18n/messages/lessonsContent';
import { useModeText } from '@/i18n/messages/modes';
import { cx } from '@/lib/cx';
import { haptics, sfx } from '@/lib/sound';

/** How long a wrong answer stays on the board before it is taken back. */
const WRONG_MS = 1400;

export function LessonScreen({ id }: { id: string }) {
  const t = useT(lessonMessages);
  const lesson = lessonById(id);
  if (!lesson) {
    return (
      <Screen scroll>
        <Card className="w-full">
          <EmptyState
            title={t('notFoundTitle')}
            body={t('notFoundBody')}
            action={
              <LessonsLink
                mode={DEFAULT_MODE_ID}
                className={buttonClasses({ size: 'small', className: 'w-auto px-4' })}
                style={buttonStyle()}
              >
                <span className="relative z-2">{t('allLessons')}</span>
              </LessonsLink>
            }
          />
        </Card>
      </Screen>
    );
  }
  // Keyed so moving to the next lesson starts it clean.
  return <LessonPlayer key={lesson.id} lesson={lesson} />;
}

type Phase = 'intro' | 'playing' | 'wrong' | 'right' | 'done';

/**
 * One lesson, a step at a time.
 *
 * It opens on the idea in words, then hands over the board. Every step is a
 * single move on the real board: the right one stays and says why; a wrong one
 * lands, is explained, and is lifted again - the same rhythm as the puzzles,
 * because seeing a move fail is how the lesson sticks. Answers are checked
 * against the step's stored list, which the engine has already proved, so
 * nothing is searched here.
 */
function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const navigate = useNavigate();
  const t = useT(lessonMessages);
  const text = useLessonText(lesson);
  const modeName = useModeText(lesson.mode).name;
  const completeLesson = useLessonStore((state) => state.completeLesson);
  const completed = useLessonStore((state) => state.completed);

  const [stepIndex, setStepIndex] = useState(0);
  const step = lesson.steps[stepIndex] ?? lesson.steps[0]!;
  const words = text.steps[stepIndex] ?? text.steps[0]!;
  const [game, setGame] = useState<GameState>(() => stepStart(lesson, step));
  const [phase, setPhase] = useState<Phase>('intro');
  const [hinted, setHinted] = useState(false);
  const [misses, setMisses] = useState(0);
  const [helped, setHelped] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const buzz = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(buzz.current);
    },
    [],
  );

  const solver = useMemo(() => stepStart(lesson, step).currentPlayer, [lesson, step]);
  useGameFeedback(game, { you: solver });
  useTurnTint(phase === 'intro' ? null : game);

  const index = lessonIndex(lesson.id);
  const last = stepIndex === lesson.steps.length - 1;
  const nextLesson = LESSONS[index + 1];

  const hints: BoardHint[] =
    hinted && phase === 'playing'
      ? step.accept.map((square) => ({ index: square, kind: 'best' }))
      : [];

  function goTo(next: number) {
    clearTimeout(timer.current);
    clearTimeout(buzz.current);
    const target = lesson.steps[next];
    if (!target) return;
    setStepIndex(next);
    setGame(stepStart(lesson, target));
    setHinted(false);
    setPhase('playing');
  }

  function attempt(square: number) {
    if (phase !== 'playing') return;
    const next = applyMove(game, square);
    if (!next) return;

    if (!step.accept.includes(square)) {
      // Show it, say why, take it back.
      const before = game;
      setGame(next);
      setPhase('wrong');
      setMisses((count) => count + 1);
      buzz.current = setTimeout(() => {
        sfx.wrong();
        haptics.buzz([12, 40, 12]);
      }, 180);
      timer.current = setTimeout(() => {
        setGame(before);
        setPhase('playing');
      }, WRONG_MS);
      return;
    }

    setGame(next);
    setHinted(false);
    setPhase('right');
    // Recorded on the last right answer rather than on the closing button, so
    // a player who has seen enough and leaves still has the lesson ticked.
    if (last) completeLesson(lesson.id);
  }

  function restart() {
    setMisses(0);
    setHelped(false);
    setReviewing(false);
    goTo(0);
  }

  const message =
    phase === 'wrong'
      ? words.wrong
      : phase === 'right' || phase === 'done'
        ? words.success
        : hinted
          ? words.hint
          : '';
  // The mark is bold wherever the language puts it, so the placeholder is
  // split around rather than filled.
  const [playBefore, playAfter = ''] = t('youPlay').split('{mark}');

  return (
    <Screen scroll>
      <header className="flex w-full items-center gap-3 pt-2">
        <LessonsLink
          mode={lesson.mode}
          aria-label={t('allLessons')}
          title={t('allLessons')}
          className={iconButtonClasses({ tone: 'bare', size: 'small' })}
        >
          <BackIcon className="rtl:-scale-x-100" />
        </LessonsLink>
        <div className="flex min-w-0 flex-col">
          <h1 className="font-display text-xl leading-tight">{text.title}</h1>
          <span className="truncate text-xs text-ink-faint">
            {modeName} · {t('lessonOf', { number: index + 1, total: LESSONS.length })}
          </span>
        </div>
      </header>

      {phase === 'intro' ? (
        <main className="flex w-full flex-1 animate-rise flex-col justify-center gap-4 py-6">
          <Card className="w-full">
            <div className="flex flex-col gap-3">
              <span className="text-xs tracking-wide text-ink-faint uppercase">
                {modeName} · {t('steps', { count: lesson.steps.length })}
              </span>
              <h2 className="font-display text-2xl leading-tight">{text.title}</h2>
              <p className="text-sm text-ink-muted">{text.intro}</p>
              <Button
                variant="primary"
                size="small"
                className="mt-2 w-auto self-start px-6"
                onClick={() => goTo(0)}
              >
                {t('start')}
              </Button>
            </div>
          </Card>
        </main>
      ) : (
        <>
          <main className="flex w-full flex-1 animate-board-in flex-col items-center justify-center gap-4 py-4">
            <div className="flex items-center gap-3 rounded-full border border-stroke-soft bg-surface/70 py-1.5 ps-2 pe-4">
              <Mark
                player={solver}
                hole="var(--color-surface)"
                className={cx('size-7', solver === X && 'p-0.5')}
              />
              <span className="text-sm">
                {playBefore}
                <strong>{solver === X ? 'X' : 'O'}</strong>
                {playAfter} · {t(`kind.${step.kind}`)}
              </span>
              {/* One pip per step, filled as they are passed. */}
              <span
                className="flex gap-1"
                role="img"
                aria-label={t('stepOf', { step: stepIndex + 1, total: lesson.steps.length })}
              >
                {lesson.steps.map((entry, pip) => (
                  <span
                    key={`${entry.kind}-${pip}`}
                    className={cx(
                      'size-2 rounded-full transition-colors duration-300',
                      pip < stepIndex ||
                        (pip === stepIndex && (phase === 'right' || phase === 'done'))
                        ? 'bg-ok'
                        : pip === stepIndex
                          ? 'bg-ink-muted'
                          : 'bg-stroke-soft',
                    )}
                  />
                ))}
              </span>
            </div>

            <h2 aria-live="polite" className="min-h-12 max-w-sm text-center text-base text-balance">
              {words.prompt}
            </h2>

            {/* Boards never mirror: the lesson's "top-left" is the same in every language. */}
            <div dir="ltr" className="contents">
              <Board
                game={game}
                onPlay={attempt}
                disabled={phase !== 'playing'}
                finishTone={
                  (phase === 'right' || phase === 'done') &&
                  game.status === 'won' &&
                  game.winner === solver
                    ? 'win'
                    : null
                }
                hints={hints}
              />
            </div>
            {hinted ? <HintLegend hints={hints} /> : null}

            <p
              key={message}
              aria-live="polite"
              className={cx(
                'min-h-10 max-w-sm animate-toast-in text-center text-sm text-balance',
                phase === 'wrong'
                  ? 'text-danger'
                  : phase === 'right' || phase === 'done'
                    ? 'text-ok'
                    : 'text-ink-muted',
              )}
            >
              {message}
            </p>
          </main>

          <footer className="flex flex-wrap items-center justify-center gap-3 pb-4">
            {phase === 'done' && reviewing ? (
              <Button size="small" variant="ghost" onClick={() => setReviewing(false)}>
                {t('showResult')}
              </Button>
            ) : null}
            {phase === 'right' ? (
              <Button
                variant="primary"
                size="small"
                className="w-auto px-6"
                onClick={() => (last ? setPhase('done') : goTo(stepIndex + 1))}
              >
                {last ? t('finishLesson') : t('nextStep')}
              </Button>
            ) : null}
            <IconButton
              label={t('tryAgain')}
              onClick={() => goTo(stepIndex)}
              disabled={phase === 'wrong' || phase === 'done'}
            >
              <RefreshIcon />
            </IconButton>
            <IconButton
              label={hinted ? t('hintShown') : t('showHint')}
              aria-pressed={hinted}
              disabled={phase !== 'playing'}
              onClick={() => {
                setHinted(true);
                setHelped(true);
              }}
              className={hinted ? 'text-ok' : undefined}
            >
              <BulbIcon />
            </IconButton>
          </footer>
        </>
      )}

      {phase === 'done' && !reviewing ? (
        <ResultModal
          onDismiss={() => setReviewing(true)}
          title={t('lessonComplete')}
          art={<Mark player={solver} hole="var(--color-surface)" className="size-20" />}
          note={`${
            misses === 0
              ? helped
                ? t('noteHelped')
                : t('noteClean')
              : t('noteMisses', { count: misses })
          } ${t('noteDone', { done: completedLessonCount(completed), total: LESSONS.length })}`}
          celebrate
          revealDelay={game.status === 'won' ? revealDelayFor(game) : 0}
          actions={
            <>
              {nextLesson ? (
                <Button
                  variant="primary"
                  size="small"
                  block
                  onClick={() =>
                    void navigate({
                      to: '/learn/lesson/$id',
                      params: { id: nextLesson.id },
                      replace: true,
                    })
                  }
                >
                  {t('nextLesson')}
                </Button>
              ) : null}
              <Button variant="ghost" size="small" block onClick={restart}>
                {t('doItAgain')}
              </Button>
              <LessonsLink
                mode={lesson.mode}
                className={buttonClasses({ variant: 'ghost', size: 'small', block: true })}
                style={buttonStyle('ghost')}
              >
                <span className="relative z-2">{t('allLessons')}</span>
              </LessonsLink>
            </>
          }
        />
      ) : null}
    </Screen>
  );
}

/**
 * Back to the lesson list, on the mode the lesson belongs to. A real link so it
 * opens in a new tab and reads as one, styled by whichever control it stands in
 * for.
 */
function LessonsLink({
  mode,
  className,
  style,
  children,
  ...label
}: {
  mode: ModeId;
  className: string;
  style?: CSSProperties;
  children: ReactNode;
  'aria-label'?: string;
  title?: string;
}) {
  return (
    <Link to="/learn" search={{ mode }} replace className={className} style={style} {...label}>
      {children}
    </Link>
  );
}
