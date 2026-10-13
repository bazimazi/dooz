import { afterEach, describe, expect, it } from 'vitest';
import { savePreferences } from '@/lib/preferences';
import { duration, ordinal, signed, winRate } from './format';

afterEach(() => {
  savePreferences({ language: 'system' });
});

describe('format helpers', () => {
  it('write English as they always have', () => {
    savePreferences({ language: 'en' });
    expect(duration(252_000)).toBe('4m 12s');
    expect(duration(9_000)).toBe('9s');
    expect(duration(65_000)).toBe('1m 05s');
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(22)).toBe('22nd');
    expect(signed(12)).toBe('+12');
    expect(signed(-7)).toBe('-7');
    expect(signed(0)).toBe('0');
    expect(winRate(2, 3)).toBe('67%');
    expect(winRate(0, 0)).toBe('—');
  });

  it('follow the chosen language', () => {
    savePreferences({ language: 'fr' });
    expect(ordinal(1)).toBe('1er');
    expect(ordinal(2)).toBe('2e');
    expect(duration(252_000)).toBe('4 min 12 s');

    savePreferences({ language: 'fa' });
    expect(duration(9_000)).toBe('۹ ثانیه');
  });
});
