import type { ArtStyle, GraphicsQuality } from '@/lib/preferences';
import { useArtStyle, useGraphics } from '@/lib/graphics';
import { useWorld, type WorldMotif } from '@/lib/world';

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
 * Under them sits the visual style's own scenery - a lamp over felt, an
 * arcade horizon, paper hills, ink mountains, chalk doodles - and over them,
 * when a journey rival is being played, that rival's world. Scenery and world
 * are static drawings, so they stay on Low; only High lets them move.
 *
 * The whole layer carries a view-transition name, which lifts it out of the
 * page snapshot: when the router moves between screens the backdrop is held
 * still and only the content above it animates.
 */
export function Backdrop({ variant = 'game' }: { variant?: 'home' | 'game' }) {
  const quality = useGraphics();
  const style = useArtStyle();
  const world = useWorld();
  if (quality === 'low') {
    return (
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas">
        <Scenery style={style} quality={quality} />
        {world ? <WorldLayer motif={world.motif} quality={quality} /> : null}
      </div>
    );
  }
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas"
      style={{ viewTransitionName: 'dooz-backdrop' }}
    >
      <Scenery style={style} quality={quality} />
      {/* The room warms towards whoever is to move. Pooled low, behind the
          board, and faint: it is felt more than it is seen. See `useTurnTint`. */}
      <div
        className="turn-tint turn-tint-x absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 50% 58%, var(--color-glow-x), transparent 70%)',
          mixBlendMode: 'soft-light',
        }}
      />
      <div
        className="turn-tint turn-tint-o absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 50% 58%, var(--color-glow-o), transparent 70%)',
          mixBlendMode: 'soft-light',
        }}
      />
      <svg
        viewBox="0 0 360 640"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
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
            <stop offset="0%" stopColor="var(--color-backdrop-glow)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--color-backdrop-glow)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="360" height="640" fill="url(#dooz-glow)" />

        {/* Ring, top left */}
        <g className="origin-center animate-float-a transform-fill">
          <circle cx="80.5" cy="9.5" r="58.5" fill="var(--color-backdrop-shape)" />
          <circle cx="80.5" cy="9.5" r="32.5" fill="var(--color-canvas)" />
        </g>

        {/* Cross, top right */}
        <g
          fill="var(--color-backdrop-shape)"
          className="origin-center animate-float-b transform-fill"
        >
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
        <g
          fill="var(--color-backdrop-shape)"
          className="origin-center animate-float-c transform-fill"
        >
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
          <circle cx="53" cy="597" r="65" fill="var(--color-backdrop-shape)" />
          <circle cx="53" cy="597" r="36.111" fill="var(--color-canvas)" />
        </g>

        {/* Cross, bottom right */}
        <g
          fill="var(--color-backdrop-shape)"
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

        {variant === 'home' && quality === 'high' ? (
          <g filter="url(#dooz-soft)" opacity="0.75">
            {/* Out-of-focus pieces pooled at the foot of the home screen. */}
            <g className="origin-center animate-float-c transform-fill">
              <circle cx="248" cy="470" r="34" fill="var(--color-mark-o)" opacity="0.55" />
              <circle cx="248" cy="470" r="16" fill="var(--color-canvas)" />
            </g>
            <g
              fill="var(--color-mark-x)"
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
              <circle cx="96" cy="592" r="46" fill="var(--color-mark-o)" opacity="0.4" />
              <circle cx="96" cy="592" r="22" fill="var(--color-canvas)" />
            </g>
          </g>
        ) : null}
      </svg>
      {world ? <WorldLayer motif={world.motif} quality={quality} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scenery: one drawing per visual style, behind everything else.
// ---------------------------------------------------------------------------

function Scenery({ style, quality }: { style: ArtStyle; quality: GraphicsQuality }) {
  switch (style) {
    case 'tabletop':
      return <Lamplight quality={quality} />;
    case 'neon':
      return <ArcadeHorizon quality={quality} />;
    case 'paper':
      return <PaperHills />;
    case 'ink':
      return <InkMountains />;
    case 'chalkboard':
      return <ChalkDoodles />;
    case 'pastel':
    default:
      return null;
  }
}

function SceneSvg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 360 640"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Green baize under a warm hanging lamp, darkening to the corners. */
function Lamplight({ quality }: { quality: GraphicsQuality }) {
  return (
    <SceneSvg>
      <defs>
        <radialGradient id="dooz-lamp" cx="50%" cy="34%" r="70%">
          <stop offset="0%" stopColor="#ffd890" stopOpacity="0.32" />
          <stop offset="45%" stopColor="#ffb860" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.35" />
        </radialGradient>
        {/* The nap of the felt, on High only: a full-screen noise filter is
            drawn once, but it is still a full screen of it. */}
        {quality === 'high' ? (
          <filter id="dooz-felt" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" />
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.09 0" />
          </filter>
        ) : null}
      </defs>
      {quality === 'high' ? <rect width="360" height="640" filter="url(#dooz-felt)" /> : null}
      <rect width="360" height="640" fill="url(#dooz-lamp)" />
    </SceneSvg>
  );
}

/** A horizon of light: a striped sun setting into a grid that runs to the viewer. */
function ArcadeHorizon({ quality }: { quality: GraphicsQuality }) {
  const verticals = Array.from({ length: 13 }, (_, at) => -240 + at * 70);
  const horizontals = [512, 528, 548, 574, 606, 646];
  return (
    <SceneSvg>
      <defs>
        <linearGradient id="dooz-sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-mark-o)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--color-mark-x)" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id="dooz-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-accent)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <g opacity="0.55">
        <circle cx="180" cy="500" r="92" fill="url(#dooz-sun)" />
        {[455, 472, 486, 498].map((y, at) => (
          <rect key={y} x="80" y={y} width="200" height={3 + at} fill="var(--color-canvas)" />
        ))}
      </g>
      <rect y="500" width="360" height="140" fill="var(--color-canvas)" />
      <g
        stroke="url(#dooz-floor)"
        strokeWidth="1.2"
        fill="none"
        className={quality === 'high' ? 'arcade-floor' : undefined}
      >
        {verticals.map((x) => (
          <path key={x} d={`M180 500L${x} 680`} />
        ))}
        {horizontals.map((y) => (
          <path key={y} d={`M0 ${y}H360`} />
        ))}
      </g>
      <path d="M0 500H360" stroke="var(--color-accent)" strokeOpacity="0.6" strokeWidth="1.5" />
    </SceneSvg>
  );
}

/** Three layers of cut card at the foot of the page, each casting its shadow. */
function PaperHills() {
  const layers = [
    {
      d: 'M0 520 C 70 480, 140 500, 200 486 S 320 470, 360 492 V640 H0Z',
      fill: 'var(--color-mark-o)',
      o: 0.28,
    },
    {
      d: 'M0 560 C 60 530, 130 556, 210 540 S 310 528, 360 548 V640 H0Z',
      fill: 'var(--color-mark-x)',
      o: 0.24,
    },
    {
      d: 'M0 598 C 80 576, 160 600, 240 586 S 330 580, 360 592 V640 H0Z',
      fill: 'var(--color-accent)',
      o: 0.22,
    },
  ];
  return (
    <SceneSvg>
      {layers.map((layer) => (
        <g key={layer.d}>
          <path d={layer.d} fill="#000" opacity="0.12" transform="translate(3 -5)" />
          <path d={layer.d} fill={layer.fill} opacity={layer.o} />
        </g>
      ))}
      {/* A few paper stars pinned to the sky. */}
      <g fill="var(--color-mark-o)" opacity="0.35">
        <path d="M300 120l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z" />
        <path d="M48 230l3.5 7.5 8 .8-6 5.4 2 8-7.5-4-7.5 4 2-8-6-5.4 8-.8z" />
      </g>
    </SceneSvg>
  );
}

/** Mountains in washes of ink, and a red sun above them. */
function InkMountains() {
  return (
    <SceneSvg>
      <circle cx="268" cy="148" r="34" fill="var(--color-mark-x)" opacity="0.32" />
      <path
        d="M0 470 L60 410 L96 440 L150 360 L210 438 L250 400 L300 452 L360 404 V640 H0Z"
        fill="var(--color-ink)"
        opacity="0.07"
      />
      <path
        d="M0 540 L44 500 L100 530 L170 470 L236 528 L290 490 L360 534 V640 H0Z"
        fill="var(--color-ink)"
        opacity="0.1"
      />
      <path
        d="M-10 610 C 60 580, 120 600, 180 588 S 300 576, 370 596"
        fill="none"
        stroke="var(--color-ink)"
        strokeOpacity="0.12"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </SceneSvg>
  );
}

/** What the last lesson left on the board: a little game, some sums, a star. */
function ChalkDoodles() {
  return (
    <SceneSvg>
      <g
        fill="none"
        stroke="var(--color-ink)"
        strokeOpacity="0.14"
        strokeWidth="2"
        strokeLinecap="round"
      >
        {/* A tic-tac-toe grid, abandoned mid-game. */}
        <path d="M262 470v78M286 470v78M246 494h62M246 520h62" />
        <path d="M252 478l8 8M260 478l-8 8M291 503a6 6 0 1 0 0.1 0" />
        {/* Sums. */}
        <path d="M30 120h22M41 109v22M64 120h18M100 112h14M100 126h14M126 106c10 0 10 14 0 14s-6 12 6 12" />
        {/* A star with a circle round it - the answer. */}
        <path d="M300 82l5 12 13 1-10 8 4 13-12-7-12 7 4-13-10-8 13-1z" />
        <path d="M272 98c0-24 58-24 58 2s-58 22-58-2" />
      </g>
      {/* The chalk ledge along the bottom. */}
      <rect y="626" width="360" height="14" fill="var(--color-board-edge)" opacity="0.8" />
      <rect x="70" y="620" width="34" height="7" rx="3" fill="var(--color-ink)" opacity="0.6" />
      <rect x="250" y="621" width="24" height="6" rx="3" fill="var(--color-mark-x)" opacity="0.6" />
    </SceneSvg>
  );
}

// ---------------------------------------------------------------------------
// Rival worlds: a motif in the world's accent colour, over everything else.
// ---------------------------------------------------------------------------

function WorldLayer({ motif, quality }: { motif: WorldMotif; quality: GraphicsQuality }) {
  const drift = quality === 'high';
  return (
    <svg
      viewBox="0 0 360 640"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <g
        fill="var(--world-accent)"
        stroke="var(--world-accent)"
        opacity="0.22"
        className={drift ? 'origin-center animate-float-c transform-fill' : undefined}
      >
        <WorldMotifArt motif={motif} />
      </g>
    </svg>
  );
}

function WorldMotifArt({ motif }: { motif: WorldMotif }) {
  switch (motif) {
    case 'pond':
      // Lily pads, each with its notch, and the ripples round them.
      return (
        <>
          {[
            [70, 520, 34],
            [290, 470, 26],
            [250, 590, 20],
            [40, 160, 18],
          ].map(([x, y, r]) => (
            <g key={`${x}-${y}`}>
              <path
                d={`M${x} ${y} L${x! + r!} ${y! - r! * 0.3} A ${r} ${r} 0 1 1 ${x! + r!} ${y! + r! * 0.3} Z`}
                stroke="none"
              />
              <circle cx={x} cy={y} r={r! * 1.5} fill="none" strokeWidth="1.5" />
            </g>
          ))}
        </>
      );
    case 'yarn':
      return (
        <>
          <circle cx="292" cy="540" r="38" stroke="none" />
          <g fill="none" strokeWidth="2" stroke="var(--color-canvas)" strokeOpacity="0.6">
            <path d="M262 524c18 8 42 8 60 0M258 548c22 10 46 10 68 0M276 508c-4 22-4 48 6 66" />
          </g>
          <path d="M254 560 C 200 600, 140 560, 90 610" fill="none" strokeWidth="2" />
          {/* Paw prints walking off the top of the page. */}
          {[
            [60, 140],
            [92, 108],
            [70, 72],
          ].map(([x, y]) => (
            <g key={`${x}-${y}`} stroke="none">
              <ellipse cx={x} cy={y} rx="7" ry="6" />
              <circle cx={x! - 8} cy={y! - 9} r="2.6" />
              <circle cx={x! - 2} cy={y! - 12} r="2.6" />
              <circle cx={x! + 5} cy={y! - 11} r="2.6" />
              <circle cx={x! + 10} cy={y! - 6} r="2.6" />
            </g>
          ))}
        </>
      );
    case 'library':
      return (
        <>
          <path d="M300 70a34 34 0 1 0 22 56a28 28 0 1 1 -22 -56z" stroke="none" />
          {[
            [60, 90],
            [120, 50],
            [210, 120],
            [40, 220],
            [330, 220],
          ].map(([x, y]) => (
            <path
              key={`${x}-${y}`}
              d={`M${x} ${y! - 6}L${x! + 1.6} ${y! - 1.6}L${x! + 6} ${y}L${x! + 1.6} ${y! + 1.6}L${x} ${y! + 6}L${x! - 1.6} ${y! + 1.6}L${x! - 6} ${y}L${x! - 1.6} ${y! - 1.6}Z`}
              stroke="none"
            />
          ))}
          {/* A shelf of books along the foot of the page. */}
          {[0, 26, 46, 74, 96, 128, 150, 178, 204, 232, 256, 288, 314, 336].map((x, at) => (
            <rect
              key={x}
              x={x}
              y={600 - (at % 3) * 12}
              width={at % 2 ? 18 : 22}
              height={40 + (at % 3) * 12}
              rx="2"
              stroke="none"
            />
          ))}
        </>
      );
    case 'forest':
      return (
        <>
          {[
            [30, 640, 70],
            [90, 640, 110],
            [160, 640, 80],
            [250, 640, 120],
            [320, 640, 90],
          ].map(([x, y, h]) => (
            <path
              key={x}
              d={`M${x} ${y! - h!}L${x! + h! * 0.32} ${y! - h! * 0.45}H${x! + h! * 0.16}L${x! + h! * 0.4} ${y}H${x! - h! * 0.4}L${x! - h! * 0.16} ${y! - h! * 0.45}H${x! - h! * 0.32}Z`}
              stroke="none"
            />
          ))}
        </>
      );
    case 'embers':
      return (
        <>
          {[
            [40, 600, 3],
            [80, 540, 2],
            [130, 590, 2.5],
            [200, 520, 2],
            [260, 580, 3],
            [310, 500, 2],
            [340, 610, 2.5],
            [170, 460, 1.8],
          ].map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} stroke="none" />
          ))}
          {/* Two leaves, turning as they fall. */}
          <path d="M290 120c20-14 40-6 44 10c-16 14-36 10-44-10z" stroke="none" />
          <path d="M60 260c14-18 34-14 40 0c-12 16-32 16-40 0z" stroke="none" />
        </>
      );
    case 'eclipse':
      return (
        <>
          <circle cx="180" cy="150" r="70" fill="none" strokeWidth="10" strokeOpacity="0.8" />
          <circle cx="180" cy="150" r="92" fill="none" strokeWidth="2" strokeOpacity="0.5" />
          <circle cx="180" cy="150" r="64" fill="var(--color-canvas)" stroke="none" />
          {/* Wisps rising from the foot of the page. */}
          <g fill="none" strokeWidth="3" strokeLinecap="round">
            <path d="M60 640c-10-40 20-60 0-100s10-60 0-90" />
            <path d="M300 640c10-30-16-50 2-86s-6-50 4-74" />
          </g>
        </>
      );
  }
}
