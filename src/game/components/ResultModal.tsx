import { type GameState, type Player, X } from '@/game/engine';
import type { EndReason } from '@/protocol';
import { type CSSProperties, type ReactNode, useEffect, useState } from 'react';
import { Confetti } from '@/components/art/Confetti';
import { Button } from '@/components/ui/Button';
import { HappyFace, NeutralFace, SadFace } from '@/components/art/faces';
import { Mark } from '@/components/art/marks';
import { formatDuration } from '@/game/useGameDuration';
import { cx } from '@/lib/cx';
import { useGraphics } from '@/lib/graphics';
import { loadPreferences, type GraphicsQuality } from '@/lib/preferences';
import { useDialog } from '@/lib/useDialog';
import { useClosing } from '@/lib/useClosing';
import { formatNumber, type Locale, translate, useLocale, useT } from '@/i18n';
import { gameResultMessages } from '@/i18n/messages/gameResult';
import { DecisiveReplay, replayPlan } from './DecisiveReplay';

interface ResultModalProps {
  title: string;
  art: ReactNode;
  /** Extra line under the title - how the game ended, a rematch prompt. */
  note?: ReactNode;
  /** The rating change, the streak: anything worth a moment's attention. */
  detail?: ReactNode;
  /**
   * XP gained, a level reached, anything unlocked. Shown prominently, between
   * the game's own story and the buttons. Optional: most results earn nothing.
   */
  rewards?: ReactNode;
  /**
   * How it went for the person at this device, which colours the banner.
   * Omitted, a celebrated result reads as a win and anything else as a draw.
   */
  tone?: 'win' | 'loss' | 'draw';
  /** The finished game: its move count, and its last moves replayed beside it. */
  game?: GameState;
  /** How long the game took, when it is known. See `useGameDuration`. */
  durationMs?: number | null;
  /** A rated game's rating before and after, counted up on arrival. */
  rating?: { before: number; after: number } | null;
  /** The buttons. Given rather than assembled here, because they differ by screen. */
  actions: ReactNode;
  /** Fires the confetti. Set only when the person at this device won. */
  celebrate?: boolean;
  /**
   * Milliseconds to leave the finished board uncovered before arriving.
   * `revealDelayFor` works it out from the game; zero arrives immediately.
   */
  revealDelay?: number;
  /** Local games can uncover the final position and reopen these results. */
  onDismiss?: () => void;
}

/**
 * The end-of-game panel.
 *
 * It holds off for `revealDelay` first. The panel dims and blurs the whole
 * board behind it, so arriving the instant the game ends means covering the
 * winning line while it is still being drawn - the one thing the player has
 * been waiting the whole game to see.
 *
 * The wait is a delay to the mount rather than a hidden panel, so the panel and
 * its focus trap come up together and nothing invisible is holding focus over
 * the board in the meantime. A tap or a keypress ends it early.
 */
export function ResultModal({ revealDelay = 0, ...panel }: ResultModalProps) {
  const quality = useGraphics();
  return useRevealed(quality === 'low' ? 0 : revealDelay) ? <ResultPanel {...panel} /> : null;
}

/** `true` once `delay` has passed since mounting, or the player cuts it short. */
function useRevealed(delay: number): boolean {
  const [revealed, setRevealed] = useState(delay <= 0);

  useEffect(() => {
    if (revealed) return;

    const reveal = () => setRevealed(true);
    const timer = setTimeout(reveal, delay);
    // Somebody who has seen enough should not have to sit through the rest of
    // it, so any tap or key brings the panel in early. The interaction that
    // ended the game is already over by the time this is listening.
    document.addEventListener('pointerdown', reveal);
    document.addEventListener('keydown', reveal);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', reveal);
      document.removeEventListener('keydown', reveal);
    };
  }, [delay, revealed]);

  return revealed || delay <= 0;
}

/**
 * How long to leave a finished board alone before the panel covers it.
 *
 * A win line takes 0.55s to draw itself - a 0.1s delay and a 0.45s sweep - and
 * is the point of the whole game, so the panel waits for that and leaves it on
 * screen a beat longer. A draw has no line to watch, only the board settling,
 * so its pause is just long enough that the panel does not feel like a cut.
 * A game that ended without a final move - a resignation, a flag - has nothing
 * to watch at all. Under gravity the last mark has to fall before any of it
 * starts, and the shockwave off a finished line is worth its half second.
 */
export function revealDelayFor(
  game: GameState,
  reason?: EndReason,
  graphics: GraphicsQuality = loadPreferences().graphics,
): number {
  if (graphics === 'low') return 0;
  if (reason && reason !== 'line' && reason !== 'draw') return 0;
  const drops = game.config.variant === 'gravity' || game.config.variant === 'connect4';
  const falling = drops ? 450 : 0;
  if (graphics === 'balanced') return (game.status === 'won' ? 700 : 300) + falling;
  if (game.winLine) return 1450 + falling;
  if (game.ultimate?.winBoards) return 1400;
  return 700 + falling;
}

/**
 * Local games may provide a dismiss action to review the board. Screens that
 * require a choice, such as an online rematch, keep their existing actions.
 *
 * It arrives in pieces - dim, then panel, then the medallion, the verdict on
 * its ribbon, the story of the game and the buttons - because the result is
 * the one moment in the game worth pausing on. Everything a player acts on is
 * in place within half a second, so it never delays a rematch; the replay and
 * the counting keep going underneath for whoever wants to watch.
 */
function ResultPanel({
  title,
  art,
  note,
  detail,
  rewards,
  actions,
  celebrate = false,
  onDismiss,
  tone = celebrate ? 'win' : 'draw',
  game,
  durationMs,
  rating,
}: Omit<ResultModalProps, 'revealDelay'>) {
  // Moves focus in, traps Tab, and makes the board behind it inert - without
  // which `aria-modal` below would be a claim the page does not honour.
  const { closing, close } = useClosing(onDismiss ?? (() => undefined));
  const panelRef = useDialog<HTMLDivElement>(onDismiss ? close : undefined);
  const quality = useGraphics();
  const t = useT(gameResultMessages);
  const locale = useLocale();
  const replayable = game ? replayPlan(game) !== null : false;
  const stats = game ? gameStats(game, durationMs ?? null, locale) : [];

  return (
    <div
      className={cx(
        'fixed inset-0 z-50 flex items-center justify-center bg-scrim p-5 backdrop-blur-[2px]',
        closing ? 'animate-fade-out' : 'animate-fade-in',
      )}
    >
      {celebrate ? <Confetti /> : null}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        data-tone={tone}
        className={cx(
          'relative w-full max-w-84 animate-result-in panel-shell rounded-[2.5rem] border border-stroke p-2 outline-none',
          'shadow-[0_30px_70px_-30px_var(--color-shadow)]',
        )}
        style={{ animationDelay: '0.06s' }}
      >
        <div className="flex max-h-[85dvh] flex-col items-center gap-4 overflow-y-auto panel-face rounded-[2rem] bg-surface px-6 pt-6 pb-7">
          <ResultHero art={art} title={title} tone={tone} quality={quality} />

          {note ? (
            <p
              className="-mt-1 animate-rise text-center text-sm text-ink-muted"
              style={{ animationDelay: '0.3s' }}
            >
              {note}
            </p>
          ) : null}

          {rating ? <RatingChange rating={rating} quality={quality} /> : null}

          {game && (replayable || stats.length > 0) ? (
            <div
              className="flex w-full animate-rise items-center gap-3"
              style={{ animationDelay: '0.32s' }}
            >
              {replayable ? (
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <DecisiveReplay game={game} className="w-24" />
                  <span className="text-[0.6875rem] text-ink-faint">{t('decisiveMoments')}</span>
                </div>
              ) : null}
              {stats.length > 0 ? (
                <dl className="grid min-w-0 flex-1 grid-cols-1 gap-1.5">
                  {stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="flex items-baseline justify-between gap-2 rounded-xl border border-stroke-soft bg-sunken/40 px-3 py-1.5"
                    >
                      <dt className="text-xs text-ink-muted">{stat.label}</dt>
                      <dd className="tnum font-semibold">{stat.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          ) : null}

          {detail ? (
            <div className="w-full animate-rise" style={{ animationDelay: '0.34s' }}>
              {detail}
            </div>
          ) : null}

          {/* The rewards slot: whatever this result earned, given its own
              stage rather than tucked into the detail. */}
          {rewards ? (
            <div
              className="w-full animate-pop rounded-2xl border border-stroke bg-sunken/45 p-3"
              style={{ animationDelay: '0.42s' }}
            >
              {rewards}
            </div>
          ) : null}

          <div
            className="flex w-full animate-rise flex-col items-center gap-3 pt-1"
            style={{ animationDelay: '0.38s' }}
          >
            {actions}
            {onDismiss ? (
              <Button size="small" variant="ghost" block onClick={close}>
                {t('reviewBoard')}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The verdict, staged: a medallion holding the face or the winning mark with
 * rays turning behind it, and the title on a ribbon whose letters drop in one
 * after another. The ribbon takes its colours from the button and surface
 * token pairs, which every style already holds to AA contrast.
 */
function ResultHero({
  art,
  title,
  tone,
  quality,
}: {
  art: ReactNode;
  title: string;
  tone: 'win' | 'loss' | 'draw';
  quality: GraphicsQuality;
}) {
  const locale = useLocale();
  const ribbon =
    tone === 'win'
      ? { fill: 'var(--color-btn-primary)', ink: 'var(--color-on-btn-primary)' }
      : tone === 'loss'
        ? { fill: 'var(--color-sunken)', ink: 'var(--color-ink)' }
        : { fill: 'var(--color-btn-secondary)', ink: 'var(--color-on-btn-secondary)' };
  const rays =
    tone === 'win'
      ? 'var(--color-mark-o)'
      : tone === 'loss'
        ? 'var(--color-stroke-soft)'
        : 'var(--color-stroke)';
  // Letters drop in one by one on Balanced and High. A long title would take
  // too long that way, so it arrives whole - and so does a title in a joined
  // script, whose letters change shape when they are set apart.
  const spell = quality !== 'low' && title.length <= 22 && !JOINED_SCRIPTS.has(locale);

  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative flex size-32 items-center justify-center">
        <span
          aria-hidden="true"
          className="result-rays pointer-events-none absolute -inset-6 rounded-full"
          style={{ '--rays': rays } as CSSProperties}
        />
        <div
          className={cx(
            'relative flex size-28 animate-pop items-center justify-center rounded-full border-2 border-stroke',
            'bg-[radial-gradient(circle_at_35%_30%,var(--color-raised),var(--color-sunken))] text-[4.25rem] leading-none',
          )}
          style={{ animationDelay: '0.18s' }}
        >
          {/* A slow bob under the one-shot entrance, so the face stays alive
              while the panel waits for a decision. */}
          <span className="block animate-bob">{art}</span>
        </div>
      </div>

      <div
        className="result-ribbon relative -mt-3 animate-pop px-8 py-2"
        style={
          { '--ribbon': ribbon.fill, color: ribbon.ink, animationDelay: '0.24s' } as CSSProperties
        }
      >
        <h2 className="text-center font-display text-2xl leading-tight">
          {spell ? (
            <>
              <span className="sr-only">{title}</span>
              <span aria-hidden="true">
                {Array.from(title).map((letter, at) => (
                  <span
                    key={at}
                    className="result-letter"
                    style={{ animationDelay: `${0.3 + at * 0.035}s` }}
                  >
                    {letter === ' ' ? NBSP : letter}
                  </span>
                ))}
              </span>
            </>
          ) : (
            title
          )}
        </h2>
      </div>
    </div>
  );
}

const NBSP = String.fromCharCode(0xa0);
/** Languages written in a script whose letters join, which cannot be spelled out one by one. */
const JOINED_SCRIPTS: ReadonlySet<Locale> = new Set(['fa']);
const MINUS = String.fromCharCode(0x2212);

/** A rating change, counted from the old number to the new one. */
function RatingChange({
  rating,
  quality,
}: {
  rating: { before: number; after: number };
  quality: GraphicsQuality;
}) {
  const t = useT(gameResultMessages);
  const locale = useLocale();
  const shown = useCountUp(rating.before, rating.after, quality === 'low' ? 0 : 900, 450);
  const delta = rating.after - rating.before;
  const up = delta >= 0;
  return (
    <div
      className="flex w-full animate-rise items-center justify-between gap-3 rounded-2xl border border-stroke-soft bg-sunken/40 px-4 py-2.5"
      style={{ animationDelay: '0.3s' }}
    >
      <span className="text-xs text-ink-muted">{t('rating')}</span>
      <span className="flex items-baseline gap-2">
        <span
          className="tnum font-display text-2xl"
          aria-label={t('ratingValue', { value: ratingDigits(rating.after, locale) })}
        >
          {ratingDigits(shown, locale)}
        </span>
        <span
          className={cx(
            'tnum animate-badge-in rounded-full px-2 py-0.5 text-sm font-semibold',
            up ? 'bg-ok/15 text-ok' : 'bg-danger/15 text-danger',
          )}
          style={{ animationDelay: '0.5s' }}
          aria-label={t(up ? 'ratingUp' : 'ratingDown', { count: Math.abs(delta) })}
        >
          {up ? '+' : MINUS}
          {formatNumber(Math.abs(delta), locale)}
        </span>
      </span>
    </div>
  );
}

/** A rating in the locale's digits, ungrouped: 1216, not 1,216. */
function ratingDigits(value: number, locale: Locale): string {
  return value.toLocaleString(locale, { useGrouping: false });
}

/**
 * A number easing from `from` to `to` over `duration` ms, after `delay` ms.
 * A zero duration shows the final value at once - on Low graphics, say.
 */
function useCountUp(from: number, to: number, duration: number, delay: number): number {
  const instant = duration <= 0 || typeof requestAnimationFrame === 'undefined';
  const [value, setValue] = useState(from);
  useEffect(() => {
    if (instant) return;
    let frame = 0;
    const begin = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - begin) / duration));
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [from, to, duration, delay, instant]);
  return instant ? to : value;
}

/** The numbers worth a glance once a game is over. */
export function gameStats(
  game: GameState,
  durationMs: number | null,
  locale?: Locale,
): { label: string; value: string }[] {
  const say = (key: keyof (typeof gameResultMessages)['en'], values?: { size: number }) =>
    translate(gameResultMessages, key, values, locale);
  const stats = [{ label: say('statMoves'), value: formatNumber(game.moves.length, locale) }];
  if (durationMs !== null && durationMs > 0) {
    stats.push({ label: say('statTime'), value: formatDuration(durationMs) });
  }
  const { size } = game.config;
  stats.push({ label: say('statBoard'), value: say('boardSize', { size }) });
  return stats;
}

/** The face shown for a game played against the bot, or online. */
export function outcomeFace(outcome: 'win' | 'loss' | 'draw') {
  if (outcome === 'win') return <HappyFace />;
  if (outcome === 'loss') return <SadFace />;
  return <NeutralFace />;
}

/** The winner's mark, shown for two-human games. A draw has no mark. */
export function outcomeMark(winner: Player | null) {
  if (!winner) return <NeutralFace />;
  return (
    <Mark
      player={winner}
      hole="var(--color-surface)"
      className={cx('size-20', winner === X && 'p-0.5')}
    />
  );
}

/** Whether a finished game was a win, a loss, or a draw for `you`. */
export function outcomeFor(game: GameState, you: Player): 'win' | 'loss' | 'draw' {
  if (game.status !== 'won' || game.winner === null) return 'draw';
  return game.winner === you ? 'win' : 'loss';
}

/**
 * Plain words for how a match ended, from the point of view of the reader.
 * Under misère the completed line belongs to whoever lost.
 */
export function describeReason(
  reason: EndReason,
  outcome: 'win' | 'loss' | 'draw',
  misere = false,
  locale?: Locale,
): string {
  const say = (key: keyof (typeof gameResultMessages)['en']) =>
    translate(gameResultMessages, key, undefined, locale);
  const won = outcome === 'win';
  switch (reason) {
    case 'line':
      return say(won !== misere ? 'youCompletedLine' : 'opponentCompletedLine');
    case 'draw':
      return say('boardFilled');
    case 'agreed':
      return say('drawAgreed');
    case 'resign':
      return say(won ? 'opponentResigned' : 'youResigned');
    case 'timeout':
      return say(won ? 'opponentTimedOut' : 'youTimedOut');
    case 'abandoned':
      return say(won ? 'opponentLeft' : 'youLeft');
  }
}

/** The same, told about two other people: for spectators and shared replays. */
export function describeReasonFor(
  reason: EndReason,
  names: { winner: string; loser: string },
  misere = false,
  locale?: Locale,
): string {
  const say = (key: keyof (typeof gameResultMessages)['en'], name?: string) =>
    translate(gameResultMessages, key, name === undefined ? undefined : { name }, locale);
  switch (reason) {
    case 'line':
      return say('nameCompletedLine', misere ? names.loser : names.winner);
    case 'draw':
      return say('boardFilled');
    case 'agreed':
      return say('drawAgreed');
    case 'resign':
      return say('nameResigned', names.loser);
    case 'timeout':
      return say('nameTimedOut', names.loser);
    case 'abandoned':
      return say('nameLeft', names.loser);
  }
}
