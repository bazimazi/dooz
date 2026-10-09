import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
