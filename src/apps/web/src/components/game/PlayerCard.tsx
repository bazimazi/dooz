import { type Player, X } from '@dooz/engine';
import { AvatarIcon, BotAvatarIcon, TurnCaret, WifiOffIcon } from '@/components/art/icons';
import { Mark } from '@/components/art/marks';
import { cx } from '@/lib/cx';

interface PlayerCardProps {
  name: string;
  player: Player;
  /** Draws the caret and the coloured edge when it is this player's turn. */
  active: boolean;
  kind?: 'human' | 'bot';
  /** Online only. `undefined` means presence does not apply. */
  connected?: boolean;
  /** Marks the seat as belonging to the person at this device. */
  isYou?: boolean;
  /** Seat is working on something — the bot searching for its move. */
  busy?: boolean;
}

/**
 * One of the two cards flanking the board header.
 *
 * Whose turn it is has to be readable at a glance from across a table, so the
 * active card does four things at once: it lifts, its edge takes the player's
 * colour, that edge breathes, and the avatar bobs. Every one of them is a
 * transition or a loop rather than a swap, so the turn passing between the two
 * cards is a single visible handover.
 */
export function PlayerCard({
  name,
  player,
  active,
  kind = 'human',
  connected,
  isYou = false,
  busy = false,
}: PlayerCardProps) {
  const Avatar = kind === 'bot' ? BotAvatarIcon : AvatarIcon;
  const accent = player === X ? 'var(--color-p2)' : 'var(--color-y2)';
  const glow = player === X ? 'rgb(243 51 158 / 0.45)' : 'rgb(249 189 19 / 0.45)';
  const offline = connected === false;

  return (
    <div
      className={cx(
        'relative w-[6.125rem] rounded-panel border p-1',
        'transition-[transform,border-color,opacity] duration-300 ease-spring',
        active ? 'scale-[1.04] border-transparent' : 'scale-100 border-b8',
        active && 'animate-glow-ring',
        offline && 'opacity-60',
      )}
      style={active ? ({ borderColor: accent, '--glow': glow } as React.CSSProperties) : undefined}
    >
      <div className="flex h-[7.5rem] flex-col items-center justify-around rounded-[1.25rem] bg-raised px-1">
        {/* A bot that is searching casts about; a waiting player just bobs. */}
        <Avatar
          className={cx('size-12 origin-bottom', busy ? 'animate-sweep' : active && 'animate-bob')}
          ring="var(--color-b2)"
        />

        <div className="flex items-center gap-1">
          <span className="max-w-[5rem] truncate text-base leading-5" title={name}>
            {name}
          </span>
          {offline ? <WifiOffIcon className="size-3.5 animate-pulse-soft text-g8" /> : null}
        </div>

        <Mark
          player={player}
          hole="var(--color-raised)"
          className={cx(
            'size-8 transition-[transform,filter] duration-300 ease-spring',
            active ? 'scale-110' : 'scale-100 opacity-80',
          )}
          style={active ? { filter: `drop-shadow(0 0 8px ${glow})` } : undefined}
        />
      </div>

      {isYou ? (
        <span className="absolute -top-2 left-1/2 animate-badge-in rounded-full bg-b2 px-2 py-0.5 text-[0.625rem] tracking-wide uppercase">
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
