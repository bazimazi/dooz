import { describe, expect, it } from 'vitest';
import { deepLinkPath } from './deep-links';

describe('deepLinkPath', () => {
  it('opens a room from the custom scheme', () => {
    expect(deepLinkPath('dooz://play/online?code=ABCD')).toBe('/play/online?code=ABCD');
    expect(deepLinkPath('dooz:///play/online?code=ABCD')).toBe('/play/online?code=ABCD');
  });

  it('expands the short join form', () => {
    expect(deepLinkPath('dooz://join/ab12')).toBe('/play/online?code=ab12');
  });

  it('keeps known screens and their search', () => {
    expect(deepLinkPath('dooz://puzzles/daily')).toBe('/puzzles/daily');
    expect(deepLinkPath('dooz://play/bot?mode=classic')).toBe('/play/bot?mode=classic');
  });

  it('sends unknown or empty paths home', () => {
    expect(deepLinkPath('dooz://')).toBe('/');
    expect(deepLinkPath('dooz://admin/delete')).toBe('/');
  });

  it('accepts https links only from the public host', () => {
    const publicUrl = 'https://dooz.example.com';
    expect(deepLinkPath('https://dooz.example.com/play/online?code=WXYZ', publicUrl)).toBe(
      '/play/online?code=WXYZ',
    );
    expect(deepLinkPath('https://evil.example.com/play/online?code=WXYZ', publicUrl)).toBeNull();
    expect(deepLinkPath('https://dooz.example.com/play/online?code=WXYZ')).toBeNull();
  });

  it('rejects other schemes and garbage', () => {
    expect(deepLinkPath('javascript:alert(1)')).toBeNull();
    expect(deepLinkPath('http://dooz.example.com/play', 'http://dooz.example.com')).toBeNull();
    expect(deepLinkPath('not a url')).toBeNull();
  });
});
