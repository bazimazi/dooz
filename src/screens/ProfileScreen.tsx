import { ReturnLink } from '@/components/ui/ReturnLink';
import { AVATARS, type Avatar } from '@/protocol';
import { describeConfig, GAME_MODES, modeById } from '@/game/engine';
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { AvatarBadge } from '@/components/art/avatars';
import { BackIcon } from '@/components/art/icons';
import { LockIcon, MedalIcon, SparkIcon, TrophyIcon } from '@/components/art/ui-icons';
import { Button, buttonClasses, buttonStyle } from '@/components/ui/Button';
import { Card, EmptyState, StatTile } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { useAccountStore } from '@/features/account/store';
import { MAX_STARS } from '@/features/journey/stages';
import {
  totalBotGames,
  totalBotWins,
  totalStars,
  useProgressStore,
} from '@/features/progress/store';
import { isSkinUnlocked, SKIN_UNLOCKS } from '@/features/progress/unlocks';
import { api, type Credentials, type MatchSummary, type ProfileResponse } from '@/lib/api';
import { cx } from '@/lib/cx';
import { duration, fullDate, signed, timeAgo, winRate } from '@/lib/format';
import { ACHIEVEMENT_LABELS } from '@/lib/achievements';

export function ProfileScreen() {
  const { status, profile, credentials, initialise, rename, setAvatar, claim, error, clearError } =
    useAccountStore();

  const pendingChanges = useAccountStore((state) => Object.keys(state.changes).length > 0);

  const [loadedRanks, setRanks] = useState<{
    for: Credentials;
    value: ProfileResponse['ranks'];
  } | null>(null);
  const [loadedMatches, setMatches] = useState<{ for: Credentials; value: MatchSummary[] } | null>(
    null,
  );
  // Read cached activity during render so reopening an offline profile does
  // not briefly show an empty history or a previous account's ratings.
  const ranks = credentials
    ? loadedRanks?.for === credentials
      ? loadedRanks.value
      : (api.cachedProfile(credentials)?.ranks ?? [])
    : [];
  const matches = credentials
    ? loadedMatches?.for === credentials
      ? loadedMatches.value
      : (api.cachedMatches(credentials)?.matches ?? [])
    : [];
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    void initialise();
  }, [initialise]);

  useEffect(() => {
    if (!credentials) return;
    void useAccountStore.getState().refresh();
    const controller = new AbortController();

    void api
      .profile(credentials, controller.signal)
      .then((response) => setRanks({ for: credentials, value: response.ranks }))
      .catch(() => undefined);

    void api
      .matches(credentials, 20, controller.signal)
      .then((response) => setMatches({ for: credentials, value: response.matches }))
      .catch(() => undefined);

    return () => controller.abort();
  }, [credentials]);

  if (status === 'loading' || (status === 'idle' && !profile)) {
    return (
      <Screen width="wide" scroll>
        <Header />
        <Card className="w-full" padding="roomy">
          <p className="text-center text-sm text-ink-faint">Loading your profile…</p>
        </Card>
        <SoloProgress className="mt-4" />
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen width="wide" scroll>
        <Header />
        <Card className="w-full">
          <EmptyState
            title="Could not load your profile"
            body={error ?? 'The server could not be reached. Your games are safe.'}
            action={
              <Button size="small" className="w-auto px-4" onClick={() => void initialise()}>
                Try again
              </Button>
            }
          />
        </Card>
        <SoloProgress className="mt-4" />
      </Screen>
    );
  }

  const totals = profile.stats.reduce(
    (sum, entry) => ({
      played: sum.played + entry.played,
      won: sum.won + entry.won,
      lost: sum.lost + entry.lost,
      drawn: sum.drawn + entry.drawn,
      best: Math.max(sum.best, entry.bestStreak),
    }),
    { played: 0, won: 0, lost: 0, drawn: 0, best: 0 },
  );

  const rated = profile.stats.filter((entry) => entry.played > 0);
  const favourite = rated.toSorted((a, b) => b.played - a.played)[0];

  return (
    <Screen width="wide" scroll>
      <Header />

      <div className="flex w-full flex-col gap-4 pb-6">
        {/* Identity */}
        <Card className="w-full">
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Change avatar"
              className="shrink-0 rounded-full"
              onClick={() => setEditing(true)}
            >
              <AvatarBadge avatar={profile.avatar} className="size-16" />
            </button>
            <div className="flex min-w-0 flex-1 flex-col">
              <h1 className="truncate font-display text-2xl">{profile.displayName}</h1>
              <p className="text-xs text-ink-faint">
                Playing since {fullDate(profile.createdAt).split(',')[0]}
                {profile.claimed ? ' · Password set' : ''}
              </p>
            </div>
            <Button
              size="small"
              variant="ghost"
              className="w-auto px-3"
              onClick={() => {
                clearError();
                setEditing((open) => !open);
              }}
            >
              {editing ? 'Done' : 'Edit'}
            </Button>
          </div>

          {editing ? (
            <IdentityEditor
              currentName={profile.displayName}
              currentAvatar={profile.avatar}
              claimed={profile.claimed}
              error={error}
              onRename={rename}
              onAvatar={setAvatar}
              onClaim={claim}
            />
          ) : null}
        </Card>

        <p className="px-1 text-xs text-ink-faint">
          Your name, avatar and solo progress are saved on this device. Online records refresh when
          connected.
        </p>
        {credentials && pendingChanges ? (
          <p className="px-1 text-xs text-ink-muted">
            Profile changes saved locally. They will sync when connected.
          </p>
        ) : null}
        {/* Totals across every mode */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <StatTile label="Played" value={totals.played} />
          <StatTile label="Win rate" value={winRate(totals.won, totals.played)} />
          <StatTile
            label="Record"
            value={`${totals.won}–${totals.lost}–${totals.drawn}`}
            hint="W–L–D"
          />
          <StatTile
            label="Best streak"
            value={totals.best}
            hint={favourite ? `in ${labelFor(favourite.mode)}` : undefined}
          />
        </div>

        <SoloProgress />

        {/* Per mode */}
        <Card className="w-full" padding="tight">
          <h2 className="px-2 py-1 text-xs tracking-wide text-ink-faint uppercase">By mode</h2>
          {rated.length === 0 ? (
            <EmptyState
              icon={<TrophyIcon />}
              title="No online games yet"
              body="Ratings and per-mode records appear here after your first match."
              action={
                <Button as={ReturnLink} to="/" size="small" className="w-auto px-4">
                  Play a match
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col">
              {rated.map((entry) => {
                const rank = ranks.find((row) => row.mode === entry.mode);
                return (
                  <li
                    key={entry.mode}
                    className="flex items-center gap-3 border-t border-stroke-soft px-2 py-2.5 first:border-t-0"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold">{labelFor(entry.mode)}</span>
                      <span className="text-xs text-ink-faint">
                        {entry.played} played · {winRate(entry.won, entry.played)} won
                        {entry.streak > 1 ? ` · ${entry.streak} in a row` : ''}
                      </span>
                    </span>

                    <span className="flex flex-col items-end">
                      <span className="tnum text-base font-semibold">{entry.rating}</span>
                      <span className="text-xs text-ink-faint">
                        {rank?.rank
                          ? `#${rank.rank} · ${rank.division}`
                          : (rank?.division ?? 'Unranked')}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Achievements */}
        <Card className="w-full" padding="tight">
          <h2 className="px-2 py-1 text-xs tracking-wide text-ink-faint uppercase">Achievements</h2>
          <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3">
            {ACHIEVEMENT_LABELS.map((achievement) => {
              const unlocked = profile.achievements.find((entry) => entry.id === achievement.id);
              return (
                <div
                  key={achievement.id}
                  className={cx(
                    'flex items-start gap-2 rounded-tile border px-2.5 py-2',
                    // A locked achievement is dimmer in its frame and its icon,
                    // never in its text: fading the whole tile took the
                    // description below AA, and a goal nobody can read is not a
                    // goal. The padlock and the softer border carry the state.
                    unlocked ? 'border-stroke bg-surface/85' : 'border-stroke-soft bg-surface/50',
                  )}
                >
                  <span className={cx('mt-0.5 text-base', unlocked ? 'text-ok' : 'text-ink-faint')}>
                    {unlocked ? <MedalIcon /> : <LockIcon />}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span
                      className={cx(
                        'truncate text-xs font-semibold',
                        unlocked ? 'text-ink' : 'text-ink-muted',
                      )}
                    >
                      {achievement.name}
                    </span>
                    <span className="text-[0.75rem] leading-snug text-ink-muted">
                      {achievement.description}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* History */}
        <Card className="w-full" padding="tight">
          <h2 className="px-2 py-1 text-xs tracking-wide text-ink-faint uppercase">
            Recent matches
          </h2>
          {matches === null ? (
            <p className="px-2 py-6 text-center text-sm text-ink-faint">Loading…</p>
          ) : matches.length === 0 ? (
            <EmptyState
              icon={<SparkIcon />}
              title="No matches yet"
              body="Online games show up here, with a replay you can step through."
            />
          ) : (
            <ul className="flex flex-col">
              {matches.map((match) => (
                <li key={match.matchId} className="border-t border-stroke-soft first:border-t-0">
                  <Link
                    to="/replay/$matchId"
                    params={{ matchId: match.matchId }}
                    className="flex items-center gap-3 px-2 py-2.5 no-underline"
                  >
                    <span
                      className={cx(
                        'flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                        match.outcome === 'win' && 'bg-ok/15 text-ok',
                        match.outcome === 'loss' && 'bg-danger/15 text-danger',
                        match.outcome === 'draw' && 'bg-stroke-soft text-ink-muted',
                      )}
                    >
                      {match.outcome === 'win' ? 'W' : match.outcome === 'loss' ? 'L' : 'D'}
                    </span>

                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm">vs {match.opponent.displayName}</span>
                      <span className="truncate text-xs text-ink-faint">
                        {describeConfig(match.config)} · {match.kind} · {match.moveCount} moves ·{' '}
                        {duration(match.durationMs)}
                      </span>
                    </span>

                    <span className="flex shrink-0 flex-col items-end">
                      {match.ratingDelta !== null ? (
                        <span
                          className={cx(
                            'tnum text-sm font-semibold',
                            match.ratingDelta > 0 && 'text-ok',
                            match.ratingDelta < 0 && 'text-danger',
                          )}
                        >
                          {signed(match.ratingDelta)}
                        </span>
                      ) : null}
                      <span className="text-xs text-ink-faint" title={fullDate(match.playedAt)}>
                        {timeAgo(match.playedAt)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Screen>
  );
}

function Header() {
  return (
    <header className="flex w-full items-center gap-3 pt-2 pb-4">
      <IconButton as={ReturnLink} to="/" tone="bare" size="small" label="Back to home">
        <BackIcon />
      </IconButton>
      <h1 className="font-display text-xl">Profile</h1>
    </header>
  );
}

function IdentityEditor({
  currentName,
  currentAvatar,
  claimed,
  error,
  onRename,
  onAvatar,
  onClaim,
}: {
  currentName: string;
  currentAvatar: Avatar;
  claimed: boolean;
  error: string | null;
  onRename: (name: string) => Promise<boolean>;
  onAvatar: (avatar: Avatar) => Promise<void>;
  onClaim: (password: string) => Promise<boolean>;
}) {
  const [name, setName] = useState(currentName);
  const [password, setPassword] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  return (
    <div className="mt-4 flex flex-col gap-4 border-t border-stroke-soft pt-4">
      <form
        className="flex items-end gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const ok = await onRename(name.trim());
          setSaved(ok ? 'Name updated' : null);
        }}
      >
        <Field
          label="Display name"
          value={name}
          maxLength={20}
          onChange={(event) => setName(event.target.value)}
          error={error}
          hint="2–20 characters. Letters, numbers, spaces and . _ -"
        />
        <Button
          type="submit"
          size="small"
          className="mb-6 w-auto shrink-0 px-4"
          disabled={name.trim() === currentName || name.trim().length < 2}
        >
          Save
        </Button>
      </form>

      <fieldset className="flex flex-col gap-2">
        <legend className="px-1 text-sm text-ink-muted">Avatar</legend>
        <div className="flex flex-wrap gap-2">
          {AVATARS.map((avatar) => (
            <button
              key={avatar}
              type="button"
              aria-label={avatar}
              aria-pressed={avatar === currentAvatar}
              onClick={() => void onAvatar(avatar)}
              className={cx(
                'rounded-full border-2 p-0.5 transition-transform duration-200 ease-spring hover:scale-110',
                avatar === currentAvatar ? 'border-stroke' : 'border-transparent',
              )}
            >
              <AvatarBadge avatar={avatar} className="size-10" />
            </button>
          ))}
        </div>
      </fieldset>

      <form
        className="flex flex-col gap-2 border-t border-stroke-soft pt-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const ok = await onClaim(password);
          if (ok) {
            setPassword('');
            setSaved('Password set — you can now sign in on another device');
          }
        }}
      >
        <div className="flex items-end gap-2">
          <Field
            label={claimed ? 'Change password' : 'Set a password'}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            hint="At least 8 characters. Requires internet to use this account on another device."
          />
          <Button
            type="submit"
            size="small"
            className="mb-6 w-auto shrink-0 px-4"
            disabled={password.length < 8}
          >
            {claimed ? 'Change' : 'Set'}
          </Button>
        </div>
      </form>

      {saved ? (
        <p className="text-xs text-ok" role="status">
          {saved}
        </p>
      ) : null}
    </div>
  );
}

/** A mode id from the server, as a name a player recognises. */
function labelFor(mode: string): string {
  const known = GAME_MODES.find((entry) => entry.id === mode);
  if (known) return known.name;
  // A custom game is keyed by its config rather than a mode id.
  const parts = mode.split(':');
  if (parts.length === 3) {
    return describeConfig({
      variant: parts[0] as 'classic',
      size: Number(parts[1]),
      winLength: Number(parts[2]),
    });
  }
  return mode;
}

export { modeById };

/**
 * Everything earned on this device, without the server.
 *
 * Shown on every state of the screen, including the ones where the server
 * could not be reached - the journey and the puzzles never needed it, and an
 * offline player's profile should not be an error message and nothing else.
 */
function SoloProgress({ className }: { className?: string }) {
  const progress = useProgressStore();
  const stars = totalStars(progress.journey);
  const games = totalBotGames(progress.bot);
  const wins = totalBotWins(progress.bot);
  const unlocked = SKIN_UNLOCKS.filter((unlock) => isSkinUnlocked(unlock.skin, progress)).length;

  return (
    <Card className={cx('w-full', className)} padding="tight">
      <h2 className="px-2 py-1 text-xs tracking-wide text-ink-faint uppercase">Solo</h2>
      <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-4">
        <StatTile label="Journey" value={`${stars}/${MAX_STARS}`} hint="stars earned" />
        <StatTile
          label="Puzzles"
          value={progress.puzzles.length}
          hint={progress.daily.best > 0 ? `best daily streak ${progress.daily.best}` : 'solved'}
        />
        <StatTile
          label="vs Bot"
          value={games > 0 ? winRate(wins, games) : '—'}
          hint={`${wins} won of ${games}`}
        />
        <StatTile
          label="Pieces"
          value={`${unlocked}/${SKIN_UNLOCKS.length}`}
          hint={progress.localGames > 0 ? `${progress.localGames} local games` : 'unlocked'}
        />
      </div>
      <div className="flex flex-wrap gap-2 px-2 pb-2">
        <Link
          to="/journey"
          className={buttonClasses({ size: 'small', variant: 'ghost', className: 'w-auto px-4' })}
          style={buttonStyle('ghost')}
        >
          <span className="relative z-2">Journey</span>
        </Link>
        <Link
          to="/puzzles"
          className={buttonClasses({ size: 'small', variant: 'ghost', className: 'w-auto px-4' })}
          style={buttonStyle('ghost')}
        >
          <span className="relative z-2">Puzzles</span>
        </Link>
      </div>
    </Card>
  );
}
