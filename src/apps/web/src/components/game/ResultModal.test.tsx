import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/Button';
import { ResultModal } from './ResultModal';

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
