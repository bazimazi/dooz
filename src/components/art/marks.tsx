import type { Player } from '@/game/engine';
import { X } from '@/game/engine';
import { type CSSProperties, useSyncExternalStore } from 'react';
import { loadPreferences, type Skin, subscribePreferences } from '@/lib/preferences';

interface MarkProps {
  /** Extra classes, normally sizing. The marks fill their box. */
  className?: string;
  /** Used to stagger an entrance animation set by the caller's class. */
  style?: CSSProperties;
  title?: string;
  /** Overrides the player's chosen piece set - the skin picker previews with it. */
  skin?: Skin;
}

/**
 * The X and O pieces.
 *
 * `classic` is traced from the Figma components and is what every screenshot
 * of the game shows. The other sets are unlocked by playing and change only the
 * drawing: the colours still come from the `mark-x` and `mark-o` tokens, so
 * every set is the same pink and amber, in both themes, and a board is readable
 * in any of them.
 *
 * They are inline SVG rather than `<img>` files so they inherit the animation
 * on the cell that holds them, stay sharp on any display, and need no network
 * request when the app is running offline in a Tauri window.
 */

// ---------------------------------------------------------------------------
// The chosen skin
// ---------------------------------------------------------------------------

let currentSkin: Skin = loadPreferences().skin;
subscribePreferences((next) => {
  currentSkin = next.skin;
});
const readSkin = () => currentSkin;
const serverSkin = (): Skin => 'classic';

/** The player's piece set, re-rendering whenever it changes. */
export function useSkin(): Skin {
  return useSyncExternalStore(subscribePreferences, readSkin, serverSkin);
}

// ---------------------------------------------------------------------------
// Classic
// ---------------------------------------------------------------------------

function ClassicX({ className, style, title }: MarkProps) {
  return (
    <svg
      viewBox="0 0 64 65"
      fill="none"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
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

function ClassicO({ className, style, title, hole = 'var(--color-surface)' }: MarkOProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
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

// ---------------------------------------------------------------------------
// Neon: tubes of light. A wide soft stroke under a bright core, no filters -
// a blur per mark on a 225-square board is a cost nobody needs to pay.
// ---------------------------------------------------------------------------

function NeonX({ className, style, title }: MarkProps) {
  const arms = 'M14 14 L50 50 M50 14 L14 50';
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <path
        d={arms}
        stroke="var(--color-mark-x)"
        strokeOpacity="0.28"
        strokeWidth="17"
        strokeLinecap="round"
      />
      <path d={arms} stroke="var(--color-mark-x)" strokeWidth="8" strokeLinecap="round" />
      <path d={arms} stroke="var(--color-mark-x-soft)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function NeonO({ className, style, title }: MarkOProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <circle
        cx="32"
        cy="32"
        r="21"
        stroke="var(--color-mark-o)"
        strokeOpacity="0.28"
        strokeWidth="17"
      />
      <circle cx="32" cy="32" r="21" stroke="var(--color-mark-o)" strokeWidth="8" />
      <circle cx="32" cy="32" r="21" stroke="var(--color-mark-o-soft)" strokeWidth="3" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Chalk: hand-drawn strokes that draw themselves on. The paths are slightly
// irregular on purpose, and the dash pattern breaks them up like chalk on a
// board. `pathLength` normalises every stroke to 1, so one keyframe draws them
// all regardless of their real length.
// ---------------------------------------------------------------------------

function ChalkX({ className, style, title }: MarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M13 15 C 22 23, 30 31, 36 36 S 47 46, 51 50"
        pathLength={1}
        className="chalk-stroke"
        stroke="var(--color-mark-x)"
        strokeWidth="7.5"
        strokeLinecap="round"
      />
      <path
        d="M50 13 C 44 21, 37 28, 31 34 S 19 46, 14 51"
        pathLength={1}
        className="chalk-stroke [animation-delay:0.14s]"
        stroke="var(--color-mark-x)"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChalkO({ className, style, title }: MarkOProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {/* Starts at the top and overshoots its own start, the way a hand does. */}
      <path
        d="M33 10 C 46 10, 54 20, 53 33 C 52 46, 43 54, 31 54 C 18 54, 10 45, 11 32 C 12 19, 21 11, 36 12"
        pathLength={1}
        className="chalk-stroke"
        stroke="var(--color-mark-o)"
        strokeWidth="7.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Candy: glossy and rounded, lit from the top left. Gradients are shared - see
// `MarkDefs` - so a full board costs one set of definitions, not one per mark.
// ---------------------------------------------------------------------------

function CandyX({ className, style, title }: MarkProps) {
  const arms = 'M15 15 L49 49 M49 15 L15 49';
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <path
        d={arms}
        stroke="var(--color-mark-x-edge)"
        strokeWidth="18"
        strokeLinecap="round"
        transform="translate(0 2.5)"
      />
      <path d={arms} stroke="url(#dooz-candy-x)" strokeWidth="16" strokeLinecap="round" />
      <path
        d="M17 13.5 L23 19.5 M47 13.5 L41 19.5"
        stroke="white"
        strokeOpacity="0.55"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CandyO({ className, style, title }: MarkOProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <circle cx="32" cy="34.5" r="20" stroke="var(--color-mark-o-edge)" strokeWidth="16" />
      <circle cx="32" cy="32" r="20" stroke="url(#dooz-candy-o)" strokeWidth="15" />
      <path
        d="M17.5 24 A 16 16 0 0 1 30 15.5"
        stroke="white"
        strokeOpacity="0.6"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Gradients the candy set points at, rendered once for the whole document.
 *
 * Kept in the page rather than inside each mark: an SVG gradient is looked up
 * by id across the document, so one copy serves every board, preview and card.
 * The colours are the theme tokens, so they follow a theme switch without the
 * definitions being rebuilt.
 */
export function MarkDefs() {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      className="pointer-events-none absolute"
      focusable="false"
    >
      <defs>
        <linearGradient id="dooz-candy-x" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--color-mark-x-soft)' }} />
          <stop offset="0.55" style={{ stopColor: 'var(--color-mark-x)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-mark-x-edge)' }} />
        </linearGradient>
        <linearGradient id="dooz-candy-o" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--color-mark-o-soft)' }} />
          <stop offset="0.55" style={{ stopColor: 'var(--color-mark-o)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-mark-o-edge)' }} />
        </linearGradient>

        {/* The visual styles' mark accents (see `art-styles.css`), applied on
            High only and only on boards small enough to afford a filter per
            mark. Defined once here for the same reason the gradients are. */}

        {/* Tabletop: a glossy stone. The mark's own silhouette, blurred, is
            the height map; a lamp up and to the left lights it. */}
        <filter
          id="dooz-stone"
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="height" />
          <feSpecularLighting
            in="height"
            surfaceScale="3.2"
            specularConstant="0.95"
            specularExponent="20"
            lightingColor="#fff6e6"
            result="shine"
          >
            <feDistantLight azimuth="225" elevation="42" />
          </feSpecularLighting>
          <feComposite in="shine" in2="SourceAlpha" operator="in" result="lit" />
          <feComposite in="SourceGraphic" in2="lit" operator="arithmetic" k2="1" k3="0.7" />
        </filter>

        {/* Ink: the stroke's edge wanders as the brush bleeds into paper. */}
        <filter id="dooz-ink-bleed" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            seed="3"
            result="fibres"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="fibres"
            scale="3.2"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* Chalk: the stick skips, leaving the slate showing through. */}
        <filter id="dooz-chalk-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="1.4"
            numOctaves="1"
            seed="7"
            result="noise"
          />
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.7 0 0 0 1.5"
            result="grain"
          />
          <feComposite in="SourceGraphic" in2="grain" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Pixel: an eight-by-eight sprite. The cells are worked out once and joined
// into a single path per mark, so a full board is still one element a mark.
// ---------------------------------------------------------------------------

const PIXEL = 7;
const PIXEL_ORIGIN = 4;

function pixelPath(cells: readonly (readonly [number, number])[]): string {
  return cells
    .map(([col, row]) => {
      const x = PIXEL_ORIGIN + col * PIXEL;
      const y = PIXEL_ORIGIN + row * PIXEL;
      return `M${x} ${y}h${PIXEL}v${PIXEL}h-${PIXEL}z`;
    })
    .join('');
}

const PIXEL_X = pixelPath(
  Array.from({ length: 8 }, (_, at) => [
    [at, at] as const,
    [7 - at, at] as const,
    // A second pixel beside each, so the arms read as strokes, not dots.
    [Math.min(7, at + 1), at] as const,
    [Math.max(0, 6 - at), at] as const,
  ]).flat(),
);

const PIXEL_O = pixelPath(
  Array.from({ length: 64 }, (_, at) => [at % 8, Math.floor(at / 8)] as const).filter(
    ([col, row]) => {
      const distance = Math.hypot(col - 3.5, row - 3.5);
      return distance > 1.9 && distance < 3.9;
    },
  ),
);

function PixelX({ className, style, title }: MarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      style={style}
      role="img"
      aria-label={title}
      shapeRendering="crispEdges"
    >
      {title ? <title>{title}</title> : null}
      <path d={PIXEL_X} fill="var(--color-mark-x-edge)" transform="translate(1.5 1.5)" />
      <path d={PIXEL_X} fill="var(--color-mark-x)" />
    </svg>
  );
}

function PixelO({ className, style, title }: MarkOProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      style={style}
      role="img"
      aria-label={title}
      shapeRendering="crispEdges"
    >
      {title ? <title>{title}</title> : null}
      <path d={PIXEL_O} fill="var(--color-mark-o-edge)" transform="translate(1.5 1.5)" />
      <path d={PIXEL_O} fill="var(--color-mark-o)" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Brush: ink strokes with a loaded start and a dry, tapering finish. Filled
// shapes rather than strokes, since a stroke cannot change width along its
// length.
// ---------------------------------------------------------------------------

function BrushX({ className, style, title }: MarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M9 15 C 11 9, 18 10, 22 14 C 31 23, 41 35, 54 51 C 55 53, 53 54, 51 52 C 38 40, 26 29, 12 21 C 8 19, 8 17, 9 15 Z"
        fill="var(--color-mark-x)"
      />
      <path
        d="M52 10 C 56 9, 57 13, 54 16 C 44 27, 32 39, 15 55 C 13 56, 12 55, 13 53 C 27 37, 38 24, 47 13 C 48 11, 50 10, 52 10 Z"
        fill="var(--color-mark-x)"
      />
      <path
        d="M12 15 C 14 13, 17 13, 19 15"
        stroke="var(--color-mark-x-soft)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

function BrushO({ className, style, title }: MarkOProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {/* An enso: one sweep, heavy where the brush lands, open where it lifts. */}
      <path
        d="M40 9 C 26 4, 8 14, 8 33 C 8 50, 22 58, 36 56 C 50 54, 58 42, 56 28 C 55 22, 52 17, 48 14 C 51 19, 52 25, 51 30 C 50 42, 42 49, 33 49 C 22 49, 15 42, 15 32 C 15 20, 25 12, 37 13 C 40 13, 42 11, 40 9 Z"
        fill="var(--color-mark-o)"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Gem: cut stones. Each face is the same token at a different strength, so
// the facets read as light on a solid shape in either theme.
// ---------------------------------------------------------------------------

function GemX({ className, style, title }: MarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M10 18 L18 10 L32 24 L46 10 L54 18 L40 32 L54 46 L46 54 L32 40 L18 54 L10 46 L24 32 Z"
        fill="var(--color-mark-x)"
        stroke="var(--color-mark-x-edge)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M18 10 L32 24 L24 32 L10 18 Z" fill="var(--color-mark-x-soft)" opacity="0.8" />
      <path d="M46 10 L54 18 L40 32 L32 24 Z" fill="white" opacity="0.28" />
      <path d="M32 40 L40 32 L54 46 L46 54 Z" fill="var(--color-mark-x-edge)" opacity="0.5" />
    </svg>
  );
}

function GemO({ className, style, title, hole = 'var(--color-surface)' }: MarkOProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M22 5 H42 L59 22 V42 L42 59 H22 L5 42 V22 Z"
        fill="var(--color-mark-o)"
        stroke="var(--color-mark-o-edge)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M22 5 H42 L37 18 H27 Z" fill="white" opacity="0.32" />
      <path d="M5 22 L18 27 V37 L5 42 Z" fill="var(--color-mark-o-soft)" opacity="0.75" />
      <path d="M42 59 H22 L27 46 H37 Z" fill="var(--color-mark-o-edge)" opacity="0.5" />
      <path
        d="M27 18 H37 L46 27 V37 L37 46 H27 L18 37 V27 Z"
        fill={hole}
        stroke="var(--color-mark-o-edge)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Public components
// ---------------------------------------------------------------------------

const X_BY_SKIN: Record<Skin, (props: MarkProps) => React.JSX.Element> = {
  classic: ClassicX,
  neon: NeonX,
  chalk: ChalkX,
  candy: CandyX,
  pixel: PixelX,
  brush: BrushX,
  gem: GemX,
};

const O_BY_SKIN: Record<Skin, (props: MarkOProps) => React.JSX.Element> = {
  classic: ClassicO,
  neon: NeonO,
  chalk: ChalkO,
  candy: CandyO,
  pixel: PixelO,
  brush: BrushO,
  gem: GemO,
};

export function MarkX({ skin, ...props }: MarkProps) {
  const chosen = useSkin();
  const Draw = X_BY_SKIN[skin ?? chosen];
  return <Draw {...props} />;
}

export function MarkO({ skin, ...props }: MarkOProps) {
  const chosen = useSkin();
  const Draw = O_BY_SKIN[skin ?? chosen];
  return <Draw {...props} />;
}

interface MarkProps2 extends MarkOProps {
  player: Player;
}

/** Whichever mark belongs to `player`. */
export function Mark({ player, ...props }: MarkProps2) {
  return player === X ? <MarkX {...props} /> : <MarkO {...props} />;
}
