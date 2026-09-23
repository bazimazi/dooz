import {
  type BotDifficulty,
  DEFAULT_MODE_ID,
  isBotDifficulty,
  isModeId,
  type ModeId,
  RANKED_MODES,
} from '@dooz/engine';
import { ROOM_CODE_LENGTH } from '@dooz/protocol';
import { createRootRoute, createRoute, createRouter, Link, Outlet } from '@tanstack/react-router';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { BotGameScreen } from '@/screens/BotGameScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { LeaderboardScreen } from '@/screens/LeaderboardScreen';
import { LearnScreen } from '@/screens/LearnScreen';
import { LocalGameScreen } from '@/screens/LocalGameScreen';
import { OnlineScreen } from '@/screens/OnlineScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { ReplayScreen } from '@/screens/ReplayScreen';

/**
 * Routes are declared in code rather than generated from the file system.
 *
 * The app has eight screens and no data loading in the router, so a generated
 * route tree would be one more build step and one more committed artefact for
 * no benefit - and this file stays just as type-safe.
 *
 * Every search parameter is narrowed here rather than in the screen. A URL is
 * untrusted input like any other: `?mode=<script>` has to become the default
 * mode before it reaches a component, not after.
 */
const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: NotFound,
  errorComponent: RouteError,
});

function readMode(search: Record<string, unknown>): ModeId {
  const raw = search['mode'];
  return isModeId(raw) ? raw : DEFAULT_MODE_ID;
}

function readCode(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const code = value.trim().toUpperCase().slice(0, ROOM_CODE_LENGTH);
  return code.length === ROOM_CODE_LENGTH ? code : undefined;
}

/** A search param that may arrive as a real boolean or as the string form. */
function readFlag(value: unknown): true | undefined {
  return value === true || value === 'true' ? true : undefined;
}

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomeScreen,
});

const localRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/play/local',
  validateSearch: (search: Record<string, unknown>): { mode: ModeId } => ({
    mode: readMode(search),
  }),
  component: function LocalRoute() {
    const { mode } = localRoute.useSearch();
    return <LocalGameScreen mode={mode} />;
  },
});

const botRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/play/bot',
  validateSearch: (
    search: Record<string, unknown>,
  ): { mode: ModeId; difficulty: BotDifficulty; practice?: true } => {
    const difficulty = search['difficulty'];
    return {
      mode: readMode(search),
      difficulty: isBotDifficulty(difficulty) ? difficulty : 'medium',
      ...(readFlag(search['practice']) ? { practice: true as const } : {}),
    };
  },
  component: function BotRoute() {
    const { mode, difficulty, practice } = botRoute.useSearch();
    return <BotGameScreen mode={mode} difficulty={difficulty} practice={practice} />;
  },
});

const onlineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/play/online',
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    mode: ModeId;
    host?: true;
    code?: string;
    watch?: string;
    ranked?: true;
  } => {
    const code = readCode(search['code']);
    const watch = readCode(search['watch']);
    return {
      mode: readMode(search),
      ...(readFlag(search['host']) ? { host: true as const } : {}),
      ...(code ? { code } : {}),
      ...(watch ? { watch } : {}),
      ...(readFlag(search['ranked']) ? { ranked: true as const } : {}),
    };
  },
  component: function OnlineRoute() {
    const search = onlineRoute.useSearch();
    return <OnlineScreen {...search} />;
  },
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: ProfileScreen,
});

const leaderboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/leaderboard',
  validateSearch: (search: Record<string, unknown>): { mode: ModeId } => {
    const mode = readMode(search);
    // The ladder only exists for ranked modes, so a link to an unranked one
    // lands on the first ranked mode rather than on an empty table.
    const ranked = RANKED_MODES.some((entry) => entry.id === mode);
    return { mode: ranked ? mode : (RANKED_MODES[0]?.id ?? DEFAULT_MODE_ID) };
  },
  component: function LeaderboardRoute() {
    const { mode } = leaderboardRoute.useSearch();
    return <LeaderboardScreen mode={mode} />;
  },
});

const learnRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/learn',
  validateSearch: (search: Record<string, unknown>): { mode: ModeId } => ({
    mode: readMode(search),
  }),
  component: function LearnRoute() {
    const { mode } = learnRoute.useSearch();
    return <LearnScreen mode={mode} />;
  },
});

const replayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/replay/$matchId',
  component: function ReplayRoute() {
    const { matchId } = replayRoute.useParams();
    return <ReplayScreen matchId={matchId} />;
  },
});

function NotFound() {
  return (
    <Screen>
      <div className="stagger flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="font-display text-3xl">Nothing here</p>
        <p className="max-w-64 text-sm text-ink-muted">
          That link does not point at a screen in this app. It may have been a room that has since
          closed.
        </p>
        <Button as={Link} to="/" variant="primary">
          Back to home
        </Button>
      </div>
    </Screen>
  );
}

/**
 * The last line of defence.
 *
 * A component that throws would otherwise leave a blank page, which is the one
 * failure a player cannot work around. This at least says so and offers the way
 * back - and reloading is a real fix for most of what can get here, because the
 * game state lives on the server rather than in this tab.
 */
function RouteError({ error }: { error: Error }) {
  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <p className="font-display text-2xl">Something broke</p>
        <p className="max-w-72 text-sm text-ink-muted">
          {error.message || 'An unexpected error stopped this screen from loading.'}
        </p>
        <div className="flex gap-3">
          <Button variant="primary" className="w-auto px-5" onClick={() => location.reload()}>
            Reload
          </Button>
          <Button as={Link} to="/" variant="ghost" className="w-auto px-5">
            Home
          </Button>
        </div>
      </div>
    </Screen>
  );
}

const routeTree = rootRoute.addChildren([
  homeRoute,
  localRoute,
  botRoute,
  onlineRoute,
  profileRoute,
  leaderboardRoute,
  learnRoute,
  replayRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: false,
  // Every navigation goes through the View Transitions API where the browser
  // has it, so a screen change is one continuous move. Browsers without it
  // simply swap as before - the styling for it lives in `theme.css`. Changing a
  // setting on the screen you are already on opts out per navigation: the
  // transition animates the whole document, which on a game screen reads as the
  // page reloading under you.
  defaultViewTransition: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
