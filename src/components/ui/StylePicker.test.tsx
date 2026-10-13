import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { loadPreferences, savePreferences } from '@/lib/preferences';
import { SettingsSheet } from '@/screens/SettingsSheet';

afterEach(() => {
  savePreferences({ style: 'pastel' });
});

it('switches the visual style live, persists it and keeps the theme choice independent', async () => {
  const user = userEvent.setup();
  render(<SettingsSheet onClose={vi.fn()} />);
  const styles = within(screen.getByRole('radiogroup', { name: 'Visual style' }));

  expect(styles.getByRole('radio', { name: 'Pastel' })).toBeChecked();
  expect(document.documentElement).not.toHaveAttribute('data-style');

  await user.click(styles.getByRole('radio', { name: 'Tabletop' }));
  expect(loadPreferences().style).toBe('tabletop');
  expect(document.documentElement).toHaveAttribute('data-style', 'tabletop');
  expect(screen.getByText(/wooden board on green felt/)).toBeInTheDocument();

  // The arrow keys walk the group, as a radio group should.
  await user.keyboard('{ArrowRight}');
  expect(loadPreferences().style).toBe('neon');
  expect(styles.getByRole('radio', { name: 'Neon Arcade' })).toHaveFocus();

  savePreferences({ theme: 'light' });
  expect(loadPreferences()).toMatchObject({ style: 'neon', theme: 'light' });

  await user.click(styles.getByRole('radio', { name: 'Pastel' }));
  expect(document.documentElement).not.toHaveAttribute('data-style');
  savePreferences({ theme: 'system' });
});
