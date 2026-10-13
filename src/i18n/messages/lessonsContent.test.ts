import { describe, expect, it } from 'vitest';
import { LESSONS } from '@/features/lessons/lessons';
import { LOCALES, type Message } from '@/i18n';
import { lessonMessages, stepKindLabel } from './lessons';
import { lessonContentMessages, lessonText } from './lessonsContent';

/**
 * The lesson catalogs' English is either built from `lessons.ts` or fixes the
 * keys by type, but the translations are plain records the compiler cannot
 * hold to it. So this checks what it cannot: every language translates every
 * lesson and step in full, invents no key a lesson does not have, and keeps
 * the interface's placeholders intact.
 */

const TRANSLATED = LOCALES.filter((locale) => locale !== 'en');

function placeholders(message: Message): string[] {
  const texts = typeof message === 'string' ? [message] : Object.values(message);
  return [...new Set(texts.flatMap((text) => text?.match(/\{\w+\}/g) ?? []))].toSorted();
}

describe('lesson content catalog', () => {
  const englishKeys = Object.keys(lessonContentMessages.en).toSorted();

  it('has English for every lesson and step, word for word', () => {
    expect(englishKeys).toHaveLength(
      LESSONS.reduce((count, lesson) => count + 2 + lesson.steps.length * 4, 0),
    );
    for (const lesson of LESSONS) {
      const text = lessonText(lesson, 'en');
      expect(text.title).toBe(lesson.title);
      expect(text.intro).toBe(lesson.intro);
      lesson.steps.forEach((step, index) => {
        expect(text.steps[index]).toEqual({
          prompt: step.prompt,
          hint: step.hint,
          success: step.success,
          wrong: step.wrong,
        });
      });
    }
  });

  it.each(TRANSLATED)('translates every key in %s, and only those', (locale) => {
    const translated = lessonContentMessages[locale] ?? {};
    expect(Object.keys(translated).toSorted()).toEqual(englishKeys);
    for (const [key, message] of Object.entries(translated)) {
      expect(typeof message === 'string' && message.trim().length > 0, key).toBe(true);
    }
  });

  it.each(TRANSLATED)('reads lessons in %s rather than English', (locale) => {
    const lesson = LESSONS[0]!;
    const text = lessonText(lesson, locale);
    expect(text.intro).not.toBe(lesson.intro);
    expect(text.steps).toHaveLength(lesson.steps.length);
  });
});

describe('lesson interface catalog', () => {
  it.each(TRANSLATED)('covers every message in %s with the same placeholders', (locale) => {
    const translated = lessonMessages[locale] ?? {};
    expect(Object.keys(translated).toSorted()).toEqual(Object.keys(lessonMessages.en).toSorted());
    for (const [key, english] of Object.entries(lessonMessages.en)) {
      const message = translated[key as keyof typeof lessonMessages.en];
      expect(message, key).toBeDefined();
      expect(placeholders(message!), key).toEqual(placeholders(english));
    }
  });

  it('labels every kind of step', () => {
    const kinds = new Set(LESSONS.flatMap((lesson) => lesson.steps.map((step) => step.kind)));
    for (const kind of kinds) expect(stepKindLabel(kind, 'en').length).toBeGreaterThan(0);
    expect(stepKindLabel('fork', 'en')).toBe('Double threat');
  });
});
