import { loadPreferences, subscribePreferences } from './preferences';
import { onAudioUnlocked, soundEngine } from './sound';
import { createMusicScore, MOTIFS, type Mood, MUSIC_BAR, MUSIC_BEAT } from './music-score';

/** Where the score sits when nothing is pulling it either way: the original groove. */
export const RESTING_INTENSITY = 0.3;

/** A warm, gently swung mallet groove. Generated on-device and available offline. */
class Music {
  private output: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBarAt = 0;
  private bar = 0;
  private score: ReturnType<typeof createMusicScore> | null = null;
  private nodes: AudioNode[] = [];
  private wanted = loadPreferences().music;
  private filter: BiquadFilterNode | null = null;
  /** What the game asked for, and what the score is actually playing - eased per bar. */
  private target = RESTING_INTENSITY;
  private mood: Mood = { intensity: RESTING_INTENSITY, motif: null };

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
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop(0.3);
      else if (this.wanted && soundEngine.isUnlocked) this.start();
    });
  }

  start() {
    if (this.output || document.hidden) return;
    const target = soundEngine.musicOutput();
    if (!target) return;
    const { context, bus } = target;
    if (context.state === 'suspended') void context.resume().catch(() => undefined);
    const input = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff(this.mood.intensity);
    filter.Q.value = 0.5;
    const output = context.createGain();
    output.gain.setValueAtTime(0.0001, context.currentTime);
    // Bring the gentle score up by 12 dB; the shared master limiter keeps
    // overlapping music and game effects controlled at maximum volume.
    output.gain.exponentialRampToValueAtTime(4, context.currentTime + 1.2);
    input.connect(filter);
    filter.connect(output);
    output.connect(bus);
    const echo = context.createDelay(1);
    echo.delayTime.value = MUSIC_BEAT * 0.75;
    const echoLevel = context.createGain();
    echoLevel.gain.value = 0.16;
    filter.connect(echo);
    echo.connect(echoLevel);
    echoLevel.connect(output);
    this.nodes = [input, filter, echo, echoLevel, output];
    this.filter = filter;
    this.output = output;
    this.score = createMusicScore(context, input);
    this.nextBarAt = context.currentTime + 0.08;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 120);
  }

  stop(fade = 0.8) {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const output = this.output;
    if (!output) return;
    const context = soundEngine.audio();
    const nodes = this.nodes;
    this.output = null;
    this.filter = null;
    this.score = null;
    this.nodes = [];
    if (!output || !context) return;
    output.gain.cancelScheduledValues(context.currentTime);
    output.gain.setValueAtTime(Math.max(0.0001, output.gain.value), context.currentTime);
    output.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + fade);
    setTimeout(() => nodes.forEach((node) => node.disconnect()), (fade + 0.6) * 1000);
  }

  /** Ask for a calmer or tenser score, 0 to 1. It moves there over a bar or two. */
  setIntensity(value: number) {
    this.target = Math.min(1, Math.max(0, Number.isFinite(value) ? value : RESTING_INTENSITY));
  }

  /** Play a rival's theme instead of the house tune, or `null` for the house tune. */
  setMotif(id: string | null) {
    this.mood = { ...this.mood, motif: id ? (MOTIFS[id] ?? null) : null };
  }

  private schedule() {
    const context = soundEngine.audio();
    if (!context || !this.output || !this.score) return;
    if (this.nextBarAt < context.currentTime) this.nextBarAt = context.currentTime + 0.03;
    while (this.nextBarAt < context.currentTime + 0.3) {
      // Tension rises faster than it falls: a threat is heard at once, and
      // the room calms down over a few bars once it has passed.
      const step = this.target > this.mood.intensity ? 0.5 : 0.25;
      const intensity = this.mood.intensity + (this.target - this.mood.intensity) * step;
      this.mood = { ...this.mood, intensity };
      this.filter?.frequency.setTargetAtTime(cutoff(intensity), this.nextBarAt, MUSIC_BEAT);
      this.score(this.bar++, this.nextBarAt, this.mood);
      this.nextBarAt += MUSIC_BAR;
    }
  }
}
/** The score opens up - more top end - as the game gets tense. */
function cutoff(intensity: number): number {
  return 1900 + intensity * 3600;
}

let music: Music | null = null;
// Asked for before the score exists - a game screen mounts before the first
// gesture - so remembered and handed over when it starts.
let pendingIntensity = RESTING_INTENSITY;
let pendingMotif: string | null = null;

/** Listen for the music toggle and the first audio-unlocking gesture. */
export function initMusic(): void {
  if (music) return;
  music = new Music();
  music.setIntensity(pendingIntensity);
  music.setMotif(pendingMotif);
}

/**
 * How tense the game on screen is, from 0 (calm) to 1 (one move from the end).
 * Game screens drive this; see `useMusicTension`. Leaving a game should hand
 * it back with `resetMusicMood`.
 */
export function setMusicIntensity(value: number): void {
  pendingIntensity = value;
  music?.setIntensity(value);
}

/** A journey rival's theme by rival id, or `null` for the house tune. */
export function setMusicMotif(id: string | null): void {
  pendingMotif = id;
  music?.setMotif(id);
}

/** Back to the house tune at its resting intensity. */
export function resetMusicMood(): void {
  setMusicIntensity(RESTING_INTENSITY);
  setMusicMotif(null);
}
