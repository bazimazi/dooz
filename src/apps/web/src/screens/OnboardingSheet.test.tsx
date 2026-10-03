import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OnboardingSheet } from './OnboardingSheet';

describe('learning by playing', () => {
  it.each(['row 1, column 1, empty', 'row 2, column 2, empty', 'row 3, column 3, empty'])(
    'accepts %s when instructed to tap any empty square',
    async (name) => {
      render(<OnboardingSheet mode="classic" onClose={vi.fn()} />);
      await userEvent.click(screen.getByRole('gridcell', { name }));
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
      expect(screen.queryByText(/try again/i)).not.toBeInTheDocument();
      expect(
        screen
          .getAllByRole('gridcell')
          .every((cell) => cell.getAttribute('aria-disabled') === 'true'),
      ).toBe(true);
    },
  );

  it('still teaches a specific winning move and a specific block', async () => {
    render(<OnboardingSheet mode="classic" onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('gridcell', { name: 'row 1, column 1, empty' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('gridcell', { name: 'row 3, column 3, empty' }));
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    await userEvent.click(
      screen.getByRole('gridcell', { name: /row 1, column 3, empty, winning move/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('gridcell', { name: 'row 3, column 3, empty' }));
    expect(
      screen.getByRole('gridcell', { name: /row 3, column 1, empty, block/ }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('gridcell', { name: /row 3, column 1, empty, block/ }));
    expect(screen.getByRole('button', { name: 'Start playing' })).toBeEnabled();
  });
});
