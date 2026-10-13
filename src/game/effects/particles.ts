/**
 * A fixed-size particle pool for the board's effects layer.
 *
 * Every particle the board will ever show lives in one array allocated up
 * front, and a dead one is reused rather than collected - a burst of a hundred
 * sparks on a phone must not hand the garbage collector a hundred objects to
 * find mid-animation. When the pool is full a new particle is simply not born:
 * an effect that runs a little thin is invisible, a dropped frame is not.
 *
 * Pure apart from the drawing, so the pool's bookkeeping is testable without a
 * canvas.
 */

export type ParticleShape = 'dot' | 'puff' | 'streak' | 'chip' | 'star' | 'ring' | 'splat';

export interface Particle {
  alive: boolean;
  shape: ParticleShape;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds lived so far, and in total. */
  age: number;
  life: number;
  /** Seconds to wait before appearing - a burst can be staggered from one call. */
  delay: number;
  size: number;
  /** Multiplier on `size` reached at the end of life. */
  grow: number;
  rotation: number;
  spin: number;
  /** Downward acceleration in px/s². */
  gravity: number;
  /** Fraction of velocity kept per second. */
  drag: number;
  alpha: number;
  colour: string;
  /** Draw with additive blending: light, not paint. */
  glow: boolean;
}

function blank(): Particle {
  return {
    alive: false,
    shape: 'dot',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    age: 0,
    life: 1,
    delay: 0,
    size: 2,
    grow: 1,
    rotation: 0,
    spin: 0,
    gravity: 0,
    drag: 1,
    alpha: 1,
    colour: '#fff',
    glow: false,
  };
}

const DEFAULTS: Readonly<Particle> = blank();

export type ParticleInit = Partial<Omit<Particle, 'alive' | 'age'>> & { x: number; y: number };

export class ParticleField {
  private pool: Particle[] = [];
  private live = 0;
  /**
   * Additive blending brightens towards white, which is light on a dark board
   * and a washed-out smear on a pale one. Off for light boards.
   */
  additive = true;

  constructor(capacity: number) {
    this.setCapacity(capacity);
  }

  /** Grow or shrink the pool. Shrinking drops whatever no longer fits. */
  setCapacity(capacity: number): void {
    const size = Math.max(0, Math.floor(capacity));
    while (this.pool.length < size) this.pool.push(blank());
    if (this.pool.length > size) this.pool.length = size;
    this.live = this.pool.reduce((count, particle) => count + (particle.alive ? 1 : 0), 0);
  }

  get capacity(): number {
    return this.pool.length;
  }

  /** Particles currently alive, waiting ones included. */
  get alive(): number {
    return this.live;
  }

  /** Bring one particle to life. `false` when the pool is full. */
  spawn(init: ParticleInit): boolean {
    const particle = this.pool.find((candidate) => !candidate.alive);
    if (!particle) return false;
    Object.assign(particle, DEFAULTS, init);
    particle.alive = true;
    particle.age = 0;
    this.live++;
    return true;
  }

  clear(): void {
    for (const particle of this.pool) particle.alive = false;
    this.live = 0;
  }

  /** Advance every particle by `dt` seconds. */
  step(dt: number): void {
    if (this.live === 0) return;
    for (const particle of this.pool) {
      if (!particle.alive) continue;
      if (particle.delay > 0) {
        particle.delay -= dt;
        continue;
      }
      particle.age += dt;
      if (particle.age >= particle.life) {
        particle.alive = false;
        this.live--;
        continue;
      }
      const keep = particle.drag ** dt;
      particle.vx *= keep;
      particle.vy = particle.vy * keep + particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.rotation += particle.spin * dt;
    }
  }

  /** Paint every visible particle. The caller has cleared and scaled the context. */
  draw(context: CanvasRenderingContext2D): void {
    if (this.live === 0) return;
    for (const particle of this.pool) {
      if (!particle.alive || particle.delay > 0) continue;
      const t = particle.age / particle.life;
      // Fade in over the first tenth, out over the last half: a particle that
      // pops on at full strength reads as a flicker.
      const fade = Math.min(1, t * 10) * Math.min(1, (1 - t) * 2);
      const alpha = particle.alpha * fade;
      if (alpha <= 0.01) continue;
      const size = particle.size * (1 + (particle.grow - 1) * t);
      context.globalAlpha = alpha;
      context.globalCompositeOperation = particle.glow && this.additive ? 'lighter' : 'source-over';
      context.fillStyle = particle.colour;
      context.strokeStyle = particle.colour;
      drawShape(context, particle, size);
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
  }
}

function drawShape(context: CanvasRenderingContext2D, particle: Particle, size: number): void {
  const { x, y } = particle;
  switch (particle.shape) {
    case 'dot':
    case 'puff':
    case 'splat': {
      context.beginPath();
      context.arc(x, y, Math.max(0.3, size), 0, Math.PI * 2);
      context.fill();
      return;
    }
    case 'ring': {
      context.beginPath();
      context.lineWidth = Math.max(0.75, size * 0.08);
      context.arc(x, y, Math.max(0.5, size), 0, Math.PI * 2);
      context.stroke();
      return;
    }
    case 'streak': {
      // A spark is drawn along its own velocity, so speed reads as length.
      const speed = Math.hypot(particle.vx, particle.vy) || 1;
      const length = Math.min(size * 6, speed * 0.05 + size);
      context.beginPath();
      context.lineCap = 'round';
      context.lineWidth = Math.max(0.6, size * 0.7);
      context.moveTo(x, y);
      context.lineTo(x - (particle.vx / speed) * length, y - (particle.vy / speed) * length);
      context.stroke();
      return;
    }
    case 'chip': {
      context.save();
      context.translate(x, y);
      context.rotate(particle.rotation);
      // A flat scrap seen turning: its width swings with the spin.
      const turn = Math.abs(Math.cos(particle.rotation * 1.7));
      context.fillRect(
        -size,
        (-size * 0.6 * (0.25 + turn)) / 1.25,
        size * 2,
        size * 1.2 * (0.25 + turn),
      );
      context.restore();
      return;
    }
    case 'star': {
      context.save();
      context.translate(x, y);
      context.rotate(particle.rotation);
      context.beginPath();
      for (let point = 0; point < 8; point++) {
        const radius = point % 2 === 0 ? size : size * 0.32;
        const angle = (point / 8) * Math.PI * 2;
        context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      context.closePath();
      context.fill();
      context.restore();
      return;
    }
  }
}
