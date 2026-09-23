import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

/**
 * jsdom stops short of a few things the app leans on.
 *
 * `matchMedia` is used to honour the reduced-motion preference, `inert` is how
 * the modal overlays take the rest of the page out of the tab order, and
 * `scrollIntoView` is how the tab strips bring the selected tab into view.
 * None of them exist in jsdom, so they are filled in once here rather than
 * guarded at each call site - the app should not carry test-only branches.
 */
beforeEach(() => {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }

  if (!('inert' in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, 'inert', {
      configurable: true,
      get(this: HTMLElement) {
        return this.hasAttribute('inert');
      },
      set(this: HTMLElement, value: boolean) {
        this.toggleAttribute('inert', value);
      },
    });
  }

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }

  sessionStorage.clear();
  localStorage.clear();
});

afterEach(cleanup);
