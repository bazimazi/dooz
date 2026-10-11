import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { Backdrop } from '@/components/art/Backdrop';
import { Confetti } from '@/components/art/Confetti';
import { loadPreferences } from '@/lib/preferences';
import { SettingsSheet } from './SettingsSheet';

afterEach(() => document.documentElement.removeAttribute('data-graphics'));

it('switches graphics live, removes costly decoration and restores the full experience', async () => {
  const user = userEvent.setup();
  const { container, unmount } = render(
    <>
      <Backdrop variant="home" />
      <Confetti />
      <SettingsSheet onClose={vi.fn()} />
    </>,
  );
  const quality = within(screen.getByRole('radiogroup', { name: 'Graphics quality' }));
  expect(quality.getByRole('radio', { name: 'High' })).toBeChecked();
  expect(container.querySelectorAll('.animate-confetti-y')).toHaveLength(56);

  await user.click(quality.getByRole('radio', { name: 'Balanced' }));
  expect(loadPreferences().graphics).toBe('balanced');
  expect(container.querySelectorAll('.animate-confetti-y')).toHaveLength(16);
  expect(container.querySelector('[filter="url(#dooz-soft)"]')).toBeNull();

  await user.click(quality.getByRole('radio', { name: 'Low' }));
  expect(document.documentElement).toHaveAttribute('data-graphics', 'low');
  expect(container.querySelector('.confetti')).toBeNull();
  expect(container.querySelector('#dooz-glow')).toBeNull();
  unmount();

  render(<SettingsSheet onClose={vi.fn()} />);
  expect(screen.getByRole('radio', { name: 'Low' })).toBeChecked();
  await user.click(screen.getByRole('radio', { name: 'High' }));
  expect(loadPreferences().graphics).toBe('high');
  expect(document.documentElement).toHaveAttribute('data-graphics', 'high');
});
