import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MOTIFS } from '@/lib/music-score';
import { RIVALS } from './stages';
import { rivalWorld, useRivalWorld } from './worlds';

describe('rival worlds', () => {
  it('gives every rival a world with its own motif and theme', () => {
    const motifs = new Set<string>();
    for (const rival of RIVALS) {
      const world = rivalWorld(rival.id);
      expect(world, rival.id).not.toBeNull();
      expect(MOTIFS[world!.music], rival.id).toBeDefined();
      motifs.add(world!.motif);
    }
    expect(motifs.size).toBe(RIVALS.length);
    expect(rivalWorld('nobody')).toBeNull();
  });

  it('applies to the page while mounted and clears on the way out', () => {
    const root = document.documentElement;
    const { unmount } = renderHook(() => useRivalWorld(rivalWorld('nyx')));
    expect(root.dataset['world']).toBe('nyx');
    expect(root.style.getPropertyValue('--world-accent')).toBe('#a77bff');
    unmount();
    expect(root.dataset['world']).toBeUndefined();
    expect(root.style.getPropertyValue('--world-accent')).toBe('');
  });
});
