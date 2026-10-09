import type { VariantId } from '../types.js';
import { classicVariant, gomokuVariant, gravityVariant, misereVariant } from './line.js';
import { ultimateVariant } from './ultimate.js';
import type { Variant } from './variant.js';
import { vanishVariant } from './vanish.js';

/**
 * The variant registry.
 *
 * Every entry point into the rules goes through this map, so the rest of the
 * codebase never branches on a variant id: adding one means adding a row here
 * and a mode in `modes.ts`, and nothing in the server, the client or the AI
 * needs to know it happened.
 */
const VARIANTS: Record<VariantId, Variant> = {
  classic: classicVariant,
  gomoku: gomokuVariant,
  misere: misereVariant,
  gravity: gravityVariant,
  vanish: vanishVariant,
  ultimate: ultimateVariant,
};

export function variantFor(id: VariantId): Variant {
  return VARIANTS[id];
}

export { type Variant } from './variant.js';
export { TRIPLES } from './ultimate.js';
export { VANISH_KEEP, VANISH_MOVE_LIMIT, vanishedBy, vanishingNext } from './vanish.js';
