import type { GameConfig, VariantId } from '../types.js';
import {
  classicVariant,
  connect4Variant,
  gomokuVariant,
  gravityVariant,
  misereVariant,
  obstaclesVariant,
} from './line.js';
import { orderChaosVariant, wildVariant } from './marks.js';
import { withOpening } from './opening.js';
import { penteVariant } from './pente.js';
import { powersVariant } from './powers.js';
import { quantumVariant } from './quantum.js';
import { qubicVariant } from './qubic.js';
import { ultimateVariant } from './ultimate.js';
import type { Variant } from './variant.js';
import { vanishVariant } from './vanish.js';

/**
 * The variant registry.
 *
 * Every entry point into the rules goes through this map, so the server and
 * the transport never branch on a variant id: adding a rule set means adding
 * its id to `VARIANT_IDS`, a row here and a mode in `modes.ts`. Validation,
 * naming and the move-code range all come from the variant itself. The AI,
 * the board renderer and the hints still have per-variant code, because how a
 * rule set is played well and drawn is genuinely different per rule set.
 */
const VARIANTS: Record<VariantId, Variant> = {
  classic: classicVariant,
  gomoku: gomokuVariant,
  misere: misereVariant,
  gravity: gravityVariant,
  vanish: vanishVariant,
  ultimate: ultimateVariant,
  pente: penteVariant,
  qubic: qubicVariant,
  quantum: quantumVariant,
  connect4: connect4Variant,
  wild: wildVariant,
  'order-chaos': orderChaosVariant,
  obstacles: obstaclesVariant,
  powers: powersVariant,
};

export function variantFor(id: VariantId): Variant {
  return VARIANTS[id];
}

const WITH_OPENING = new Map<string, Variant>();

/**
 * The rules a game under `config` is played by: its variant, wrapped in the
 * config's opening rule if it has one.
 */
export function rulesFor(config: GameConfig): Variant {
  const base = VARIANTS[config.variant];
  if (!config.opening) return base;
  const key = `${config.variant}:${config.opening}`;
  let wrapped = WITH_OPENING.get(key);
  if (!wrapped) {
    wrapped = withOpening(base, config.opening);
    WITH_OPENING.set(key, wrapped);
  }
  return wrapped;
}

export { type Variant } from './variant.js';
export { centreOf, PRO_DISTANCE, swapMoveFor } from './opening.js';
export { TRIPLES } from './ultimate.js';
export { VANISH_KEEP, VANISH_MOVE_LIMIT, vanishedBy, vanishingNext } from './vanish.js';
export { CONNECT4_SIZE } from './line.js';
export { CHAOS, choosesMark, decodeMarkMove, MARK_CHOICES, markMove, ORDER } from './marks.js';
export { obstacleCells, obstacleCount } from './obstacles.js';
export {
  decodePowerMove,
  POWER_CHARGES,
  POWER_KINDS,
  type PowerKind,
  powerCharges,
  powerMove,
} from './powers.js';
export {
  capturedBy,
  captureSlot,
  PENTE_CAPTURES_TO_WIN,
  penteCaptures,
  penteCapturesAt,
} from './pente.js';
export {
  QUBIC_BOARD_SIZE,
  QUBIC_EDGE,
  QUBIC_LINES,
  QUBIC_LINES_THROUGH,
  qubicCoords,
  qubicIndex,
  qubicLineFrom,
} from './qubic.js';
export {
  decodeQuantumMove,
  encodeQuantumMove,
  QUANTUM_MOVE_SPACE,
  QUANTUM_NOTHING,
  type QuantumMove,
  quantumOf,
  quantumOptions,
} from './quantum.js';
