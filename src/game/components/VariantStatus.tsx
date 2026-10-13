import {
  CHAOS,
  type GameState,
  O,
  ORDER,
  powerCharges,
  PRO_DISTANCE,
  PENTE_CAPTURES_TO_WIN,
  penteCaptures,
  type Player,
  VANISH_MOVE_LIMIT,
  X,
} from '@/game/engine';
import { Mark } from '@/components/art/marks';
import { ClockIcon } from '@/components/art/ui-icons';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { type Translator, useT } from '@/i18n';
import { gameVariantMessages } from '@/i18n/messages/gameVariants';

type VariantText = Translator<(typeof gameVariantMessages)['en']>;

/**
 * The one extra fact a rule set needs said out loud under the board.
 *
 * Keep the variant's unusual rule next to the board where it can be used.
 * Vanish also warns before its move limit ends the round.
 */
export function VariantStatus({ game }: { game: GameState }) {
  const t = useT(gameVariantMessages);
  // Pente's capture count is the score of a second race, and it is how a game
  // won on captures was won - so it stays up once the game is over.
  if (game.config.variant === 'pente') return <PenteCaptures game={game} />;
  // Order and Chaos renames the seats, and says who won as which - so it, too,
  // stays up at the end.
  if (game.config.variant === 'order-chaos') return <OrderChaosRoles game={game} />;
  if (game.status !== 'playing') return null;

  const extra = newRuleReminder(game, t);
  if (extra) return extra;

  if (game.config.variant === 'qubic') {
    return <p className="text-center text-xs text-ink-muted">{t('qubic')}</p>;
  }
  if (game.config.variant === 'quantum') {
    return <p className="text-center text-xs text-ink-muted">{t('quantum')}</p>;
  }

  if (game.config.variant === 'misere') {
    return <p className="text-center text-xs text-ink-muted">{t('misere')}</p>;
  }
  if (game.config.variant === 'gravity') {
    return <p className="text-center text-xs text-ink-muted">{t('gravity')}</p>;
  }
  if (game.ultimate) {
    const active = game.ultimate.activeBoard;
    return (
      <p className="text-center text-xs text-ink-muted" aria-live="polite">
        {active === null ? t('ultimateAny') : t('ultimateMust', { n: active + 1 })}{' '}
        {t('ultimateWin')}
      </p>
    );
  }
  if (game.config.variant !== 'vanish') return null;

  const left = VANISH_MOVE_LIMIT - game.moves.length;
  const close = left <= 10;
  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-center text-xs text-ink-muted">{t('vanishKeep')}</p>
      <p
        className={cx(
          'tnum flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs',
          'transition-colors duration-300',
          close ? 'animate-pulse-soft border-warn text-warn' : 'border-stroke-soft text-ink-faint',
        )}
        aria-live={close ? 'polite' : 'off'}
      >
        <ClockIcon className="size-3.5" />
        {left === 1 ? t('vanishLast') : t('vanishLeft', { count: left })}
      </p>
    </div>
  );
}

/** Each side's captured pairs as five pips, filling towards the capture win. */
function PenteCaptures({ game }: { game: GameState }) {
  const t = useT(gameVariantMessages);
  const [x, o] = penteCaptures(game);
  return (
    <div className="flex flex-col items-center gap-1">
      {game.status === 'playing' ? (
        <p className="text-center text-xs text-ink-muted">{t('pente')}</p>
      ) : null}
      <div className="flex items-center gap-4" aria-live="polite">
        <CaptureTally player={X} count={x} />
        <CaptureTally player={O} count={o} />
      </div>
    </div>
  );
}

function CaptureTally({ player, count }: { player: Player; count: number }) {
  const t = useT(gameVariantMessages);
  const name = player === X ? 'X' : 'O';
  const close = count === PENTE_CAPTURES_TO_WIN - 1;
  return (
    <span
      className={cx(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors duration-300',
        close ? 'border-warn text-warn' : 'border-stroke-soft text-ink-muted',
      )}
      role="img"
      aria-label={t('captured', { mark: name, count, total: PENTE_CAPTURES_TO_WIN })}
    >
      <Mark player={player} hole="var(--color-surface)" className="size-3.5" />
      {Array.from({ length: PENTE_CAPTURES_TO_WIN }, (_, pip) => (
        <span
          key={pip}
          aria-hidden="true"
          // The newest pip pops as it fills: the class arriving starts it.
          className={cx(
            'size-1.5 rounded-full',
            pip < count ? 'bg-current' : 'bg-stroke-soft',
            pip === count - 1 && 'animate-pop',
          )}
        />
      ))}
    </span>
  );
}

/** Order and Chaos: which seat is which, whose turn it is, and how it ended. */
function OrderChaosRoles({ game }: { game: GameState }) {
  const t = useT(gameVariantMessages);
  const toMove = t(game.currentPlayer === ORDER ? 'order' : 'chaos');
  const outcome =
    game.status === 'playing'
      ? t('toMove', { role: toMove })
      : t(game.winner === ORDER ? 'orderWins' : 'chaosWins');
  return (
    <div className="flex flex-col items-center gap-1 text-xs text-ink-muted">
      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1">
          <Mark player={ORDER} hole="var(--color-surface)" className="size-3.5" />
          <strong className="font-semibold text-ink">{t('order')}</strong> {t('orderWants')}
        </span>
        <span className="flex items-center gap-1">
          <Mark player={CHAOS} hole="var(--color-surface)" className="size-3.5" />
          <strong className="font-semibold text-ink">{t('chaos')}</strong> {t('chaosWants')}
        </span>
      </p>
      <p aria-live="polite">
        {outcome} {t('eitherMark')}
      </p>
    </div>
  );
}

/** The reminder line for the rule sets that need one and have no richer panel. */
function newRuleReminder(game: GameState, t: VariantText): ReactNode {
  const { variant, exact, opening } = game.config;

  if (variant === 'connect4') {
    return note(t('connect4'));
  }
  if (variant === 'wild') {
    const short = game.config.winLength - 1;
    return note(t(short === 2 ? 'wildTwo' : 'wildThree'));
  }
  if (variant === 'obstacles') {
    return note(t('obstacles'));
  }
  if (variant === 'powers') {
    return <PowersLeft game={game} />;
  }

  const ply = game.moves.length;
  if (opening === 'swap' && ply <= 1) {
    return note(t(ply === 0 ? 'swapFirst' : 'swapSecond'));
  }
  if (opening === 'pro' && (ply === 0 || ply === 2)) {
    return note(ply === 0 ? t('proFirst') : t('proSecond', { count: PRO_DISTANCE }));
  }
  if (exact) return note(t('exact'));
  return null;
}

/** One line of reminder under the board. */
function note(text: ReactNode) {
  return (
    <p className="text-center text-xs text-ink-muted" aria-live="polite">
      {text}
    </p>
  );
}

/** Powers: what each side has left to spend. */
function PowersLeft({ game }: { game: GameState }) {
  const t = useT(gameVariantMessages);
  const seat = (player: Player) => {
    const left = powerCharges(game, player);
    return (
      <span className="flex items-center gap-1">
        <Mark player={player} hole="var(--color-surface)" className="size-3.5" />
        {t('powersSeat', { bomb: left.bomb, wall: left.wall })}
      </span>
    );
  };
  return (
    <div className="flex flex-col items-center gap-1 text-xs text-ink-muted">
      <p className="tnum flex items-center gap-4" aria-label={t('powersLeft')}>
        {seat(X)}
        {seat(O)}
      </p>
      <p>{t('powersRule')}</p>
    </div>
  );
}
