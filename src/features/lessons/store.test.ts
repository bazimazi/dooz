import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LESSONS } from './lessons';
import { completedLessonCount, isLessonComplete, onLessonComplete, useLessonStore } from './store';

const first = LESSONS[0]!.id;
const second = LESSONS[1]!.id;

describe('lesson store', () => {
  beforeEach(() => {
    useLessonStore.getState().reset();
  });
  afterEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('records a lesson once and remembers it', () => {
    const { completeLesson } = useLessonStore.getState();
    expect(isLessonComplete(first)).toBe(false);
    expect(completeLesson(first)).toBe(true);
    expect(completeLesson(first)).toBe(false);
    expect(isLessonComplete(first)).toBe(true);
    expect(useLessonStore.getState().completed).toEqual([first]);
    expect(JSON.parse(localStorage.getItem('dooz.lessons') ?? 'null')).toEqual({
      completed: [first],
    });
  });

  it('counts only lessons that exist', () => {
    const { completeLesson } = useLessonStore.getState();
    completeLesson(first);
    completeLesson(second);
    completeLesson('retired-lesson');
    expect(completedLessonCount()).toBe(2);
  });

  it('tells listeners and the window, first time or not', () => {
    const heard: [string, boolean][] = [];
    const events: unknown[] = [];
    const stop = onLessonComplete((id, firstTime) => heard.push([id, firstTime]));
    const onEvent = (event: Event) => events.push((event as CustomEvent).detail);
    window.addEventListener('dooz:lesson-complete', onEvent);

    const { completeLesson } = useLessonStore.getState();
    completeLesson(first);
    completeLesson(first);
    stop();
    completeLesson(second);
    window.removeEventListener('dooz:lesson-complete', onEvent);

    expect(heard).toEqual([
      [first, true],
      [first, false],
    ]);
    expect(events).toEqual([
      { id: first, firstTime: true },
      { id: first, firstTime: false },
      { id: second, firstTime: true },
    ]);
  });

  it('survives a listener that throws', () => {
    const stop = onLessonComplete(() => {
      throw new Error('broken');
    });
    expect(useLessonStore.getState().completeLesson(first)).toBe(true);
    expect(isLessonComplete(first)).toBe(true);
    stop();
  });

  it('loads what was saved and shrugs off anything unreadable', async () => {
    localStorage.setItem('dooz.lessons', JSON.stringify({ completed: [first, 7, first, second] }));
    vi.resetModules();
    const saved = await import('./store');
    expect(saved.useLessonStore.getState().completed).toEqual([first, second]);

    for (const raw of ['{not json', 'null', '"text"', JSON.stringify({ completed: 'all' })]) {
      localStorage.setItem('dooz.lessons', raw);
      vi.resetModules();
      const fresh = await import('./store');
      expect(fresh.useLessonStore.getState().completed).toEqual([]);
    }
  });
});
