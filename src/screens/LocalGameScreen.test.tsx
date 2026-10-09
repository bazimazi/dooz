import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '@/test/router';
import { LocalGameScreen } from './LocalGameScreen';

beforeEach(() => vi.spyOn(Math, 'random').mockReturnValue(0.1));
afterEach(() => vi.restoreAllMocks());

describe('local round recovery', () => {
  it('keeps a played round when a restart is cancelled, and resets only on confirmation', async () => {
    await renderWithRouter(<LocalGameScreen mode="classic" />);
    await userEvent.click(screen.getByRole('gridcell', { name: 'row 1, column 1, empty' }));
    await userEvent.click(screen.getByRole('button', { name: 'New game' }));
    expect(screen.getByRole('dialog', { name: 'Start a new round?' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('gridcell', { name: 'row 1, column 1, X' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New game' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'New game' }));
    await userEvent.click(screen.getByRole('button', { name: 'New round' }));
    expect(screen.getByRole('gridcell', { name: 'row 1, column 1, empty' })).toBeInTheDocument();
  });

  it('allows an empty round to restart immediately', async () => {
    await renderWithRouter(<LocalGameScreen mode="classic" />);
    await userEvent.click(screen.getByRole('button', { name: 'New game' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('uncovers a finished board, reopens results, and permits a take-back', async () => {
    await renderWithRouter(<LocalGameScreen mode="classic" />);
    for (const [row, col] of [
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 2],
      [1, 3],
    ]) {
      await userEvent.click(
        screen.getByRole('gridcell', { name: `row ${row}, column ${col}, empty` }),
      );
    }
    await userEvent.keyboard(' ');
    await userEvent.click(screen.getByRole('button', { name: 'Review board' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('gridcell', { name: 'row 1, column 3, X' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show result' }));
    await userEvent.keyboard(' ');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Take back the last move' }));
    expect(screen.getByRole('gridcell', { name: 'row 1, column 3, empty' })).toHaveAttribute(
      'aria-disabled',
      'false',
    );
  });
});
