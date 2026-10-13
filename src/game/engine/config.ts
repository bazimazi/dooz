import {
  type GameConfig,
  isBoardSize,
  isVariantId,
  MAX_WIN_LENGTH,
  MIN_WIN_LENGTH,
  OPENING_RULES,
} from './types.js';
import { rulesFor, swapMoveFor, variantFor } from './variants/index.js';

/**
 * Whether `config` describes a game the rules can actually run.
 *
 * The checks every rule set shares live here: a known variant, a board in
 * range, a run that fits on it, and options the variant actually supports.
 * Anything particular to one rule set - Ultimate's fixed geometry, Vanish's
 * 3x3 board - is the variant's own `validate`, so a new rule set brings its
 * constraints with it instead of adding a branch here.
 */
export function isGameConfig(value: unknown): value is GameConfig {
  if (typeof value !== 'object' || value === null) return false;
  const { variant, size, winLength, exact, opening, seed } = value as Partial<GameConfig>;

  if (!isVariantId(variant) || !isBoardSize(size)) return false;
  if (
    typeof winLength !== 'number' ||
    !Number.isInteger(winLength) ||
    winLength < MIN_WIN_LENGTH ||
    winLength > MAX_WIN_LENGTH ||
    winLength > size
  ) {
    return false;
  }

  const rules = variantFor(variant);
  const supports = rules.supports ?? {};

  if (exact !== undefined && (typeof exact !== 'boolean' || (exact && !supports.exact))) {
    return false;
  }
  if (opening !== undefined) {
    if (!(OPENING_RULES as readonly unknown[]).includes(opening)) return false;
    if (!supports.openings?.includes(opening)) return false;
    // The pro rule's distance only means something with room around the centre.
    if (opening === 'pro' && size < 7) return false;
  }
  if (seed !== undefined && (!supports.seeded || !isSeed(seed))) return false;

  return rules.validate(value as GameConfig);
}

function isSeed(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

/** Total cells on the board `config` describes. */
export function cellCount(config: GameConfig): number {
  return config.size * config.size;
}

/** One past the largest move code a game under `config` can record. */
export function moveSpace(config: GameConfig): number {
  return rulesFor(config).moveSpace?.(config) ?? cellCount(config);
}

/** The pie-rule swap's move code under `config`, or `null` if it has no swap. */
export function swapMove(config: GameConfig): number | null {
  return config.opening === 'swap' ? swapMoveFor(variantFor(config.variant), config) : null;
}

/**
 * A stable string for a config, used to key queues, ratings and statistics.
 *
 * Options are appended only when present, so every config that existed before
 * they did keeps the key its ratings and history are stored under. The seed is
 * left out: it varies game to game within one mode, like who opens.
 */
export function configKey(config: GameConfig): string {
  let key = `${config.variant}:${config.size}:${config.winLength}`;
  if (config.exact) key += ':exact';
  if (config.opening) key += `:${config.opening}`;
  return key;
}

/** Whether two configs are the same mode. Ignores the per-game seed, as {@link configKey} does. */
export function sameConfig(a: GameConfig, b: GameConfig): boolean {
  return (
    a.variant === b.variant &&
    a.size === b.size &&
    a.winLength === b.winLength &&
    Boolean(a.exact) === Boolean(b.exact) &&
    a.opening === b.opening
  );
}

/** Whether `config`'s rule set randomises its setup from `config.seed`. */
export function isSeeded(config: GameConfig): boolean {
  return variantFor(config.variant).supports?.seeded === true;
}

/**
 * `config` with a fresh seed, for starting a new game of a seeded rule set.
 * Configs that read no seed come back unchanged. A seeded variant reads an
 * absent seed as 0, so a mode's config is playable before it has one.
 */
export function withSeed(config: GameConfig, random: () => number = Math.random): GameConfig {
  if (!isSeeded(config)) return config;
  return { ...config, seed: Math.floor(random() * 0x1_0000_0000) >>> 0 };
}

/** The name a variant gives a custom game played under it. */
export function variantName(config: GameConfig): string {
  return variantFor(config.variant).name;
}
