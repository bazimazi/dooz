import { createGame, X } from '@dooz/engine';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Board } from './Board';

function played(indices: number[]) {
  const game = createGame(3, X);
  const board = [...game.board];
  for (const [turn, index] of indices.entries()) board[index] = turn % 2 === 0 ? 1 : 2;
  return { ...game, board };
}

describe('Board', () => {
  it('plays the cell that was clicked', async () => {
    const onPlay = vi.fn();
    render(<Board game={createGame(3, X)} onPlay={onPlay} />);

    await userEvent.click(screen.getByRole('gridcell', { name: 'row 2, column 2, empty' }));
    expect(onPlay).toHaveBeenCalledWith(4);
  });

  it('refuses a cell that is already taken', async () => {
    const onPlay = vi.fn();
    render(<Board game={played([0])} onPlay={onPlay} />);

    await userEvent.click(screen.getByRole('gridcell', { name: 'row 1, column 1, X' }));
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('refuses every cell while it is the opponent’s turn', async () => {
    const onPlay = vi.fn();
    render(<Board game={createGame(3, X)} onPlay={onPlay} disabled />);

    await userEvent.click(screen.getByRole('gridcell', { name: 'row 1, column 1, empty' }));
    expect(onPlay).not.toHaveBeenCalled();
  });

  /**
   * The roving tabindex anchors to one cell. When cells were `disabled` rather
   * than `aria-disabled`, playing that cell left the grid with no tab stop at
   * all and the board became unreachable by keyboard.
   */
  it('keeps a tab stop after the anchor cell has been played', async () => {
    render(<Board game={played([0])} onPlay={vi.fn()} />);

    const anchor = screen.getByRole('gridcell', { name: 'row 1, column 1, X' });
    expect(anchor).toHaveAttribute('tabindex', '0');

    await userEvent.tab();
    expect(anchor).toHaveFocus();
  });

  it('moves focus with the arrow keys and stays inside the row', async () => {
    render(<Board game={createGame(3, X)} onPlay={vi.fn()} />);

    await userEvent.tab();
    expect(screen.getByRole('gridcell', { name: 'row 1, column 1, empty' })).toHaveFocus();

    await userEvent.keyboard('{ArrowRight}{ArrowDown}');
    expect(screen.getByRole('gridcell', { name: 'row 2, column 2, empty' })).toHaveFocus();

    // Column 1 is the left edge, so left again must not wrap to the row above.
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('gridcell', { name: 'row 2, column 1, empty' })).toHaveFocus();
  });

  it('exposes rows between the grid and its cells', () => {
    render(<Board game={createGame(3, X)} onPlay={vi.fn()} />);

    // `role="grid"` is only valid with `role="row"` in between; without the
    // rows the cells are not in a grid as far as a screen reader is concerned.
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(screen.getAllByRole('gridcell').filter((cell) => row.contains(cell))).toHaveLength(3);
    }
  });
});
