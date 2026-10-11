import { createGame } from '@/game/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { revealDelayFor } from '@/game/components/ResultModal';
import {
  applyGraphics,
  loadPreferences,
  savePreferences,
  subscribePreferences,
} from './preferences';

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-graphics');
});

describe('graphics preferences', () => {
  it.each([undefined, null, 'auto', 1, false])(
    'defaults invalid or missing quality %s to high',
    (graphics) => {
      localStorage.setItem('dooz.preferences', JSON.stringify({ graphics }));
      expect(loadPreferences().graphics).toBe('high');
    },
  );

  it('applies immediately, persists and notifies mounted consumers', () => {
    const listener = vi.fn();
    const unsubscribe = subscribePreferences(listener);
    try {
      savePreferences({ graphics: 'low', theme: 'dark', volume: 0.4 });
      expect(document.documentElement).toHaveAttribute('data-graphics', 'low');
      expect(loadPreferences()).toMatchObject({ graphics: 'low', theme: 'dark', volume: 0.4 });
      expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ graphics: 'low' }));
      savePreferences({ graphics: 'balanced' });
      expect(loadPreferences()).toMatchObject({ graphics: 'balanced', theme: 'dark', volume: 0.4 });
      applyGraphics(loadPreferences().graphics);
      expect(document.documentElement).toHaveAttribute('data-graphics', 'balanced');
    } finally {
      unsubscribe();
    }
  });

  it('keeps session choices usable when storage cannot be written', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    try {
      savePreferences({ graphics: 'low' });
      savePreferences({ sound: false });
      expect(loadPreferences()).toMatchObject({ graphics: 'low', sound: false });
      expect(document.documentElement).toHaveAttribute('data-graphics', 'low');
    } finally {
      write.mockRestore();
      savePreferences({ graphics: 'high', sound: true });
    }
  });

  it('skips the reveal pause only when low graphics is explicitly selected', () => {
    const game = createGame(3);
    expect(revealDelayFor(game)).toBe(700);
    savePreferences({ graphics: 'low' });
    expect(revealDelayFor(game)).toBe(0);
    savePreferences({ graphics: 'balanced' });
    expect(revealDelayFor(game)).toBe(300);
    savePreferences({ graphics: 'high' });
    expect(revealDelayFor(game)).toBe(700);
  });
});

describe('animation policy', () => {
  it.each([true, false, 'yes'])('ignores the legacy reducedMotion value %s', (reducedMotion) => {
    localStorage.setItem(
      'dooz.preferences',
      JSON.stringify({ reducedMotion, hints: true, volume: 0.4 }),
    );
    expect(loadPreferences()).not.toHaveProperty('reducedMotion');
    expect(loadPreferences()).toMatchObject({ hints: true, volume: 0.4 });

    savePreferences({ sound: false });
    expect(JSON.parse(localStorage.getItem('dooz.preferences')!)).not.toHaveProperty(
      'reducedMotion',
    );
    expect(loadPreferences()).toMatchObject({ hints: true, volume: 0.4, sound: false });
  });
  it.each([true, false])(
    'keeps result timing when the device motion preference is %s',
    (matches) => {
      const media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches } as MediaQueryList);
      expect(revealDelayFor(createGame(3))).toBe(700);
      expect(revealDelayFor(createGame(3), 'resign')).toBe(0);
      expect(media).not.toHaveBeenCalled();
    },
  );
});
