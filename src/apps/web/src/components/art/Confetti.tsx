import type { CSSProperties } from 'react';

/**
 * The burst fired over the result panel when the game was won.
 *
 * Twenty-eight pieces of DOM with CSS animations, rather than a canvas: the
 * whole thing is under a kilobyte, needs no animation frame loop competing with
 * the router, and stops dead on its own when the last piece fades.
 *
 * Every piece is three nested spans. `transform` can only be animated once per
 * element, and a convincing throw needs three at once - an arc up and down, a
 * sideways drift, and a tumble - so each gets its own layer.
 */

const COLOURS = [
  'var(--color-p2)',
  'var(--color-p3)',
  'var(--color-y2)',
  'var(--color-y3)',
  'var(--color-g10)',
  'var(--color-b8)',
];

const PIECE_COUNT = 28;

/**
 * A hash, not a random number: the same piece must land the same way on every
 * render, or React re-running the component would restart the burst somewhere
 * new. Sine-fract is the cheapest thing that scatters well.
 */
function noise(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

const PIECES = Array.from({ length: PIECE_COUNT }, (_, index) => {
  const spread = noise(index, 1) * 2 - 1;
  return {
    colour: COLOURS[index % COLOURS.length]!,
    // Pieces thrown further sideways are also thrown harder upward, which is
    // what stops the burst reading as a flat fan.
    dx: `${spread * 165}px`,
    lift: `${-70 - noise(index, 2) * 90}px`,
    drop: `${200 + noise(index, 3) * 160}px`,
    rot: `${(noise(index, 4) * 2 - 1) * 720}deg`,
    delay: `${noise(index, 5) * 0.28}s`,
    width: 5 + Math.round(noise(index, 6) * 4),
    height: 8 + Math.round(noise(index, 7) * 8),
    round: noise(index, 8) > 0.65,
  };
});

export function Confetti({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 top-1/3 z-10 overflow-visible ${className ?? ''}`}
    >
      {PIECES.map((piece, index) => (
        <span
          key={index}
          className="absolute left-1/2 block animate-confetti-y"
          style={
            {
              '--lift': piece.lift,
              '--drop': piece.drop,
              animationDelay: piece.delay,
            } as CSSProperties
          }
        >
          <span
            className="block animate-confetti-x"
            style={{ '--dx': piece.dx, animationDelay: piece.delay } as CSSProperties}
          >
            <span
              className="block animate-confetti-spin"
              style={{ '--rot': piece.rot, animationDelay: piece.delay } as CSSProperties}
            >
              <span
                className="block"
                style={{
                  width: piece.width,
                  height: piece.round ? piece.width : piece.height,
                  borderRadius: piece.round ? '50%' : 2,
                  background: piece.colour,
                }}
              />
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}
