import type { ReactNode } from 'react';
import { Backdrop } from '@/components/art/Backdrop';

interface ScreenProps {
  children: ReactNode;
  /** The home screen gets the extra out-of-focus pieces at its foot. */
  backdrop?: 'home' | 'game';
}

/**
 * The frame every screen sits in.
 *
 * The design is drawn at phone width, so the content column is capped and
 * centred rather than stretched - on a desktop or tablet window the backdrop
 * fills the space and the game stays at a comfortable size. Safe-area insets
 * keep it clear of a notch or a home indicator on mobile.
 */
export function Screen({ children, backdrop = 'game' }: ScreenProps) {
  return (
    <>
      <Backdrop variant={backdrop} />
      <div
        className="relative mx-auto flex h-full w-full max-w-104 flex-col items-center px-5"
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
