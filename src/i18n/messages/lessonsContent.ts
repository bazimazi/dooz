import { type Lesson, LESSONS } from '@/features/lessons/lessons';
import { defineMessages, type Locale, translate, useLocale } from '@/i18n';
import { lessonsContentDe } from './lessonsContent.de';
import { lessonsContentEs } from './lessonsContent.es';
import { lessonsContentFa } from './lessonsContent.fa';
import { lessonsContentFr } from './lessonsContent.fr';

/**
 * The words of every lesson, in every language.
 *
 * English stays in `lessons.ts`, beside the positions it describes, because a
 * lesson's text and its moves are written - and checked - together. This
 * catalog's English is read out of that list rather than copied, so the two
 * cannot drift; each other language has a file of its own, the lessons being
 * long. Keys are `<lessonId>.title`, `<lessonId>.intro` and, for each step
 * counting from 1, `<lessonId>.<step>.prompt`, `.hint`, `.success` and
 * `.wrong`. Anything a language has not translated reads in English.
 *
 * Because the English keys are built at load time they are not checked by the
 * compiler; `lessonsContent.test.ts` checks instead that every translation
 * covers every key and invents none.
 */

const STEP_FIELDS = ['prompt', 'hint', 'success', 'wrong'] as const;
type StepField = (typeof STEP_FIELDS)[number];

function stepKey(lessonId: string, step: number, field: StepField): string {
  return `${lessonId}.${step + 1}.${field}`;
}

function english(): Record<string, string> {
  const messages: Record<string, string> = {};
  for (const lesson of LESSONS) {
    messages[`${lesson.id}.title`] = lesson.title;
    messages[`${lesson.id}.intro`] = lesson.intro;
    lesson.steps.forEach((step, index) => {
      for (const field of STEP_FIELDS) messages[stepKey(lesson.id, index, field)] = step[field];
    });
  }
  return messages;
}

export const lessonContentMessages = defineMessages({
  en: english(),
  es: lessonsContentEs,
  fr: lessonsContentFr,
  de: lessonsContentDe,
  fa: lessonsContentFa,
});

export type LessonStepText = Readonly<Record<StepField, string>>;

export interface LessonText {
  readonly title: string;
  readonly intro: string;
  /** One per step, in the lesson's order. */
  readonly steps: readonly LessonStepText[];
}

/** A lesson's title, intro and step texts in `locale` (the current one by default). */
export function lessonText(lesson: Lesson, locale?: Locale): LessonText {
  const read = (key: string) => translate(lessonContentMessages, key, undefined, locale);
  return {
    title: read(`${lesson.id}.title`),
    intro: read(`${lesson.id}.intro`),
    steps: lesson.steps.map((_, index) => ({
      prompt: read(stepKey(lesson.id, index, 'prompt')),
      hint: read(stepKey(lesson.id, index, 'hint')),
      success: read(stepKey(lesson.id, index, 'success')),
      wrong: read(stepKey(lesson.id, index, 'wrong')),
    })),
  };
}

/** As {@link lessonText}, re-rendering when the player changes language. */
export function useLessonText(lesson: Lesson): LessonText {
  return lessonText(lesson, useLocale());
}

/**
 * A translator for any lesson, for lists that show several. The hook is what
 * re-renders on a language change; calling the result just reads the catalog.
 */
export function useLessonTexts(): (lesson: Lesson) => LessonText {
  const locale = useLocale();
  return (lesson) => lessonText(lesson, locale);
}
