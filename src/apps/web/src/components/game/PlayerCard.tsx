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
  /** Seat is working on something - the bot searching for its move. */
  busy?: boolean;
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
  kind = 'human',
  connected,
  isYou = false,
  busy = false,
}: PlayerCardProps) {
  const Avatar = kind === 'bot' ? BotAvatarIcon : AvatarIcon;
  const accent = player === X ? 'var(--color-p2)' : 'var(--color-y2)';
  // X sits left of the size picker and O sits right of it. Scaling from the
  // centre would grow the active card into that gap, leaving the picker 2px
  // nearer one card than the other. Pinning the edge that faces the picker
  // sends the growth outwards instead, so both gaps stay equal.
  const growAwayFromCentre = player === X ? 'origin-right' : 'origin-left';
  const glow = player === X ? 'rgb(243 51 158 / 0.55)' : 'rgb(249 189 19 / 0.55)';
  const offline = connected === false;

  return (
    <div
      // `aria-current` rather than a label, so a screen reader hears which seat
      // is to move from the seat itself - the visual cues all say it in colour
      // and movement, which is to say they do not say it at all.
      aria-current={active ? 'true' : undefined}
      className={cx(
        'relative w-[6.125rem] rounded-panel border p-1',
        'transition-[transform,border-color,background-color,opacity,filter] duration-300 ease-spring',
        growAwayFromCentre,
        // The gap between the two states carries the meaning, so it is a wide
        // one: six per cent up against five per cent down is a difference of
        // size you can see without having to look for it.
        active ? 'scale-[1.06] border-transparent' : 'scale-[0.95] border-b8/50',
        active && 'animate-glow-ring',
        offline && 'opacity-50',
      )}
      style={
        active
          ? // The card to move is framed in the player's own colour rather than
            // outlined in it: filling the 4px gutter between the card's edge and
            // its panel makes the colour a band you can see from across a table
            // instead of a hairline. Tinting the panel itself was the other
            // candidate and it muddied - pink and amber both go grey mixed into
            // this blue.
            ({
              borderColor: accent,
              backgroundColor: `color-mix(in srgb, ${accent} 85%, transparent)`,
              '--glow': glow,
            } as React.CSSProperties)
          : // The waiting seat is turned down rather than faded out. Fading it
            // let the canvas through, and this canvas is blue: at 70% the
            // yellow O went a muddy brown, which reads as a disabled seat
            // rather than one whose turn is simply next.
            { filter: 'brightness(0.82) saturate(0.9)' }
      }
    >
      <div
        className={cx(
          'flex h-[7.5rem] flex-col items-center justify-around rounded-[1.25rem] px-1',
          'transition-colors duration-300 ease-soft',
          // The waiting seat also sinks a step back into the canvas, so the two
          // are separated by brightness as well as by the frame.
          active ? 'bg-raised' : 'bg-b5',
        )}
      >
        <span
          className={cx(
            'relative flex size-12 items-center justify-center',
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

          {/* A bot that is searching casts about; a waiting player just bobs. */}
          <Avatar
            className={cx('size-12 origin-bottom', busy && 'animate-sweep')}
            ring="var(--color-b2)"
          />
        </span>

        <div className="flex items-center gap-1">
          <span className="max-w-[5rem] truncate text-base leading-5" title={name}>
            {name}
          </span>
          {offline ? <WifiOffIcon className="size-3.5 animate-pulse-soft text-g8" /> : null}
        </div>

        <Mark
          player={player}
          // The cut-out has to match whichever panel the mark is sitting on.
          hole={active ? 'var(--color-raised)' : 'var(--color-b5)'}
          // Size and glow only: the card above is already dimming this mark, and
          // fading it a second time here is what turned the yellow O brown.
          className={cx(
            'size-8 transition-[transform,filter] duration-300 ease-spring',
            active ? 'scale-115' : 'scale-90',
          )}
          style={active ? { filter: `drop-shadow(0 0 10px ${glow})` } : undefined}
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
