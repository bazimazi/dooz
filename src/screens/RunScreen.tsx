import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AvatarBadge } from '@/components/art/avatars';
import { Button } from '@/components/ui/Button';
import { Card, StatTile } from '@/components/ui/Card';
import { ReturnLink } from '@/components/ui/ReturnLink';
import { Screen } from '@/components/ui/Screen';
import { GameResetDialog } from '@/game/components/GameResetDialog';
import { outcomeFace } from '@/game/components/ResultModal';
import { useDifficultyLabels } from '@/game/bot/labels';
import { ArcadeMatch, type MatchResult, type MatchSpec } from '@/features/arcade/ArcadeMatch';
import { Chip, Hearts, PageHeader } from '@/features/arcade/ui';
import { RewardsPanel } from '@/features/progress/RewardsPanel';
import { type Award, useProgressStore } from '@/features/progress/store';
import {
  encounterFor,
  generateMap,
  type MapNode,
  type NodeKind,
  nodeById,
  reachable,
  relicOffer,
  type RunMap,
} from '@/features/run/map';
import { runEndXp, runFightXp, runMatchSpec } from '@/features/run/match';
import { RELICS, type RelicId } from '@/features/run/relics';
import {
  afterFight,
  currentNodeId,
  enterNode,
  floorReached,
  rest,
  type RunData,
  skip,
  takeRelic,
  useRunStore,
} from '@/features/run/store';
import { formatNumber, useLocale, useT } from '@/i18n';
import { useModeTexts } from '@/i18n/messages/modes';
import { runMessages } from '@/i18n/messages/run';
import { cx } from '@/lib/cx';

/**
 * Run mode: a chain of matches across a branching map.
 *
 * The screen is a view of the run store, which holds only decisions; the map
 * and every encounter are rebuilt from the run's seed. A fight's spec is
 * frozen when it starts, so recording its result - which moves the run on -
 * cannot swap the board out from under the result panel.
 */
export function RunScreen() {
  const run = useRunStore((state) => state.run);
  const update = useRunStore((state) => state.update);
  const veteran = useProgressStore((state) => state.run.won > 0);
  const records = useProgressStore((state) => state.run);
  const recordArcadeGame = useProgressStore((state) => state.recordArcadeGame);
  const recordRunElite = useProgressStore((state) => state.recordRunElite);
  const recordRunEnd = useProgressStore((state) => state.recordRunEnd);
  const [fight, setFight] = useState<{ spec: MatchSpec; node: MapNode } | null>(null);
  const [lastFight, setLastFight] = useState<{
    award: Award;
    counted: MatchResult['outcome'];
    run: RunData;
  } | null>(null);
  const [ending, setEnding] = useState<{ run: RunData; award: Award } | null>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const map = useMemo(() => (run ? generateMap(run.seed) : null), [run]);
  const t = useT(runMessages);
  const locale = useLocale();

  const endRun = useCallback(
    (finished: RunData, won: boolean) => {
      const floor = floorReached(finished);
      const award = recordRunEnd({
        won,
        floor,
        flawless: finished.heartsLost === 0,
        lines: runEndXp(won, floor, finished.heartsLost === 0),
      });
      setEnding({ run: finished, award });
    },
    [recordRunEnd],
  );

  const finish = useCallback(
    (result: MatchResult) => {
      const current = useRunStore.getState().run;
      if (!fight || !current) return;
      const { run: next, counted, elite } = afterFight(current, result.outcome);
      const award = recordArcadeGame({
        mode: encounterFor(current.seed, fight.node).mode,
        outcome: counted,
        lines: runFightXp(fight.node, fight.spec.difficulty, counted),
      });
      if (elite) recordRunElite();
      update(next);
      setLastFight({ award, counted, run: next });
      if (next.phase === 'won' || next.phase === 'lost') endRun(next, next.phase === 'won');
    },
    [fight, recordArcadeGame, recordRunElite, update, endRun],
  );

  if (fight && lastFight === null && run?.phase !== 'fight') {
    // A fight left behind by a run that moved on without it.
    setFight(null);
  }

  if (fight) {
    const boss = fight.node.kind === 'boss';
    return (
      <ArcadeMatch
        key={fight.spec.storageKey}
        spec={fight.spec}
        onFinish={finish}
        status={run ? <RunStatus run={run} /> : null}
        footer={run && run.relics.length > 0 ? <RelicRow relics={run.relics} /> : null}
        leave={
          <Button
            size="small"
            variant="ghost"
            className="w-auto px-4"
            onClick={() => setFight(null)}
          >
            {t('map')}
          </Button>
        }
        result={(result) => {
          const after = lastFight?.run;
          const over = after?.phase === 'won' || after?.phase === 'lost';
          const counted = lastFight?.counted ?? result.outcome;
          return {
            title:
              after?.phase === 'won'
                ? t('runComplete')
                : after?.phase === 'lost'
                  ? t('runOver')
                  : counted === 'win'
                    ? boss
                      ? t('bossDefeated')
                      : t('victory')
                    : counted === 'draw'
                      ? t('aDraw')
                      : t('heartLost'),
            art: outcomeFace(counted),
            note:
              result.outcome === 'draw' && counted === 'win'
                ? t('ironWill')
                : after?.phase === 'relic'
                  ? t('eliteDrops')
                  : boss && after?.phase === 'fight'
                    ? t('bossStanding')
                    : undefined,
            rewards: lastFight ? (
              <RewardsPanel award={lastFight.award} won={counted === 'win'} />
            ) : null,
            actions: (
              <Button
                variant="primary"
                size="small"
                block
                onClick={() => {
                  setLastFight(null);
                  if (!over && after?.phase === 'fight' && after) {
                    // The boss again, as a fresh board.
                    const node = nodeById(generateMap(after.seed), currentNodeId(after)!)!;
                    setFight({ spec: runMatchSpec(after, node), node });
                  } else setFight(null);
                }}
              >
                {over ? t('seeSummary') : after?.phase === 'fight' ? t('rematch') : t('continue')}
              </Button>
            ),
          };
        }}
      />
    );
  }

  const startFight = (state: RunData) => {
    if (!map) return;
    const at = currentNodeId(state);
    const node = at ? nodeById(map, at) : undefined;
    if (node) setFight({ spec: runMatchSpec(state, node), node });
  };

  return (
    <Screen scroll>
      <PageHeader
        title={t('title')}
        back="/arcade"
        trailing={
          run && run.phase !== 'won' && run.phase !== 'lost' ? (
            <Button
              size="small"
              variant="ghost"
              className="w-auto px-3"
              onClick={() => setConfirmAbandon(true)}
            >
              {t('abandon')}
            </Button>
          ) : null
        }
      />
      <div className="flex w-full flex-col gap-4 pb-6">
        {ending ? (
          <RunSummary
            ending={ending}
            onNew={() => {
              setEnding(null);
              useRunStore.getState().start(useProgressStore.getState().run.won > 0);
            }}
          />
        ) : !run || run.phase === 'won' || run.phase === 'lost' ? (
          <Card className="w-full">
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink-muted">{t('intro')}</p>
              {veteran ? (
                <p className="text-xs text-ok">{t('veteran')}</p>
              ) : (
                <p className="text-xs text-ink-faint">{t('notVeteran')}</p>
              )}
              <Button variant="primary" block onClick={() => useRunStore.getState().start(veteran)}>
                {t('start')}
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <RunStatus run={run} />
            {run.relics.length > 0 ? <RelicRow relics={run.relics} /> : null}
            {run.phase === 'start-relic' || run.phase === 'relic' ? (
              <RelicChoice
                title={run.phase === 'start-relic' ? t('chooseStartingRelic') : t('chooseRelic')}
                offer={relicOffer(run.seed, currentNodeId(run) ?? 'start', run.relics)}
                onTake={(relic) => update(takeRelic(run, relic))}
                onSkip={() => update(skip(run))}
              />
            ) : run.phase === 'rest' ? (
              <Card className="w-full">
                <p className="font-display text-lg">{t('camp')}</p>
                <p className="mt-1 text-sm text-ink-muted">{t('campText')}</p>
                <div className="mt-4 flex flex-col gap-2">
                  <Button
                    variant="primary"
                    block
                    disabled={run.hearts >= run.maxHearts}
                    onClick={() => update(rest(run))}
                  >
                    {run.hearts >= run.maxHearts ? t('fullHearts') : t('rest')}
                  </Button>
                  <Button variant="ghost" size="small" block onClick={() => update(skip(run))}>
                    {t('moveOn')}
                  </Button>
                </div>
              </Card>
            ) : run.phase === 'fight' ? (
              <Card className="w-full">
                <FightPreview run={run} map={map!} />
                <Button variant="primary" block className="mt-4" onClick={() => startFight(run)}>
                  {hasSavedFight(run) ? t('backToFight') : t('fight')}
                </Button>
              </Card>
            ) : null}
            {map ? (
              <RunMapView
                map={map}
                run={run}
                onEnter={(id) => {
                  const next = enterNode(run, id);
                  update(next);
                  if (next.phase === 'fight') startFight(next);
                }}
              />
            ) : null}
          </>
        )}

        <div className="grid grid-cols-3 gap-2">
          <StatTile label={t('runs')} value={formatNumber(records.runs, locale)} />
          <StatTile label={t('won')} value={formatNumber(records.won, locale)} />
          <StatTile label={t('bestFloor')} value={formatNumber(records.bestFloor, locale)} />
        </div>
        <Button as={ReturnLink} to="/arcade" variant="ghost" size="small" block>
          {t('arcade')}
        </Button>
      </div>

      {confirmAbandon && run ? (
        <GameResetDialog
          title={t('abandonTitle')}
          description={t('abandonText')}
          actionLabel={t('abandonAction')}
          onCancel={() => setConfirmAbandon(false)}
          onConfirm={() => {
            setConfirmAbandon(false);
            endRun({ ...run, phase: 'lost' }, false);
            useRunStore.getState().abandon();
          }}
        />
      ) : null}
    </Screen>
  );
}

function hasSavedFight(run: RunData): boolean {
  try {
    const at = currentNodeId(run);
    return localStorage.getItem(`dooz.game:run:${run.seed}:${at}:${run.attempt}`) !== null;
  } catch {
    return false;
  }
}

function RunStatus({ run }: { run: RunData }) {
  const t = useT(runMessages);
  return (
    <div className="flex items-center justify-between gap-3 text-xs text-ink-muted">
      <Hearts count={run.hearts} max={run.maxHearts} />
      <span className="tnum">
        {t('status', { floor: Math.max(1, floorReached(run)), won: run.fightsWon })}
      </span>
    </div>
  );
}

function RelicRow({ relics }: { relics: readonly RelicId[] }) {
  const t = useT(runMessages);
  return (
    <ul className="flex flex-wrap justify-center gap-1.5" aria-label={t('relics')}>
      {relics.map((id) => (
        <li key={id}>
          <Chip title={RELICS[id].description}>
            <span aria-hidden="true" className="font-semibold text-ink">
              {RELICS[id].glyph}
            </span>
            {RELICS[id].name}
          </Chip>
        </li>
      ))}
    </ul>
  );
}

function RelicChoice({
  title,
  offer,
  onTake,
  onSkip,
}: {
  title: string;
  offer: readonly RelicId[];
  onTake: (relic: RelicId) => void;
  onSkip: () => void;
}) {
  const t = useT(runMessages);
  return (
    <Card className="w-full">
      <h2 className="font-display text-lg">{title}</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {offer.map((id) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => onTake(id)}
              className="flex w-full items-center gap-3 rounded-tile border border-stroke-soft bg-surface/80 px-3 py-2.5 text-start transition-[border-color,transform] duration-200 ease-spring hover:-translate-y-0.5 hover:border-stroke"
            >
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken font-display text-lg"
              >
                {RELICS[id].glyph}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold">{RELICS[id].name}</span>
                <span className="text-xs text-ink-muted">{RELICS[id].description}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Button variant="ghost" size="small" block className="mt-2" onClick={onSkip}>
        {t('skip')}
      </Button>
    </Card>
  );
}

function FightPreview({ run, map }: { run: RunData; map: RunMap }) {
  const at = currentNodeId(run);
  const node = at ? nodeById(map, at) : undefined;
  if (!node) return null;
  const encounter = encounterFor(run.seed, node);
  return <FightPreviewView node={node} encounter={encounter} />;
}

function FightPreviewView({
  node,
  encounter,
}: {
  node: MapNode;
  encounter: ReturnType<typeof encounterFor>;
}) {
  const t = useT(runMessages);
  const labels = useDifficultyLabels();
  const modeText = useModeTexts();
  return (
    <div className="flex items-center gap-3">
      {encounter.rival ? (
        <AvatarBadge
          avatar={encounter.rival.avatar}
          ring="var(--color-sunken)"
          className="size-14 shrink-0"
        />
      ) : null}
      <div className="flex min-w-0 flex-col">
        <span className="text-xs text-ink-faint">{t(`kind.${node.kind}`)}</span>
        <span className="truncate font-display text-xl">
          {encounter.rival?.name ?? labels.bot(encounter.difficulty)}
        </span>
        <span className="text-sm text-ink-muted">
          {modeText(encounter.mode).name}
          {encounter.timed ? ` · ${t('timed')}` : ''}
        </span>
      </div>
    </div>
  );
}

/** Row height of the map, in rem. */
const ROW = 4.25;

/**
 * The map, boss at the top, drawn as rows of nodes with the paths between them.
 * Only the next steps are buttons; the rest is there to plan by.
 */
function RunMapView({
  map,
  run,
  onEnter,
}: {
  map: RunMap;
  run: RunData;
  onEnter: (id: string) => void;
}) {
  const options = new Set(
    run.phase === 'map' ? reachable(map, currentNodeId(run)).map((node) => node.id) : [],
  );
  const visited = new Set(run.path);
  const rows = map.floors.length;
  const t = useT(runMessages);
  const labels = useDifficultyLabels();
  const modeText = useModeTexts();
  const ref = useRef<HTMLDivElement>(null);
  const position = (node: MapNode) => ({
    x: ((node.index + 0.5) / (map.floors[node.floor]?.length ?? 1)) * 100,
    y: (rows - 1 - node.floor + 0.5) * ROW,
  });

  // Bring the next choice into view on a long map, whenever it changes.
  const nextChoices = [...options].join(' ');
  useEffect(() => {
    if (!nextChoices) return;
    ref.current
      ?.querySelector<HTMLElement>('[data-next="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [nextChoices]);

  return (
    <Card className="w-full" padding="tight">
      <h2 className="px-2 py-1 text-xs tracking-wide text-ink-faint uppercase">{t('map')}</h2>
      <div
        ref={ref}
        className="relative mx-auto w-full max-w-80"
        style={{ height: `${rows * ROW}rem` }}
      >
        <svg
          aria-hidden="true"
          className="absolute inset-0 size-full overflow-visible"
          viewBox={`0 0 100 ${rows * ROW * 16}`}
          preserveAspectRatio="none"
        >
          {map.floors.flatMap((floor) =>
            floor.flatMap((node) =>
              node.next.map((index) => {
                const target = map.floors[node.floor + 1]?.[index];
                if (!target) return null;
                const from = position(node);
                const to = position(target);
                const walked = visited.has(node.id) && visited.has(target.id);
                return (
                  <line
                    key={`${node.id}>${target.id}`}
                    x1={from.x}
                    y1={from.y * 16}
                    x2={to.x}
                    y2={to.y * 16}
                    stroke={walked ? 'var(--color-ok)' : 'var(--color-stroke-soft)'}
                    strokeWidth={walked ? 3 : 2}
                    strokeDasharray={walked ? undefined : '4 4'}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              }),
            ),
          )}
        </svg>
        {map.floors.flatMap((floor) =>
          floor.map((node) => {
            const { x, y } = position(node);
            const open = options.has(node.id);
            const here = currentNodeId(run) === node.id;
            const encounter =
              node.kind === 'rest' || node.kind === 'relic' ? null : encounterFor(run.seed, node);
            const label = [
              t('nodeLabel', { floor: node.floor + 1, kind: t(`kind.${node.kind}`) }),
              ...(encounter
                ? [labels.bot(encounter.difficulty), modeText(encounter.mode).name]
                : []),
              ...(visited.has(node.id) ? [t('visited')] : []),
            ].join(t('listSeparator'));
            return (
              <button
                key={node.id}
                type="button"
                data-next={open}
                disabled={!open}
                aria-label={label}
                title={label}
                onClick={() => onEnter(node.id)}
                className={cx(
                  'absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 font-display',
                  node.kind === 'boss' ? 'size-14 text-sm' : 'size-11 text-xs',
                  open
                    ? 'animate-pulse-soft border-ok bg-surface text-ink shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-ok)_25%,transparent)]'
                    : here
                      ? 'border-ok bg-ok/20 text-ink'
                      : visited.has(node.id)
                        ? 'border-stroke-soft bg-sunken text-ink-faint'
                        : 'border-stroke-soft bg-surface/70 text-ink-muted',
                )}
                style={{ left: `${x}%`, top: `${y}rem` }}
              >
                <NodeGlyph kind={node.kind} />
              </button>
            );
          }),
        )}
      </div>
    </Card>
  );
}

function NodeGlyph({ kind }: { kind: NodeKind }) {
  switch (kind) {
    case 'battle':
      return <span aria-hidden="true">vs</span>;
    case 'elite':
      return <span aria-hidden="true">E</span>;
    case 'rest':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
          <path
            d="M4 18h16M7 18l5-11 5 11"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'relic':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
          <path
            d="M12 3l7 7-7 11-7-11Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'boss':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6">
          <path d="M4 18h16l-1-10-4 4-3-6-3 6-4-4Z" fill="currentColor" />
        </svg>
      );
  }
}

function RunSummary({
  ending,
  onNew,
}: {
  ending: { run: RunData; award: Award };
  onNew: () => void;
}) {
  const won = ending.run.phase === 'won';
  const t = useT(runMessages);
  return (
    <Card className="w-full">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-xs tracking-wide text-ink-faint uppercase">
          {won ? t('runCompleteHeading') : t('runOverHeading')}
        </p>
        <p className="font-display text-3xl">
          {won ? t('bossFalls') : t('floor', { floor: Math.max(1, floorReached(ending.run)) })}
        </p>
        <div className="grid w-full grid-cols-3 gap-2 pt-2">
          <StatTile label={t('won')} value={ending.run.fightsWon} />
          <StatTile label={t('elites')} value={ending.run.elites} />
          <StatTile label={t('relics')} value={ending.run.relics.length} />
        </div>
        {ending.award.xp > 0 ? <RewardsPanel award={ending.award} won={won} /> : null}
        <Button variant="primary" block className="mt-2" onClick={onNew}>
          {t('newRun')}
        </Button>
      </div>
    </Card>
  );
}
