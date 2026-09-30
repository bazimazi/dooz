import type { ReactNode } from 'react';
import { Backdrop } from '@/components/art/Backdrop';
import { MarkDefs } from '@/components/art/marks';
import { cx } from '@/lib/cx';

interface ScreenProps {
  children: ReactNode;
  /** The home screen gets the extra out-of-focus pieces at its foot. */
  backdrop?: 'home' | 'game';
  /**
   * How wide the content column may grow.
   *
   * `narrow` is the phone-width column the game is drawn at. `wide` is for the
   * screens that are lists rather than boards - a leaderboard or a match
   * history reads badly in a 30rem gutter on a desktop monitor.
   */
  width?: 'narrow' | 'wide';
  /** Let the content scroll rather than being pinned to the viewport height. */
  scroll?: boolean;
  className?: string;
}

/**
 * The frame every screen sits in.
 *
 * The game is drawn at phone width, so the content column is capped and centred
 * rather than stretched - on a desktop or tablet window the backdrop fills the
 * space and the board stays at a comfortable size. Safe-area insets keep it
 * clear of a notch or a home indicator on mobile.
 */
export function Screen({
  children,
  backdrop = 'game',
  width = 'narrow',
  scroll = false,
  className,
}: ScreenProps) {
  return (
    <>
      <Backdrop variant={backdrop} />
      <MarkDefs />
      <div
        className={cx(
          'relative mx-auto flex w-full flex-col items-center px-5',
          width === 'wide' ? 'max-w-wide' : 'max-w-screen',
          // A board screen is pinned to the viewport so the board never
          // scrolls out from under the player; a list screen has to be able to
          // grow past it or half the rows are unreachable.
          scroll ? 'min-h-full' : 'h-full',
          className,
        )}
        style={{
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
        }}
      >
        {children}
      </div>
    </>
  );
}
