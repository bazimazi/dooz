import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';

/**
 * Render something that contains a router `Link`.
 *
 * `Link` reads the router out of context and throws without one, which catches
 * anything sharing a screen with the home and restart buttons. A memory history
 * keeps it self-contained - nothing here navigates, it just needs a router to
 * exist.
 */
export async function renderWithRouter(ui: ReactNode): Promise<RenderResult> {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => ui }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });

  const result = render(<RouterProvider router={router as never} />);
  await router.load();
  return result;
}
