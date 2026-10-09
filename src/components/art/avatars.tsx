import { type Avatar, AVATARS } from '@/protocol';
import type { SVGProps } from 'react';
import { cx } from '@/lib/cx';

/**
 * Player avatars.
 *
 * Ten flat shapes rather than photographs or uploads, which is a product
 * decision as much as a technical one: an avatar a player chooses from a fixed
 * set is one nobody has to moderate, it needs no upload path, no storage and no
 * report queue, and it renders identically on every platform the app ships to.
 *
 * Each one is a silhouette in its own hue, so they are told apart by shape and
 * colour together - a player who cannot distinguish the two greens still has
 * nine other outlines to go on.
 */
const HUES: Record<Avatar, string> = {
  fox: '#f97316',
  owl: '#a78bfa',
  cat: '#f43f5e',
  bear: '#a16207',
  frog: '#22c55e',
  whale: '#38bdf8',
  robot: '#94a3b8',
  ghost: '#e2e8f0',
  star: '#facc15',
  bolt: '#fb7185',
};

const SHAPES: Record<Avatar, React.ReactNode> = {
  fox: (
    <>
      <path d="M12 30 6 12l7 4h10l7-4-6 18Z" />
      <circle cx="15" cy="20" r="1.6" fill="#1f2937" />
      <circle cx="25" cy="20" r="1.6" fill="#1f2937" />
    </>
  ),
  owl: (
    <>
      <path d="M20 8c7 0 11 5 11 12s-5 12-11 12S9 27 9 20 13 8 20 8Z" />
      <circle cx="15.5" cy="18" r="4" fill="#fff" />
      <circle cx="24.5" cy="18" r="4" fill="#fff" />
      <circle cx="15.5" cy="18" r="1.8" fill="#1f2937" />
      <circle cx="24.5" cy="18" r="1.8" fill="#1f2937" />
      <path d="M20 22l-2.5 3h5L20 22Z" fill="#f59e0b" />
    </>
  ),
  cat: (
    <>
      <path d="M9 14l2-6 5 4h8l5-4 2 6v8a11 11 0 0 1-22 0v-8Z" />
      <circle cx="16" cy="19" r="1.6" fill="#1f2937" />
      <circle cx="24" cy="19" r="1.6" fill="#1f2937" />
      <path d="M18 24h4l-2 2-2-2Z" fill="#1f2937" />
    </>
  ),
  bear: (
    <>
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="28" cy="12" r="4.5" />
      <circle cx="20" cy="21" r="11" />
      <circle cx="16.5" cy="19" r="1.6" fill="#1f2937" />
      <circle cx="23.5" cy="19" r="1.6" fill="#1f2937" />
      <ellipse cx="20" cy="24" rx="3" ry="2" fill="#1f2937" />
    </>
  ),
  frog: (
    <>
      <circle cx="13" cy="13" r="5" />
      <circle cx="27" cy="13" r="5" />
      <circle cx="13" cy="13" r="2" fill="#1f2937" />
      <circle cx="27" cy="13" r="2" fill="#1f2937" />
      <path d="M8 20h24a12 12 0 0 1-24 0Z" />
    </>
  ),
  whale: (
    <>
      <path d="M6 22c0-6 6-10 14-10s14 4 14 10-6 9-14 9S6 28 6 22Z" />
      <path d="M32 16l6-4-2 8-4-4Z" />
      <circle cx="14" cy="21" r="1.8" fill="#1f2937" />
    </>
  ),
  robot: (
    <>
      <rect x="9" y="12" width="22" height="18" rx="4" />
      <path d="M20 6v6M17 9h6" stroke="#1f2937" strokeWidth="2" fill="none" />
      <rect x="14" y="18" width="4" height="4" rx="1" fill="#1f2937" />
      <rect x="22" y="18" width="4" height="4" rx="1" fill="#1f2937" />
      <path d="M15 26h10" stroke="#1f2937" strokeWidth="2" />
    </>
  ),
  ghost: (
    <>
      <path d="M8 32V19a12 12 0 0 1 24 0v13l-4-3-4 3-4-3-4 3-4-3Z" />
      <circle cx="16" cy="19" r="2" fill="#1f2937" />
      <circle cx="24" cy="19" r="2" fill="#1f2937" />
    </>
  ),
  star: (
    <path d="M20 5l4.5 10.2L36 16.6l-8.4 7.6 2.3 11.3L20 29.8 10.1 35.5l2.3-11.3L4 16.6l11.5-1.4L20 5Z" />
  ),
  bolt: <path d="M23 4 10 22h8l-2 14 14-19h-8l1-13Z" />,
};

interface AvatarBadgeProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  avatar: Avatar;
  /** The disc behind the shape. Matches whatever surface it is sitting on. */
  ring?: string;
}

export function AvatarBadge({
  avatar,
  ring = 'var(--color-surface)',
  className,
  ...props
}: AvatarBadgeProps) {
  const hue = HUES[avatar] ?? HUES.fox;

  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
      className={cx('shrink-0', className)}
      {...props}
    >
      <circle cx="20" cy="20" r="20" fill={ring} />
      <circle cx="20" cy="20" r="19" fill={`color-mix(in srgb, ${hue} 24%, transparent)`} />
      <g fill={hue}>{SHAPES[avatar] ?? SHAPES.fox}</g>
    </svg>
  );
}

export { AVATARS };
export type { Avatar };
