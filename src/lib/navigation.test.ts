import { createMemoryHistory } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { createAppHistory, returnEntry } from './navigation';

describe('page history', () => {
  it('retains the return destination through repeated setting replacements and reload state', () => {
    const history = createAppHistory(createMemoryHistory());
    history.push('/play/bot?difficulty=easy');
    history.replace('/play/bot?difficulty=hard');
    history.replace('/play/bot?difficulty=expert');
    expect(history.length).toBe(2);
    expect(returnEntry(history, '/')).toEqual({ href: '/', index: 0 });
    history.back();
    expect(history.location.href).toBe('/');
  });

  it.each(['push', 'replace'] as const)(
    'a destination chosen in a sheet uses its slot with %s',
    (method) => {
      const history = createAppHistory(createMemoryHistory());
      history.push('/journey');
      history.push('/journey', { ...history.location.state, __doozSheet: 'stage' });
      history[method]('/play/bot?stage=beginner-1');
      expect(history.length).toBe(3);
      expect(history.location.state['__doozSheet']).toBeUndefined();
      expect(returnEntry(history, '/journey')).toEqual({ href: '/journey', index: 1 });
      history.back();
      expect(history.location.href).toBe('/journey');
      expect(history.location.state['__doozSheet']).toBeUndefined();
      history.back();
      expect(history.location.href).toBe('/');
    },
  );

  it('returns to the nearest visit, retaining query parameters', () => {
    const history = createAppHistory(createMemoryHistory());
    history.push('/profile');
    history.push('/puzzles?filter=2');
    history.push('/puzzles/p1');
    history.replace('/puzzles/p2');
    const entry = returnEntry(history, '/puzzles')!;
    history.go(entry.index - history.location.state['__TSR_index']);
    expect(history.location.href).toBe('/puzzles?filter=2');
    expect(returnEntry(history, '/profile')).toEqual({ href: '/profile', index: 1 });
  });

  it('has no invented return page on a direct link', () => {
    const history = createAppHistory(createMemoryHistory({ initialEntries: ['/replay/shared'] }));
    expect(returnEntry(history, '/profile')).toBeUndefined();
  });
});
