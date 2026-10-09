import { createBrowserHistory, type RouterHistory } from '@tanstack/react-router';

interface PageEntry {
  href: string;
  index: number;
}

const backGuards = new WeakMap<RouterHistory, Array<(event: PopStateEvent) => void>>();

export function registerDialogBackGuard(
  history: RouterHistory,
  guard: (event: PopStateEvent) => void,
) {
  const guards = backGuards.get(history);
  if (!guards) return undefined;
  guards.push(guard);
  return () => {
    const index = guards.indexOf(guard);
    if (index >= 0) guards.splice(index, 1);
  };
}

declare module '@tanstack/history' {
  interface HistoryState {
    __doozPages?: PageEntry[];
    __doozSheet?: string;
    __doozSheetOrigin?: PageEntry;
  }
}

/** Keep real pages separate from the temporary entry that makes a sheet dismissible. */
export function createAppHistory(base?: RouterHistory): RouterHistory {
  let history: RouterHistory;
  if (base) history = base;
  else {
    const guards: Array<(event: PopStateEvent) => void> = [];
    // Register before the router installs its native listener. Window events
    // otherwise reach that listener before a guard mounted by a component.
    window.addEventListener('popstate', (event) => guards.at(-1)?.(event), true);
    history = createBrowserHistory();
    backGuards.set(history, guards);
  }
  const push = history.push;
  const replace = history.replace;

  function write(
    path: string,
    state: Parameters<RouterHistory['push']>[1],
    replacing: boolean,
    options: Parameters<RouterHistory['push']>[2],
  ) {
    const current = history.location;
    const pages = current.state['__doozPages'] ?? [];
    if (state?.['__doozSheet'] && path === current.href) {
      push(
        path,
        {
          ...state,
          __doozPages: pages,
          __doozSheetOrigin: { href: current.href, index: current.state['__TSR_index'] },
        },
        options,
      );
      return;
    }

    const origin = current.state['__doozSheetOrigin'];
    const nextState = { ...state };
    delete nextState['__doozSheet'];
    delete nextState['__doozSheetOrigin'];
    nextState['__doozPages'] =
      !replacing || origin
        ? [...pages, origin ?? { href: current.href, index: current.state['__TSR_index'] }]
        : pages;
    // A destination chosen inside a sheet takes its temporary slot. Back
    // then returns to the page that opened it, without an empty sheet step.
    (replacing || origin ? replace : push)(path, nextState, options);
  }

  history.push = (path, state, options) => write(path, state, false, options);
  history.replace = (path, state, options) => write(path, state, true, options);
  return history;
}

/** The nearest earlier visit to a return destination, including its search parameters. */
export function returnEntry(history: RouterHistory, pathname: string): PageEntry | undefined {
  const pages = history.location.state['__doozPages'] ?? [];
  for (let index = pages.length - 1; index >= 0; index--) {
    const entry = pages[index]!;
    if (
      entry.index < history.location.state['__TSR_index'] &&
      new URL(entry.href, 'https://dooz.invalid').pathname === pathname
    )
      return entry;
  }
  return undefined;
}
