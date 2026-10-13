import type { ModeId } from '@/game/engine';
import { Link } from '@tanstack/react-router';
import { CheckIcon, ChevronRightIcon } from '@/components/art/icons';
import { Card } from '@/components/ui/Card';
import { useT } from '@/i18n';
import { lessonMessages } from '@/i18n/messages/lessons';
import { type LessonText, useLessonTexts } from '@/i18n/messages/lessonsContent';
import { useModeTexts } from '@/i18n/messages/modes';
import { cx } from '@/lib/cx';
import { type Lesson, LESSON_MODES, LESSONS, lessonsForMode } from './lessons';
import { completedLessonCount, useLessonStore } from './store';

/**
 * The lessons, as the Learn screen lists them.
 *
 * The ones for the mode being read about come first and large, because that is
 * what the player is here to learn; the whole curriculum follows as a plain
 * list, grouped by mode, so nothing is hidden behind the tabs. Finished lessons
 * stay listed and ticked - a lesson is worth a second run.
 */
export function LessonsCard({ mode }: { mode: ModeId }) {
  const completed = useLessonStore((state) => state.completed);
  const featured = lessonsForMode(mode);
  const done = completedLessonCount(completed);
  const t = useT(lessonMessages);
  const modeText = useModeTexts();
  const textOf = useLessonTexts();

  return (
    <Card className="w-full">
      <div className="flex items-baseline gap-3">
        <h2 className="text-base font-semibold">{t('lessons')}</h2>
        <span className="tnum ms-auto text-sm text-ink-muted">
          {t('completeCount', { done, total: LESSONS.length })}
        </span>
      </div>

      {featured.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {featured.map((lesson) => (
            <li key={lesson.id}>
              <LessonRow
                lesson={lesson}
                text={textOf(lesson)}
                done={completed.includes(lesson.id)}
                featured
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">
          {t('noLessons', { mode: modeText(mode).name })}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3 border-t border-stroke-soft pt-4">
        <h3 className="text-xs tracking-wide text-ink-faint uppercase">{t('allLessons')}</h3>
        {LESSON_MODES.map((group) => (
          <section key={group} aria-label={modeText(group).name}>
            <h4 className="pb-1 text-xs font-semibold text-ink-muted">{modeText(group).name}</h4>
            <ul className="flex flex-col">
              {lessonsForMode(group).map((lesson) => (
                <li key={lesson.id}>
                  <LessonRow
                    lesson={lesson}
                    text={textOf(lesson)}
                    done={completed.includes(lesson.id)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Card>
  );
}

function LessonRow({
  lesson,
  text,
  done,
  featured = false,
}: {
  lesson: Lesson;
  text: LessonText;
  done: boolean;
  featured?: boolean;
}) {
  const t = useT(lessonMessages);
  const modeText = useModeTexts();
  const steps = t('steps', { count: lesson.steps.length });
  const label = { title: text.title, mode: modeText(lesson.mode).name, steps };
  return (
    <Link
      to="/learn/lesson/$id"
      params={{ id: lesson.id }}
      aria-label={t(done ? 'rowLabelDone' : 'rowLabel', label)}
      className={cx(
        'group flex items-center gap-3 text-start no-underline',
        'transition-[transform,border-color,background-color] duration-200 ease-spring',
        featured
          ? 'rounded-2xl border border-stroke-soft bg-surface/85 p-3 hover:-translate-y-0.5 hover:border-stroke active:scale-[0.98]'
          : 'rounded-xl px-1 py-1.5 hover:bg-stroke-soft',
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'flex shrink-0 items-center justify-center rounded-full',
          featured ? 'size-6' : 'size-5',
          done ? 'bg-ok text-g10' : 'border border-stroke-soft text-transparent',
        )}
      >
        <CheckIcon className={featured ? 'size-3.5' : 'size-3'} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cx('truncate', featured ? 'text-sm font-semibold' : 'text-sm')}>
          {text.title}
        </span>
        {featured ? (
          <span className="line-clamp-2 text-xs text-ink-faint">{text.intro}</span>
        ) : null}
      </span>
      <span className="shrink-0 text-xs text-ink-faint">{steps}</span>
      <ChevronRightIcon className="size-4 shrink-0 text-ink-faint rtl:-scale-x-100" />
    </Link>
  );
}
