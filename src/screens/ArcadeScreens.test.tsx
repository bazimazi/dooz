import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGauntletStore } from '@/features/arcade/gauntlet';
import { useProgressStore } from '@/features/progress/store';
import { useRunStore } from '@/features/run/store';
import { UnlockToast } from '@/game/components/UnlockToast';
import { loadPreferences } from '@/lib/preferences';
import { renderWithRouter } from '@/test/router';
import { ArcadeScreen } from './ArcadeScreen';
import { CollectionScreen } from './CollectionScreen';
import { DailyChallengeScreen } from './DailyChallengeScreen';
import { GauntletScreen } from './GauntletScreen';
import { RunScreen } from './RunScreen';

beforeEach(() => {
  localStorage.clear();
  useProgressStore.getState().reset();
  useGauntletStore.getState().abandon();
  useRunStore.getState().abandon();
});
afterEach(() => vi.useRealTimers());

describe('arcade screens', () => {
  it('lists every arcade mode on the hub', async () => {
    await renderWithRouter(<ArcadeScreen />);
    expect(screen.getByRole('link', { name: /Daily challenge #/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Gauntlet/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Run/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start blitz' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Bot difficulty' })).toBeInTheDocument();
  });

  it('introduces the daily challenge before it starts', async () => {
    await renderWithRouter(<DailyChallengeScreen />);
    expect(screen.getByRole('list', { name: "Today's twists" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Start the challenge' }));
    expect((await screen.findAllByRole('gridcell')).length).toBeGreaterThan(0);
  });

  it('starts a gauntlet on a board', async () => {
    await renderWithRouter(<GauntletScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Start a gauntlet' }));
    expect(screen.getByRole('img', { name: 'Lives: 3 of 3' })).toBeInTheDocument();
    // The gauntlet picks its mode at random, and the Qubic and Quantum boards
    // load on demand, so the cells may arrive a tick later.
    expect((await screen.findAllByRole('gridcell')).length).toBeGreaterThan(0);
  });

  it('walks onto the run map and into a fight', async () => {
    await renderWithRouter(<RunScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Start a run' }));
    const first = screen
      .getAllByRole('button', { name: /^Floor 1:/ })
      .find((button) => !button.hasAttribute('disabled'))!;
    await userEvent.click(first);
    expect((await screen.findAllByRole('gridcell')).length).toBeGreaterThan(0);
    expect(useRunStore.getState().run?.path).toHaveLength(1);
  });

  it('equips unlocked cosmetics and explains locked ones', async () => {
    await renderWithRouter(<CollectionScreen />);
    await userEvent.click(screen.getByRole('radio', { name: /Gold, locked/ }));
    expect(screen.getByText('Reach level 20.')).toBeInTheDocument();
    expect(loadPreferences().cosmetics.frame).toBeUndefined();
    await userEvent.click(screen.getByRole('radio', { name: 'No frame' }));
    expect(loadPreferences().cosmetics.frame).toBe('none');
  });
});

describe('reward toasts', () => {
  it('announces a level reached, once', async () => {
    vi.useFakeTimers();
    await renderWithRouter(<UnlockToast />);
    act(() => {
      for (let game = 0; game < 3; game++)
        useProgressStore.getState().recordBotGame('grid-6', 'medium', 'win');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByRole('status')).toHaveTextContent(/Level up/);
    expect(useProgressStore.getState().announced.some((id) => id.startsWith('level:'))).toBe(true);
  });
});
