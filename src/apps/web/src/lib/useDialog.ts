import { type RefObject, useEffect, useRef } from 'react';
import { useRouter } from '@tanstack/react-router';
import { sfx } from './sound';

declare module '@tanstack/history' {
  interface HistoryState {
    __doozSheet?: string;
  }
}

const SHEET_STATE = '__doozSheet';
const sheets: symbol[] = [];

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
  const history = useRouter({ warn: false })?.history;
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
    if (!history || !escapeRef.current) return;
    let disposed = false;
    let release: (() => void) | undefined;
    // StrictMode mounts effects twice. Wait until its first cleanup has run
    // before adding a browser entry, so one sheet always owns one entry.
    queueMicrotask(() => {
      if (disposed) return;
      const token = crypto.randomUUID();
      const layer = Symbol('sheet');
      sheets.push(layer);
      const { href, state } = history.location;
      history.push(href, { ...state, [SHEET_STATE]: token }, { ignoreBlocker: true });
      history.flush();
      const unblock = history.block({
        enableBeforeUnload: false,
        blockerFn: ({ action, currentLocation, nextLocation }) => {
          if (sheets.at(-1) !== layer) return false;
          const backwards =
            action === 'BACK' ||
            (action === 'GO' && nextLocation.state.__TSR_index < currentLocation.state.__TSR_index);
          if (!backwards) return false;
          escapeRef.current?.();
          // The first Back consumes the sheet entry while staying on this
          // page. Keep rapid or multi-page Back attempts on the page until
          // the sheet's closing animation finishes.
          return currentLocation.state[SHEET_STATE] !== token || nextLocation.href !== href;
        },
      });
      release = () => {
        unblock();
        sheets.splice(sheets.indexOf(layer), 1);
        if (history.location.state[SHEET_STATE] === token && history.location.href === href) {
          // Done, Escape and backdrop dismissal also consume their entry.
          // Navigation chosen inside the sheet already has a different
          // entry and must be allowed to continue to its destination.
          history.back({ ignoreBlocker: true });
        }
      };
    });
    return () => {
      disposed = true;
      release?.();
    };
  }, [history]);

  useEffect(() => {
    const panel = ref.current;
    if (!panel) return;

    const previous = document.activeElement;
    panel.focus();
    // A sheet the player opened arrives with a breath of air. The result panel
    // - the one overlay with no escape - has its own sound for arriving.
    if (escapeRef.current) sfx.whoosh(true);

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
