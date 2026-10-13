import { O, X } from '@/game/engine';
import { type ReactNode, useEffect, useState } from 'react';
import { Mark } from '@/components/art/marks';
import { LockIcon } from '@/components/art/ui-icons';
import { Card } from '@/components/ui/Card';
import { ReturnLink } from '@/components/ui/ReturnLink';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useAccountStore } from '@/features/account/store';
import { LevelStrip, PageHeader } from '@/features/arcade/ui';
import { CosmeticArt } from '@/features/collection/art';
import {
  type Cosmetic,
  COSMETIC_KIND_NAMES,
  type CosmeticKind,
  cosmeticsOf,
  equippedCosmetic,
} from '@/features/progress/cosmetics';
import { useProgressStore } from '@/features/progress/store';
import { isSkinUnlocked, SKIN_UNLOCKS } from '@/features/progress/unlocks';
import { formatNumber, useLocale, useT } from '@/i18n';
import { collectionMessages } from '@/i18n/messages/collection';
import { cx } from '@/lib/cx';
import { loadPreferences, savePreferences, subscribePreferences } from '@/lib/preferences';
import { sfx } from '@/lib/sound';

const KINDS: readonly CosmeticKind[] = ['effect', 'frame', 'title', 'emote'];

/**
 * Everything collectable, in one place: piece sets, win effects, avatar
 * frames, titles and victory lines.
 *
 * Locked items are shown, with what earns them and how far along you are -
 * a reward nobody knows exists is not a goal. Nothing here can be bought.
 */
export function CollectionScreen() {
  const progress = useProgressStore();
  const avatar = useAccountStore((state) => state.profile?.avatar ?? 'fox');
  const [preferences, setPreferences] = useState(loadPreferences);
  const [explained, setExplained] = useState<string | null>(null);
  const t = useT(collectionMessages);
  const locale = useLocale();

  // Settings can change the piece set from elsewhere while this is open.
  useEffect(() => subscribePreferences(setPreferences), []);

  const owned =
    SKIN_UNLOCKS.filter((unlock) => isSkinUnlocked(unlock.skin, progress)).length +
    KINDS.reduce(
      (sum, kind) => sum + cosmeticsOf(kind).filter((entry) => entry.unlocked(progress)).length,
      0,
    );
  const total =
    SKIN_UNLOCKS.length + KINDS.reduce((sum, kind) => sum + cosmeticsOf(kind).length, 0);

  return (
    <Screen width="wide" scroll>
      <PageHeader
        title={t('title')}
        back="/profile"
        trailing={
          <span className="tnum text-sm text-ink-muted">
            {formatNumber(owned, locale)}/{formatNumber(total, locale)}
          </span>
        }
      />
      <div className="flex w-full flex-col gap-4 pb-6">
        <LevelStrip />

        <Section title={t('pieces')}>
          {SKIN_UNLOCKS.map((unlock) => {
            const open = isSkinUnlocked(unlock.skin, progress);
            return (
              <Item
                key={unlock.skin}
                id={`skin:${unlock.skin}`}
                name={unlock.name}
                open={open}
                selected={preferences.skin === unlock.skin}
                requirement={unlock.requirement}
                progress={
                  unlock.need > 0
                    ? [Math.min(unlock.have(progress), unlock.need), unlock.need]
                    : null
                }
                explained={explained}
                onExplain={setExplained}
                onEquip={() => {
                  savePreferences({ skin: unlock.skin });
                  sfx.toggle(true);
                }}
                art={
                  <span className="flex items-center gap-0.5">
                    <Mark player={X} skin={unlock.skin} className="size-6" />
                    <Mark player={O} skin={unlock.skin} className="size-6" />
                  </span>
                }
              />
            );
          })}
        </Section>

        {KINDS.map((kind) => {
          const current = equippedCosmetic(kind, preferences.cosmetics, progress);
          return (
            <Section key={kind} title={COSMETIC_KIND_NAMES[kind]}>
              {cosmeticsOf(kind).map((cosmetic: Cosmetic) => (
                <Item
                  key={cosmetic.id}
                  id={`${kind}:${cosmetic.id}`}
                  name={
                    cosmetic.kind === 'emote' ? t('quoted', { text: cosmetic.line }) : cosmetic.name
                  }
                  open={cosmetic.unlocked(progress)}
                  selected={current.id === cosmetic.id}
                  requirement={cosmetic.requirement}
                  progress={cosmetic.progress?.(progress) ?? null}
                  explained={explained}
                  onExplain={setExplained}
                  onEquip={() => equip(kind, cosmetic.id)}
                  art={<CosmeticArt cosmetic={cosmetic} avatar={avatar} className="size-9" />}
                />
              ))}
            </Section>
          );
        })}

        <p className="px-1 text-xs text-ink-faint">{t('footer')}</p>
        <Button as={ReturnLink} to="/profile" variant="ghost" size="small" block>
          {t('profile')}
        </Button>
      </div>
    </Screen>
  );
}

function equip(kind: CosmeticKind, id: string) {
  savePreferences({ cosmetics: { ...loadPreferences().cosmetics, [kind]: id } });
  sfx.toggle(true);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="w-full" padding="tight">
      <h2 className="px-2 py-1 text-xs tracking-wide text-ink-faint uppercase">{title}</h2>
      <div
        role="radiogroup"
        aria-label={title}
        className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-4"
      >
        {children}
      </div>
    </Card>
  );
}

function Item({
  id,
  name,
  open,
  selected,
  requirement,
  progress,
  explained,
  onExplain,
  onEquip,
  art,
}: {
  id: string;
  name: string;
  open: boolean;
  selected: boolean;
  requirement: string;
  progress: readonly [number, number] | null;
  explained: string | null;
  onExplain: (id: string | null) => void;
  onEquip: () => void;
  art: ReactNode;
}) {
  const t = useT(collectionMessages);
  const locale = useLocale();
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={open ? name : t('locked', { name, requirement })}
      onClick={() => {
        if (open) {
          onEquip();
          onExplain(null);
        } else {
          onExplain(explained === id ? null : id);
          sfx.invalid();
        }
      }}
      className={cx(
        'relative flex min-w-0 flex-col items-center gap-1.5 rounded-tile border px-2 pt-3 pb-2 text-center',
        'transition-[transform,border-color,background-color] duration-200 ease-spring',
        'hover:-translate-y-0.5 active:scale-95',
        selected ? 'border-stroke bg-sunken' : 'border-stroke-soft bg-surface/60',
      )}
    >
      <span className={cx('flex h-9 items-center', !open && 'opacity-35 grayscale')}>{art}</span>
      <span className="w-full truncate text-xs font-semibold">{name}</span>
      {!open ? (
        <>
          <span className="absolute end-1.5 top-1.5 text-xs text-ink-faint">
            <LockIcon />
          </span>
          {explained === id || progress ? (
            <span className="text-[0.6875rem] leading-snug text-ink-muted">
              {explained === id ? requirement : null}
              {progress ? (
                <span className="tnum block text-ink-faint">
                  {formatNumber(progress[0], locale)}/{formatNumber(progress[1], locale)}
                </span>
              ) : null}
            </span>
          ) : null}
        </>
      ) : selected ? (
        <span className="text-[0.6875rem] text-ok">{t('equipped')}</span>
      ) : null}
    </button>
  );
}
