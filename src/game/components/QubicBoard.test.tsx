import { applyMove, createGame, modeById, qubicIndex } from '@/game/engine';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { savePreferences } from '@/lib/preferences';
import { QubicBoard as Board } from './QubicBoard';

const QUBIC = modeById('qubic').config;

afterEach(() => {
  savePreferences({ graphics: 'high' });
  localStorage.clear();
});

describe('QubicBoard', () => {
  it('is one grid of four layers, sixty-four labelled cells', () => {
    render(<Board game={createGame(QUBIC)} onPlay={vi.fn()} />);
    const grid = screen.getByRole('grid', { name: /Qubic cube/ });
    expect(within(grid).getAllByRole('rowgroup')).toHaveLength(4);
    expect(within(grid).getAllByRole('row')).toHaveLength(16);
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(64);
    expect(
      screen.getByRole('gridcell', { name: 'Layer 3, row 2, column 4, empty' }),
    ).toBeInTheDocument();
  });

  it('plays the cube cell that was clicked, in 3D and flat', async () => {
    const onPlay = vi.fn();
    render(<Board game={createGame(QUBIC)} onPlay={onPlay} />);
    await userEvent.click(
      screen.getByRole('gridcell', { name: 'Layer 2, row 1, column 3, empty' }),
    );
    expect(onPlay).toHaveBeenLastCalledWith(qubicIndex(1, 0, 2));

    await userEvent.click(screen.getByRole('button', { name: 'Flat layers' }));
    expect(screen.getByRole('button', { name: '3D view' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(
      screen.getByRole('gridcell', { name: 'Layer 4, row 4, column 4, empty' }),
    );
    expect(onPlay).toHaveBeenLastCalledWith(qubicIndex(3, 3, 3));
  });

  it('moves within a layer with the arrows and between layers with Page Up and Down', async () => {
    render(<Board game={createGame(QUBIC)} onPlay={vi.fn()} />);
    screen.getByRole('gridcell', { name: 'Layer 1, row 1, column 1, empty' }).focus();
    await userEvent.keyboard('{ArrowRight}{ArrowDown}{PageDown}{PageDown}');
    expect(screen.getByRole('gridcell', { name: 'Layer 3, row 2, column 2, empty' })).toHaveFocus();
    await userEvent.keyboard('{PageUp}{End}');
    expect(screen.getByRole('gridcell', { name: 'Layer 2, row 2, column 4, empty' })).toHaveFocus();
    // One tab stop: only the focused cell is in the tab order.
    const stops = screen
      .getAllByRole('gridcell')
      .filter((cell) => cell.getAttribute('tabindex') === '0');
    expect(stops).toHaveLength(1);
  });

  it('shows the flat layers with no 3D controls on Low graphics', () => {
    savePreferences({ graphics: 'low' });
    render(<Board game={createGame(QUBIC)} onPlay={vi.fn()} />);
    expect(screen.queryByRole('group', { name: 'Cube view' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('gridcell')).toHaveLength(64);
  });

  it('turns and tilts the cube from the controls', async () => {
    render(<Board game={createGame(QUBIC)} onPlay={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Turn the cube left' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tilt the cube up' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getAllByRole('gridcell')).toHaveLength(64);
  });

  it('names the winning line across the layers', () => {
    let game = createGame(QUBIC);
    const pillar = [0, 1, 2, 3].map((layer) => qubicIndex(layer, 0, 0));
    const others = [1, 2, 3].map((col) => qubicIndex(0, 3, col));
    for (let ply = 0; ply < 7; ply++) {
      game = applyMove(game, ply % 2 === 0 ? pillar[ply / 2]! : others[(ply - 1) / 2]!)!;
    }
    expect(game.status).toBe('won');
    render(<Board game={game} onPlay={vi.fn()} readOnly />);
    expect(
      screen.getByRole('gridcell', {
        name: 'Layer 4, row 1, column 1, X, part of the winning line',
      }),
    ).toBeInTheDocument();
  });
});
