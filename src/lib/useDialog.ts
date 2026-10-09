import { type RefObject, useEffect, useRef } from 'react';
import { type RouterHistory, useRouter } from '@tanstack/react-router';
import { sfx } from './sound';
import { registerDialogBackGuard } from './navigation';

const SHEET_STATE = '__doozSheet';
const sheets = new WeakMap<RouterHistory, Array<() => Promise<void>>>();
const pendingReleases = new WeakMap<RouterHistory, Promise<void>>();
const dialogs: symbol[] = [];
let bodyOverflow = '';

/** Consume the overlay entry before a return action or a same-screen URL edit. */
export async function consumeDialogHistory(history: RouterHistory): Promise<void> {
  await pendingReleases.get(history);
  const stack = sheets.get(history) ?? [];
  // Each Back must finish before consuming the sheet below it.
  for (let index = stack.length - 1; index >= 0; index--) {
    // eslint-disable-next-line no-await-in-loop
    await stack[index]?.();
  }
}

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
 * `onEscape` is optional because some result panels require a choice from
 * their own actions.
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
    let release: (() => Promise<void>) | undefined;
    // StrictMode mounts effects twice. Wait until its first cleanup has run
    // before adding a browser entry, so one sheet always owns one entry.
    void Promise.resolve(pendingReleases.get(history)).then(() => {
      if (disposed) return;
      const token = crypto.randomUUID();
      const stack = sheets.get(history) ?? [];
      sheets.set(history, stack);
      const { href, state } = history.location;
      history.flush();
      history.push(href, { ...state, [SHEET_STATE]: token }, { ignoreBlocker: true });
      history.flush();
      let restoration: { index: number; done: Promise<void>; resolve: () => void } | undefined;
      const onPopState = (event: PopStateEvent) => {
        const nextIndex: unknown = event.state?.['__TSR_index'];
        if (typeof nextIndex !== 'number') return;
        if (restoration) {
          event.stopImmediatePropagation();
          if (nextIndex === restoration.index) {
            restoration.resolve();
            restoration = undefined;
          }
          return;
        }
        const current = history.location;
        const currentIndex = current.state['__TSR_index'];
        if (stack.at(-1) !== release || nextIndex >= currentIndex) return;
        escapeRef.current?.();
        const nextHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (
          current.state[SHEET_STATE] === token &&
          nextIndex === state['__TSR_index'] &&
          nextHref === href
        )
          return;

        // A long-press traversal or a second Back during the exit must not
        // leave the game. Restore the entire skipped distance before cleanup
        // consumes the sheet, rather than relying on a one-step rollback.
        event.stopImmediatePropagation();
        let resolve!: () => void;
        const done = new Promise<void>((complete) => {
          resolve = complete;
        });
        restoration = { index: currentIndex, done, resolve };
        window.history.go(currentIndex - nextIndex);
      };
      const unregister = registerDialogBackGuard(history, onPopState);
      const unsubscribe =
        unregister ??
        history.subscribe(({ action }) => {
          if (
            stack.at(-1) === release &&
            (action.type === 'BACK' || (action.type === 'GO' && action.index < 0))
          )
            escapeRef.current?.();
        });
      let released: Promise<void> | undefined;
      release = () => {
        if (released) return released;
        released = (async () => {
          await restoration?.done;
          unsubscribe();
          const index = stack.indexOf(release!);
          if (index >= 0) stack.splice(index, 1);
          if (history.location.state[SHEET_STATE] === token && history.location.href === href) {
            // Done, Escape and backdrop dismissal also consume their entry.
            // Navigation chosen inside the sheet already has a different
            // entry and must be allowed to continue to its destination.
            await new Promise<void>((resolve) => {
              const stop = history.subscribe(({ action }) => {
                if (action.type !== 'BACK' && action.type !== 'GO') return;
                stop();
                resolve();
              });
              history.back({ ignoreBlocker: true });
            });
          }
        })();
        pendingReleases.set(history, released);
        void released.then(() => {
          if (pendingReleases.get(history) === released) pendingReleases.delete(history);
          return undefined;
        });
        return released;
      };
      stack.push(release);
      return undefined;
    });
    return () => {
      disposed = true;
      void release?.();
    };
  }, [history]);

  useEffect(() => {
    const panel = ref.current;
    if (!panel) return;

    const layer = Symbol('dialog');
    // Keep touch scrolling inside the overlay, including on short screens.
    if (dialogs.length === 0) bodyOverflow = document.body.style.overflow;
    dialogs.push(layer);
    document.body.style.overflow = 'hidden';

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
      if (dialogs.at(-1) !== layer) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        escapeRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const stops = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = stops[0];
      const last = stops.at(-1);
      if (!first || !last) {
        event.preventDefault();
        return;
      }

      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === panel)
      ) {
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
      dialogs.splice(dialogs.indexOf(layer), 1);
      if (dialogs.length === 0) document.body.style.overflow = bodyOverflow;
      for (const node of inerted) node.inert = false;
      if (previous instanceof HTMLElement && previous.isConnected && !previous.closest('[inert]')) {
        previous.focus({ preventScroll: true });
      }
    };
  }, []);

  return ref;
}
