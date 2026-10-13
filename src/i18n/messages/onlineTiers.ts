import { defineMessages, type Locale, translate, useLocale } from '@/i18n';
import { type Placement, TIER_IDS, type TierId } from '@/protocol/tiers';

/**
 * Ladder tier names, keyed by tier id. The protocol names tiers in English for
 * the server's logs; what a player reads comes from here.
 */
export const tierMessages = defineMessages({
  en: {
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
    diamond: 'Diamond',
    master: 'Master',
    /** A tier and its division: "Gold II". */
    division: '{tier} {division}',
  },
  es: {
    division: '{tier} {division}',
    bronze: 'Bronce',
    silver: 'Plata',
    gold: 'Oro',
    platinum: 'Platino',
    diamond: 'Diamante',
    master: 'Maestro',
  },
  fr: {
    division: '{tier} {division}',
    bronze: 'Bronze',
    silver: 'Argent',
    gold: 'Or',
    platinum: 'Platine',
    diamond: 'Diamant',
    master: 'Maître',
  },
  de: {
    division: '{tier} {division}',
    bronze: 'Bronze',
    silver: 'Silber',
    gold: 'Gold',
    platinum: 'Platin',
    diamond: 'Diamant',
    master: 'Meister',
  },
  fa: {
    division: '{tier} {division}',
    bronze: 'برنز',
    silver: 'نقره',
    gold: 'طلا',
    platinum: 'پلاتین',
    diamond: 'الماس',
    master: 'استاد',
  },
});

const ROMAN = { 1: 'I', 2: 'II', 3: 'III' } as const;

/** A tier's name in the interface language. */
export function tierName(tier: TierId, locale?: Locale): string {
  return translate(tierMessages, tier, undefined, locale);
}

/**
 * A placement as a player reads it: "Gold II", "Master". Divisions stay in
 * Roman numerals in every language, as ladders conventionally write them.
 */
export function placementLabel(placement: Placement, locale?: Locale): string {
  const tier = tierName(placement.tier, locale);
  if (placement.division === null) return tier;
  return translate(tierMessages, 'division', { tier, division: ROMAN[placement.division] }, locale);
}

/**
 * A label the server sent with its tier id ("Gold II" for `gold`), in the
 * interface language. The wire keeps English; an id this client does not know
 * keeps the server's text.
 */
export function wireTierLabel(tier: string, label: string, locale?: Locale): string {
  if (!(TIER_IDS as readonly string[]).includes(tier)) return label;
  const name = tierName(tier as TierId, locale);
  const division = /\s(I{1,3})$/.exec(label)?.[1];
  return division ? translate(tierMessages, 'division', { tier: name, division }, locale) : name;
}

/** {@link placementLabel} and {@link wireTierLabel}, re-rendering when the language changes. */
export function useTierLabels(): {
  placement: (placement: Placement) => string;
  wire: (tier: string, label: string) => string;
} {
  const locale = useLocale();
  return {
    placement: (placement) => placementLabel(placement, locale),
    wire: (tier, label) => wireTierLabel(tier, label, locale),
  };
}
