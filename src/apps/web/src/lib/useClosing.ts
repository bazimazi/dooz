import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Lets an overlay animate itself out before its owner unmounts it.
 *
 * React removes a component the moment its condition goes false, which leaves
 * no frame for an exit animation to run in. The fix is to keep the decision to
 * unmount in the parent but delay it: `close()` flips `closing`, the overlay
 * plays its exit, and the real `onClose` fires when the animation is over.
 *
 * `duration` must match the exit animation in the stylesheet. A user who has
 * asked for reduced motion gets no wait at all - their exit animation is
 * collapsed to nothing, so a delay would just be an unexplained pause.
 */
export function useClosing(onClose: () => void, duration = 180) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    timer.current = setTimeout(onClose, reduced ? 0 : duration);
  }, [closing, duration, onClose]);

  return { closing, close };
}
