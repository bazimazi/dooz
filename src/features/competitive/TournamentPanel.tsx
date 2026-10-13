import { useState } from 'react';
import { CheckIcon, ShareIcon } from '@/components/art/icons';
import { Button } from '@/components/ui/Button';
import { useAccountStore } from '@/features/account/store';
import { useOnlineStore } from '@/features/online/store';
import { useLocale, useT } from '@/i18n';
import { competitiveMessages, formatRating } from '@/i18n/messages/onlineCompetitive';
import { inviteUrl, shareOrCopy } from '@/lib/invite';
import { BracketView, Standings, tournamentStatus, useNow } from './TournamentView';

/**
 * The waiting room of a tournament, shown in the online lobby between games.
 *
 * Pairings come from the server: an arena pairs whoever is free as soon as a
 * game ends, a bracket when both players of the next match are here. This
 * panel only shows where things stand and offers the few things a player can
 * do - leave, or as the host start a bracket early or share its code.
 */
export function TournamentPanel({ fallbackId }: { fallbackId: string | null }) {
  const tournament = useOnlineStore((state) => state.tournament);
  const leaveTournament = useOnlineStore((state) => state.leaveTournament);
  const joinTournament = useOnlineStore((state) => state.joinTournament);
  const startBracket = useOnlineStore((state) => state.startBracket);
  const me = useAccountStore((state) => state.credentials?.accountId ?? null);
  const now = useNow();
  const [shared, setShared] = useState(false);
  const t = useT(competitiveMessages);
  const locale = useLocale();

  if (!tournament) {
    return (
      <p className="animate-rise text-lg">
        {fallbackId ? t('joiningTournament') : t('settingUpBracket')}
      </p>
    );
  }

  const own = tournament.standings.find((entry) => entry.profile.accountId === me);
  const isHost = tournament.hostId !== null && tournament.hostId === me;
  const waitingForPairing =
    tournament.joined && tournament.status === 'running' && tournament.kind === 'arena';

  return (
    <div className="flex w-full flex-col items-center gap-3 text-center">
      <div className="flex flex-col gap-1">
        <p className="animate-rise text-lg">{tournament.name}</p>
        <p className="text-sm text-ink-faint" aria-live="polite">
          {tournamentStatus(tournament, now, locale)}
        </p>
      </div>

      {own && tournament.kind === 'arena' ? (
        <p className="text-sm">
          {t('rank', { rank: own.rank })} ·{' '}
          <span className="tnum font-semibold">{formatRating(own.score, locale)}</span>{' '}
          {t('points', { count: own.score })}
          {own.fire ? <span className="text-mark-o"> · {t('onFireInline')}</span> : null}
        </p>
      ) : null}

      {waitingForPairing ? <p className="text-xs text-ink-faint">{t('pairingSoon')}</p> : null}

      {tournament.kind === 'arena' && tournament.status !== 'finished' ? (
        <p className="max-w-64 text-xs text-ink-faint">
          {t('arenaRules')}
          {tournament.berserk ? ` ${t('berserkRule')}` : ''}
        </p>
      ) : null}

      {tournament.kind === 'bracket' && tournament.status === 'scheduled' ? (
        <div className="flex w-full flex-col gap-2">
          <p className="text-sm">
            {t('code')}{' '}
            <span className="selectable font-mono tracking-[0.2em]">{tournament.id}</span>
          </p>
          <Button
            size="small"
            block
            icon={shared ? <CheckIcon /> : <ShareIcon />}
            onClick={async () => {
              const result = await shareOrCopy(bracketUrl(tournament.id), t('shareText'));
              setShared(result !== 'failed');
            }}
          >
            {shared ? t('shared') : t('shareBracket')}
          </Button>
          {isHost ? (
            <Button
              size="small"
              variant="primary"
              block
              disabled={tournament.players < 2}
              onClick={() => startBracket(tournament.id)}
            >
              {t('startWith', { count: tournament.players })}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="max-h-72 w-full overflow-y-auto text-start">
        {tournament.bracket ? (
          <BracketView tournament={tournament} />
        ) : (
          <Standings tournament={tournament} me={me} />
        )}
      </div>

      {tournament.status !== 'finished' ? (
        tournament.joined ? (
          <Button size="small" variant="ghost" onClick={() => leaveTournament(tournament.id)}>
            {tournament.kind === 'bracket' && tournament.status === 'running'
              ? t('withdraw')
              : t('leaveTournament')}
          </Button>
        ) : (
          <Button size="small" variant="primary" onClick={() => joinTournament(tournament.id)}>
            {t('rejoin')}
          </Button>
        )
      ) : null}
    </div>
  );
}

/**
 * The link into a bracket: the room invite link, pointed at the tournament.
 * Falls back to the bare code where there is no public address to link to.
 */
function bracketUrl(id: string): string {
  const link = inviteUrl(id);
  return link === id ? id : link.replace(/([?&])code=/, '$1tournament=');
}
