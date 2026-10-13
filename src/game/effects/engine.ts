import type { EffectsBudget } from '@/lib/graphics';
import type { ArtStyle } from '@/lib/preferences';
import { ParticleField } from './particles';
import { type Emitter, type FxColours, impact, traceSparks, winBurst } from './recipes';

/**
 * The board's effects layer: one canvas over the squares, one animation loop.
 *
 * The loop runs only while something is moving - a burst in flight, the win
 * trace, a shake - and stops itself the frame after the last particle dies, so
 * an idle board costs nothing at all. Every effect is fire-and-forget: the
 * React side reports what happened ("a mark landed here", "this line won")
 * and the engine plays it out on its own clock.
 */

interface Point {
  x: number;
  y: number;
}

/** The glowing head that runs along a winning line. */
interface Trace {
  from: Point;
  to: Point;
  /** Seconds into the trace; negative while it waits for its cue. */
  time: number;
  duration: number;
  /** The emitter the trace sheds its sparks through, colours already read. */
  emitter: Emitter;
}

export class EffectsEngine {
  private context: CanvasRenderingContext2D | null;
  private field = new ParticleField(0);
  private frame = 0;
  private last = 0;
  private width = 0;
  private height = 0;
  private ratio = 1;
  private budget: EffectsBudget | null = null;
  private style: ArtStyle = 'pastel';
  private dark = true;
  private seed = 1;

  /** Slow motion: time runs at `timeScale`, easing back to 1 by `slowUntil`. */
  private slow = { scale: 1, left: 0, total: 0 };
  private shake = { amplitude: 0, left: 0, total: 0, phase: 0 };
  private vignette = { at: { x: 0, y: 0 }, left: 0, total: 0, wait: 0 };
  private traces: Trace[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly shakeTarget: () => HTMLElement | null,
  ) {
    this.context = canvas.getContext('2d');
  }

  configure(budget: EffectsBudget, style: ArtStyle): void {
    this.budget = budget;
    this.style = style;
    this.field.setCapacity(budget.particles);
    this.resize();
  }

  /** Match the backing store to the element, capped at the budget's pixel ratio. */
  resize(): void {
    const box = this.canvas.getBoundingClientRect();
    const ceiling = this.budget?.pixelRatio ?? 1;
    this.ratio = Math.min(ceiling, globalThis.devicePixelRatio || 1);
    this.width = box.width;
    this.height = box.height;
    this.canvas.width = Math.max(1, Math.round(box.width * this.ratio));
    this.canvas.height = Math.max(1, Math.round(box.height * this.ratio));
  }

  /**
   * Rows cropped off the top of the drawn board. Connect Four is a 7x7 board
   * whose top row is blocked and never shown, so its squares are laid out over
   * six visible rows, not seven.
   */
  hiddenRows = 0;

  /** Centre of square `index` on a `size` board, in CSS pixels. */
  centre(index: number, size: number): Point {
    const rows = Math.max(1, size - this.hiddenRows);
    return {
      x: ((index % size) + 0.5) * (this.width / size),
      y: (Math.floor(index / size) - this.hiddenRows + 0.5) * (this.height / rows),
    };
  }

  /** A mark landed on square `index`, `delay` seconds from now. */
  land(index: number, size: number, player: 'x' | 'o', delay: number): void {
    if (!this.budget || this.budget.particles === 0) return;
    const at = this.centre(index, size);
    impact(this.emitter(player, size, delay), at.x, at.y, this.seed++);
    this.start();
  }

  /**
   * A line won. `line` is the run in order; `landing` is when the final mark
   * touches down. The trace starts with the SVG line's own sweep (0.1s after
   * landing, 0.45s long) so the two read as one stroke.
   */
  win(line: readonly number[], size: number, player: 'x' | 'o', landing: number): void {
    const budget = this.budget;
    if (!budget || budget.particles === 0 || line.length === 0) return;
    const points = line.map((index) => this.centre(index, size));
    const emitter = this.emitter(player, size, 0);
    const traceStart = landing + 0.1;
    const traceLength = 0.45;

    if (budget.bloom) {
      this.traces.push({
        from: points[0]!,
        to: points.at(-1)!,
        time: -traceStart,
        duration: traceLength,
        emitter,
      });
    }
    winBurst(emitter, points, this.seed++, traceStart + traceLength * 0.5);

    // The beat the whole game was for: time slows as the last mark lands and
    // the room darkens around it, then the board takes the hit.
    if (budget.slowMotion > 0) {
      this.slow = { scale: 0.3, left: budget.slowMotion / 1000, total: budget.slowMotion / 1000 };
      const last = this.centre(line.at(-1)!, size);
      this.vignette = { at: last, left: 1.3, total: 1.3, wait: landing };
    }
    if (budget.shake > 0) {
      this.shake = {
        amplitude: budget.shake,
        left: 0.42,
        total: 0.42,
        phase: landing + traceLength * 0.6,
      };
    }
    this.start();
  }

  /** A small knock, for a callout landing. */
  bump(): void {
    if (!this.budget || this.budget.shake === 0 || this.shake.left > 0) return;
    const amplitude = Math.min(2, this.budget.shake * 0.4);
    this.shake = { amplitude, left: 0.2, total: 0.2, phase: 0.05 };
    this.start();
  }

  /** Drop everything in flight: a take-back, a new game, a hidden page. */
  clear(): void {
    this.field.clear();
    this.traces = [];
    this.slow = { scale: 1, left: 0, total: 0 };
    this.vignette.left = 0;
    this.shake.left = 0;
    this.applyShake(0, 0);
    this.stop();
    this.context?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  destroy(): void {
    this.clear();
  }

  private emitter(player: 'x' | 'o', size: number, delay: number): Emitter {
    const colours = this.colours(player);
    return {
      field: this.field,
      style: this.style,
      colours,
      cell: this.width / size,
      density: this.budget?.bloom ? 1 : 0.5,
      delay,
    };
  }

  /** The live theme's colours for `player`, read at the moment they are needed. */
  private colours(player: 'x' | 'o'): FxColours {
    const css = getComputedStyle(this.canvas);
    const read = (name: string, fallback: string) =>
      normalise(this.context, css.getPropertyValue(name).trim() || fallback);
    const board = read('--color-board', '#191685');
    this.dark = luminance(board) < 0.35;
    this.field.additive = this.dark;
    return {
      mark: read(`--color-mark-${player}`, '#f3339e'),
      soft: read(`--color-mark-${player}-soft`, '#ff99f6'),
      accent: read('--color-accent', '#5570fd'),
      ink: read('--color-ink', '#ffffff'),
      board,
    };
  }

  private start(): void {
    if (this.frame || !this.context) return;
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  private stop(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private tick = (now: number) => {
    this.frame = 0;
    const context = this.context;
    if (!context) return;
    // A long gap - a dropped tab, a debugger - is treated as one frame, so
    // nothing teleports.
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;

    if (this.slow.left > 0) {
      this.slow.left = Math.max(0, this.slow.left - dt);
      const progress = 1 - this.slow.left / this.slow.total;
      this.slow.scale = 0.3 + 0.7 * progress * progress;
    } else this.slow.scale = 1;

    this.field.step(dt * this.slow.scale);
    this.stepShake(dt);

    context.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    context.clearRect(0, 0, this.width, this.height);
    this.drawVignette(context, dt);
    this.drawTraces(context, dt);
    this.field.draw(context);

    const busy =
      this.field.alive > 0 ||
      this.traces.length > 0 ||
      this.shake.left > 0 ||
      this.vignette.left > 0;
    if (busy) this.frame = requestAnimationFrame(this.tick);
    else context.clearRect(0, 0, this.width, this.height);
  };

  private stepShake(dt: number): void {
    const shake = this.shake;
    if (shake.left <= 0) return;
    if (shake.phase > 0) {
      shake.phase -= dt;
      return;
    }
    shake.left = Math.max(0, shake.left - dt);
    const t = 1 - shake.left / shake.total;
    const decay = (1 - t) ** 2;
    const wobble = t * 46;
    this.applyShake(
      Math.sin(wobble) * shake.amplitude * decay,
      Math.cos(wobble * 1.3) * shake.amplitude * 0.6 * decay,
    );
    if (shake.left === 0) this.applyShake(0, 0);
  }

  /**
   * Shaken through `translate`, not `transform`: the frame's own settle and
   * shake animations own its transform, and the two compose this way rather
   * than fighting over one property.
   */
  private applyShake(x: number, y: number): void {
    const target = this.shakeTarget();
    if (!target) return;
    target.style.translate = x === 0 && y === 0 ? '' : `${x.toFixed(2)}px ${y.toFixed(2)}px`;
  }

  private drawVignette(context: CanvasRenderingContext2D, dt: number): void {
    const vignette = this.vignette;
    if (vignette.left <= 0) return;
    if (vignette.wait > 0) {
      vignette.wait -= dt;
      return;
    }
    vignette.left = Math.max(0, vignette.left - dt);
    const t = 1 - vignette.left / vignette.total;
    // Up quickly, hold, and lift slowly as the celebration takes over.
    const strength = Math.min(1, t * 6) * Math.min(1, (1 - t) * 1.6);
    const reach = Math.hypot(this.width, this.height);
    const gradient = context.createRadialGradient(
      vignette.at.x,
      vignette.at.y,
      Math.min(this.width, this.height) * 0.12,
      vignette.at.x,
      vignette.at.y,
      reach * 0.75,
    );
    const depth = (this.dark ? 0.42 : 0.2) * strength;
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, `rgba(0,0,0,${depth.toFixed(3)})`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, this.width, this.height);
  }

  private drawTraces(context: CanvasRenderingContext2D, dt: number): void {
    if (this.traces.length === 0) return;
    for (const trace of this.traces) {
      trace.time += dt;
      if (trace.time < 0) continue;
      const progress = Math.min(1, trace.time / trace.duration);
      // The same ease-out the SVG sweep uses, so the head stays on its tip.
      const eased = 1 - (1 - progress) ** 3;
      const x = trace.from.x + (trace.to.x - trace.from.x) * eased;
      const y = trace.from.y + (trace.to.y - trace.from.y) * eased;
      const radius = Math.max(6, Math.min(this.width, this.height) * 0.05);
      const head = context.createRadialGradient(x, y, 0, x, y, radius);
      head.addColorStop(0, trace.emitter.colours.soft);
      head.addColorStop(1, 'rgba(0,0,0,0)');
      context.globalCompositeOperation = this.dark ? 'lighter' : 'source-over';
      context.globalAlpha = 1 - progress * 0.6;
      context.fillStyle = head;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
      if (progress < 1) {
        traceSparks({ ...trace.emitter, delay: 0 }, x, y, this.seed++);
      }
    }
    this.traces = this.traces.filter((trace) => trace.time < trace.duration);
  }
}

/** Any CSS colour, as the canvas itself would parse it - `#rrggbb` where it can. */
function normalise(context: CanvasRenderingContext2D | null, colour: string): string {
  if (!context) return colour;
  context.fillStyle = '#000000';
  context.fillStyle = colour;
  const parsed: unknown = context.fillStyle;
  return typeof parsed === 'string' ? parsed : colour;
}

/** Relative luminance of a `#rrggbb` or `rgb()/rgba()` colour; mid-grey if unreadable. */
export function luminance(colour: string): number {
  let channels: number[] | null = null;
  const hex = /^#([0-9a-f]{6})$/i.exec(colour);
  if (hex) {
    const value = parseInt(hex[1]!, 16);
    channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  } else {
    const rgb = /rgba?\(([^)]+)\)/i.exec(colour);
    if (rgb)
      channels = rgb[1]!
        .split(/[\s,/]+/)
        .slice(0, 3)
        .map(Number);
  }
  if (!channels || channels.some((channel) => Number.isNaN(channel))) return 0.5;
  const [r, g, b] = channels.map((channel) => {
    const v = channel / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
