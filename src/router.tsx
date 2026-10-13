import {
  type BotDifficulty,
  DEFAULT_MODE_ID,
  isBotDifficulty,
  isModeId,
  type ModeId,
  RANKED_MODES,
} from '@/game/engine';
import { ROOM_CODE_LENGTH } from '@/protocol';
import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
} from '@tanstack/react-router';
import { UnlockToast } from '@/game/components/UnlockToast';
import { UpdatePrompt } from '@/platform/UpdatePrompt';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { HomeScreen } from '@/screens/HomeScreen';
import { createAppHistory } from '@/lib/navigation';
import { loadPreferences } from '@/lib/preferences';
import { ReturnLink } from '@/components/ui/ReturnLink';
import { NoticeCenter } from '@/features/social/NoticeCenter';
import { reportError } from '@/lib/telemetry';
import { useT } from '@/i18n';
import { routeMessages } from '@/i18n/messages/routes';
import { useEffect } from 'react';

// Keep startup small. Preload wrapped screens before committing navigation so
// their normal view transitions and entrance animations start with ready code.
const BotGameScreen = lazyRouteComponent(() => import('@/screens/BotGameScreen'), 'BotGameScreen');
const JourneyScreen = lazyRouteComponent(() => import('@/screens/JourneyScreen'), 'JourneyScreen');
const LeaderboardScreen = lazyRouteComponent(
  () => import('@/screens/LeaderboardScreen'),
  'LeaderboardScreen',
);
const TournamentsScreen = lazyRouteComponent(
  () => import('@/screens/TournamentsScreen'),
  'TournamentsScreen',
);
const LearnScreen = lazyRouteComponent(() => import('@/screens/LearnScreen'), 'LearnScreen');
const LessonScreen = lazyRouteComponent(() => import('@/screens/LessonScreen'), 'LessonScreen');
const LocalGameScreen = lazyRouteComponent(
  () => import('@/screens/LocalGameScreen'),
  'LocalGameScreen',
);
const OnlineScreen = lazyRouteComponent(() => import('@/screens/OnlineScreen'), 'OnlineScreen');
const ProfileScreen = lazyRouteComponent(() => import('@/screens/ProfileScreen'), 'ProfileScreen');
const PuzzleScreen = lazyRouteComponent(() => import('@/screens/PuzzleScreen'), 'PuzzleScreen');
const PuzzleRushScreen = lazyRouteComponent(
  () => import('@/screens/PuzzleRushScreen'),
  'PuzzleRushScreen',
);
const PuzzlesScreen = lazyRouteComponent(() => import('@/screens/PuzzlesScreen'), 'PuzzlesScreen');
const ReplayScreen = lazyRouteComponent(() => import('@/screens/ReplayScreen'), 'ReplayScreen');
const FriendsScreen = lazyRouteComponent(() => import('@/screens/FriendsScreen'), 'FriendsScreen');
const CorrespondenceListScreen = lazyRouteComponent(
  () => import('@/screens/CorrespondenceScreen'),
  'CorrespondenceListScreen',
);
const CorrespondenceGameScreen = lazyRouteComponent(
  () => import('@/screens/CorrespondenceScreen'),
  'CorrespondenceGameScreen',
);
const ArcadeScreen = lazyRouteComponent(() => import('@/screens/ArcadeScreen'), 'ArcadeScreen');
const DailyChallengeScreen = lazyRouteComponent(
  () => import('@/screens/DailyChallengeScreen'),
  'DailyChallengeScreen',
);
const GauntletScreen = lazyRouteComponent(
  () => import('@/screens/GauntletScreen'),
  'GauntletScreen',
);
const RunScreen = lazyRouteComponent(() => import('@/screens/RunScreen'), 'RunScreen');
const CollectionScreen = lazyRouteComponent(
  () => import('@/screens/CollectionScreen'),
  'CollectionScreen',
);

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
  component: () => (
    <>
      <Outlet />
      <UnlockToast />
      <NoticeCenter />
      <UpdatePrompt />
    </>
  ),
  notFoundComponent: NotFound,
  errorComponent: RouteError,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  beforeLoad: () => LocalGameScreen.preload?.(),
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
  beforeLoad: () => BotGameScreen.preload?.(),
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    mode: ModeId;
    difficulty: BotDifficulty;
    practice?: true;
    stage?: string;
    blitz?: true;
    handicap?: number;
  } => {
    const difficulty = search['difficulty'];
    const stage = search['stage'];
    const handicap = Number(search['handicap']);
    return {
      mode: readMode(search),
      difficulty: isBotDifficulty(difficulty) ? difficulty : 'medium',
      ...(readFlag(search['practice']) ? { practice: true as const } : {}),
      ...(readFlag(search['blitz']) ? { blitz: true as const } : {}),
      // Clamped again against the board by the screen; here only a small
      // whole number gets through.
      ...(Number.isInteger(handicap) && handicap !== 0 && Math.abs(handicap) <= 3
        ? { handicap }
        : {}),
      // Checked against the stage list by the screen; here it only has to be a
      // short plain id rather than whatever the URL happened to carry.
      ...(typeof stage === 'string' && /^[a-z]+-\d{1,2}$/.test(stage) ? { stage } : {}),
    };
  },
  component: function BotRoute() {
    const { mode, difficulty, practice, stage, blitz, handicap } = botRoute.useSearch();
    return (
      <BotGameScreen
        mode={mode}
        difficulty={difficulty}
        practice={practice}
        stage={stage}
        blitz={blitz}
        handicap={handicap}
      />
    );
  },
});

const onlineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/play/online',
  beforeLoad: () => OnlineScreen.preload?.(),
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    mode: ModeId;
    host?: true;
    code?: string;
    watch?: string;
    ranked?: true;
    challenge?: string;
    tournament?: string;
    bracket?: 4 | 8 | 16;
  } => {
    const code = readCode(search['code']);
    const watch = readCode(search['watch']);
    // An account id to challenge. Checked for shape here; the server checks
    // that it is a friend.
    const rawChallenge = search['challenge'];
    const challenge =
      typeof rawChallenge === 'string' && UUID.test(rawChallenge) ? rawChallenge : undefined;
    // Tournament ids use the room-code alphabet, so the same narrowing applies.
    const tournament = readCode(search['tournament']);
    const bracket = Number(search['bracket']);
    return {
      mode: readMode(search),
      ...(readFlag(search['host']) ? { host: true as const } : {}),
      ...(code ? { code } : {}),
      ...(watch ? { watch } : {}),
      ...(challenge ? { challenge } : {}),
      ...(readFlag(search['ranked']) ? { ranked: true as const } : {}),
      ...(tournament ? { tournament } : {}),
      ...(bracket === 4 || bracket === 8 || bracket === 16 ? { bracket } : {}),
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
  beforeLoad: () => LeaderboardScreen.preload?.(),
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

const tournamentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tournaments',
  beforeLoad: () => TournamentsScreen.preload?.(),
  validateSearch: (search: Record<string, unknown>): { tab: 'arenas' | 'live' | 'private' } => {
    const tab = search['tab'];
    return { tab: tab === 'live' || tab === 'private' ? tab : 'arenas' };
  },
  component: function TournamentsRoute() {
    const { tab } = tournamentsRoute.useSearch();
    return <TournamentsScreen tab={tab} />;
  },
});

const learnRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/learn',
  beforeLoad: () => LearnScreen.preload?.(),
  validateSearch: (search: Record<string, unknown>): { mode: ModeId } => ({
    mode: readMode(search),
  }),
  component: function LearnRoute() {
    const { mode } = learnRoute.useSearch();
    return <LearnScreen mode={mode} />;
  },
});

const lessonRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/learn/lesson/$id',
  beforeLoad: () => LessonScreen.preload?.(),
  component: function LessonRoute() {
    const { id } = lessonRoute.useParams();
    return <LessonScreen id={id} />;
  },
});

const journeyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/journey',
  component: JourneyScreen,
});

const puzzlesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/puzzles',
  beforeLoad: () => PuzzlesScreen.preload?.(),
  validateSearch: (search: Record<string, unknown>): { tier?: '1' | '2' | '3' } => {
    const value = search['tier'];
    const tier = typeof value === 'number' ? String(value) : value;
    return tier === '1' || tier === '2' || tier === '3' ? { tier } : {};
  },
  component: function PuzzlesRoute() {
    const { tier } = puzzlesRoute.useSearch();
    return <PuzzlesScreen filter={tier ?? 'all'} />;
  },
});

const puzzleRushRoute = createRoute({
  getParentRoute: () => rootRoute,
  // A static path, so it is matched ahead of `/puzzles/$id`.
  path: '/puzzles/rush',
  beforeLoad: () => PuzzleRushScreen.preload?.(),
  component: PuzzleRushScreen,
});

const puzzleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/puzzles/$id',
  beforeLoad: () => PuzzleScreen.preload?.(),
  validateSearch: (search: Record<string, unknown>): { daily?: true } =>
    readFlag(search['daily']) ? { daily: true as const } : {},
  component: function PuzzleRoute() {
    const { id } = puzzleRoute.useParams();
    const { daily } = puzzleRoute.useSearch();
    return <PuzzleScreen id={id} daily={daily} />;
  },
});

const replayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/replay/$matchId',
  beforeLoad: () => ReplayScreen.preload?.(),
  component: function ReplayRoute() {
    const { matchId } = replayRoute.useParams();
    return <ReplayScreen matchId={matchId} />;
  },
});

const arcadeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/arcade',
  beforeLoad: () => ArcadeScreen.preload?.(),
  component: ArcadeScreen,
});

const dailyChallengeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/arcade/daily',
  beforeLoad: () => DailyChallengeScreen.preload?.(),
  component: DailyChallengeScreen,
});

const gauntletRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/arcade/gauntlet',
  beforeLoad: () => GauntletScreen.preload?.(),
  component: GauntletScreen,
});

const runRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/arcade/run',
  beforeLoad: () => RunScreen.preload?.(),
  component: RunScreen,
});

const collectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/collection',
  beforeLoad: () => CollectionScreen.preload?.(),
  component: CollectionScreen,
});

const friendsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/friends',
  beforeLoad: () => FriendsScreen.preload?.(),
  component: FriendsScreen,
});

const correspondenceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/correspondence',
  beforeLoad: () => CorrespondenceListScreen.preload?.(),
  component: CorrespondenceListScreen,
});

const correspondenceGameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/correspondence/$id',
  beforeLoad: () => CorrespondenceGameScreen.preload?.(),
  component: function CorrespondenceGameRoute() {
    const { id } = correspondenceGameRoute.useParams();
    return <CorrespondenceGameScreen id={id} />;
  },
});

function NotFound() {
  const t = useT(routeMessages);
  return (
    <Screen>
      <div className="stagger flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="font-display text-3xl">{t('notFoundTitle')}</p>
        <p className="max-w-64 text-sm text-ink-muted">{t('notFoundText')}</p>
        <Button as={ReturnLink} to="/" variant="primary">
          {t('backHome')}
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
  // Reported once per error, not on every re-render of the fallback.
  useEffect(() => reportError(error, 'route'), [error]);
  const t = useT(routeMessages);
  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <p className="font-display text-2xl">{t('errorTitle')}</p>
        <p className="max-w-72 text-sm text-ink-muted">{error.message || t('errorText')}</p>
        <div className="flex gap-3">
          <Button variant="primary" className="w-auto px-5" onClick={() => location.reload()}>
            {t('reload')}
          </Button>
          <Button as={ReturnLink} to="/" variant="ghost" className="w-auto px-5">
            {t('home')}
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
  tournamentsRoute,
  learnRoute,
  lessonRoute,
  journeyRoute,
  puzzlesRoute,
  puzzleRushRoute,
  puzzleRoute,
  replayRoute,
  friendsRoute,
  correspondenceRoute,
  correspondenceGameRoute,
  arcadeRoute,
  dailyChallengeRoute,
  gauntletRoute,
  runRoute,
  collectionRoute,
]);

export const router = createRouter({
  routeTree,
  history: createAppHistory(),
  defaultPreload: 'intent',
  scrollRestoration: true,
  // Sheets and settings replace state on the same page, so scroll belongs to
  // the URL rather than to the temporary entry's generated history key.
  getScrollRestorationKey: (location) => location.href,
  // Every navigation goes through the View Transitions API where the browser
  // has it, so a screen change is one continuous move. Browsers without it
  // simply swap as before - the styling for it lives in `theme.css`. Changing a
  // setting on the screen you are already on opts out per navigation: the
  // transition animates the whole document, which on a game screen reads as the
  // page reloading under you.
  defaultViewTransition: true,
});

// A sheet gives itself a history entry so Back can close it. That entry has
// the same URL as the screen under it, so opening or closing the sheet must
// not play the screen-change transition.
router.subscribe('onBeforeNavigate', ({ hrefChanged }) => {
  if (!hrefChanged) router.shouldViewTransition = false;
});

// A quick second navigation may skip an unfinished snapshot. The browser
// rejects `ready` in that case; the route update still completes normally.
// Observe the animation promises while leaving update failures to the router.
router.startViewTransition = (update) => {
  const animate = router.shouldViewTransition ?? router.options.defaultViewTransition;
  router.shouldViewTransition = undefined;
  if (
    !animate ||
    loadPreferences().graphics !== 'high' ||
    typeof document.startViewTransition !== 'function'
  )
    return update();
  const transition = document.startViewTransition(update);
  void transition.ready.catch(() => undefined);
  void transition.finished.catch(() => undefined);
  return transition.updateCallbackDone;
};

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
