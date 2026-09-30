import type { Player } from '@dooz/engine';
import { X } from '@dooz/engine';
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

/** The player's piece set, re-rendering whenever it changes. */
export function useSkin(): Skin {
  return useSyncExternalStore(
    (notify) => subscribePreferences(notify),
    () => currentSkin,
    (): Skin => 'classic',
  );
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
      </defs>
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
};

const O_BY_SKIN: Record<Skin, (props: MarkOProps) => React.JSX.Element> = {
  classic: ClassicO,
  neon: NeonO,
  chalk: ChalkO,
  candy: CandyO,
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
