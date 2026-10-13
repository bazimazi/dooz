import { act, render, screen } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatClock, MatchClock } from './MatchClock';

describe('formatClock', () => {
  it('shows minutes and seconds for anything comfortable', () => {
    expect(formatClock(120_000)).toBe('2:00');
    expect(formatClock(65_000)).toBe('1:05');
    expect(formatClock(600_000)).toBe('10:00');
  });

  it('drops to tenths only in the last ten seconds', () => {
    expect(formatClock(12_000)).toBe('0:12');
    expect(formatClock(9_400)).toBe('9.4');
    expect(formatClock(900)).toBe('0.9');
  });

  it('stops at zero rather than going negative', () => {
    expect(formatClock(0)).toBe('0.0');
    expect(formatClock(-5000)).toBe('0.0');
  });

  it('rounds seconds up, so a clock never shows 0:00 while time remains', () => {
    expect(formatClock(59_900)).toBe('1:00');
    expect(formatClock(10_001)).toBe('0:11');
  });
});

describe('clock scheduling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('updates seconds without committing a React render on every frame', () => {
    const commits = vi.fn();
    render(
      <Profiler id="clock" onRender={commits}>
        <MatchClock remainingMs={120_000} ticking />
      </Profiler>,
    );
    commits.mockClear();
    for (let second = 0; second < 5; second++)
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    expect(screen.getByText('1:55')).toBeInTheDocument();
    expect(commits.mock.calls.length).toBeLessThanOrEqual(5);
  });

  it('changes to tenths at ten seconds and stops scheduling at zero', () => {
    render(<MatchClock remainingMs={10_000} ticking />);
    expect(screen.getByText('0:10')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText('10.0')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByText('9.9')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText('0.0')).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops hidden-tab timers and catches up on return', () => {
    const { unmount } = render(<MatchClock remainingMs={30_000} ticking />);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByText('0:25')).toBeInTheDocument();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses new server values and cancels the previous countdown', () => {
    const { rerender } = render(<MatchClock remainingMs={30_000} ticking />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    rerender(<MatchClock remainingMs={60_000} ticking={false} />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('1:00')).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('MatchClock', () => {
  it('names itself for a screen reader', () => {
    render(<MatchClock remainingMs={90_000} ticking={false} />);
    expect(screen.getByText(/Time left/)).toBeInTheDocument();
    expect(screen.getByText('1:30')).toBeInTheDocument();
  });

  it('is not a live region while it is somebody else’s clock', () => {
    const { container } = render(<MatchClock remainingMs={90_000} ticking={false} />);
    expect(container.firstElementChild).toHaveAttribute('aria-live', 'off');
  });

  it('announces itself only once it is nearly out', () => {
    const { container } = render(<MatchClock remainingMs={8000} ticking />);
    expect(container.firstElementChild).toHaveAttribute('aria-live', 'polite');
  });

  it('stays quiet when there is plenty of time, even while running', () => {
    const { container } = render(<MatchClock remainingMs={120_000} ticking />);
    expect(container.firstElementChild).toHaveAttribute('aria-live', 'off');
  });
});

describe('formatClock', () => {
  it('never reads lower than the time left', () => {
    expect(formatClock(10_000)).toBe('0:10');
    expect(formatClock(9_950)).toBe('10.0');
    expect(formatClock(9_900)).toBe('9.9');
    expect(formatClock(50)).toBe('0.1');
    expect(formatClock(0)).toBe('0.0');
  });
});
