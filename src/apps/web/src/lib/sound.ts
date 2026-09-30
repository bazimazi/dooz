import { loadPreferences, subscribePreferences } from './preferences';

/**
 * Every sound the game makes, synthesised on the spot.
 *
 * No audio files: like the artwork, the sounds are built from primitives at
 * runtime, so they cost nothing to download, work offline in a Tauri window,
 * and can follow the game - a mark's pitch is chosen by where it lands, so a
 * game played out is also a short tune.
 *
 * The palette is D major pentatonic throughout. Any two notes of it sound fine
 * together, which matters when two players' marks, a win chord and the music
 * can all overlap, and it keeps the whole game in one key.
 *
 * Nothing here is allowed to throw. A browser without Web Audio, a context the
 * autoplay policy is still holding, a test running under jsdom - all of them
 * simply get silence.
 */

type Wave = OscillatorType;

interface Voice {
  wave: Wave;
  /** Start frequency in Hz. */
  freq: number;
  /** Where the pitch glides to over `glide` seconds, if anywhere. */
  to?: number;
  glide?: number;
  /** Seconds after `now` to start. */
  at?: number;
  attack?: number;
  /** Time for the level to fall away after the attack. */
  decay: number;
  gain: number;
  /** Optional low-pass cutoff, for softening bright waves. */
  lowpass?: number;
  detune?: number;
  /** Share sent to the reverb. */
  wet?: number;
}

interface Hiss {
  at?: number;
  duration: number;
  /** Band-pass centre, gliding from `from` to `to`. */
  from: number;
  to?: number;
  q?: number;
  gain: number;
  wet?: number;
}

// D major pentatonic, as semitone offsets from D.
const PENTATONIC = [0, 2, 4, 7, 9] as const;
const D4 = 293.66;

/** A note of the scale by degree, counting up from D4 across octaves. */
export function scaleNote(degree: number, octave = 0): number {
  const length = PENTATONIC.length;
  const wrapped = ((degree % length) + length) % length;
  const octaves = Math.floor(degree / length) + octave;
  return D4 * 2 ** ((PENTATONIC[wrapped]! + octaves * 12) / 12);
}

class SoundEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private enabled = true;
  private volume = 0.7;
  private unlocked = false;

  constructor() {
    const preferences = loadPreferences();
    this.enabled = preferences.sound;
    this.volume = preferences.volume;
    subscribePreferences((next) => {
      this.enabled = next.sound;
      this.volume = next.volume;
      this.applyVolume();
    });
    this.listenForUnlock();
  }

  /** Whether effects are wanted at all. The music asks separately. */
  get on(): boolean {
    return this.enabled && this.volume > 0;
  }

  /**
   * The context, created on first use.
   *
   * Browsers refuse to start audio before the page has been interacted with,
   * so the context is resumed from the first tap or key press - every sound
   * the game makes is itself the result of one, so in practice the first
   * mark placed is the first sound heard.
   */
  audio(): AudioContext | null {
    if (this.context) return this.context;
    if (typeof window === 'undefined') return null;
    const Context =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return null;

    try {
      const context = new Context({ latencyHint: 'interactive' });
      const master = context.createGain();
      // A gentle limiter on the way out, so a win chord landing on top of a
      // mark and the music never clips on a phone speaker.
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.knee.value = 8;
      limiter.ratio.value = 6;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.2;
      master.connect(limiter);
      limiter.connect(context.destination);

      const sfxBus = context.createGain();
      sfxBus.connect(master);
      const musicBus = context.createGain();
      musicBus.gain.value = 0.55;
      musicBus.connect(master);

      const reverb = context.createConvolver();
      reverb.buffer = impulse(context, 2.2, 2.6);
      const reverbReturn = context.createGain();
      reverbReturn.gain.value = 0.32;
      reverb.connect(reverbReturn);
      reverbReturn.connect(master);

      this.context = context;
      this.master = master;
      this.sfxBus = sfxBus;
      this.musicBus = musicBus;
      this.reverb = reverb;
      this.applyVolume();
      return context;
    } catch {
      return null;
    }
  }

  /** The bus the music plays into, and the reverb it may send to. */
  musicOutput(): { context: AudioContext; bus: GainNode; reverb: ConvolverNode } | null {
    const context = this.audio();
    if (!context || !this.musicBus || !this.reverb) return null;
    return { context, bus: this.musicBus, reverb: this.reverb };
  }

  get isUnlocked(): boolean {
    return this.unlocked;
  }

  private applyVolume() {
    if (!this.master || !this.context) return;
    // Perceived loudness is roughly logarithmic, so the slider is squared: the
    // bottom half of its travel is where quiet actually lives.
    const level = this.volume * this.volume;
    this.master.gain.setTargetAtTime(level, this.context.currentTime, 0.05);
  }

  private listenForUnlock() {
    if (typeof document === 'undefined') return;
    const unlock = () => {
      const context = this.audio();
      if (!context) return;
      if (context.state === 'suspended') void context.resume().catch(() => undefined);
      this.unlocked = true;
      unlockListeners.forEach((listener) => listener());
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
  }

  /** A context ready to schedule into, or `null` when effects are off. */
  private ready(): AudioContext | null {
    if (!this.on) return null;
    const context = this.audio();
    if (!context) return null;
    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }
    return context;
  }

  voice(spec: Voice) {
    const context = this.ready();
    if (!context || !this.sfxBus) return;
    playVoice(context, this.sfxBus, this.reverb, spec);
  }

  hiss(spec: Hiss) {
    const context = this.ready();
    if (!context || !this.sfxBus) return;
    this.noiseBuffer ??= noise(context);
    playHiss(context, this.sfxBus, this.reverb, this.noiseBuffer, spec);
  }
}

const unlockListeners = new Set<() => void>();

/** Called once audio has been unlocked by a gesture - the music waits on it. */
export function onAudioUnlocked(listener: () => void): () => void {
  unlockListeners.add(listener);
  return () => unlockListeners.delete(listener);
}

function playVoice(
  context: AudioContext,
  bus: AudioNode,
  reverb: ConvolverNode | null,
  spec: Voice,
) {
  try {
    const start = context.currentTime + 0.004 + (spec.at ?? 0);
    const attack = spec.attack ?? 0.005;
    const end = start + attack + spec.decay;

    const osc = context.createOscillator();
    osc.type = spec.wave;
    osc.frequency.setValueAtTime(spec.freq, start);
    if (spec.to !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, spec.to),
        start + (spec.glide ?? 0.08),
      );
    }
    if (spec.detune) osc.detune.value = spec.detune;

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(spec.gain, start + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);

    let head: AudioNode = osc;
    if (spec.lowpass) {
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = spec.lowpass;
      osc.connect(filter);
      head = filter;
    }
    head.connect(envelope);
    envelope.connect(bus);
    if (reverb && spec.wet) {
      const send = context.createGain();
      send.gain.value = spec.wet;
      envelope.connect(send);
      send.connect(reverb);
    }

    osc.start(start);
    osc.stop(end + 0.05);
  } catch {
    // A node the browser would not build is a sound not heard.
  }
}

function playHiss(
  context: AudioContext,
  bus: AudioNode,
  reverb: ConvolverNode | null,
  buffer: AudioBuffer,
  spec: Hiss,
) {
  try {
    const start = context.currentTime + 0.004 + (spec.at ?? 0);
    const end = start + spec.duration;

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = spec.q ?? 1.2;
    filter.frequency.setValueAtTime(spec.from, start);
    if (spec.to !== undefined) filter.frequency.exponentialRampToValueAtTime(spec.to, end);

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(spec.gain, start + spec.duration * 0.3);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);

    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(bus);
    if (reverb && spec.wet) {
      const send = context.createGain();
      send.gain.value = spec.wet;
      envelope.connect(send);
      send.connect(reverb);
    }

    source.start(start, Math.random() * 0.5);
    source.stop(end + 0.05);
  } catch {
    // As above: silence rather than an error.
  }
}

/** One second of white noise, shared by every hiss. */
function noise(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** A synthetic room: decaying noise, stereo, which is all a small reverb needs. */
function impulse(context: AudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
    }
  }
  return buffer;
}

export const soundEngine = new SoundEngine();

// ---------------------------------------------------------------------------
// The palette
// ---------------------------------------------------------------------------

/** A little life in every repeat: no two taps are pitched identically. */
const jitter = () => (Math.random() - 0.5) * 14;

/**
 * The note a mark plays, from where it landed.
 *
 * Higher up the board and further right is higher up the scale, so a run built
 * across the board climbs, and a long game wanders the way the play did.
 */
function noteFor(index: number, size: number): number {
  const row = Math.floor(index / size);
  const col = index % size;
  const span = Math.max(1, size - 1);
  // Normalise so a 3x3 and a 15x15 board cover the same range of the scale.
  const height = (size - 1 - row) / span;
  const across = col / span;
  return Math.round((height * 0.6 + across * 0.4) * 7);
}

export const sfx = {
  /**
   * A mark landing. X is plucked - bright, with a fast drop into the note -
   * and O is a round bloop that swells up into it, so the two players are
   * told apart by ear as well as by colour.
   */
  place(player: 1 | 2, index: number, size: number) {
    const degree = noteFor(index, size);
    if (player === 1) {
      const note = scaleNote(degree, 1);
      soundEngine.voice({
        wave: 'triangle',
        freq: note * 2,
        to: note,
        glide: 0.025,
        decay: 0.2,
        gain: 0.32,
        detune: jitter(),
        wet: 0.12,
      });
      soundEngine.voice({ wave: 'sine', freq: note * 3, decay: 0.07, gain: 0.08 });
      soundEngine.hiss({ duration: 0.03, from: 5200, gain: 0.07 });
    } else {
      const note = scaleNote(degree, 0);
      soundEngine.voice({
        wave: 'sine',
        freq: note * 0.72,
        to: note,
        glide: 0.07,
        attack: 0.012,
        decay: 0.26,
        gain: 0.42,
        detune: jitter(),
        wet: 0.12,
      });
      soundEngine.voice({
        wave: 'triangle',
        freq: note * 2,
        decay: 0.09,
        gain: 0.05,
        lowpass: 2400,
      });
    }
  },

  /** A mark dropping down a gravity column: a falling whistle, then the landing. */
  drop(player: 1 | 2, index: number, size: number, rows: number) {
    const fall = Math.min(0.42, 0.1 + rows * 0.045);
    soundEngine.voice({
      wave: 'sine',
      freq: 1100,
      to: 520,
      glide: fall,
      attack: 0.02,
      decay: fall,
      gain: 0.05,
    });
    const note = scaleNote(noteFor(index, size), player === 1 ? 0 : -1);
    soundEngine.voice({
      at: fall,
      wave: 'sine',
      freq: note * 1.6,
      to: note * 0.5,
      glide: 0.08,
      decay: 0.16,
      gain: 0.34,
    });
    soundEngine.voice({
      at: fall,
      wave: player === 1 ? 'triangle' : 'sine',
      freq: scaleNote(noteFor(index, size), 1),
      decay: 0.18,
      gain: 0.14,
      wet: 0.14,
    });
    soundEngine.hiss({ at: fall, duration: 0.05, from: 900, gain: 0.12 });
  },

  /** An old mark lifted off a vanish board: a soft breathy puff. */
  vanish() {
    soundEngine.hiss({ duration: 0.28, from: 2400, to: 500, q: 0.8, gain: 0.12, wet: 0.3 });
    soundEngine.voice({
      wave: 'sine',
      freq: 880,
      to: 440,
      glide: 0.2,
      attack: 0.01,
      decay: 0.2,
      gain: 0.05,
      wet: 0.3,
    });
  },

  /** A tap the rules refuse. Low and short: noticed, not scolded. */
  invalid() {
    soundEngine.voice({ wave: 'sine', freq: 150, to: 90, glide: 0.08, decay: 0.1, gain: 0.3 });
    soundEngine.voice({ wave: 'square', freq: 110, decay: 0.05, gain: 0.03, lowpass: 600 });
  },

  /** A move taken back: the placing sound, run in reverse. */
  undo() {
    soundEngine.hiss({ duration: 0.18, from: 600, to: 3200, q: 1.5, gain: 0.08 });
    soundEngine.voice({
      wave: 'triangle',
      freq: scaleNote(4),
      to: scaleNote(0),
      glide: 0.12,
      decay: 0.14,
      gain: 0.12,
    });
  },

  /** A fresh board: a brush of air and a rising pair. */
  start() {
    soundEngine.hiss({ duration: 0.32, from: 400, to: 2600, q: 0.9, gain: 0.06, wet: 0.2 });
    soundEngine.voice({
      at: 0.1,
      wave: 'triangle',
      freq: scaleNote(2, 1),
      decay: 0.16,
      gain: 0.1,
      wet: 0.2,
    });
    soundEngine.voice({
      at: 0.18,
      wave: 'triangle',
      freq: scaleNote(5, 1),
      decay: 0.24,
      gain: 0.1,
      wet: 0.25,
    });
  },

  /** You won: a climbing arpeggio that lands on a ringing chord. */
  win() {
    const notes = [0, 2, 3, 5, 7, 8, 10];
    notes.forEach((degree, step) => {
      soundEngine.voice({
        at: step * 0.065,
        wave: 'triangle',
        freq: scaleNote(degree, 1),
        decay: 0.3,
        gain: 0.16,
        wet: 0.35,
      });
    });
    const chordAt = notes.length * 0.065;
    for (const degree of [0, 2, 3, 5]) {
      soundEngine.voice({
        at: chordAt,
        wave: 'sine',
        freq: scaleNote(degree, 1),
        attack: 0.02,
        decay: 1.4,
        gain: 0.12,
        wet: 0.5,
      });
      soundEngine.voice({
        at: chordAt,
        wave: 'sine',
        freq: scaleNote(degree, 2),
        attack: 0.03,
        decay: 1.1,
        gain: 0.04,
        wet: 0.6,
      });
    }
    soundEngine.hiss({
      at: chordAt - 0.1,
      duration: 0.8,
      from: 3000,
      to: 9000,
      q: 0.7,
      gain: 0.05,
      wet: 0.5,
    });
  },

  /** You lost: three notes falling, and a low sigh under them. */
  lose() {
    const notes = [4, 2, 0];
    notes.forEach((degree, step) => {
      soundEngine.voice({
        at: step * 0.16,
        wave: 'triangle',
        freq: scaleNote(degree, 0) * 0.94,
        to: scaleNote(degree, 0) * 0.9,
        glide: 0.18,
        decay: 0.3,
        gain: 0.16,
        lowpass: 1800,
        wet: 0.25,
      });
    });
    soundEngine.voice({
      at: 0.36,
      wave: 'sine',
      freq: scaleNote(0, -1),
      to: scaleNote(0, -2),
      glide: 0.7,
      attack: 0.05,
      decay: 0.8,
      gain: 0.18,
      wet: 0.3,
    });
  },

  /** Nobody won: two even notes and a shrug. */
  draw() {
    soundEngine.voice({ wave: 'triangle', freq: scaleNote(3), decay: 0.28, gain: 0.14, wet: 0.3 });
    soundEngine.voice({
      at: 0.2,
      wave: 'triangle',
      freq: scaleNote(0),
      decay: 0.45,
      gain: 0.14,
      wet: 0.35,
    });
    soundEngine.hiss({ at: 0.18, duration: 0.3, from: 1500, to: 700, gain: 0.04 });
  },

  /** An Ultimate small board taken: a stab, pitched by who took it. */
  claim(player: 1 | 2) {
    const base = player === 1 ? 5 : 3;
    for (const offset of [0, 2, 4]) {
      soundEngine.voice({
        wave: 'triangle',
        freq: scaleNote(base + offset),
        decay: 0.4,
        gain: 0.1,
        wet: 0.35,
      });
    }
    soundEngine.voice({ wave: 'sine', freq: 110, to: 55, glide: 0.2, decay: 0.25, gain: 0.3 });
  },

  /** The other side can now win next move. Played only where hints are on. */
  threat() {
    soundEngine.voice({ wave: 'sine', freq: scaleNote(3, 1), decay: 0.12, gain: 0.1 });
    soundEngine.voice({ at: 0.12, wave: 'sine', freq: scaleNote(1, 1), decay: 0.2, gain: 0.1 });
  },

  /** A light click for buttons. Kept very quiet: it is heard a lot. */
  tap() {
    soundEngine.voice({
      wave: 'sine',
      freq: 1900 + jitter() * 6,
      to: 1300,
      glide: 0.02,
      decay: 0.03,
      gain: 0.05,
    });
  },

  toggle(on: boolean) {
    const [first, second] = on ? [2, 4] : [4, 2];
    soundEngine.voice({ wave: 'sine', freq: scaleNote(first, 1), decay: 0.06, gain: 0.08 });
    soundEngine.voice({
      at: 0.06,
      wave: 'sine',
      freq: scaleNote(second, 1),
      decay: 0.08,
      gain: 0.08,
    });
  },

  /** A panel opening, or closing: air moving past. */
  whoosh(opening = true) {
    soundEngine.hiss({
      duration: 0.22,
      from: opening ? 500 : 2400,
      to: opening ? 2400 : 500,
      q: 0.9,
      gain: 0.05,
    });
  },

  /** An opponent was found. */
  matched() {
    soundEngine.voice({
      wave: 'triangle',
      freq: scaleNote(3, 1),
      decay: 0.3,
      gain: 0.16,
      wet: 0.35,
    });
    soundEngine.voice({
      at: 0.12,
      wave: 'triangle',
      freq: scaleNote(7, 1),
      decay: 0.5,
      gain: 0.16,
      wet: 0.4,
    });
  },

  /** A reaction arriving on the board. */
  emote() {
    soundEngine.voice({ wave: 'sine', freq: 520, to: 1040, glide: 0.06, decay: 0.09, gain: 0.14 });
  },

  /** One beat of a clock that is nearly out. */
  tick(urgent = false) {
    soundEngine.voice({
      wave: 'square',
      freq: urgent ? 1400 : 1100,
      decay: 0.03,
      gain: 0.05,
      lowpass: 3000,
    });
  },

  /** A star earned, an achievement, a puzzle solved: a scatter of bright notes. */
  sparkle(count = 5) {
    for (let step = 0; step < count; step++) {
      soundEngine.voice({
        at: step * 0.05,
        wave: 'sine',
        freq: scaleNote(5 + step * 2, 1),
        decay: 0.3,
        gain: 0.08,
        wet: 0.5,
      });
    }
  },

  /** A puzzle answer that was not it. Softer than a loss: try again. */
  wrong() {
    soundEngine.voice({
      wave: 'triangle',
      freq: scaleNote(2),
      to: scaleNote(0) * 0.94,
      glide: 0.2,
      decay: 0.24,
      gain: 0.14,
      lowpass: 1500,
    });
  },
};

/** Short buzzes on devices that can make them. */
export const haptics = {
  enabled: loadPreferences().haptics,
  buzz(pattern: number | number[]) {
    if (!this.enabled || typeof navigator === 'undefined') return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      // Not every webview exposes it, and a missing buzz is not an error.
    }
  },
};

subscribePreferences((next) => {
  haptics.enabled = next.haptics;
});
