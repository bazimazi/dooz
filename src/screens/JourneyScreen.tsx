import { ReturnLink } from '@/components/ui/ReturnLink';
import { modeById } from '@/game/engine';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { AvatarBadge } from '@/components/art/avatars';
import { BackIcon } from '@/components/art/icons';
import { LockIcon, SparkIcon, TrophyIcon } from '@/components/art/ui-icons';
import { MiniBoard } from '@/game/components/MiniBoard';
import { StarIcon, Stars } from '@/game/components/Stars';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import {
  chapterOf,
  isUnlocked,
  MAX_STARS,
  nextStage,
  type Rival,
  RIVALS,
  type Stage,
  stageDifficulty,
  STAGES,
} from '@/features/journey/stages';
import { useDifficultyLabels } from '@/game/bot/labels';
import { type Translator, useT } from '@/i18n';
import { journeyMessages, useJourneyText } from '@/i18n/messages/journey';
import { useModeTexts } from '@/i18n/messages/modes';
import { totalStars, useProgressStore } from '@/features/progress/store';
import { cx } from '@/lib/cx';
import { useClosing } from '@/lib/useClosing';
import { useDialog } from '@/lib/useDialog';

/**
 * The journey map: six chapters, one per rival, top to bottom.
 *
 * Drawn as a path rather than a grid - a dashed line running down the left,
 * a node per stage on it - because the order is the point. A player should be
 * able to see where they are, what they beat to get there, and who is next.
 * The chapter in play is open; the others fold to a header with their stars,
 * so forty-odd stages read as six steps rather than one long list.
 */
export function JourneyScreen() {
  const earned = useProgressStore((state) => state.journey);
  const [open, setOpen] = useState<Stage | null>(null);
  const stars = totalStars(earned);
  const upNext = nextStage(earned);
  // Chapters the player has opened or closed by hand; the rest follow `upNext`.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const t = useT(journeyMessages);
  const text = useJourneyText();
  const modeText = useModeTexts();

  return (
    <Screen scroll>
      <header className="flex w-full items-center gap-3 pt-2 pb-3">
        <IconButton as={ReturnLink} to="/" tone="bare" size="small" label={t('backHome')}>
          <BackIcon />
        </IconButton>
        <h1 className="font-display text-xl">{t('title')}</h1>
        <span className="tnum ms-auto flex items-center gap-1.5 text-sm text-ink-muted">
          <StarIcon lit className="size-4" />
          {t('starsCount', { stars, max: MAX_STARS })}
        </span>
      </header>

      <div className="flex w-full flex-col gap-4 pb-6">
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-sunken"
          role="progressbar"
          aria-label={t('starsEarned')}
          aria-valuemin={0}
          aria-valuemax={MAX_STARS}
          aria-valuenow={stars}
        >
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-soft rtl:-scale-x-100"
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
              <span className="text-xs tracking-wide text-ink-faint uppercase">
                {upNext.boss ? t('bossStage') : t('upNext')}
              </span>
              <span className="font-display text-lg leading-tight">
                {t('upNextTitle', { rival: upNext.rival.name, mode: modeText(upNext.mode).name })}
              </span>
              <span className="text-xs text-ink-faint">
                {t('stageOf', {
                  number: STAGES.indexOf(upNext) + 1,
                  total: STAGES.length,
                  chapter: text.rival(upNext.rival).chapter.title,
                })}
              </span>
            </div>
            {/* A fixed-width wrapper, because the pill button stretches to
                whatever it is given and would squeeze the name beside it. */}
            <div className="w-24 shrink-0">
              <Button variant="primary" size="small" block onClick={() => setOpen(upNext)}>
                {t('play')}
              </Button>
            </div>
          </div>
        </Card>

        <ol className="stagger flex flex-col gap-4">
          {RIVALS.map((rival, chapter) => {
            const stages = chapterOf(rival.id);
            const expanded = toggled[rival.id] ?? upNext.rival.id === rival.id;
            return (
              <Chapter
                key={rival.id}
                rival={rival}
                number={chapter + 1}
                stages={stages}
                earned={earned}
                upNext={upNext}
                expanded={expanded}
                onToggle={() => setToggled((state) => ({ ...state, [rival.id]: !expanded }))}
                onOpen={setOpen}
              />
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

function Chapter({
  rival,
  number,
  stages,
  earned,
  upNext,
  expanded,
  onToggle,
  onOpen,
}: {
  rival: Rival;
  number: number;
  stages: readonly Stage[];
  earned: Record<string, number>;
  upNext: Stage;
  expanded: boolean;
  onToggle: () => void;
  onOpen: (stage: Stage) => void;
}) {
  const reached = isUnlocked(stages[0]!, earned);
  const won = stages.reduce((sum, stage) => sum + (earned[stage.id] ?? 0), 0);
  const listId = `chapter-${rival.id}`;
  const boss = stages.at(-1);
  const cleared = boss !== undefined && (earned[boss.id] ?? 0) > 0;
  const t = useT(journeyMessages);
  const levels = useDifficultyLabels();
  const text = useJourneyText().rival(rival);

  return (
    <li className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={listId}
        className={cx(
          'flex w-full items-center gap-3 rounded-2xl px-1 py-1 text-start',
          'transition-[background-color] duration-200 hover:bg-surface/50',
        )}
      >
        <AvatarBadge
          avatar={rival.avatar}
          ring="var(--color-canvas)"
          className={cx('size-11 shrink-0', !reached && 'opacity-55')}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs tracking-wide text-ink-faint uppercase">
            {t('chapterHeading', { number, chapter: text.chapter.title })}
          </span>
          <span className="font-semibold">
            {rival.name}{' '}
            <span className="text-xs font-normal text-ink-faint">
              · {levels.label(rival.difficulty)}
            </span>
          </span>
          <span className="truncate text-xs text-ink-faint italic">
            {reached ? t('quoted', { text: text.greeting }) : t('notMet')}
          </span>
        </span>
        <span className="tnum flex shrink-0 flex-col items-end gap-0.5 text-xs text-ink-muted">
          <span className="flex items-center gap-1">
            <StarIcon lit={won > 0} className="size-3.5" />
            {t('chapterStars', { stars: won, max: stages.length * 3 })}
          </span>
          {cleared ? (
            <span className="flex items-center gap-1 text-ok">
              <TrophyIcon className="size-3.5" /> {t('cleared')}
            </span>
          ) : null}
        </span>
        <span
          aria-hidden="true"
          className={cx(
            'shrink-0 text-ink-faint transition-transform duration-200',
            // The chevron mirrors in right-to-left text, so it turns the other way to point down.
            expanded ? 'rotate-90 rtl:-rotate-90' : 'rotate-0',
          )}
        >
          ›
        </span>
      </button>

      {expanded ? (
        <div id={listId} className="flex flex-col gap-2">
          {reached ? (
            <p className="mx-1 flex items-start gap-2 rounded-tile border border-stroke-soft bg-surface/60 px-3 py-2 text-xs text-ink-muted">
              <SparkIcon className="mt-0.5 size-3.5 shrink-0 text-warn" />
              <span>
                <strong className="text-ink">
                  {t('signature', { name: text.signature.name })}
                </strong>{' '}
                {text.signature.description}
              </span>
            </p>
          ) : null}
          <ol className="relative ms-[1.6rem] flex flex-col gap-2 border-s-2 border-dashed border-stroke-soft ps-5">
            {stages.map((stage) => (
              <StageRow
                key={stage.id}
                stage={stage}
                stars={earned[stage.id] ?? 0}
                unlocked={isUnlocked(stage, earned)}
                next={stage === upNext}
                onOpen={() => onOpen(stage)}
              />
            ))}
          </ol>
        </div>
      ) : null}
    </li>
  );
}

/** Short tags for what makes a stage different from a plain game. */
function modifiers(stage: Stage, t: Translator<typeof journeyMessages.en>): string[] {
  const tags: string[] = [];
  if (stage.boss) tags.push(t('tagBoss'));
  if (stage.opener !== 1) tags.push(t('tagOpens', { rival: stage.rival.name }));
  if (stage.setup) tags.push(t('tagHeadStart'));
  if (stage.objective === 'fork') tags.push(t('tagFork'));
  if (stage.objective === 'no-hints') tags.push(t('tagNoHints'));
  if (stage.objective === 'flawless') tags.push(t('tagFlawless'));
  return tags;
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
  const modeText = useModeTexts()(stage.mode);
  const number = STAGES.indexOf(stage) + 1;
  const t = useT(journeyMessages);
  const tags = modifiers(stage, t);
  const label = t(unlocked ? 'rowLabel' : 'rowLabelLocked', {
    stage: t(stage.boss ? 'stageNumberBoss' : 'stageNumber', { number }),
    mode: modeText.name,
    rival: stage.rival.name,
    stars,
    max: 3,
  });

  return (
    <li className="relative">
      {/* The node on the path, lit once the stage has a star. */}
      <span
        aria-hidden="true"
        className={cx(
          'absolute top-1/2 -translate-y-1/2 rounded-full border-2',
          // A boss's node is a size up, and shifted to stay centred on the path.
          stage.boss ? 'size-4.5 -start-[2.1rem]' : 'size-3.5 -start-[1.95rem]',
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
        aria-label={label}
        className={cx(
          'flex w-full items-center gap-3 rounded-2xl border p-2 text-start',
          'transition-[transform,border-color,background-color] duration-200 ease-spring',
          'hover:-translate-y-0.5 active:scale-[0.98]',
          'disabled:pointer-events-none',
          next ? 'border-stroke bg-surface' : 'border-stroke-soft bg-surface/70',
          stage.boss && 'border-warn/50',
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
            {t('rowTitle', { number, mode: modeText.name })}
          </span>
          <span className="truncate text-xs text-ink-faint">
            {tags.length > 0 ? tags.join(' · ') : modeText.tagline}
          </span>
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
  const difficulty = stageDifficulty(stage);
  const t = useT(journeyMessages);
  const levels = useDifficultyLabels();
  const journeyText = useJourneyText();
  const text = journeyText.stage(stage);
  const modeName = useModeTexts()(stage.mode).name;

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
        aria-label={t('sheetLabel', { number, mode: modeName })}
        tabIndex={-1}
        className={cx(
          'max-h-full w-full max-w-80 overflow-y-auto panel-shell rounded-[2rem] border border-stroke p-2 outline-none',
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
          <p className="text-sm text-ink-muted italic">
            {t('quoted', { text: text.intro ?? journeyText.rival(stage.rival).greeting })}
          </p>

          <div className="flex w-full items-center gap-3 rounded-tile border border-stroke-soft px-3 py-2.5 text-start">
            <MiniBoard config={mode.config} active className="w-14 shrink-0" />
            <div className="flex min-w-0 flex-col">
              <span className="text-xs tracking-wide text-ink-faint uppercase">
                {t(stage.boss ? 'sheetBoss' : 'stageNumber', { number })}
              </span>
              <span className="font-display text-lg leading-tight">{modeName}</span>
              <span className="text-xs text-ink-faint">
                {t('versus', {
                  rival: stage.rival.name,
                  level: levels.label(difficulty),
                  opener:
                    stage.opener === 1
                      ? t('youFirst')
                      : t('rivalFirst', { rival: stage.rival.name }),
                })}
              </span>
            </div>
          </div>

          {text.twist ? (
            <p className="flex items-start gap-2 rounded-tile bg-warn/10 px-3 py-2 text-start text-sm text-ink">
              <SparkIcon className="mt-0.5 size-4 shrink-0 text-warn" />
              <span>{text.twist}</span>
            </p>
          ) : null}
          {stage.setup ? <p className="text-xs text-ink-faint">{t('setupNote')}</p> : null}

          <p className="text-sm text-ink-muted">{text.tip}</p>

          <dl className="grid w-full grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-start text-xs">
            <dt>
              <Stars earned={3} className="text-sm" />
            </dt>
            <dd className="text-ink-muted">{journeyText.objective(stage)}</dd>
            <dt>
              <Stars earned={2} className="text-sm" />
            </dt>
            <dd className="text-ink-muted">{t('objective.par', { count: stage.par[0] })}</dd>
            <dt>
              <Stars earned={1} className="text-sm" />
            </dt>
            <dd className="text-ink-muted">{t('win')}</dd>
          </dl>

          {stars > 0 ? (
            <p className="flex items-center gap-2 text-xs text-ink-faint">
              {t('bestSoFar')} <Stars earned={stars} className="text-sm" />
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
                search: { mode: stage.mode, difficulty, stage: stage.id },
              })
            }
          >
            {stars > 0 ? t('playAgain') : stage.boss ? t('faceBoss') : t('play')}
          </Button>
          <Button variant="ghost" size="small" onClick={close} className="self-center">
            {t('back')}
          </Button>
        </div>
      </div>
    </div>
  );
}
