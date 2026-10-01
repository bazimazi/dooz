/** A gentle 84 BPM mallet groove in the same key as the game's move sounds. */
export const MUSIC_BEAT = 60 / 84;
export const MUSIC_BAR = MUSIC_BEAT * 4;
const D3 = 146.83;
const CHORDS = [
  [0, 4, 7, 14],
  [-3, 0, 4, 9],
  [-7, -3, 2, 7],
  [-5, 2, 7, 14],
];
const MELODY: readonly (readonly (number | null)[])[] = [
  [14, null, 16, 19, null, 16, 14, null],
  [9, null, 14, null, 16, null, 14, 9],
  [14, null, 19, null, 21, 19, 16, null],
  [16, null, 14, 9, null, 7, 9, null],
];

export function createMusicScore(context: BaseAudioContext, output: AudioNode) {
  const noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.18), context.sampleRate);
  const samples = noise.getChannelData(0);
  let seed = 48271;
  for (let i = 0; i < samples.length; i++) {
    seed = (seed * 16807) % 2147483647;
    samples[i] = (seed / 2147483647) * 2 - 1;
  }

  function note(
    offset: number,
    at: number,
    duration: number,
    gain: number,
    kind: 'mallet' | 'chord' | 'bass',
  ) {
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(gain, at + (kind === 'chord' ? 0.12 : 0.012));
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    envelope.connect(output);
    const partials =
      kind === 'mallet'
        ? [
            [1, 1],
            [3, 0.14],
          ]
        : [[1, 1]];
    let remaining = partials.length;
    for (const [ratio, amplitude] of partials) {
      const oscillator = context.createOscillator();
      const level = context.createGain();
      level.gain.value = amplitude!;
      oscillator.type = kind === 'chord' ? 'triangle' : 'sine';
      oscillator.frequency.value = D3 * 2 ** (offset / 12) * ratio!;
      oscillator.connect(level);
      level.connect(envelope);
      oscillator.onended = () => {
        oscillator.disconnect();
        level.disconnect();
        if (--remaining === 0) envelope.disconnect();
      };
      oscillator.start(at);
      oscillator.stop(at + duration + 0.03);
    }
  }

  function brush(at: number, snare: boolean) {
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = snare ? 1100 : 4500;
    filter.Q.value = 0.7;
    const envelope = context.createGain();
    const length = snare ? 0.13 : 0.055;
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(snare ? 0.035 : 0.012, at + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(output);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
    };
    source.start(at);
    source.stop(at + length + 0.01);
  }

  return (bar: number, at: number) => {
    const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length]!;
    for (const beat of [0, 1.5, 2.75]) {
      for (const offset of chord) note(offset, at + beat * MUSIC_BEAT, 1.15, 0.018, 'chord');
    }
    note(chord[0]! - 12, at, 0.65, 0.13, 'bass');
    note(chord[0]! - 12, at + MUSIC_BEAT * 2, 0.55, 0.1, 'bass');
    const motif = MELODY[bar % MELODY.length]!;
    for (let step = 0; step < 8; step++) {
      // A small swing makes the offbeats less mechanical.
      const time = at + (step / 2 + (step % 2 ? 0.065 : 0)) * MUSIC_BEAT;
      const offset = motif[step];
      if (offset !== null && offset !== undefined)
        note(
          offset + (Math.floor(bar / 8) % 2 && step === 6 ? 12 : 0),
          time,
          0.75,
          step % 2 ? 0.047 : 0.06,
          'mallet',
        );
      brush(time, false);
    }
    brush(at + MUSIC_BEAT, true);
    brush(at + MUSIC_BEAT * 3, true);
  };
}
