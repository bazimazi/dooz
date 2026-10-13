import {
  applyMove,
  createGame,
  decodeQuantumMove,
  encodeQuantumMove,
  type GameState,
  modeById,
} from '@/game/engine';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuantumBoard as Board } from './QuantumBoard';

const QUANTUM = modeById('quantum').config;
const spooky = (a: number, b: number) =>
  encodeQuantumMove({ collapse: null, follow: { kind: 'spooky', cells: [a, b] } });

function play(codes: number[]): GameState {
  let game = createGame(QUANTUM);
  for (const code of codes) game = applyMove(game, code)!;
  return game;
}

const square = (row: number, col: number) =>
  screen.getByRole('gridcell', { name: new RegExp(`^row ${row}, column ${col},`) });

describe('QuantumBoard', () => {
  it('sends a spooky mark as one move after two taps', async () => {
    const onPlay = vi.fn();
    render(<Board game={createGame(QUANTUM)} onPlay={onPlay} />);
    expect(screen.getByText(/Tap two squares for your spooky mark X1/)).toBeInTheDocument();

    await userEvent.click(square(1, 1));
    expect(square(1, 1)).toHaveAttribute('aria-pressed', 'true');
    expect(onPlay).not.toHaveBeenCalled();
    await userEvent.click(square(3, 3));
    expect(onPlay).toHaveBeenCalledWith(spooky(0, 8));
  });

  it('cancels the first square when it is tapped again', async () => {
    const onPlay = vi.fn();
    render(<Board game={createGame(QUANTUM)} onPlay={onPlay} />);
    await userEvent.click(square(2, 2));
    await userEvent.click(square(2, 2));
    expect(square(2, 2)).toHaveAttribute('aria-pressed', 'false');
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('labels spooky marks with their subscripts', () => {
    render(<Board game={play([spooky(0, 4), spooky(4, 8)])} onPlay={vi.fn()} />);
    expect(square(2, 2)).toHaveAccessibleName(/spooky X1, O2/);
    expect(square(1, 1)).toHaveAccessibleName(/spooky X1/);
    expect(square(3, 3)).toHaveAccessibleName(/spooky O2/);
  });

  it('asks the next player to measure a loop, then plays the collapse and a new mark together', async () => {
    // X1 0-1, O2 1-2, X3 0-2 closes the triangle; O measures X3.
    const game = play([spooky(0, 1), spooky(1, 2), spooky(0, 2)]);
    const onPlay = vi.fn();
    render(<Board game={game} onPlay={onPlay} />);
    expect(screen.getByText(/A loop closed! Choose where X3 really is/)).toBeInTheDocument();
    expect(square(1, 1)).toHaveAccessibleName(/collapse choice/);
    expect(square(1, 3)).toHaveAccessibleName(/collapse choice/);
    expect(square(1, 2)).toHaveAttribute('aria-disabled', 'true');

    // Landing X3 in square 2 (its higher square): the board shows the result.
    await userEvent.click(square(1, 3));
    expect(onPlay).not.toHaveBeenCalled();
    expect(square(1, 3)).toHaveAccessibleName(/X3, collapsed/);
    expect(screen.getByRole('button', { name: 'Change collapse' })).toBeInTheDocument();

    await userEvent.click(square(2, 1));
    await userEvent.click(square(3, 1));
    expect(onPlay).toHaveBeenCalledTimes(1);
    const move = decodeQuantumMove(onPlay.mock.calls[0]![0] as number)!;
    expect(move.collapse).toBe(1);
    expect(move.follow).toEqual({ kind: 'spooky', cells: [3, 6] });
    expect(applyMove(game, onPlay.mock.calls[0]![0] as number)).not.toBeNull();
  });

  it('goes back from a collapse choice', async () => {
    const game = play([spooky(0, 1), spooky(1, 2), spooky(0, 2)]);
    render(<Board game={game} onPlay={vi.fn()} />);
    await userEvent.click(square(1, 1));
    await userEvent.click(screen.getByRole('button', { name: 'Change collapse' }));
    expect(screen.getByText(/A loop closed!/)).toBeInTheDocument();
  });

  it('sends a collapse that ends the game at once', async () => {
    // O's triangle 6-7-8: X must measure it, and either way O wins.
    const game = play([
      spooky(0, 3),
      spooky(6, 7),
      spooky(1, 4),
      spooky(7, 8),
      spooky(2, 5),
      spooky(6, 8),
    ]);
    const onPlay = vi.fn();
    render(<Board game={game} onPlay={onPlay} />);
    await userEvent.click(square(3, 1));
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(decodeQuantumMove(onPlay.mock.calls[0]![0] as number)!.follow.kind).toBe('nothing');
  });

  it('moves focus with the arrow keys and takes no input when read-only', async () => {
    const onPlay = vi.fn();
    render(<Board game={createGame(QUANTUM)} onPlay={onPlay} readOnly />);
    square(2, 2).focus();
    await userEvent.keyboard('{ArrowUp}{ArrowLeft}');
    expect(square(1, 1)).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onPlay).not.toHaveBeenCalled();
    expect(screen.queryByText(/Tap two squares/)).not.toBeInTheDocument();
  });
});
