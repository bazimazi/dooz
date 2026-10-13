import { ReturnLink } from '@/components/ui/ReturnLink';
import { AVATARS, type Avatar } from '@/protocol';
import { isModeId, modeById } from '@/game/engine';
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
import { AccountDataPanel } from '@/features/account/AccountDataPanel';
import { useAccountStore } from '@/features/account/store';
import { CompetitiveSection } from '@/features/competitive/CompetitiveSection';
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
import { duration, fullDate, longDate, signed, timeAgo, winRate } from '@/lib/format';
import { ACHIEVEMENT_LABELS } from '@/lib/achievements';
import { LevelStrip } from '@/features/arcade/ui';
import { FramedAvatar } from '@/features/collection/art';
import { type AchievementGroup, OFFLINE_ACHIEVEMENTS } from '@/features/progress/achievements';
import { equippedCosmetic } from '@/features/progress/cosmetics';
import { loadPreferences } from '@/lib/preferences';
import { type Locale, formatNumber, useLocale, useT } from '@/i18n';
import { achievementGroupName } from '@/i18n/messages/achievements';
import { describeConfigText, modeName } from '@/i18n/messages/modes';
import { useAchievementText } from '@/i18n/messages/onlineAchievements';
import { formatRating } from '@/i18n/messages/onlineCompetitive';
import { profileMessages } from '@/i18n/messages/onlineProfile';
import { wireTierLabel } from '@/i18n/messages/onlineTiers';
import { TIERS } from '@/protocol/tiers';

export function ProfileScreen() {
  const {
    status,
    profile,
    credentials,
    initialise,
    rename,
    setAvatar,
    claim,
    signIn,
    signOut,
    error,
    claimError,
    signInError,
    clearError,
  } = useAccountStore();

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
      : (api.cachedMatches(credentials)?.matches ?? null)
    : [];
  const [editing, setEditing] = useState(false);
  const t = useT(profileMessages);
  const locale = useLocale();
  const achievementText = useAchievementText();

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
      // Unreachable with nothing cached: an empty history, not endless loading.
      .catch(() => {
        if (!controller.signal.aborted) setMatches({ for: credentials, value: [] });
      });

    return () => controller.abort();
  }, [credentials]);

  if (status === 'loading' || (status === 'idle' && !profile)) {
    return (
      <Screen width="wide" scroll>
        <Header />
        <Card className="w-full" padding="roomy">
          <p className="text-center text-sm text-ink-faint">{t('loadingProfile')}</p>
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
            title={t('loadError')}
            body={error ?? t('loadErrorBody')}
            action={
              <Button size="small" className="w-auto px-4" onClick={() => void initialise()}>
                {t('tryAgain')}
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
  // The mode the best streak was set in, not the one played most.
  const streakMode = profile.stats.find(
    (entry) => entry.bestStreak > 0 && entry.bestStreak === totals.best,
  )?.mode;

  const rated = profile.stats.filter((entry) => entry.played > 0);

  return (
    <Screen width="wide" scroll>
      <Header />

      <div className="flex w-full flex-col gap-4 pb-6">
        {/* Identity */}
        <Card className="w-full">
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label={t('changeAvatar')}
              className="shrink-0 rounded-full"
              onClick={() => setEditing(true)}
            >
              <EquippedAvatar avatar={profile.avatar} />
            </button>
            <div className="flex min-w-0 flex-1 flex-col">
              <h1 className="truncate font-display text-xl min-[360px]:text-2xl">
                {profile.displayName}
              </h1>
              <EquippedTitle />
              <p className="text-xs text-ink-faint">
                {t('playingSince', { date: longDate(profile.createdAt) })}
                {profile.claimed ? ` · ${t('passwordSet')}` : ''}
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
              {editing ? t('done') : t('edit')}
            </Button>
          </div>

          {editing ? (
            <IdentityEditor
              // A sign-in or sign-out swaps the account; its fields start over.
              key={profile.accountId}
              currentName={profile.displayName}
              currentAvatar={profile.avatar}
              claimed={profile.claimed}
              error={error}
              claimError={claimError}
              signInError={signInError}
              onRename={rename}
              onAvatar={setAvatar}
              onClaim={claim}
              onSignIn={signIn}
              onSignOut={signOut}
            />
          ) : null}
        </Card>

        <p className="px-1 text-xs text-ink-faint">{t('localNote')}</p>
        {credentials && pendingChanges ? (
          <p className="px-1 text-xs text-ink-muted">{t('pendingSync')}</p>
        ) : null}
        {/* Totals across every mode */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <StatTile label={t('played')} value={formatNumber(totals.played, locale)} />
          <StatTile label={t('winRate')} value={winRate(totals.won, totals.played)} />
          <StatTile
            label={t('record')}
            value={t('recordValue', { won: totals.won, lost: totals.lost, drawn: totals.drawn })}
            hint={t('recordHint')}
          />
          <StatTile
            label={t('bestStreak')}
            value={formatNumber(totals.best, locale)}
            hint={streakMode ? t('streakIn', { mode: labelFor(streakMode, locale) }) : undefined}
          />
        </div>

        <SoloProgress />

        {/* This season's tier and division per mode, past seasons, titles */}
        <CompetitiveSection />

        {/* Per mode */}
        <Card className="w-full" padding="tight">
          <h2 className="px-2 py-1 text-xs tracking-wide text-ink-faint uppercase">
            {t('byMode')}
          </h2>
          {rated.length === 0 ? (
            <EmptyState
              icon={<TrophyIcon />}
              title={t('noOnlineGames')}
              body={t('noOnlineGamesBody')}
              action={
                <Button as={ReturnLink} to="/" size="small" className="w-auto px-4">
                  {t('playMatch')}
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
                      <span className="truncate text-sm font-semibold">
                        {labelFor(entry.mode, locale)}
                      </span>
                      <span className="text-xs text-ink-faint">
                        {t('modePlayed', { count: entry.played })} ·{' '}
                        {t('modeWon', { rate: winRate(entry.won, entry.played) })}
                        {entry.streak > 1 ? ` · ${t('inARow', { count: entry.streak })}` : ''}
                      </span>
                    </span>

                    <span className="flex flex-col items-end">
                      <span className="tnum text-base font-semibold">
                        {formatRating(entry.rating, locale)}
                      </span>
                      <span className="text-xs text-ink-faint">
                        {rank?.rank
                          ? t('rankDivision', {
                              rank: rank.rank,
                              division: divisionLabel(rank.division, locale),
                            })
                          : rank
                            ? divisionLabel(rank.division, locale)
                            : t('unranked')}
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
          <h2 className="px-2 py-1 text-xs tracking-wide text-ink-faint uppercase">
            {t('achievements')}
          </h2>
          <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3">
            {ACHIEVEMENT_LABELS.map((achievement) => {
              const unlocked = profile.achievements.find((entry) => entry.id === achievement.id);
              const text = achievementText(achievement);
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
                      {text.name}
                    </span>
                    <span className="text-[0.75rem] leading-snug text-ink-muted">
                      {text.description}
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
            {t('recentMatches')}
          </h2>
          {matches === null ? (
            <p className="px-2 py-6 text-center text-sm text-ink-faint">{t('loading')}</p>
          ) : matches.length === 0 ? (
            <EmptyState icon={<SparkIcon />} title={t('noMatches')} body={t('noMatchesBody')} />
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
                      {match.outcome === 'win'
                        ? t('outcomeWin')
                        : match.outcome === 'loss'
                          ? t('outcomeLoss')
                          : t('outcomeDraw')}
                    </span>

                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm">
                        {t('versus', { name: match.opponent.displayName })}
                      </span>
                      <span className="truncate text-xs text-ink-faint">
                        {describeConfigText(match.config, locale)} · {t(`kind.${match.kind}`)} ·{' '}
                        {t('moves', { count: match.moveCount })} · {duration(match.durationMs)}
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

        <AccountDataPanel />
      </div>
    </Screen>
  );
}

function Header() {
  const t = useT(profileMessages);
  return (
    <header className="flex w-full items-center gap-3 pt-2 pb-4">
      <IconButton as={ReturnLink} to="/" tone="bare" size="small" label={t('backHome')}>
        <BackIcon className="rtl:-scale-x-100" />
      </IconButton>
      <h1 className="font-display text-xl">{t('title')}</h1>
    </header>
  );
}

function IdentityEditor({
  currentName,
  currentAvatar,
  claimed,
  error,
  claimError,
  signInError,
  onRename,
  onAvatar,
  onClaim,
  onSignIn,
  onSignOut,
}: {
  currentName: string;
  currentAvatar: Avatar;
  claimed: boolean;
  error: string | null;
  claimError: string | null;
  signInError: string | null;
  onRename: (name: string) => Promise<boolean>;
  onAvatar: (avatar: Avatar) => Promise<void>;
  onClaim: (password: string) => Promise<boolean>;
  onSignIn: (name: string, password: string) => Promise<boolean>;
  onSignOut: () => void;
}) {
  const [name, setName] = useState(currentName);
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [busy, setBusy] = useState(false);
  // A message key rather than its text, so a language change rewords it.
  const [saved, setSaved] = useState<'nameUpdated' | 'passwordSaved' | 'signedIn' | null>(null);
  const t = useT(profileMessages);

  return (
    <div className="mt-4 flex flex-col gap-4 border-t border-stroke-soft pt-4">
      <form
        className="flex items-end gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const ok = await onRename(name.trim());
          setSaved(ok ? 'nameUpdated' : null);
        }}
      >
        <Field
          label={t('displayName')}
          value={name}
          maxLength={20}
          onChange={(event) => setName(event.target.value)}
          error={error}
          hint={t('nameHint')}
        />
        <Button
          type="submit"
          size="small"
          className="mb-6 w-auto shrink-0 px-4"
          disabled={name.trim() === currentName || name.trim().length < 2}
        >
          {t('save')}
        </Button>
      </form>

      <fieldset className="flex flex-col gap-2">
        <legend className="px-1 text-sm text-ink-muted">{t('avatar')}</legend>
        <div className="flex flex-wrap gap-2">
          {AVATARS.map((avatar) => (
            <button
              key={avatar}
              type="button"
              aria-label={t(`avatar.${avatar}`)}
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
            setSaved('passwordSaved');
          }
        }}
      >
        <div className="flex items-end gap-2">
          <Field
            label={claimed ? t('changePassword') : t('setPassword')}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={claimError}
            hint={t('passwordHint')}
          />
          <Button
            type="submit"
            size="small"
            className="mb-6 w-auto shrink-0 px-4"
            disabled={password.length < 8}
          >
            {claimed ? t('change') : t('set')}
          </Button>
        </div>
      </form>

      {saved ? (
        <p className="text-xs text-ok" role="status">
          {t(saved)}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-stroke-soft pt-4">
        {signingIn ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              const ok = await onSignIn(loginName.trim(), loginPassword);
              setBusy(false);
              if (ok) {
                setLoginPassword('');
                setSigningIn(false);
                setSaved('signedIn');
              }
            }}
          >
            <Field
              label={t('accountName')}
              value={loginName}
              maxLength={20}
              autoComplete="username"
              onChange={(event) => setLoginName(event.target.value)}
            />
            <Field
              label={t('password')}
              type="password"
              autoComplete="current-password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              error={signInError}
              hint={claimed ? t('switchHint') : t('switchHintUnclaimed')}
            />
            <div className="flex gap-2">
              <Button
                type="submit"
                size="small"
                className="w-auto px-4"
                disabled={busy || loginName.trim().length < 2 || loginPassword.length < 8}
              >
                {t('signIn')}
              </Button>
              <Button
                type="button"
                size="small"
                variant="ghost"
                className="w-auto px-4"
                onClick={() => setSigningIn(false)}
              >
                {t('cancel')}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="small"
              variant="ghost"
              className="w-auto px-4"
              onClick={() => {
                setSaved(null);
                setSigningIn(true);
              }}
            >
              {t('signInOther')}
            </Button>
            {claimed ? (
              <Button size="small" variant="ghost" className="w-auto px-4" onClick={onSignOut}>
                {t('signOut')}
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

/** A mode id from the server, as a name a player recognises. */
function labelFor(mode: string, locale: Locale): string {
  if (isModeId(mode)) return modeName(mode, locale);
  // A custom game is keyed by its config rather than a mode id.
  const parts = mode.split(':');
  if (parts.length === 3) {
    return describeConfigText(
      {
        variant: parts[0] as 'classic',
        size: Number(parts[1]),
        winLength: Number(parts[2]),
      },
      locale,
    );
  }
  return mode;
}

/**
 * A division the server named in English ("Gold II"), in the interface
 * language. The tier is read back from its English name; an unknown one keeps
 * the server's text.
 */
function divisionLabel(label: string, locale: Locale): string {
  const tier = TIERS.find((entry) => label === entry.name || label.startsWith(`${entry.name} `));
  return wireTierLabel(tier?.id ?? '', label, locale);
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
  const t = useT(profileMessages);
  const locale = useLocale();

  return (
    <>
      <LevelStrip className={className} />
      <Card className="w-full" padding="tight">
        <h2 className="px-2 py-1 text-xs tracking-wide text-ink-faint uppercase">{t('solo')}</h2>
        <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-4">
          <StatTile
            label={t('journey')}
            value={t('fraction', { have: stars, need: MAX_STARS })}
            hint={t('starsEarned')}
          />
          <StatTile
            label={t('puzzles')}
            value={formatNumber(progress.puzzles.length, locale)}
            hint={
              progress.daily.best > 0 ? t('bestDaily', { count: progress.daily.best }) : t('solved')
            }
          />
          <StatTile
            label={t('vsBot')}
            value={games > 0 ? winRate(wins, games) : '—'}
            hint={t('wonOf', { won: wins, games })}
          />
          <StatTile
            label={t('pieces')}
            value={t('fraction', { have: unlocked, need: SKIN_UNLOCKS.length })}
            hint={
              progress.localGames > 0
                ? t('localGames', { count: progress.localGames })
                : t('unlocked')
            }
          />
        </div>
        <div className="flex flex-wrap gap-2 px-2 pb-2">
          <Link
            to="/journey"
            className={buttonClasses({ size: 'small', variant: 'ghost', className: 'w-auto px-4' })}
            style={buttonStyle('ghost')}
          >
            <span className="relative z-2">{t('journey')}</span>
          </Link>
          <Link
            to="/puzzles"
            className={buttonClasses({ size: 'small', variant: 'ghost', className: 'w-auto px-4' })}
            style={buttonStyle('ghost')}
          >
            <span className="relative z-2">{t('puzzles')}</span>
          </Link>
          <Link
            to="/arcade"
            className={buttonClasses({ size: 'small', variant: 'ghost', className: 'w-auto px-4' })}
            style={buttonStyle('ghost')}
          >
            <span className="relative z-2">{t('arcade')}</span>
          </Link>
          <Link
            to="/collection"
            className={buttonClasses({ size: 'small', variant: 'ghost', className: 'w-auto px-4' })}
            style={buttonStyle('ghost')}
          >
            <span className="relative z-2">{t('collection')}</span>
          </Link>
        </div>
      </Card>
      <OfflineAchievements />
    </>
  );
}

const GROUPS: readonly AchievementGroup[] = ['Journey', 'Puzzles', 'Bot', 'Arcade', 'Level'];

/**
 * Achievements earned on this device, beside the online ones the server
 * awards. Shown on every state of the screen, like the rest of solo progress.
 */
function OfflineAchievements() {
  const progress = useProgressStore();
  const earned = OFFLINE_ACHIEVEMENTS.filter((entry) => progress.achievements.includes(entry.id));
  const t = useT(profileMessages);
  // Names and descriptions are read in the current language as they render.
  const locale = useLocale();
  return (
    <Card className="w-full" padding="tight">
      <h2 className="flex justify-between px-2 py-1 text-xs tracking-wide text-ink-faint uppercase">
        <span>{t('soloAchievements')}</span>
        <span className="tnum">
          {t('fraction', { have: earned.length, need: OFFLINE_ACHIEVEMENTS.length })}
        </span>
      </h2>
      {GROUPS.map((group) => (
        <section key={group} aria-label={achievementGroupName(group, locale)} className="px-2 pt-2">
          <h3 className="text-[0.6875rem] font-semibold text-ink-muted">
            {achievementGroupName(group, locale)}
          </h3>
          <ul className="grid grid-cols-1 gap-2 py-2 min-[360px]:grid-cols-2 sm:grid-cols-3">
            {OFFLINE_ACHIEVEMENTS.filter((entry) => entry.group === group).map((entry) => {
              const unlocked = progress.achievements.includes(entry.id);
              const [have, need] = entry.progress?.(progress) ?? [0, 0];
              return (
                <li
                  key={entry.id}
                  className={cx(
                    'flex items-start gap-2 rounded-tile border px-2.5 py-2',
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
                      {entry.name}
                      <span className="sr-only">{unlocked ? t('earned') : t('locked')}</span>
                    </span>
                    <span className="text-[0.75rem] leading-snug text-ink-muted">
                      {entry.description}
                      {!unlocked && need > 1 ? (
                        <span className="tnum text-ink-faint">
                          {' '}
                          ({t('fraction', { have, need })})
                        </span>
                      ) : null}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Card>
  );
}

/** The avatar in the frame equipped in the collection. */
function EquippedAvatar({ avatar }: { avatar: Avatar }) {
  const progress = useProgressStore();
  const frame = equippedCosmetic('frame', loadPreferences().cosmetics, progress);
  return <FramedAvatar avatar={avatar} ring={frame.ring} className="size-16" />;
}

/** The title equipped in the collection, under the name. */
function EquippedTitle() {
  const progress = useProgressStore();
  // The title's name is read in the current language; this re-renders on a change.
  useLocale();
  const title = equippedCosmetic('title', loadPreferences().cosmetics, progress);
  return <p className="truncate text-sm font-semibold text-warn">{title.name}</p>;
}
