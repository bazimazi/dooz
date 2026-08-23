import type { SVGProps } from 'react';

/**
 * The three result faces: won, lost, drawn.
 *
 * Drawn as one family sharing a bubble and eye geometry so the expressions read
 * as the same character in three moods, which the three separate Figma exports
 * only approximated.
 */
type FaceProps = SVGProps<SVGSVGElement>;

function FaceBubble({ children, ...props }: FaceProps) {
  return (
    <svg viewBox="0 0 72 68" fill="none" width="1em" height="1em" aria-hidden="true" {...props}>
      {/* Trailing thought bubbles, as in the design. */}
      <circle cx="9.4" cy="17.6" r="6.2" fill="var(--color-g9)" />
      <circle cx="4.2" cy="6.4" r="4" fill="var(--color-g9)" />
      <circle cx="41.7" cy="37.3" r="29.9" fill="var(--color-g9)" />
      {children}
    </svg>
  );
}

const EYE = 'var(--color-raised)';

export function HappyFace(props: FaceProps) {
  return (
    <FaceBubble {...props}>
      {/* Eyes squeezed shut into upward arcs. */}
      <path
        d="M25.5 27.5c1.9-3.4 6.2-3.4 8.1 0M49.8 27.5c1.9-3.4 6.2-3.4 8.1 0"
        stroke={EYE}
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      {/* Open grin with a tongue tucked behind the lower lip. */}
      <path
        d="M29.2 42.6c8.1 3.4 16.9 3.4 25 0 0 7-5.6 12.6-12.5 12.6s-12.5-5.6-12.5-12.6Z"
        fill={EYE}
      />
      <path
        d="M33.9 51.2a10 10 0 0 0 15.6 0c-2.2-2-5-3-7.8-3s-5.6 1-7.8 3Z"
        fill="var(--color-p3)"
      />
    </FaceBubble>
  );
}

export function SadFace(props: FaceProps) {
  return (
    <FaceBubble {...props}>
      {/* Eyes closed downward — the mirror of the happy arcs. */}
      <path
        d="M25.5 29.5c1.9 3.4 6.2 3.4 8.1 0M49.8 29.5c1.9 3.4 6.2 3.4 8.1 0"
        stroke={EYE}
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      {/* Frown. */}
      <path
        d="M33 51.5c2.4-3.6 6-5.4 8.7-5.4s6.3 1.8 8.7 5.4"
        stroke={EYE}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      {/* A single tear. */}
      <path d="M27.5 36c1.9 2.9 2.9 4.8 2.9 6a2.9 2.9 0 1 1-5.8 0c0-1.2 1-3.1 2.9-6Z" fill={EYE} />
    </FaceBubble>
  );
}

export function NeutralFace(props: FaceProps) {
  return (
    <FaceBubble {...props}>
      {/* Flat eyes and a flat mouth: nobody won, nobody lost. */}
      <path d="M25.8 28.5h8.2M49.5 28.5h8.2" stroke={EYE} strokeWidth="2.8" strokeLinecap="round" />
      <path d="M32.5 48.5h18.4" stroke={EYE} strokeWidth="3" strokeLinecap="round" />
    </FaceBubble>
  );
}
