import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

/**
 * jsdom stops short of a few things the app leans on.
 *
 * `matchMedia` is used to honour the reduced-motion preference, and `inert` is
 * how the modal overlays take the rest of the page out of the tab order. Both
 * are absent rather than stubbed, so they are filled in once here.
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

  sessionStorage.clear();
  localStorage.clear();
});

afterEach(cleanup);
