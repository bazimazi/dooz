import { useEffect, useState } from 'react';
import { cx } from '@/lib/cx';

const SHOW_MS = 2600;

/**
 * A journey rival saying something, under their seat.
 *
 * Keyed by the caller on each new line, so a line replays its entrance, holds
 * for a moment and leaves on its own - the same banner timing as the opener's
 * toss. It takes no pointer input and never covers anything for long; it is
 * there to give the opponent a voice, not to be read carefully.
 */
export function RivalBubble({ text, accent = false }: { text: string; accent?: boolean }) {
  // Leaves on a timer as well as by its fade, which Low graphics does not play.
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShown(false), SHOW_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!shown) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute end-0 top-full z-30 mt-3 flex max-w-[12rem] animate-banner justify-end"
      style={{ animationDuration: `${SHOW_MS}ms` }}
    >
      {/* A big moment - a fork, a signature move - gets the warm edge. */}
      <span
        className={cx(
          'relative rounded-2xl rounded-se-sm border bg-surface px-3 py-1.5 text-sm shadow-[0_12px_28px_-14px_var(--color-shadow)]',
          accent ? 'border-warn font-semibold' : 'border-stroke',
        )}
      >
        {/* The tail points up at the rival's card. */}
        <span
          aria-hidden="true"
          className={cx(
            'absolute end-6 -top-1.5 size-3 rotate-45 border-t border-l bg-surface',
            accent ? 'border-warn' : 'border-stroke',
          )}
        />
        <span className="relative">{text}</span>
      </span>
    </div>
  );
}
