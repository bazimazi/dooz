import { loadPreferences, subscribePreferences } from './preferences';
import { onAudioUnlocked, scaleNote, soundEngine } from './sound';

/**
 * The ambient score: slow pads with a few plucked notes drifting over them.
 *
 * Generated rather than recorded, for the same reasons the effects are, and
 * never the same twice - a loop heard for the fortieth time on a long gomoku
 * game is the thing that makes people mute a game for good. It stays in the
 * effects' key, so a mark landing always sounds like part of it.
 *
 * Off by default. It starts on the first gesture after being switched on
 * (browsers will not play it before), fades rather than cuts, and pauses while
 * the app is in the background.
 */

/** Chords as scale degrees of D major pentatonic plus colour tones, in semitones from D. */
const PROGRESSION: readonly (readonly number[])[] = [
  [0, 7, 14, 16], // Dadd9
  [-3, 4, 9, 14], // Bm7
  [-5, 2, 7, 11], // Gmaj7
  [-7, 0, 5, 9], // Em7 over A-ish
];

const CHORD_SECONDS = 9;
const LOOKAHEAD = 2;
const D3 = 146.83;

function semitone(offset: number): number {
  return D3 * 2 ** (offset / 12);
}

class Music {
  private output: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextChordAt = 0;
  private chord = 0;
  private nextPluckAt = 0;
  private playing = false;
  private wanted = loadPreferences().music;

  constructor() {
    subscribePreferences((next) => {
      if (next.music === this.wanted) return;
      this.wanted = next.music;
      if (next.music) this.start();
      else this.stop();
    });
    onAudioUnlocked(() => {
      if (this.wanted) this.start();
    });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.stop(0.3);
        else if (this.wanted && soundEngine.isUnlocked) this.start();
      });
    }
  }

  start() {
    if (this.playing) return;
    const target = soundEngine.musicOutput();
    if (!target) return;
    const { context, bus } = target;
    if (context.state === 'suspended') void context.resume().catch(() => undefined);

    const output = context.createGain();
    output.gain.setValueAtTime(0.0001, context.currentTime);
    output.gain.exponentialRampToValueAtTime(1, context.currentTime + 3);
    output.connect(bus);

    this.output = output;
    this.playing = true;
    this.nextChordAt = context.currentTime + 0.1;
    this.nextPluckAt = context.currentTime + 2.5;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 400);
  }

  stop(fade = 1.5) {
    if (!this.playing) return;
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;

    const output = this.output;
    const context = soundEngine.audio();
    this.output = null;
    if (!output || !context) return;
    try {
      output.gain.cancelScheduledValues(context.currentTime);
      output.gain.setValueAtTime(Math.max(0.0001, output.gain.value), context.currentTime);
      output.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + fade);
      setTimeout(() => output.disconnect(), (fade + 0.2) * 1000);
    } catch {
      output.disconnect();
    }
  }

  private schedule() {
    const target = soundEngine.musicOutput();
    if (!target || !this.output) return;
    const { context, reverb } = target;
    const horizon = context.currentTime + LOOKAHEAD;

    while (this.nextChordAt < horizon) {
      this.pad(context, reverb, PROGRESSION[this.chord % PROGRESSION.length]!, this.nextChordAt);
      this.chord++;
      this.nextChordAt += CHORD_SECONDS;
    }

    while (this.nextPluckAt < horizon) {
      this.pluck(context, reverb, this.nextPluckAt);
      // Sparse and uneven: a note every couple of seconds, sometimes a pair.
      this.nextPluckAt += Math.random() < 0.2 ? 0.28 : 1.4 + Math.random() * 2.6;
    }
  }

  private pad(context: AudioContext, reverb: ConvolverNode, chord: readonly number[], at: number) {
    const output = this.output;
    if (!output) return;
    const hold = CHORD_SECONDS + 2.5;

    try {
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 0.7;
      filter.frequency.setValueAtTime(420, at);
      filter.frequency.linearRampToValueAtTime(900, at + CHORD_SECONDS * 0.5);
      filter.frequency.linearRampToValueAtTime(480, at + hold);

      const envelope = context.createGain();
      envelope.gain.setValueAtTime(0.0001, at);
      envelope.gain.exponentialRampToValueAtTime(0.05, at + 2.4);
      envelope.gain.setValueAtTime(0.05, at + CHORD_SECONDS - 0.5);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + hold);

      filter.connect(envelope);
      envelope.connect(output);
      const send = context.createGain();
      send.gain.value = 0.6;
      envelope.connect(send);
      send.connect(reverb);

      for (const offset of chord) {
        for (const detune of [-7, 6]) {
          const osc = context.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = semitone(offset);
          osc.detune.value = detune;
          osc.connect(filter);
          osc.start(at);
          osc.stop(at + hold + 0.1);
        }
      }

      // A soft root underneath, an octave down.
      const bass = context.createOscillator();
      bass.type = 'sine';
      bass.frequency.value = semitone((chord[0] ?? 0) - 12);
      const bassGain = context.createGain();
      bassGain.gain.setValueAtTime(0.0001, at);
      bassGain.gain.exponentialRampToValueAtTime(0.09, at + 1.5);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, at + hold);
      bass.connect(bassGain);
      bassGain.connect(output);
      bass.start(at);
      bass.stop(at + hold + 0.1);
    } catch {
      // Music is garnish; a chord the browser will not build is skipped.
    }
  }

  private pluck(context: AudioContext, reverb: ConvolverNode, at: number) {
    const output = this.output;
    if (!output) return;
    try {
      const degree = Math.floor(Math.random() * 8);
      const osc = context.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = scaleNote(degree, 1);
      const envelope = context.createGain();
      envelope.gain.setValueAtTime(0.0001, at);
      envelope.gain.exponentialRampToValueAtTime(0.045, at + 0.01);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + 1.6);
      osc.connect(envelope);
      envelope.connect(output);
      const send = context.createGain();
      send.gain.value = 0.8;
      envelope.connect(send);
      send.connect(reverb);
      osc.start(at);
      osc.stop(at + 1.7);
    } catch {
      // As above.
    }
  }
}

let music: Music | null = null;

/** Start listening for the music preference. Called once, at launch. */
export function initMusic(): void {
  music ??= new Music();
}
