import { useEffect, useRef, useState } from 'react';
import { cx } from '@/lib/cx';
import { sfx } from '@/lib/sound';

/** Below this the clock turns and starts beating, because it is nearly gone. */
const URGENT_MS = 20_000;
/** Below this it counts tenths, which is the only point at which they help. */
const PRECISE_MS = 10_000;

interface MatchClockProps {
  /** Server-authoritative time left when the last frame arrived. */
  remainingMs: number;
  /** True while this is the clock actually running down. */
  ticking: boolean;
  /** Tick out loud in the last ten seconds. Only ever your own clock. */
  audible?: boolean;
  compact?: boolean;
}

/**
 * One player's clock.
 *
 * The number shown is interpolated locally between server frames, because a
 * clock that only moves when a message arrives does not read as a clock. What
 * it never does is *decide* anything: the server owns the real time, flags the
 * game when it runs out, and sends a corrected value with every move. This can
 * be a few hundred milliseconds out and it does not matter, because nothing is
 * decided by what it says.
 *
 * It stops at zero rather than going negative - the result is on its way, and
 * a negative clock is a bug every player has seen and nobody believes.
 */
export function MatchClock({
  remainingMs,
  ticking,
  audible = false,
  compact = false,
}: MatchClockProps) {
  const [displayed, setDisplayed] = useState(remainingMs);
  // A new server value snaps the display to it during render rather than in an
  // effect, so the corrected time is on screen in the same paint it arrived in
  // - an effect would show the stale one for a frame first.
  const [lastFromServer, setLastFromServer] = useState(remainingMs);
  if (lastFromServer !== remainingMs) {
    setLastFromServer(remainingMs);
    setDisplayed(remainingMs);
  }

  const startedAt = useRef(0);

  useEffect(() => {
    if (!ticking) return;

    // The clock is read once when the countdown starts and never during render,
    // so the component stays a pure function of its props and this state.
    startedAt.current = Date.now();
    const base = remainingMs;

    let frame = 0;
    const step = () => {
      setDisplayed(Math.max(0, base - (Date.now() - startedAt.current)));
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [ticking, remainingMs]);

  const urgent = ticking && displayed <= URGENT_MS;

  // One tick per whole second in the last ten, faster-sounding in the last
  // five. Keyed on the second rather than the frame, so it cannot stutter.
  const second = Math.ceil(displayed / 1000);
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (!audible || !ticking || displayed >= PRECISE_MS || displayed <= 0) return;
    if (lastTick.current === second) return;
    lastTick.current = second;
    sfx.tick(second <= 5);
  }, [audible, ticking, displayed, second]);

  return (
    <span
      // Only the running clock is a live region, and only once it is urgent:
      // announcing every second of every clock would make the board unusable
      // with a screen reader.
      aria-live={urgent ? 'polite' : 'off'}
      aria-atomic="true"
      className={cx(
        'tnum rounded-full px-2 py-0.5 leading-tight transition-colors duration-300',
        compact ? 'text-sm' : 'text-base',
        urgent ? 'bg-danger/15 font-semibold text-danger' : 'text-ink-muted',
        urgent && 'animate-tick',
      )}
    >
      <span className="sr-only">Time left </span>
      {formatClock(displayed)}
    </span>
  );
}

/**
 * `m:ss`, dropping to `s.t` in the last ten seconds.
 *
 * Tenths only appear when they carry information. Showing them for the whole
 * game turns the header into a slot machine, and at four minutes nobody is
 * reading the tenths anyway.
 */
export function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  if (clamped < PRECISE_MS) return (clamped / 1000).toFixed(1);

  const total = Math.ceil(clamped / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
