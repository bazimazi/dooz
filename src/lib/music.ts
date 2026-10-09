import { loadPreferences, subscribePreferences } from './preferences';
import { onAudioUnlocked, soundEngine } from './sound';
import { createMusicScore, MUSIC_BAR, MUSIC_BEAT } from './music-score';

/** A warm, gently swung mallet groove. Generated on-device and available offline. */
class Music {
  private output: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBarAt = 0;
  private bar = 0;
  private score: ReturnType<typeof createMusicScore> | null = null;
  private nodes: AudioNode[] = [];
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
    filter.frequency.value = 2800;
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
    this.score = null;
    this.nodes = [];
    if (!output || !context) return;
    output.gain.cancelScheduledValues(context.currentTime);
    output.gain.setValueAtTime(Math.max(0.0001, output.gain.value), context.currentTime);
    output.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + fade);
    setTimeout(() => nodes.forEach((node) => node.disconnect()), (fade + 0.6) * 1000);
  }

  private schedule() {
    const context = soundEngine.audio();
    if (!context || !this.output || !this.score) return;
    if (this.nextBarAt < context.currentTime) this.nextBarAt = context.currentTime + 0.03;
    while (this.nextBarAt < context.currentTime + 0.3) {
      this.score(this.bar++, this.nextBarAt);
      this.nextBarAt += MUSIC_BAR;
    }
  }
}
let music: Music | null = null;
/** Listen for the music toggle and the first audio-unlocking gesture. */
export function initMusic(): void {
  music ??= new Music();
}
