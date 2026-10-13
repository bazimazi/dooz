import type { CSSProperties } from 'react';
import { AvatarBadge } from '@/components/art/avatars';
import { MedalIcon } from '@/components/art/ui-icons';
import type { Avatar } from '@/protocol';
import type { Cosmetic, WinEffect } from '@/features/progress/cosmetics';
import { cx } from '@/lib/cx';

/**
 * The small drawings the collection is shown with.
 *
 * Each is a preview of the real thing at icon size, never a stand-in: the
 * frame is the ring the profile draws, the effect swatch uses the colours and
 * shape the confetti will throw, so what is equipped is what was shown.
 */

/** The player level, as a numbered shield. */
export function LevelBadge({ level, className }: { level: number; className?: string }) {
  return (
    <span
      className={cx(
        'relative inline-flex shrink-0 items-center justify-center font-display leading-none text-on-raised',
        className ?? 'size-10 text-base',
      )}
    >
      <svg viewBox="0 0 40 44" aria-hidden="true" className="absolute inset-0 size-full">
        <path
          d="M20 2 L37 11 V31 L20 42 L3 31 V11 Z"
          fill="var(--color-stroke)"
          stroke="var(--color-mark-o)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path d="M20 6 L33 13 V20 L20 13 L7 20 V13 Z" fill="white" opacity="0.16" />
      </svg>
      <span className="tnum relative">{level}</span>
    </span>
  );
}

/** An avatar inside its equipped frame. A frame with no ring draws the avatar alone. */
export function FramedAvatar({
  avatar,
  ring,
  className,
}: {
  avatar: Avatar;
  /** The frame's CSS background, or empty for none. */
  ring: string;
  className?: string;
}) {
  if (!ring) return <AvatarBadge avatar={avatar} className={className} />;
  return (
    <span
      className={cx('inline-flex shrink-0 rounded-full p-[7%]', className)}
      style={{ background: ring }}
    >
      <AvatarBadge avatar={avatar} className="size-full" />
    </span>
  );
}

const SWATCH = [
  { x: 6, y: 22, r: -20 },
  { x: 17, y: 8, r: 25 },
  { x: 27, y: 25, r: 60 },
  { x: 33, y: 9, r: -35 },
  { x: 13, y: 31, r: 10 },
  { x: 25, y: 16, r: -60 },
];

/** A frozen handful of the confetti an effect throws. */
export function EffectSwatch({ effect, className }: { effect: WinEffect; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={cx('shrink-0', className)}>
      {SWATCH.map((piece, at) => {
        const fill = effect.colours[at % effect.colours.length]!;
        const shape = effect.shape === 'mixed' ? (at % 3 === 0 ? 'round' : 'square') : effect.shape;
        const transform = `rotate(${piece.r} ${piece.x} ${piece.y})`;
        if (shape === 'round')
          return <circle key={at} cx={piece.x} cy={piece.y} r="3.2" style={{ fill }} />;
        if (shape === 'star')
          return (
            <path
              key={at}
              d={starPath(piece.x, piece.y, 4.6)}
              style={{ fill }}
              transform={transform}
            />
          );
        return (
          <rect
            key={at}
            x={piece.x - 2.2}
            y={piece.y - 3.6}
            width="4.4"
            height="7.2"
            rx="1"
            style={{ fill }}
            transform={transform}
          />
        );
      })}
    </svg>
  );
}

function starPath(x: number, y: number, r: number): string {
  const points = Array.from({ length: 10 }, (_, at) => {
    const angle = (Math.PI / 5) * at - Math.PI / 2;
    const radius = at % 2 === 0 ? r : r * 0.45;
    return `${(x + Math.cos(angle) * radius).toFixed(2)} ${(y + Math.sin(angle) * radius).toFixed(2)}`;
  });
  return `M${points.join('L')}Z`;
}

/** A clip path for star-shaped confetti, matching the swatch. */
export const STAR_CLIP: CSSProperties['clipPath'] =
  'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';

/** The art for any cosmetic, at icon size. */
export function CosmeticArt({
  cosmetic,
  avatar = 'fox',
  className = 'size-10',
}: {
  cosmetic: Cosmetic;
  avatar?: Avatar;
  className?: string;
}) {
  switch (cosmetic.kind) {
    case 'effect':
      return <EffectSwatch effect={cosmetic} className={className} />;
    case 'frame':
      return <FramedAvatar avatar={avatar} ring={cosmetic.ring} className={className} />;
    case 'title':
      return (
        <span
          className={cx(
            'flex shrink-0 items-center justify-center rounded-full bg-sunken text-warn',
            className,
          )}
        >
          <MedalIcon />
        </span>
      );
    case 'emote':
      return (
        <span
          className={cx(
            'flex shrink-0 items-center justify-center rounded-2xl rounded-es-sm bg-sunken font-display text-sm text-ink',
            className,
          )}
        >
          “”
        </span>
      );
  }
}
