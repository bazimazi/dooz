import { type BoardSize, type BotDifficulty, isBoardSize, isBotDifficulty } from '@dooz/engine';
import { createRootRoute, createRoute, createRouter, Link, Outlet } from '@tanstack/react-router';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { BotGameScreen } from '@/screens/BotGameScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { LocalGameScreen } from '@/screens/LocalGameScreen';
import { OnlineScreen } from '@/screens/OnlineScreen';

/**
 * Routes are declared in code rather than generated from the file system.
 *
 * The app has four screens and no data loading, so the generated route tree
 * would be one more build step and one more committed artefact for no benefit —
 * and this file stays just as type-safe.
 */
const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: NotFound,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomeScreen,
});

/** Board size lives in the URL, so a game screen can be linked to or reloaded. */
function readSize(search: Record<string, unknown>): BoardSize {
  const raw = Number(search['size']);
  return isBoardSize(raw) ? raw : 3;
}

const localRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/play/local',
  validateSearch: (search: Record<string, unknown>): { size: BoardSize } => ({
    size: readSize(search),
  }),
  component: function LocalRoute() {
    const { size } = localRoute.useSearch();
    // Remounting on a size change resets the game rather than trying to carry
    // a position onto a different board.
    return <LocalGameScreen key={size} size={size} />;
  },
});

const botRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/play/bot',
  validateSearch: (
    search: Record<string, unknown>,
  ): { size: BoardSize; difficulty: BotDifficulty } => {
    const difficulty = search['difficulty'];
    return {
      size: readSize(search),
      difficulty: isBotDifficulty(difficulty) ? difficulty : 'hard',
    };
  },
  component: function BotRoute() {
    const { size, difficulty } = botRoute.useSearch();
    return <BotGameScreen key={size} size={size} difficulty={difficulty} />;
  },
});

const onlineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/play/online',
  validateSearch: (
    search: Record<string, unknown>,
  ): { size: BoardSize; host?: boolean; code?: string } => {
    const code = search['code'];
    return {
      size: readSize(search),
      ...(search['host'] === true || search['host'] === 'true' ? { host: true } : {}),
      ...(typeof code === 'string' && code.trim()
        ? { code: code.trim().toUpperCase().slice(0, 6) }
        : {}),
    };
  },
  component: function OnlineRoute() {
    const search = onlineRoute.useSearch();
    return <OnlineScreen {...search} />;
  },
});

function NotFound() {
  return (
    <Screen>
      <div className="stagger flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="font-display text-3xl">nothing here</p>
        <Button as={Link} to="/" variant="primary">
          Back to home
        </Button>
      </div>
    </Screen>
  );
}

const routeTree = rootRoute.addChildren([homeRoute, localRoute, botRoute, onlineRoute]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: false,
  // Every navigation goes through the View Transitions API where the browser
  // has it, so a screen change is one continuous move. Browsers without it
  // simply swap as before — the styling for it lives in `theme.css`.
  defaultViewTransition: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
