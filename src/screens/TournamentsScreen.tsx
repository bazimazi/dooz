import { DEFAULT_MODE_ID, GAME_MODES, isModeId, type ModeId } from '@/game/engine';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, type Tournament } from '@/protocol';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { AvatarBadge } from '@/components/art/avatars';
import { BackIcon } from '@/components/art/icons';
import { MedalIcon } from '@/components/art/ui-icons';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { ReturnLink } from '@/components/ui/ReturnLink';
import { Screen } from '@/components/ui/Screen';
import { Tabs } from '@/components/ui/Tabs';
import { useAccountStore } from '@/features/account/store';
import { competitiveApi } from '@/features/competitive/api';
import { LiveGames } from '@/features/competitive/LiveGames';
import { tournamentStatus, useNow } from '@/features/competitive/TournamentView';
import { useT } from '@/i18n';
import { useModeTexts } from '@/i18n/messages/modes';
import { apiErrorText } from '@/i18n/messages/onlineApiErrors';
import { tournamentsMessages } from '@/i18n/messages/onlineTournaments';
import { ApiError } from '@/lib/api';
import { usePageVisible } from '@/lib/usePageVisible';

export type CompeteTab = 'arenas' | 'live' | 'private';

const REFRESH_MS = 15_000;
const BRACKET_SIZES = [4, 8, 16] as const;

/**
 * Everything competitive that is not the ladder: scheduled arenas, games to
 * watch, and private brackets to run with friends.
 */
export function TournamentsScreen({ tab }: { tab: CompeteTab }) {
  const navigate = useNavigate();
  const t = useT(tournamentsMessages);

  return (
    <Screen width="wide" scroll>
      <header className="flex w-full items-center gap-3 pt-2 pb-4">
        <IconButton as={ReturnLink} to="/" tone="bare" size="small" label={t('backToHome')}>
          <BackIcon className="rtl:-scale-x-100" />
        </IconButton>
        <h1 className="font-display text-xl">{t('compete')}</h1>
      </header>

      <Tabs
        label={t('compete')}
        value={tab}
        onChange={(next) =>
          void navigate({
            to: '/tournaments',
            search: { tab: next },
            replace: true,
            viewTransition: false,
            resetScroll: false,
          })
        }
        options={[
          { value: 'arenas', label: t('arenas') },
          { value: 'live', label: t('watchLive') },
          { value: 'private', label: t('privateBracket') },
        ]}
        className="mb-3"
      />

      <Card className="w-full" padding="tight">
        {tab === 'arenas' ? <Arenas /> : tab === 'live' ? <LiveGames /> : <PrivateBracket />}
      </Card>
    </Screen>
  );
}

function Arenas() {
  const credentials = useAccountStore((state) => state.credentials);
  const navigate = useNavigate();
  const [list, setList] = useState<Tournament[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const visible = usePageVisible();
  const now = useNow();
  const t = useT(tournamentsMessages);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    const load = () =>
      void competitiveApi
        .tournaments(credentials, controller.signal)
        .then((found) => {
          setList(found);
          setError(null);
          setFailed(false);
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return;
          setError(cause instanceof ApiError ? apiErrorText(cause.message, cause.status) : null);
          setFailed(true);
        });
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [credentials, visible, attempt]);

  if (failed && list === null) {
    return (
      <EmptyState
        title={t('loadFailed')}
        body={error ?? t('loadFailed')}
        action={
          <Button size="small" className="w-auto px-4" onClick={() => setAttempt((n) => n + 1)}>
            {t('tryAgain')}
          </Button>
        }
      />
    );
  }
  if (list === null)
    return <p className="px-2 py-10 text-center text-sm text-ink-faint">{t('loading')}</p>;
  if (list.length === 0) {
    return <EmptyState icon={<MedalIcon />} title={t('noArenas')} body={t('noArenasBody')} />;
  }

  return (
    <ul className="flex flex-col">
      {list.map((tournament) => {
        const mode: ModeId = isModeId(tournament.mode) ? tournament.mode : DEFAULT_MODE_ID;
        const podium = tournament.standings.filter((entry) => entry.played > 0).slice(0, 3);
        return (
          <li
            key={tournament.id}
            className="flex flex-col gap-2 border-t border-stroke-soft px-2 py-3 first:border-t-0"
          >
            <div className="flex items-center gap-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">{tournament.name}</span>
                <span className="text-xs text-ink-faint">
                  {tournamentStatus(tournament, now)} ·{' '}
                  {t('playing', { count: tournament.players })}
                  {tournament.kind === 'bracket' ? ` · ${t('private')}` : ''}
                </span>
              </span>
              {tournament.status !== 'finished' ? (
                <Button
                  size="small"
                  variant={tournament.status === 'running' ? 'primary' : 'secondary'}
                  className="w-auto shrink-0 px-4"
                  onClick={() =>
                    void navigate({
                      to: '/play/online',
                      search: { mode, tournament: tournament.id },
                    })
                  }
                >
                  {tournament.joined ? t('open') : t('join')}
                </Button>
              ) : null}
            </div>
            {tournament.status === 'finished' && podium.length > 0 ? (
              <ol className="flex flex-wrap gap-3 text-xs text-ink-muted" aria-label={t('podium')}>
                {podium.map((entry) => (
                  <li key={entry.profile.accountId} className="flex items-center gap-1.5">
                    <span className="tnum text-ink-faint">#{entry.rank}</span>
                    <AvatarBadge avatar={entry.profile.avatar} className="size-5" />
                    <span className="max-w-24 truncate">{entry.profile.displayName}</span>
                    <span className="tnum font-semibold text-ink">{entry.score}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function PrivateBracket() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<ModeId>(DEFAULT_MODE_ID);
  const [size, setSize] = useState<(typeof BRACKET_SIZES)[number]>(4);
  const [code, setCode] = useState('');
  const t = useT(tournamentsMessages);
  const modeText = useModeTexts();
  const cleaned = code
    .toUpperCase()
    .split('')
    .filter((character) => ROOM_CODE_ALPHABET.includes(character))
    .join('')
    .slice(0, ROOM_CODE_LENGTH);

  return (
    <div className="flex flex-col gap-5 px-2 py-3">
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t('startBracket')}</h2>
        <p className="text-sm text-ink-muted">{t('bracketBody', { count: size })}</p>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs tracking-wide text-ink-faint uppercase">{t('game')}</span>
          <select
            className="h-11 rounded-tile border border-stroke bg-surface px-3 text-sm"
            value={mode}
            onChange={(event) => {
              const next = event.target.value;
              if (isModeId(next)) setMode(next);
            }}
          >
            {GAME_MODES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {modeText(entry.id).name}
              </option>
            ))}
          </select>
        </label>
        <div role="radiogroup" aria-label={t('players')} className="flex gap-2">
          {BRACKET_SIZES.map((option) => (
            <Button
              key={option}
              size="small"
              variant={option === size ? 'primary' : 'ghost'}
              role="radio"
              aria-checked={option === size}
              onClick={() => setSize(option)}
            >
              {t('playersOption', { count: option })}
            </Button>
          ))}
        </div>
        <Button
          variant="primary"
          block
          onClick={() => void navigate({ to: '/play/online', search: { mode, bracket: size } })}
        >
          {t('createBracket')}
        </Button>
      </section>

      <section className="flex flex-col gap-3 border-t border-stroke-soft pt-4">
        <h2 className="text-base font-semibold">{t('joinWithCode')}</h2>
        <input
          className="h-11 rounded-tile border border-stroke bg-surface px-3 font-mono tracking-[0.3em] uppercase"
          inputMode="text"
          autoComplete="off"
          aria-label={t('bracketCode')}
          placeholder="ABC234"
          value={cleaned}
          onChange={(event) => setCode(event.target.value)}
        />
        <Button
          block
          disabled={cleaned.length !== ROOM_CODE_LENGTH}
          onClick={() =>
            void navigate({
              to: '/play/online',
              search: { mode: DEFAULT_MODE_ID, tournament: cleaned },
            })
          }
        >
          {t('joinBracket')}
        </Button>
      </section>
    </div>
  );
}
