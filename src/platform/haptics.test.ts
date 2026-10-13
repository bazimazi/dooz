import { afterEach, describe, expect, it, vi } from 'vitest';
import { hapticsSupported, intentForPattern, playHaptic } from './haptics';

describe('haptics on the web', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('plays the caller pattern through navigator.vibrate', () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    expect(hapticsSupported()).toBe(true);
    playHaptic('success', [1, 2, 3]);
    expect(vibrate).toHaveBeenCalledWith([1, 2, 3]);
    playHaptic('light');
    expect(vibrate).toHaveBeenLastCalledWith(8);
  });

  it('never throws when vibration is unavailable', () => {
    Object.defineProperty(navigator, 'vibrate', {
      value: () => {
        throw new Error('blocked');
      },
      configurable: true,
    });
    expect(() => playHaptic('error')).not.toThrow();
  });

  it('judges an intent from an old-style pattern', () => {
    expect(intentForPattern(8)).toBe('light');
    expect(intentForPattern(140)).toBe('impact');
    expect(intentForPattern([10, 30, 10])).toBe('impact');
  });
});
