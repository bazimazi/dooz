/**
 * A journey rival saying something, under their seat.
 *
 * Keyed by the caller on each new line, so a line replays its entrance, holds
 * for a moment and leaves on its own - the same banner timing as the opener's
 * toss. It takes no pointer input and never covers anything for long; it is
 * there to give the opponent a voice, not to be read carefully.
 */
export function RivalBubble({ text }: { text: string }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute top-full right-0 z-30 mt-3 flex max-w-[12rem] animate-banner justify-end"
      style={{ animationDuration: '2.6s' }}
    >
      <span className="relative rounded-2xl rounded-tr-sm border border-stroke bg-surface px-3 py-1.5 text-sm shadow-[0_12px_28px_-14px_var(--color-shadow)]">
        {/* The tail points up at the rival's card. */}
        <span
          aria-hidden="true"
          className="absolute -top-1.5 right-6 size-3 rotate-45 border-t border-l border-stroke bg-surface"
        />
        <span className="relative">{text}</span>
      </span>
    </div>
  );
}
