/**
 * The scattered rings and crosses behind every screen.
 *
 * One SVG covering the viewport with `slice`, rather than a bitmap: it stays
 * sharp on a 4K desktop window, weighs a few hundred bytes instead of the
 * 109KB PNG the original build shipped, and recolours with the theme tokens.
 */
export function Backdrop({ variant = 'game' }: { variant?: 'home' | 'game' }) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas">
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
        </defs>

        {/* Ring, top left */}
        <circle cx="80.5" cy="9.5" r="58.5" fill="var(--color-b4)" />
        <circle cx="80.5" cy="9.5" r="32.5" fill="var(--color-canvas)" />

        {/* Cross, top right */}
        <g fill="var(--color-b4)">
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
        <g fill="var(--color-b4)">
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
        <circle cx="53" cy="597" r="65" fill="var(--color-b4)" />
        <circle cx="53" cy="597" r="36.111" fill="var(--color-canvas)" />

        {/* Cross, bottom right */}
        <g fill="var(--color-b4)">
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
            <circle cx="248" cy="470" r="34" fill="var(--color-y2)" opacity="0.55" />
            <circle cx="248" cy="470" r="16" fill="var(--color-canvas)" />
            <g fill="var(--color-p2)" opacity="0.5">
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
            <circle cx="96" cy="592" r="46" fill="var(--color-y2)" opacity="0.4" />
            <circle cx="96" cy="592" r="22" fill="var(--color-canvas)" />
          </g>
        ) : null}
      </svg>
    </div>
  );
}
