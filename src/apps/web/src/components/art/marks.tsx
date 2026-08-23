import type { Player } from '@dooz/engine';
import { X } from '@dooz/engine';

interface MarkProps {
  /** Extra classes, normally sizing. The marks fill their box. */
  className?: string;
  title?: string;
}

/**
 * The X and O pieces, traced from the Figma components.
 *
 * They are inline SVG rather than `<img>` files so they inherit the animation
 * on the cell that holds them, stay sharp on any display, and need no network
 * request when the app is running offline in a Tauri window.
 */
export function MarkX({ className, title }: MarkProps) {
  return (
    <svg viewBox="0 0 64 65" fill="none" className={className} role="img" aria-label={title}>
      {title ? <title>{title}</title> : null}
      <rect
        x="1.41421"
        y="12.8018"
        width="16.1019"
        height="70.4077"
        rx="8.05096"
        transform="rotate(-45 1.41421 12.8018)"
        fill="var(--color-mark-x)"
        stroke="var(--color-mark-x-edge)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect
        x="51.2004"
        y="1.41421"
        width="16.1019"
        height="70.4077"
        rx="8.05096"
        transform="rotate(45 51.2004 1.41421)"
        fill="var(--color-mark-x)"
        stroke="var(--color-mark-x-edge)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Two short strokes over the crossing point, so the near arm reads as
          passing in front of the far one rather than merging with it. */}
      <rect
        x="20.6055"
        y="30.5781"
        width="14.0986"
        height="2.02188"
        transform="rotate(-45 20.6055 30.5781)"
        fill="var(--color-mark-x)"
      />
      <rect
        x="32"
        y="41.9688"
        width="14.0986"
        height="2.02188"
        transform="rotate(-45 32 41.9688)"
        fill="var(--color-mark-x)"
      />
    </svg>
  );
}

interface MarkOProps extends MarkProps {
  /** Colour showing through the ring. Match it to whatever sits behind. */
  hole?: string;
}

export function MarkO({ className, title, hole = 'var(--color-surface)' }: MarkOProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} role="img" aria-label={title}>
      {title ? <title>{title}</title> : null}
      <circle
        cx="32"
        cy="32"
        r="31"
        fill="var(--color-mark-o)"
        stroke="var(--color-mark-o-edge)"
        strokeWidth="2"
      />
      <circle
        cx="32"
        cy="32"
        r="15"
        fill={hole}
        stroke="var(--color-mark-o-edge)"
        strokeWidth="2"
      />
    </svg>
  );
}

interface MarkProps2 extends MarkProps {
  player: Player;
  hole?: string;
}

/** Whichever mark belongs to `player`. */
export function Mark({ player, ...props }: MarkProps2) {
  return player === X ? <MarkX {...props} /> : <MarkO {...props} />;
}
