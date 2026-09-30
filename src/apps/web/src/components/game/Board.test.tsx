import { applyMove, createGame, modeById } from '@dooz/engine';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Board } from './Board';

function played(indices: number[]) {
  const game = createGame(3);
  const board = [...game.board];
  for (const [turn, index] of indices.entries()) board[index] = turn % 2 === 0 ? 1 : 2;
  return { ...game, board };
}

describe('Board', () => {
  it('plays the cell that was clicked', async () => {
    const onPlay = vi.fn();
    render(<Board game={createGame(3)} onPlay={onPlay} />);

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
    render(<Board game={createGame(3)} onPlay={onPlay} disabled />);

    await userEvent.click(screen.getByRole('gridcell', { name: 'row 1, column 1, empty' }));
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('refuses every cell when read-only', async () => {
    const onPlay = vi.fn();
    render(<Board game={createGame(3)} onPlay={onPlay} readOnly />);

    await userEvent.click(screen.getByRole('gridcell', { name: 'row 1, column 1, empty' }));
    expect(onPlay).not.toHaveBeenCalled();
    expect(screen.getByRole('grid')).toHaveAttribute('aria-readonly', 'true');
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
    render(<Board game={createGame(3)} onPlay={vi.fn()} />);

    await userEvent.tab();
    expect(screen.getByRole('gridcell', { name: 'row 1, column 1, empty' })).toHaveFocus();

    await userEvent.keyboard('{ArrowRight}{ArrowDown}');
    expect(screen.getByRole('gridcell', { name: 'row 2, column 2, empty' })).toHaveFocus();

    // Column 1 is the left edge, so left again must not wrap to the row above.
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('gridcell', { name: 'row 2, column 1, empty' })).toHaveFocus();
  });

  it('jumps to the ends of a row with Home and End', async () => {
    render(<Board game={createGame(modeById('grid-9').config)} onPlay={vi.fn()} />);

    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}{End}');
    expect(screen.getByRole('gridcell', { name: 'row 2, column 9, empty' })).toHaveFocus();

    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('gridcell', { name: 'row 2, column 1, empty' })).toHaveFocus();
  });

  it('is one tab stop however big the board is', async () => {
    render(<Board game={createGame(modeById('gomoku-15').config)} onPlay={vi.fn()} />);

    const stops = screen
      .getAllByRole('gridcell')
      .filter((cell) => cell.getAttribute('tabindex') === '0');
    expect(screen.getAllByRole('gridcell')).toHaveLength(225);
    expect(stops).toHaveLength(1);
  });

  it('exposes rows between the grid and its cells', () => {
    render(<Board game={createGame(3)} onPlay={vi.fn()} />);

    // `role="grid"` is only valid with `role="row"` in between; without the
    // rows the cells are not in a grid as far as a screen reader is concerned.
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(screen.getAllByRole('gridcell').filter((cell) => row.contains(cell))).toHaveLength(3);
    }
  });

  it('names the board and its win condition', () => {
    render(<Board game={createGame(modeById('grid-6').config)} onPlay={vi.fn()} />);
    expect(screen.getByRole('grid')).toHaveAccessibleName('6 by 6 board, 4 in a row to win');
  });

  it('marks itself busy while the opponent is thinking', () => {
    render(<Board game={createGame(3)} onPlay={vi.fn()} disabled />);
    expect(screen.getByRole('grid')).toHaveAttribute('aria-busy', 'true');
  });
});

describe('Board: Ultimate', () => {
  const ultimate = modeById('ultimate').config;

  it('says which small board a square belongs to', () => {
    render(<Board game={createGame(ultimate)} onPlay={vi.fn()} />);
    // Row 1 column 1 is the top-left cell of the first small board.
    expect(
      screen.getByRole('gridcell', { name: 'row 1, column 1, small board 1, empty' }),
    ).toBeInTheDocument();
  });

  it('says where the mover is confined', () => {
    // Board 4 (the middle), cell 0 -> the opponent must answer in board 0.
    const game = applyMove(createGame(ultimate), 30)!;
    render(<Board game={game} onPlay={vi.fn()} />);

    expect(screen.getByRole('grid')).toHaveAccessibleName(
      'Ultimate board, nine small boards. you must play in small board 1',
    );
  });

  it('refuses a square outside the board the rules point at', async () => {
    const onPlay = vi.fn();
    const game = applyMove(createGame(ultimate), 30)!;
    render(<Board game={game} onPlay={onPlay} />);

    // Inside the forced board: allowed.
    await userEvent.click(
      screen.getByRole('gridcell', { name: 'row 1, column 2, small board 1, empty' }),
    );
    expect(onPlay).toHaveBeenCalledWith(1);

    onPlay.mockClear();

    // Outside it: refused, even though the square is empty.
    await userEvent.click(
      screen.getByRole('gridcell', { name: 'row 1, column 4, small board 2, empty' }),
    );
    expect(onPlay).not.toHaveBeenCalled();
  });
});

describe('Board under gravity', () => {
  const gravity = modeById('gravity').config;

  it('plays the landing square of whichever column is tapped', async () => {
    const onPlay = vi.fn();
    render(<Board game={createGame(gravity)} onPlay={onPlay} />);

    // The top of column 4 on an empty 7x7 board drops to the floor, row 7.
    await userEvent.click(
      screen.getByRole('gridcell', { name: 'row 1, column 4, empty, plays column 4 at row 7' }),
    );
    expect(onPlay).toHaveBeenCalledWith(6 * 7 + 3);
  });

  it('stacks on whatever is already in the column', async () => {
    const onPlay = vi.fn();
    const game = applyMove(createGame(gravity), 6 * 7 + 3)!;
    render(<Board game={game} onPlay={onPlay} />);

    await userEvent.click(
      screen.getByRole('gridcell', { name: 'row 2, column 4, empty, plays column 4 at row 6' }),
    );
    expect(onPlay).toHaveBeenCalledWith(5 * 7 + 3);
  });
});

describe('Board under vanish', () => {
  it('says which marks leave next', () => {
    const vanish = modeById('vanish').config;
    let game = createGame(vanish);
    for (const move of [0, 4, 8, 2, 6, 7]) game = applyMove(game, move)!;
    render(<Board game={game} onPlay={vi.fn()} />);

    // X moves next and loses its oldest mark, 0; O's oldest, 4, goes after.
    expect(
      screen.getByRole('gridcell', { name: 'row 1, column 1, X, vanishes next' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('gridcell', { name: 'row 2, column 2, O, vanishes next' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: 'row 3, column 3, X' })).toBeInTheDocument();
  });
});
