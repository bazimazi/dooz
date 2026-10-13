import {
  applyMove,
  createGame,
  markMove,
  modeById,
  powerMove,
  replay,
  swapMove,
} from '@/game/engine';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Board } from './Board';

const WILD = modeById('wild').config;
const CONNECT4 = modeById('connect4').config;
const POWERS = modeById('powers').config;
const GOMOKU_PRO = modeById('gomoku-pro').config;

describe('variant controls on the board', () => {
  it('plays the chosen mark in Wild, from the picker or the keyboard', async () => {
    const onPlay = vi.fn();
    render(<Board game={createGame(WILD, 1)} onPlay={onPlay} />);

    const picker = screen.getByRole('radiogroup', { name: 'Mark to place' });
    expect(picker).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'X' })).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(screen.getByRole('gridcell', { name: 'row 1, column 1, empty' }));
    expect(onPlay).toHaveBeenLastCalledWith(markMove(WILD, 0, 1));

    await userEvent.click(screen.getByRole('radio', { name: 'O' }));
    expect(screen.getByRole('radio', { name: 'O' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('gridcell', { name: 'row 2, column 2, empty' }));
    expect(onPlay).toHaveBeenLastCalledWith(markMove(WILD, 4, 2));

    // X and O on the board itself switch the mark too.
    screen.getByRole('gridcell', { name: 'row 2, column 2, empty' }).focus();
    await userEvent.keyboard('x{Enter}');
    expect(onPlay).toHaveBeenLastCalledWith(markMove(WILD, 4, 1));
  });

  it('draws Connect Four without its blocked top row', async () => {
    const onPlay = vi.fn();
    render(<Board game={createGame({ ...CONNECT4, opening: undefined }, 1)} onPlay={onPlay} />);
    expect(screen.getAllByRole('gridcell')).toHaveLength(42);
    expect(screen.queryByRole('gridcell', { name: /blocked/ })).toBeNull();
    // Any square in a column drops to its floor.
    await userEvent.click(screen.getByRole('gridcell', { name: /^row 2, column 4,/ }));
    expect(onPlay).toHaveBeenCalledWith(6 * 7 + 3);
  });

  it('offers the swap as a button only when it is legal', async () => {
    const onPlay = vi.fn();
    const { rerender } = render(<Board game={createGame(GOMOKU_PRO, 1)} onPlay={onPlay} />);
    expect(screen.queryByRole('button', { name: /swap/i })).toBeNull();

    rerender(<Board game={replay(GOMOKU_PRO, 1, [112])!} onPlay={onPlay} />);
    await userEvent.click(screen.getByRole('button', { name: /swap/i }));
    expect(onPlay).toHaveBeenCalledWith(swapMove(GOMOKU_PRO));
  });

  it('aims a bomb at an opponent mark and spends it on the tap', async () => {
    const onPlay = vi.fn();
    const game = applyMove(applyMove(createGame(POWERS, 1), 40)!, 41)!;
    render(<Board game={game} onPlay={onPlay} />);

    const bomb = screen.getByRole('radio', { name: /Bomb/ });
    expect(bomb).not.toHaveAttribute('aria-disabled');
    await userEvent.click(bomb);
    await userEvent.click(screen.getByRole('gridcell', { name: 'row 5, column 6, O' }));
    expect(onPlay).toHaveBeenCalledWith(powerMove(POWERS, 41, 'bomb'));
  });

  it('names blocked squares to a screen reader', () => {
    const walled = replay(POWERS, 1, [powerMove(POWERS, 0, 'wall')])!;
    render(<Board game={walled} onPlay={vi.fn()} />);
    expect(screen.getByRole('gridcell', { name: 'row 1, column 1, blocked' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    // The wall is spent: X has none left, and it is O's turn with both.
    expect(screen.getByRole('radio', { name: /Wall/ })).not.toHaveAttribute('aria-disabled');
  });
});
