import { type Player, X } from '@dooz/engine';
import type { Avatar } from '@dooz/protocol';
import { AvatarBadge } from '@/components/art/avatars';
import { BotAvatarIcon, TurnCaret, WifiOffIcon } from '@/components/art/icons';
import { Mark } from '@/components/art/marks';
import { cx } from '@/lib/cx';
import { MatchClock } from './MatchClock';

export interface SeatInfo {
  name: string;
  avatar?: Avatar;
  kind?: 'human' | 'bot' | 'local';
  /** Online only. `undefined` means presence does not apply. */
  connected?: boolean;
  /** Marks the seat as belonging to the person at this device. */
  isYou?: boolean;
  /** Seat is working on something - the bot searching for its move. */
  busy?: boolean;
  /** Shown under the name in ranked play. */
  rating?: number | null;
  /** Milliseconds left, when this game is timed. */
  timeMs?: number | null;
  /** True while this seat's clock is the one running down. */
  ticking?: boolean;
}

interface PlayerCardProps extends SeatInfo {
  player: Player;
  /** Draws the caret and the coloured edge when it is this player's turn. */
  active: boolean;
}

/**
 * One of the two cards flanking the board header.
 *
 * Whose turn it is has to be readable at a glance from across a table, so the
 * two cards are pushed apart rather than the active one being decorated: the
 * card to move lifts, brightens, takes the player's colour and pings; the one
 * waiting sinks, dims and goes flat. Reading either card alone is enough,
 * because it is being compared with the other one right beside it.
 *
 * Every part of that is a transition or a loop rather than a swap, so the turn
 * passing between the two cards is a single visible handover.
 */
export function PlayerCard({
  name,
  player,
  active,
  avatar,
  kind = 'human',
  connected,
  isYou = false,
  busy = false,
  rating = null,
  timeMs = null,
  ticking = false,
}: PlayerCardProps) {
  const accent = player === X ? 'var(--color-mark-x)' : 'var(--color-mark-o)';
  // X sits left of the centre column and O sits right of it. Scaling from the
  // centre would grow the active card into that gap, leaving the column 2px
  // nearer one card than the other. Pinning the edge that faces the centre
  // sends the growth outwards instead, so both gaps stay equal.
  const growAwayFromCentre = player === X ? 'origin-right' : 'origin-left';
  const glow = player === X ? 'var(--color-glow-x)' : 'var(--color-glow-o)';
  const offline = connected === false;

  return (
    <div
      // `aria-current` rather than a label, so a screen reader hears which seat
      // is to move from the seat itself - the visual cues all say it in colour
      // and movement, which is to say they do not say it at all.
      aria-current={active ? 'true' : undefined}
      className={cx(
        'relative w-[6.5rem] rounded-panel border p-1',
        'transition-[transform,border-color,background-color,opacity] duration-300 ease-spring',
        growAwayFromCentre,
        // The gap between the two states carries the meaning, so it is a wide
        // one: six per cent up against five per cent down is a difference of
        // size you can see without having to look for it.
        active ? 'scale-[1.06] border-transparent' : 'scale-[0.95] border-stroke-soft',
        active && 'animate-glow-ring',
        offline && 'opacity-50',
      )}
      // The card to move is framed in the player's own colour rather than
      // outlined in it: filling the gutter between the card's edge and its
      // panel makes the colour a band you can see from across a table instead
      // of a hairline.
      //
      // The waiting card carries no filter. Dimming it worked on the dark
      // canvas and turned a near-white card grey on the light one; the size,
      // the border and the two background tokens already say everything the
      // filter was saying.
      style={
        active
          ? ({
              borderColor: accent,
              backgroundColor: `color-mix(in srgb, ${accent} 85%, transparent)`,
              '--glow': glow,
            } as React.CSSProperties)
          : undefined
      }
    >
      <div
        className={cx(
          'flex flex-col items-center justify-between gap-1 rounded-[1.25rem] px-1 py-2.5',
          'transition-colors duration-300 ease-soft',
          active ? 'bg-raised' : 'bg-seat-idle',
        )}
      >
        <span
          className={cx(
            'relative flex size-11 items-center justify-center',
            active && !busy && 'animate-bob',
          )}
        >
          {/* The ping, behind the avatar and pinned to it, so the card's own
              breathing edge is not the only thing in motion on a turn. */}
          {active ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 animate-turn-ping rounded-full"
              style={{ boxShadow: `0 0 0 2px ${accent}` }}
            />
          ) : null}

          {kind === 'bot' ? (
            <BotAvatarIcon
              className={cx('size-11 origin-bottom', busy && 'animate-sweep')}
              ring="var(--color-seat-idle)"
            />
          ) : kind === 'local' ? (
            // Two people at one device have no accounts and so no avatars. A
            // pair of identical default faces told them apart less well than
            // the marks they are actually playing with.
            <Mark
              player={player}
              hole={active ? 'var(--color-raised)' : 'var(--color-seat-idle)'}
              className="size-10"
              style={active ? { filter: `drop-shadow(0 0 10px ${glow})` } : undefined}
            />
          ) : (
            <AvatarBadge
              avatar={avatar ?? 'fox'}
              ring={active ? 'var(--color-raised)' : 'var(--color-seat-idle)'}
              className="size-11"
            />
          )}
        </span>

        <div className="flex w-full flex-col items-center gap-0.5">
          <span className="flex items-center gap-1">
            <span
              className={cx(
                'max-w-[5rem] truncate text-sm leading-4',
                active ? 'text-on-raised' : 'text-ink',
              )}
              title={name}
            >
              {name}
            </span>
            {offline ? <WifiOffIcon className="size-3.5 animate-pulse-soft" /> : null}
          </span>

          {rating !== null ? (
            <span className={cx('tnum text-xs', active ? 'text-on-raised/70' : 'text-ink-faint')}>
              {rating}
            </span>
          ) : null}
        </div>

        {timeMs !== null ? (
          <MatchClock remainingMs={timeMs} ticking={ticking} compact />
        ) : kind === 'local' ? null : (
          <Mark
            player={player}
            hole={active ? 'var(--color-raised)' : 'var(--color-seat-idle)'}
            className={cx(
              'size-7 transition-[transform,filter] duration-300 ease-spring',
              active ? 'scale-115' : 'scale-90',
            )}
            style={active ? { filter: `drop-shadow(0 0 10px ${glow})` } : undefined}
          />
        )}
      </div>

      {isYou ? (
        <span className="absolute -top-2 left-1/2 animate-badge-in rounded-full border border-stroke-soft bg-seat-idle px-2 py-0.5 text-[0.6875rem] tracking-wide text-ink uppercase">
          you
        </span>
      ) : null}

      {active ? (
        <TurnCaret
          color={accent}
          className="absolute -bottom-[0.9rem] left-1/2 h-2 w-4 animate-caret-in"
        />
      ) : null}
    </div>
  );
}
