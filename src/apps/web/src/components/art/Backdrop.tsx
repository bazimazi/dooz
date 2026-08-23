/**
 * The scattered rings and crosses behind every screen.
 *
 * One SVG covering the viewport with `slice`, rather than a bitmap: it stays
 * sharp on a 4K desktop window, weighs a few hundred bytes instead of the
 * 109KB PNG the original build shipped, and recolours with the theme tokens.
 *
 * Each piece drifts on its own long, offset loop. The periods are deliberately
 * co-prime-ish (14s / 18s / 22s) so the arrangement never visibly repeats, and
 * slow enough to read as depth rather than as something demanding attention.
 *
 * The whole layer carries a view-transition name, which lifts it out of the
 * page snapshot: when the router moves between screens the backdrop is held
 * still and only the content above it animates.
 */
export function Backdrop({ variant = 'game' }: { variant?: 'home' | 'game' }) {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas"
      style={{ viewTransitionName: 'dooz-backdrop' }}
    >
      <svg
        viewBox="0 0 360 640"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        aria-hidden="true"
      >
        <defs>
          {/* Blurred copies of the pieces drift behind the home screen; the
              filter needs room to bleed, hence the oversized region. */}
          <filter id="dooz-soft" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="9" />
          </filter>

          {/* A pool of light behind the content column, so the middle of the
              screen sits slightly proud of the corners. */}
          <radialGradient id="dooz-glow" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="var(--color-b5)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--color-b5)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="360" height="640" fill="url(#dooz-glow)" />

        {/* Ring, top left */}
        <g className="origin-center animate-float-a transform-fill">
          <circle cx="80.5" cy="9.5" r="58.5" fill="var(--color-b4)" />
          <circle cx="80.5" cy="9.5" r="32.5" fill="var(--color-canvas)" />
        </g>

        {/* Cross, top right */}
        <g fill="var(--color-b4)" className="origin-center animate-float-b transform-fill">
          <rect
            x="248.804"
            y="37.634"
            width="29.883"
            height="107.58"
            rx="12"
            transform="rotate(-81.2925 248.804 37.634)"
          />
          <rect
            x="310.862"
            y="86.439"
            width="29.883"
            height="107.58"
            rx="12"
            transform="rotate(-171.293 310.862 86.439)"
          />
        </g>

        {/* Small cross, middle right */}
        <g fill="var(--color-b4)" className="origin-center animate-float-c transform-fill">
          <rect
            x="160.9"
            y="179.955"
            width="25.063"
            height="90.228"
            rx="12"
            transform="rotate(-72.3513 160.9 179.955)"
          />
          <rect
            x="205.954"
            y="228.48"
            width="25.063"
            height="90.228"
            rx="12"
            transform="rotate(-162.351 205.954 228.48)"
          />
        </g>

        {/* Ring, bottom left */}
        <g className="origin-center animate-float-b [animation-delay:-6s] transform-fill">
          <circle cx="53" cy="597" r="65" fill="var(--color-b4)" />
          <circle cx="53" cy="597" r="36.111" fill="var(--color-canvas)" />
        </g>

        {/* Cross, bottom right */}
        <g
          fill="var(--color-b4)"
          className="origin-center animate-float-a [animation-delay:-4s] transform-fill"
        >
          <rect
            x="240.403"
            y="596.743"
            width="33.721"
            height="121.395"
            rx="12"
            transform="rotate(-62.9652 240.403 596.743)"
          />
          <rect
            x="289.562"
            y="671.044"
            width="33.721"
            height="121.395"
            rx="12"
            transform="rotate(-152.965 289.562 671.044)"
          />
        </g>

        {variant === 'home' ? (
          <g filter="url(#dooz-soft)" opacity="0.75">
            {/* Out-of-focus pieces pooled at the foot of the home screen. */}
            <g className="origin-center animate-float-c transform-fill">
              <circle cx="248" cy="470" r="34" fill="var(--color-y2)" opacity="0.55" />
              <circle cx="248" cy="470" r="16" fill="var(--color-canvas)" />
            </g>
            <g
              fill="var(--color-p2)"
              opacity="0.5"
              className="origin-center animate-float-a [animation-delay:-9s] transform-fill"
            >
              <rect x="292" y="512" width="20" height="86" rx="10" transform="rotate(30 292 512)" />
              <rect
                x="256"
                y="542"
                width="20"
                height="86"
                rx="10"
                transform="rotate(-60 256 542)"
              />
            </g>
            <g className="origin-center animate-float-b [animation-delay:-12s] transform-fill">
              <circle cx="96" cy="592" r="46" fill="var(--color-y2)" opacity="0.4" />
              <circle cx="96" cy="592" r="22" fill="var(--color-canvas)" />
            </g>
          </g>
        ) : null}
      </svg>
    </div>
  );
}
