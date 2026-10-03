import { createGame } from '@dooz/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { revealDelayFor } from '@/components/game/ResultModal';
import { loadPreferences, savePreferences } from './preferences';

afterEach(() => {
  vi.restoreAllMocks();
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
