import { type RefObject, useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Makes an overlay behave like the modal it claims to be.
 *
 * `aria-modal="true"` is a promise to assistive technology, not an instruction
 * to the browser: on its own the board and the controls behind the panel stay
 * in the tab order, so a keyboard or screen-reader user tabs straight out of a
 * dialog that says nothing is outside it. This does the three things that
 * promise actually requires.
 *
 * 1. Focus moves into the panel on mount, and back to whatever had it on close.
 * 2. Tab and Shift+Tab wrap within the panel.
 * 3. Everything else on the page is `inert` for as long as the panel is up, so
 *    it is unreachable by pointer and hidden from the accessibility tree.
 *
 * `onEscape` is optional because not every overlay is dismissible - the result
 * panel deliberately has no way out but its own two buttons.
 */
export function useDialog<T extends HTMLElement>(onEscape?: () => void): RefObject<T | null> {
  const ref = useRef<T>(null);
  // Held in a ref, and refreshed after every render, so a caller passing an
  // inline arrow does not tear the trap down and rebuild it each time. The
  // handler reads it when a key is actually pressed, so it is always current by
  // then.
  const escapeRef = useRef(onEscape);
  useEffect(() => {
    escapeRef.current = onEscape;
  });

  useEffect(() => {
    const panel = ref.current;
    if (!panel) return;

    const previous = document.activeElement;
    panel.focus();

    // Everything that is not an ancestor of the panel, which is the smallest
    // set that covers the page without needing to know the app's layout.
    const inerted: HTMLElement[] = [];
    for (let node = panel.parentElement; node; node = node.parentElement) {
      for (const sibling of node.children) {
        if (sibling instanceof HTMLElement && !sibling.contains(panel) && !sibling.inert) {
          sibling.inert = true;
          inerted.push(sibling);
        }
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        escapeRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const stops = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = stops[0];
      const last = stops.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      for (const node of inerted) node.inert = false;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  return ref;
}
