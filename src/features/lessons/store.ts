import { create } from 'zustand';
import { lessonById } from './lessons';

const STORAGE_KEY = 'dooz.lessons';

/**
 * Which lessons the player has finished.
 *
 * Kept on the device beside the rest of the offline progress, and just as
 * forgiving: anything unreadable in storage loads as "nothing finished yet"
 * rather than breaking the Learn screen, and losing it costs a few ticks.
 *
 * Other features hook in without this file knowing about them -
 * {@link onLessonComplete} for code in the app, and a `dooz:lesson-complete`
 * window event for anything listening from further away - so rewards for a
 * finished lesson live with the rewards, not here.
 */

export type LessonCompleteListener = (id: string, firstTime: boolean) => void;

const listeners = new Set<LessonCompleteListener>();

function load(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { completed?: unknown } | null;
    if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.completed)) {
      return [];
    }
    const ids = parsed.completed.filter((id): id is string => typeof id === 'string');
    return [...new Set(ids)];
  } catch {
    return [];
  }
}

function save(completed: readonly string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ completed }));
  } catch {
    // Without storage the ticks last the session, which is still worth having.
  }
}

function announce(id: string, firstTime: boolean): void {
  for (const listener of listeners) {
    try {
      listener(id, firstTime);
    } catch {
      // One broken listener must not cost the player their completion.
    }
  }
  if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent('dooz:lesson-complete', { detail: { id, firstTime } }));
  }
}

interface LessonState {
  /** Lesson ids finished at least once, in the order they were first finished. */
  completed: string[];
  /**
   * Record a finished lesson and tell anyone listening. Finishing one again
   * still announces it - a replay is worth a "well done" - but with
   * `firstTime` false, so nothing is rewarded twice. Returns `firstTime`.
   */
  completeLesson: (id: string) => boolean;
  reset: () => void;
}

export const useLessonStore = create<LessonState>((set, get) => ({
  completed: load(),

  completeLesson(id) {
    const firstTime = !get().completed.includes(id);
    if (firstTime) {
      const completed = [...get().completed, id];
      set({ completed });
      save(completed);
    }
    announce(id, firstTime);
    return firstTime;
  },

  reset() {
    set({ completed: [] });
    save([]);
  },
}));

export function isLessonComplete(id: string): boolean {
  return useLessonStore.getState().completed.includes(id);
}

/**
 * Finished lessons that still exist. A lesson retired in an update keeps its
 * stored id - harmless - but should not count towards anything.
 */
export function completedLessonCount(completed = useLessonStore.getState().completed): number {
  return completed.filter((id) => lessonById(id) !== undefined).length;
}

/** Be told whenever a lesson is finished. Returns the unsubscribe. */
export function onLessonComplete(listener: LessonCompleteListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
