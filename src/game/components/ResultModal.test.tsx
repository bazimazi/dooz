import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMove, createGame, X } from '@/game/engine';
import { Button } from '@/components/ui/Button';
import { savePreferences } from '@/lib/preferences';
import { describeReason, describeReasonFor, ResultModal } from './ResultModal';

const actions = (
  <>
    <Button size="small">Play again</Button>
    <Button size="small">Back to home</Button>
  </>
);

describe('ResultModal', () => {
  it('traps focus inside the panel', async () => {
    render(
      <>
        <button type="button">Behind the panel</button>
        <ResultModal title="You win!" art={null} actions={actions} />
      </>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveFocus();

    // Tab cycles between the panel's own controls and never reaches the button
    // behind it, which is what `aria-modal` promises.
    await userEvent.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await userEvent.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await userEvent.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('makes everything outside the panel inert', () => {
    render(
      <>
        <div data-testid="behind">
          <button type="button">Behind the panel</button>
        </div>
        <ResultModal title="Draw" art={null} actions={actions} />
      </>,
    );

    expect(screen.getByTestId('behind')).toHaveAttribute('inert');
  });

  it('restores focus to whatever had it when the panel closes', async () => {
    function Harness() {
      return (
        <>
          <button type="button" data-testid="opener">
            Opener
          </button>
          <ResultModal title="You win!" art={null} actions={actions} />
        </>
      );
    }

    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();

    const { unmount } = render(<Harness />);
    expect(screen.getByRole('dialog')).toHaveFocus();

    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it('is announced by its title', () => {
    render(<ResultModal title="You lose" art={null} actions={actions} />);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('You lose');
  });
});

describe('ResultModal: reveal delay', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('waits before covering the finished board', () => {
    render(<ResultModal title="You win!" art={null} actions={actions} revealDelay={1250} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1250);
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('arrives at once when there is nothing to watch', () => {
    render(<ResultModal title="Draw" art={null} actions={actions} revealDelay={0} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('lets a tap cut the wait short', () => {
    render(<ResultModal title="You win!" art={null} actions={actions} revealDelay={5000} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => {
      document.dispatchEvent(new Event('pointerdown'));
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('describeReason', () => {
  it('credits the completed line to the loser under misère', () => {
    expect(describeReason('line', 'win')).toBe('You completed the line');
    expect(describeReason('line', 'win', true)).toBe('Your opponent completed the line');
    expect(describeReason('line', 'loss', true)).toBe('You completed the line');
  });

  it('tells spectators about the players by name', () => {
    const names = { winner: 'Ada', loser: 'Bob' };
    expect(describeReasonFor('resign', names)).toBe('Bob resigned');
    expect(describeReasonFor('line', names)).toBe('Ada completed the line');
    expect(describeReasonFor('line', names, true)).toBe('Bob completed the line');
  });
});

describe('ResultModal: the story of the game', () => {
  function finished() {
    let game = createGame(3, X);
    for (const move of [0, 3, 1, 4, 2]) game = applyMove(game, move)!;
    return game;
  }

  it('shows the moves, the time and the decisive moments of a finished game', () => {
    const { container } = render(
      <ResultModal
        title="You win!"
        art={null}
        actions={actions}
        tone="win"
        game={finished()}
        durationMs={83_000}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'You win!' });
    expect(within(dialog).getByRole('heading', { name: 'You win!' })).toBeInTheDocument();
    expect(within(dialog).getByText('Moves').nextElementSibling).toHaveTextContent('5');
    expect(within(dialog).getByText('Time').nextElementSibling).toHaveTextContent('1:23');
    expect(within(dialog).getByText('Decisive moments')).toBeInTheDocument();
    expect(container.ownerDocument.querySelector('[data-tone="win"]')).not.toBeNull();
  });

  it('gives rewards their own place and lands the rating on its new value', () => {
    savePreferences({ graphics: 'low' });
    try {
      render(
        <ResultModal
          title="You win!"
          art={null}
          actions={actions}
          rating={{ before: 1200, after: 1216 }}
          rewards={<p>+40 XP</p>}
        />,
      );
      expect(screen.getByText('+40 XP')).toBeInTheDocument();
      expect(screen.getByLabelText('Rating 1216')).toHaveTextContent('1216');
      expect(screen.getByLabelText('up 16')).toBeInTheDocument();
    } finally {
      savePreferences({ graphics: 'high' });
    }
  });
});
