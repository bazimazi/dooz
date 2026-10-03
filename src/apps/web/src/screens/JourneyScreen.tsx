import { modeById } from '@dooz/engine';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { AvatarBadge } from '@/components/art/avatars';
import { BackIcon } from '@/components/art/icons';
import { LockIcon } from '@/components/art/ui-icons';
import { MiniBoard } from '@/components/game/MiniBoard';
import { StarIcon, Stars } from '@/components/game/Stars';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import {
  isUnlocked,
  MAX_STARS,
  nextStage,
  RIVALS,
  type Stage,
  STAGES,
} from '@/features/journey/stages';
import { DIFFICULTY_LABELS } from '@/features/bot/labels';
import { totalStars, useProgressStore } from '@/features/progress/store';
import { cx } from '@/lib/cx';
import { useClosing } from '@/lib/useClosing';
import { useDialog } from '@/lib/useDialog';

/**
 * The journey map: six rivals, three stages each, top to bottom.
 *
 * Drawn as a path rather than a grid - a dashed line running down the left,
 * a node per stage on it - because the order is the point. A player should be
 * able to see where they are, what they beat to get there, and who is next.
 */
export function JourneyScreen() {
  const earned = useProgressStore((state) => state.journey);
  const [open, setOpen] = useState<Stage | null>(null);
  const stars = totalStars(earned);
  const upNext = nextStage(earned);

  return (
    <Screen scroll>
      <header className="flex w-full items-center gap-3 pt-2 pb-3">
        <IconButton as={Link} to="/" tone="bare" size="small" label="Back to home">
          <BackIcon />
        </IconButton>
        <h1 className="font-display text-xl">Journey</h1>
        <span className="tnum ml-auto flex items-center gap-1.5 text-sm text-ink-muted">
          <StarIcon lit className="size-4" />
          {stars} / {MAX_STARS}
        </span>
      </header>

      <div className="flex w-full flex-col gap-4 pb-6">
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-sunken"
          role="progressbar"
          aria-label="Stars earned"
          aria-valuemin={0}
          aria-valuemax={MAX_STARS}
          aria-valuenow={stars}
        >
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-soft"
            style={{
              width: `${(stars / MAX_STARS) * 100}%`,
              background: 'linear-gradient(90deg, var(--color-mark-o-edge), var(--color-mark-o))',
            }}
          />
        </div>

        <Card className="w-full animate-rise">
          <div className="flex items-center gap-3">
            <AvatarBadge
              avatar={upNext.rival.avatar}
              ring="var(--color-sunken)"
              className="size-14"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-xs tracking-wide text-ink-faint uppercase">Up next</span>
              <span className="truncate font-display text-lg">
                {upNext.rival.name} · {modeById(upNext.mode).name}
              </span>
              <span className="text-xs text-ink-faint">
                Stage {STAGES.indexOf(upNext) + 1} of {STAGES.length}
              </span>
            </div>
            {/* A fixed-width wrapper, because the pill button stretches to
                whatever it is given and would squeeze the name beside it. */}
            <div className="w-24 shrink-0">
              <Button variant="primary" size="small" block onClick={() => setOpen(upNext)}>
                Play
              </Button>
            </div>
          </div>
        </Card>

        <ol className="stagger flex flex-col gap-5">
          {RIVALS.map((rival) => {
            const stages = STAGES.filter((stage) => stage.rival.id === rival.id);
            const reached = isUnlocked(stages[0]!, earned);
            return (
              <li key={rival.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-3 px-1">
                  <AvatarBadge
                    avatar={rival.avatar}
                    ring="var(--color-canvas)"
                    className={cx('size-11', !reached && 'opacity-55')}
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="font-semibold">
                      {rival.name}{' '}
                      <span className="text-xs font-normal text-ink-faint">
                        · {DIFFICULTY_LABELS[rival.difficulty]}
                      </span>
                    </span>
                    <span className="truncate text-xs text-ink-faint italic">
                      {reached ? `“${rival.greeting}”` : 'Clear the stage before to meet them.'}
                    </span>
                  </div>
                </div>

                <ol className="relative ml-[1.6rem] flex flex-col gap-2 border-l-2 border-dashed border-stroke-soft pl-5">
                  {stages.map((stage) => (
                    <StageRow
                      key={stage.id}
                      stage={stage}
                      stars={earned[stage.id] ?? 0}
                      unlocked={isUnlocked(stage, earned)}
                      next={stage === upNext}
                      onOpen={() => setOpen(stage)}
                    />
                  ))}
                </ol>
              </li>
            );
          })}
        </ol>
      </div>

      {open ? (
        <StageSheet stage={open} stars={earned[open.id] ?? 0} onClose={() => setOpen(null)} />
      ) : null}
    </Screen>
  );
}

function StageRow({
  stage,
  stars,
  unlocked,
  next,
  onOpen,
}: {
  stage: Stage;
  stars: number;
  unlocked: boolean;
  next: boolean;
  onOpen: () => void;
}) {
  const mode = modeById(stage.mode);
  const number = STAGES.indexOf(stage) + 1;

  return (
    <li className="relative">
      {/* The node on the path, lit once the stage has a star. */}
      <span
        aria-hidden="true"
        className={cx(
          'absolute top-1/2 -left-[1.95rem] size-3.5 -translate-y-1/2 rounded-full border-2',
          stars > 0
            ? 'border-mark-o-edge bg-mark-o'
            : next
              ? 'animate-glow-ring border-stroke bg-surface'
              : 'border-stroke-soft bg-canvas',
        )}
      />
      <button
        type="button"
        onClick={onOpen}
        disabled={!unlocked}
        aria-label={`Stage ${number}: ${mode.name} against ${stage.rival.name}, ${stars} of 3 stars${unlocked ? '' : ', locked'}`}
        className={cx(
          'flex w-full items-center gap-3 rounded-2xl border p-2 text-left',
          'transition-[transform,border-color,background-color] duration-200 ease-spring',
          'hover:-translate-y-0.5 active:scale-[0.98]',
          'disabled:pointer-events-none',
          next ? 'border-stroke bg-surface' : 'border-stroke-soft bg-surface/70',
        )}
      >
        <span className="relative w-11 shrink-0">
          <MiniBoard config={mode.config} className="w-11" />
          {!unlocked ? (
            <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-surface/70 text-ink-muted">
              <LockIcon />
            </span>
          ) : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold">
            {number}. {mode.name}
          </span>
          <span className="truncate text-xs text-ink-faint">{mode.tagline}</span>
        </span>
        <Stars earned={stars} className="shrink-0 text-lg" />
      </button>
    </li>
  );
}

function StageSheet({
  stage,
  stars,
  onClose,
}: {
  stage: Stage;
  stars: number;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { closing, close } = useClosing(onClose);
  const panelRef = useDialog<HTMLDivElement>(close);
  const mode = modeById(stage.mode);
  const number = STAGES.indexOf(stage) + 1;

  return (
    <div
      className={cx(
        'fixed inset-0 z-50 flex items-center justify-center bg-scrim p-5 backdrop-blur-[2px]',
        closing ? 'animate-fade-out' : 'animate-fade-in',
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Stage ${number}: ${mode.name}`}
        tabIndex={-1}
        className={cx(
          'w-full max-w-80 panel-shell rounded-[2rem] border border-stroke p-2 outline-none',
          'shadow-[0_30px_70px_-30px_var(--color-shadow)]',
          closing ? 'animate-panel-out' : 'animate-panel-in',
        )}
      >
        <div className="flex flex-col items-center gap-3 panel-face rounded-[1.5rem] bg-surface px-5 py-6 text-center">
          <span className="animate-pop" style={{ animationDelay: '0.12s' }}>
            <span className="block animate-bob">
              <AvatarBadge
                avatar={stage.rival.avatar}
                ring="var(--color-sunken)"
                className="size-20"
              />
            </span>
          </span>
          <p className="text-sm text-ink-muted italic">“{stage.rival.greeting}”</p>

          <div className="flex w-full items-center gap-3 rounded-tile border border-stroke-soft px-3 py-2.5 text-left">
            <MiniBoard config={mode.config} active className="w-14 shrink-0" />
            <div className="flex min-w-0 flex-col">
              <span className="text-xs tracking-wide text-ink-faint uppercase">Stage {number}</span>
              <span className="font-display text-lg leading-tight">{mode.name}</span>
              <span className="text-xs text-ink-faint">
                vs {stage.rival.name} · {DIFFICULTY_LABELS[stage.rival.difficulty]} · you move first
              </span>
            </div>
          </div>

          <p className="text-sm text-ink-muted">{stage.tip}</p>

          <dl className="grid w-full grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-left text-xs">
            <dt>
              <Stars earned={3} className="text-sm" />
            </dt>
            <dd className="text-ink-muted">Win in {stage.par[1]} moves or fewer</dd>
            <dt>
              <Stars earned={2} className="text-sm" />
            </dt>
            <dd className="text-ink-muted">Win in {stage.par[0]} moves or fewer</dd>
            <dt>
              <Stars earned={1} className="text-sm" />
            </dt>
            <dd className="text-ink-muted">Win</dd>
          </dl>

          {stars > 0 ? (
            <p className="flex items-center gap-2 text-xs text-ink-faint">
              Best so far <Stars earned={stars} className="text-sm" />
            </p>
          ) : null}

          <Button
            variant="primary"
            size="small"
            block
            onClick={() =>
              void navigate({
                replace: true,
                to: '/play/bot',
                search: { mode: stage.mode, difficulty: stage.rival.difficulty, stage: stage.id },
              })
            }
          >
            {stars > 0 ? 'Play again' : 'Play'}
          </Button>
          <Button variant="ghost" size="small" onClick={close} className="self-center">
            Back
          </Button>
        </div>
      </div>
    </div>
  );
}
