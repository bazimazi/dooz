import type { SVGProps } from 'react';

/**
 * The icons the competitive screens needed and the original set did not have.
 *
 * Drawn on a 24-unit grid with a 2-unit stroke rather than the original's
 * filled 32-unit shapes, because these appear at small sizes in dense lists
 * where a filled glyph turns into a blob. They paint with `currentColor` for
 * the same reason the others do.
 */
type IconProps = SVGProps<SVGSVGElement>;

function Stroke({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      width="1em"
      height="1em"
      {...props}
    >
      {children}
    </svg>
  );
}

export function TrophyIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H5a3 3 0 0 0 3 3M16 5h3a3 3 0 0 1-3 3" />
      <path d="M12 13v4M9 20h6M10 17h4l1 3H9l1-3Z" />
    </Stroke>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Stroke>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </Stroke>
  );
}

export function FlagIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </Stroke>
  );
}

/** Offered draw: two hands meeting. Simplified to a handshake chevron pair. */
export function HandshakeIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M3 11l4-4 5 3 5-3 4 4" />
      <path d="M7 13l3 3 2-2 2 2 3-3" />
    </Stroke>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </Stroke>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M9.5 3h5l.5 2.5 1.5.9 2.4-.8 2.5 4.3-1.9 1.7v1.8l1.9 1.7-2.5 4.3-2.4-.8-1.5.9-.5 2.5h-5L9 19.5l-1.5-.9-2.4.8-2.5-4.3 1.9-1.7v-1.8L2.6 9.9l2.5-4.3 2.4.8L9 5.5 9.5 3Z" />
    </Stroke>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </Stroke>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </Stroke>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M7 4.5l12 7.5-12 7.5V4.5Z" fill="currentColor" />
    </Stroke>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M9 4v16M15 4v16" />
    </Stroke>
  );
}

export function StepBackIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M18 5l-9 7 9 7V5Z" fill="currentColor" />
      <path d="M6 4v16" />
    </Stroke>
  );
}

export function StepForwardIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M6 5l9 7-9 7V5Z" fill="currentColor" />
      <path d="M18 4v16" />
    </Stroke>
  );
}

export function UndoIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M4 9h11a5 5 0 0 1 0 10h-6" />
      <path d="M8 5L4 9l4 4" />
    </Stroke>
  );
}

export function BulbIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1 .9 1.6v.5h5.2v-.5c0-.6.3-1.1.9-1.6A6 6 0 0 0 12 3Z" />
    </Stroke>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </Stroke>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
    </Stroke>
  );
}

export function MedalIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <circle cx="12" cy="15" r="6" />
      <path d="M12 12.8l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2L8.8 15l2.2-.3 1-2Z" />
      <path d="M8 3l2.5 5M16 3l-2.5 5" />
    </Stroke>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
      <path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
    </Stroke>
  );
}

export function MuteIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M11 5L6.5 9H3v6h3.5L11 19V5Z" />
      <path d="M16 9l5 6M21 9l-5 6" />
    </Stroke>
  );
}

export function SpeakIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M11 5L6.5 9H3v6h3.5L11 19V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12" />
    </Stroke>
  );
}

export function FlagReportIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M12 8v5M12 16.5v.01" />
      <circle cx="12" cy="12" r="9" />
    </Stroke>
  );
}

export function ListIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </Stroke>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </Stroke>
  );
}

export function TargetIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </Stroke>
  );
}

export function SwapIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </Stroke>
  );
}
