import { describe, expect, it } from 'vitest';
import { isNameAllowed, nameProblem, normaliseName } from './name-filter.js';

describe('display-name filter', () => {
  it('lets ordinary names through, including ones that contain a short bad word', () => {
    for (const name of [
      'Ada',
      'Grace Hopper',
      'Scunthorpe United',
      'Dickens',
      'Hancock',
      'Cocktail_Hour',
      'Classic',
      'Passion.Fruit',
      'Assistant',
      'Therapist Tom',
      'Nigeria Fan',
      'Speedo',
      'Swanky',
      'Skyscraper',
      'Modern',
      'Moody',
      'Player0042',
    ]) {
      expect(nameProblem(name), name).toBeNull();
    }
  });

  it('refuses obscenities however they are disguised', () => {
    for (const name of [
      'fuck',
      'FUUUCK',
      'f.u.c.k',
      'Fück you',
      'sh1t head',
      'b1tch',
      'big c0ck',
    ]) {
      expect(nameProblem(name), name).toBe('offensive');
    }
  });

  it('refuses short words only when they stand alone', () => {
    expect(isNameAllowed('Ass')).toBe(false);
    expect(isNameAllowed('Big ass')).toBe(false);
    expect(isNameAllowed('Cock')).toBe(false);
    expect(isNameAllowed('Classy')).toBe(true);
  });

  it('refuses names that pass as staff', () => {
    expect(nameProblem('Admin')).toBe('reserved');
    expect(nameProblem('Moderator_1')).toBe('reserved');
    expect(nameProblem('Mod Squad')).toBe('reserved');
    expect(nameProblem('d00z official')).toBe('reserved');
    expect(nameProblem('Support')).toBe('reserved');
    expect(nameProblem('Adminton')).toBeNull();
  });

  it('normalises leetspeak, accents, separators and repeats', () => {
    expect(normaliseName('H3ll0 W0rld')).toEqual({
      words: ['helo', 'world'],
      squashed: 'heloworld',
    });
    expect(normaliseName('Ünïcödé').squashed).toBe('unicode');
  });
});
