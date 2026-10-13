import type { ArtStyle } from '@/lib/preferences';
import type { ParticleField, ParticleInit } from './particles';

/**
 * What each visual style throws when a mark lands and when a line is won.
 *
 * One recipe per style, so the effects agree with the board they are on:
 * a wooden board kicks up dust, a neon cabinet spits sparks, paper sheds
 * scraps, ink splashes, chalk leaves a cloud. All of them are drawn from the
 * same handful of particle shapes and differ only in numbers.
 */

/** Colours read from the live theme, so effects follow the style and the light/dark choice. */
export interface FxColours {
  mark: string;
  soft: string;
  accent: string;
  ink: string;
  board: string;
}

export interface Emitter {
  field: ParticleField;
  style: ArtStyle;
  colours: FxColours;
  /** The size of one board square in CSS pixels; effects scale with it. */
  cell: number;
  /** 1 on High, about half on Balanced. */
  density: number;
  /** Seconds every particle from this call waits before appearing. */
  delay?: number;
}

/** Spawn one particle, held back by the emitter's own delay. */
function emit(emitter: Emitter, init: ParticleInit): void {
  emitter.field.spawn({ ...init, delay: (init.delay ?? 0) + (emitter.delay ?? 0) });
}

/** A tiny deterministic generator, so tests and replays scatter the same way. */
export function scatter(seed: number): () => number {
  let state = (seed * 2654435761) >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 10_000) / 10_000;
  };
}

function radial(
  emitter: Emitter,
  count: number,
  random: () => number,
  build: (angle: number, speed: number, random: () => number) => ParticleInit,
  speed: [number, number],
): void {
  const total = Math.max(1, Math.round(count * emitter.density));
  for (let index = 0; index < total; index++) {
    const angle = (index / total) * Math.PI * 2 + random() * 0.6;
    const scale = emitter.cell / 64;
    const velocity = (speed[0] + random() * (speed[1] - speed[0])) * scale;
    const init = build(angle, velocity, random);
    emit(emitter, init);
  }
}

/** The landing of one mark at `(x, y)`. */
export function impact(emitter: Emitter, x: number, y: number, seed: number): void {
  const { colours, cell, style } = emitter;
  const random = scatter(seed);
  const unit = Math.max(1, cell / 32);
  const along = (angle: number, speed: number) => ({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  });

  switch (style) {
    case 'tabletop':
      // Dust puffing out from under a stone set down on wood, and a couple
      // of chips of light kicked up by it.
      radial(
        emitter,
        9,
        random,
        (angle, speed) => ({
          ...along(angle, speed),
          shape: 'puff',
          life: 0.7 + random() * 0.3,
          size: unit * (1.6 + random()),
          grow: 2.6,
          drag: 0.05,
          alpha: 0.32,
          colour: colours.ink,
        }),
        [60, 120],
      );
      radial(
        emitter,
        4,
        random,
        (angle, speed) => ({
          ...along(angle, speed),
          vy: Math.sin(angle) * speed - 60 * unit,
          shape: 'chip',
          life: 0.5,
          size: unit * 0.9,
          gravity: 520 * unit,
          spin: 12,
          colour: colours.soft,
        }),
        [80, 150],
      );
      return;
    case 'neon':
      radial(
        emitter,
        14,
        random,
        (angle, speed) => ({
          ...along(angle, speed),
          shape: 'streak',
          life: 0.32 + random() * 0.18,
          size: unit * 1.1,
          drag: 0.02,
          glow: true,
          colour: random() > 0.3 ? colours.mark : colours.accent,
        }),
        [260, 460],
      );
      emit(emitter, {
        x,
        y,
        shape: 'ring',
        life: 0.35,
        size: cell * 0.18,
        grow: 2.8,
        glow: true,
        alpha: 0.8,
        colour: colours.soft,
      });
      return;
    case 'paper':
      radial(
        emitter,
        9,
        random,
        (angle, speed) => ({
          ...along(angle, speed),
          vy: Math.sin(angle) * speed - 90 * unit,
          shape: 'chip',
          life: 0.8 + random() * 0.3,
          size: unit * (1.2 + random() * 0.8),
          gravity: 300 * unit,
          drag: 0.3,
          spin: (random() - 0.5) * 18,
          rotation: random() * 6,
          colour: random() > 0.5 ? colours.mark : colours.soft,
        }),
        [90, 170],
      );
      return;
    case 'ink':
      radial(
        emitter,
        8,
        random,
        (angle, speed) => ({
          ...along(angle, speed),
          shape: 'splat',
          life: 0.55 + random() * 0.25,
          size: unit * (0.8 + random() * 1.4),
          grow: 0.4,
          drag: 0.001,
          alpha: 0.85,
          colour: colours.mark,
        }),
        [70, 190],
      );
      emit(emitter, {
        x,
        y,
        shape: 'ring',
        life: 0.6,
        size: cell * 0.22,
        grow: 2.2,
        alpha: 0.45,
        colour: colours.mark,
      });
      return;
    case 'chalkboard':
      radial(
        emitter,
        16,
        random,
        (angle, speed) => ({
          ...along(angle, speed),
          shape: 'dot',
          life: 0.9 + random() * 0.5,
          size: unit * (0.35 + random() * 0.45),
          gravity: 40 * unit,
          drag: 0.08,
          alpha: 0.75,
          colour: colours.ink,
        }),
        [30, 110],
      );
      radial(
        emitter,
        3,
        random,
        (angle, speed) => ({
          ...along(angle, speed),
          shape: 'puff',
          life: 0.9,
          size: unit * 2.5,
          grow: 2,
          drag: 0.05,
          alpha: 0.12,
          colour: colours.ink,
        }),
        [15, 35],
      );
      return;
    case 'pastel':
    default:
      radial(
        emitter,
        9,
        random,
        (angle, speed) => ({
          ...along(angle, speed),
          shape: 'star',
          life: 0.5 + random() * 0.2,
          size: unit * (1.3 + random()),
          grow: 0.3,
          drag: 0.03,
          spin: (random() - 0.5) * 8,
          colour: random() > 0.4 ? colours.soft : colours.mark,
        }),
        [120, 230],
      );
      return;
  }
}

/**
 * The celebration when a line is won: every square of the run goes off in
 * turn, from one end to the other, then the middle of the line bursts.
 * `cells` are square centres in canvas pixels, in the run's own order.
 */
export function winBurst(
  emitter: Emitter,
  cells: readonly { x: number; y: number }[],
  seed: number,
  /** Seconds before the first square goes off, so the burst follows the line. */
  start = 0,
): void {
  const random = scatter(seed);
  const { colours, cell } = emitter;
  const unit = Math.max(1, cell / 32);
  cells.forEach((point, order) => {
    const delay = start + order * 0.07;
    const count = Math.round(7 * emitter.density);
    for (let index = 0; index < count; index++) {
      const angle = random() * Math.PI * 2;
      const speed = (60 + random() * 140) * unit;
      emit(emitter, {
        x: point.x,
        y: point.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        delay,
        shape: emitter.style === 'neon' ? 'streak' : emitter.style === 'paper' ? 'chip' : 'star',
        life: 0.6 + random() * 0.3,
        size: unit * (1.2 + random()),
        grow: emitter.style === 'paper' ? 1 : 0.35,
        gravity: emitter.style === 'paper' ? 260 * unit : 0,
        drag: 0.05,
        spin: (random() - 0.5) * 10,
        glow: emitter.style === 'neon' || emitter.style === 'pastel',
        colour: random() > 0.35 ? colours.soft : colours.mark,
      });
    }
  });

  const first = cells[0];
  const last = cells.at(-1);
  if (!first || !last) return;
  const middle = { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 };
  const finale = start + cells.length * 0.07 + 0.05;
  emit(emitter, {
    ...middle,
    delay: finale,
    shape: 'ring',
    life: 0.7,
    size: cell * 0.4,
    grow: 5,
    alpha: 0.7,
    glow: emitter.style !== 'ink' && emitter.style !== 'paper',
    colour: colours.soft,
  });
  const count = Math.round(26 * emitter.density);
  for (let index = 0; index < count; index++) {
    const angle = (index / count) * Math.PI * 2 + random() * 0.3;
    const speed = (180 + random() * 260) * unit;
    emit(emitter, {
      ...middle,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      delay: finale,
      shape: emitter.style === 'chalkboard' ? 'dot' : emitter.style === 'ink' ? 'splat' : 'streak',
      life: 0.55 + random() * 0.35,
      size: unit * (1 + random() * 0.8),
      drag: 0.04,
      gravity: 90 * unit,
      glow: emitter.style === 'neon' || emitter.style === 'pastel',
      colour: random() > 0.5 ? colours.mark : colours.accent,
    });
  }
}

/** Sparks shed by the head of the win trace as it runs along the line. */
export function traceSparks(emitter: Emitter, x: number, y: number, seed: number): void {
  const random = scatter(seed);
  const unit = Math.max(1, emitter.cell / 32);
  for (let index = 0; index < 2; index++) {
    const angle = random() * Math.PI * 2;
    const speed = (30 + random() * 70) * unit;
    emit(emitter, {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      shape: 'dot',
      life: 0.35 + random() * 0.2,
      size: unit * (0.6 + random() * 0.6),
      drag: 0.1,
      glow: emitter.style !== 'ink' && emitter.style !== 'paper',
      colour: emitter.colours.soft,
    });
  }
}
