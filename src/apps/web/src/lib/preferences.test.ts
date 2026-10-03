import { createGame } from '@dooz/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { revealDelayFor } from '@/components/game/ResultModal';
import { applyMotion, loadPreferences, prefersReducedMotion, savePreferences } from './preferences';

afterEach(() => {
  applyMotion(false);
  vi.restoreAllMocks();
});

describe('motion preferences', () => {
  it('migrates older preferences and ignores malformed values', () => {
    localStorage.setItem('dooz.preferences', JSON.stringify({ reducedMotion: 'yes' }));
    expect(loadPreferences().reducedMotion).toBe(false);
  });
  it('persists a motion setting and applies it immediately', () => {
    savePreferences({ reducedMotion: true });
    expect(loadPreferences().reducedMotion).toBe(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(revealDelayFor(createGame(3))).toBe(0);
    savePreferences({ reducedMotion: false });
    expect(prefersReducedMotion()).toBe(false);
  });
  it('respects the device preference even when the in-game toggle is off', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    applyMotion(false);
    expect(prefersReducedMotion()).toBe(true);
    expect(revealDelayFor(createGame(3))).toBe(0);
  });
});
