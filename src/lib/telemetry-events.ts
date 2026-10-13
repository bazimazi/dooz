import { modeForConfig, type Player } from '@/game/engine';
import { applyingCloudSave } from '@/features/cloud/sync';
import { useOnlineStore } from '@/features/online/store';
import { useProgressStore } from '@/features/progress/store';
import { loadPreferences, subscribePreferences } from './preferences';
import { track } from './telemetry';

/**
 * The gameplay events telemetry reports, read off the stores the game already
 * keeps rather than called from inside the screens: a game opened, an online
 * match matched and decided, a bot or local game finished, a puzzle solved,
 * onboarding completed. The screens stay free of analytics calls, and an
 * event cannot drift from what actually happened.
 */

interface RouterLike {
  subscribe(
    event: 'onResolved',
    listener: (event: {
      toLocation: { pathname: string; search: unknown };
      fromLocation?: { pathname: string } | undefined;
    }) => void,
  ): () => void;
}

/** A route without the ids in it, so a path never carries a match or puzzle id. */
function routeOf(pathname: string): string {
  return (
    pathname
      .split('/')
      .slice(0, 3)
      .join('/')
      .replace(/\/[0-9a-f-]{16,}$/i, '/:id') || '/'
  );
}

function field(search: unknown, key: string): string | undefined {
  const value = (search as Record<string, unknown> | null)?.[key];
  return typeof value === 'string' ? value.slice(0, 40) : undefined;
}

export function installGameplayEvents(router: RouterLike): void {
  router.subscribe('onResolved', ({ toLocation, fromLocation }) => {
    if (fromLocation?.pathname === toLocation.pathname) return;
    const path = toLocation.pathname;
    const mode = field(toLocation.search, 'mode') ?? 'default';
    if (path === '/play/bot') {
      track('game.start', {
        kind: field(toLocation.search, 'stage') ? 'journey' : 'bot',
        mode,
        difficulty: field(toLocation.search, 'difficulty') ?? 'medium',
      });
    } else if (path === '/play/local') {
      track('game.start', { kind: 'local', mode });
    } else {
      track('screen', { route: path.startsWith('/puzzles/') ? '/puzzles/:id' : routeOf(path) });
    }
  });

  useOnlineStore.subscribe((state, previous) => {
    if (state.phase === 'playing' && previous.phase !== 'playing' && state.config) {
      track('game.start', {
        kind: state.kind ?? 'online',
        mode: modeForConfig(state.config)?.id ?? 'custom',
      });
    }
    if (state.result && !previous.result) {
      const you: Player | null = state.you;
      const outcome =
        state.result.winner === null
          ? 'draw'
          : you === null
            ? 'watched'
            : state.result.winner === you
              ? 'win'
              : 'loss';
      track('game.finish', {
        kind: state.result.kind,
        mode: state.config ? (modeForConfig(state.config)?.id ?? 'custom') : 'unknown',
        reason: state.result.reason,
        outcome,
      });
    }
  });

  useProgressStore.subscribe((state, previous) => {
    // A cloud save landing changes every counter at once; none of it was played here.
    if (applyingCloudSave()) return;
    for (const [key, record] of Object.entries(state.bot)) {
      const before = previous.bot[key] ?? { won: 0, lost: 0, drawn: 0 };
      const outcome =
        record.won > before.won
          ? 'win'
          : record.lost > before.lost
            ? 'loss'
            : record.drawn > before.drawn
              ? 'draw'
              : null;
      if (!outcome) continue;
      const [mode = 'unknown', difficulty = 'unknown'] = key.split(':');
      track('game.finish', { kind: 'bot', mode, difficulty, outcome });
    }
    if (state.localGames > previous.localGames) track('game.finish', { kind: 'local' });
    if (state.puzzles.length > previous.puzzles.length) track('puzzle.solved');
  });

  let onboarded = loadPreferences().onboarded;
  subscribePreferences((preferences) => {
    if (preferences.onboarded && !onboarded) track('onboarding.complete');
    onboarded = preferences.onboarded;
  });
}
