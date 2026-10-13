/** A gentle 84 BPM mallet groove in the same key as the game's move sounds. */
export const MUSIC_BEAT = 60 / 84;
export const MUSIC_BAR = MUSIC_BEAT * 4;
const D3 = 146.83;

/**
 * A rival's musical signature: their own chord loop, their own tune and the
 * instrument it is played on. Every note stays inside the D major pentatonic
 * the move sounds use, so a rival's theme and the marks on the board are
 * always in tune with each other.
 */
export interface Motif {
  chords: readonly (readonly number[])[];
  melody: readonly (readonly (number | null)[])[];
  /** `mallet` is the house sound; `bell` rings longer; `pluck` is short. */
  voice: 'mallet' | 'bell' | 'pluck';
  /** Semitones the tune is lifted (or dropped) by. */
  lift: number;
}

const HOUSE: Motif = {
  chords: [
    [0, 4, 7, 14],
    [-3, 0, 4, 9],
    [-7, -3, 2, 7],
    [-5, 2, 7, 14],
  ],
  melody: [
    [14, null, 16, 19, null, 16, 14, null],
    [9, null, 14, null, 16, null, 14, 9],
    [14, null, 19, null, 21, 19, 16, null],
    [16, null, 14, 9, null, 7, 9, null],
  ],
  voice: 'mallet',
  lift: 0,
};

/** The journey rivals' themes, keyed by rival id. See `features/journey/worlds.ts`. */
export const MOTIFS: Readonly<Record<string, Motif>> = {
  // Pip: hops between neighbouring notes, like a frog between pads.
  pip: {
    chords: HOUSE.chords,
    melody: [
      [14, 16, null, 14, 19, null, 16, null],
      [14, 16, null, 14, 21, null, 19, null],
      [16, 19, null, 16, 14, null, 9, null],
      [14, null, 9, 14, 16, null, null, null],
    ],
    voice: 'pluck',
    lift: 0,
  },
  // Mo: lazy, lots of rest, a cat stretching.
  mo: {
    chords: [
      [-3, 0, 4, 9],
      [0, 4, 7, 14],
      [-5, 2, 7, 14],
      [-3, 0, 4, 9],
    ],
    melody: [
      [16, null, null, 14, null, null, 9, null],
      [null, null, 14, null, 16, null, null, null],
      [19, null, null, 16, null, 14, null, null],
      [9, null, null, null, 7, null, null, null],
    ],
    voice: 'mallet',
    lift: 0,
  },
  // Sage: slow bells, long notes, patience.
  sage: {
    chords: [
      [0, 7, 14, 16],
      [-5, 2, 9, 14],
      [-3, 4, 9, 16],
      [-7, 2, 7, 14],
    ],
    melody: [
      [21, null, null, null, 19, null, null, null],
      [16, null, null, null, 14, null, null, null],
      [19, null, null, null, 21, null, 24, null],
      [21, null, null, null, null, null, null, null],
    ],
    voice: 'bell',
    lift: 0,
  },
  // Bruno: low, heavy, plodding.
  bruno: {
    chords: [
      [-12, -5, 0, 4],
      [-15, -8, -3, 4],
      [-12, -5, 0, 7],
      [-17, -10, -5, 2],
    ],
    melody: [
      [7, null, 7, null, 9, null, 7, null],
      [4, null, 4, null, 2, null, null, null],
      [7, null, 9, null, 12, null, 9, null],
      [7, null, 4, null, 2, null, null, null],
    ],
    voice: 'mallet',
    lift: -12,
  },
  // Vex: off the beat, sly.
  vex: {
    chords: [
      [-3, 0, 4, 9],
      [-7, -3, 2, 7],
      [-3, 0, 4, 9],
      [-5, -1, 2, 7],
    ],
    melody: [
      [null, 16, null, 14, null, 9, 12, null],
      [null, 14, null, 16, null, 19, null, 16],
      [null, 21, null, 19, 16, null, 14, null],
      [null, 9, 12, null, 14, null, null, null],
    ],
    voice: 'pluck',
    lift: 0,
  },
  // Nyx: sparse high bells over open fifths, nothing quite resolving.
  nyx: {
    chords: [
      [0, 7, 14],
      [-3, 4, 11],
      [-5, 2, 9],
      [-3, 4, 11],
    ],
    melody: [
      [26, null, null, null, null, 24, null, null],
      [null, null, 21, null, null, null, null, null],
      [28, null, null, 26, null, null, 21, null],
      [null, null, null, null, 19, null, null, null],
    ],
    voice: 'bell',
    lift: 0,
  },
};

/**
 * How the score should feel this bar.
 *
 * `intensity` runs from 0 (calm: an empty board, a quiet position) to 1
 * (tense: threats on the board, the last few moves). The groove gains layers
 * as it rises - a heartbeat kick, a driving bass, busier hats, the tune lifted
 * an octave - so tension is heard as more happening rather than as a different
 * song.
 */
export interface Mood {
  intensity: number;
  motif: Motif | null;
}

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
    kind: 'mallet' | 'chord' | 'bass' | 'bell' | 'pluck',
  ) {
    const envelope = context.createGain();
    const attack = kind === 'chord' ? 0.12 : kind === 'pluck' ? 0.004 : 0.012;
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(gain, at + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    envelope.connect(output);
    const partials =
      kind === 'mallet'
        ? [
            [1, 1],
            [3, 0.14],
          ]
        : kind === 'bell'
          ? [
              [1, 1],
              [2.76, 0.22],
              [5.4, 0.06],
            ]
          : [[1, 1]];
    let remaining = partials.length;
    for (const [ratio, amplitude] of partials) {
      const oscillator = context.createOscillator();
      const level = context.createGain();
      level.gain.value = amplitude!;
      oscillator.type = kind === 'chord' ? 'triangle' : kind === 'pluck' ? 'triangle' : 'sine';
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

  function brush(at: number, snare: boolean, level = 1) {
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = snare ? 1100 : 4500;
    filter.Q.value = 0.7;
    const envelope = context.createGain();
    const length = snare ? 0.13 : 0.055;
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime((snare ? 0.035 : 0.012) * level, at + 0.006);
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

  /** A soft heartbeat kick: a sine that drops in pitch as it fades. */
  function kick(at: number, level: number) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(92, at);
    oscillator.frequency.exponentialRampToValueAtTime(44, at + 0.16);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(0.16 * level, at + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.24);
    oscillator.connect(envelope);
    envelope.connect(output);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(at);
    oscillator.stop(at + 0.26);
  }

  return (bar: number, at: number, mood: Mood = { intensity: 0.3, motif: null }) => {
    const motif = mood.motif ?? HOUSE;
    const tension = Math.min(1, Math.max(0, mood.intensity));
    const chords = motif.chords;
    const chord = chords[Math.floor(bar / 2) % chords.length]!;

    // The bed: chords and a walking root, always there.
    for (const beat of [0, 1.5, 2.75]) {
      for (const offset of chord) note(offset, at + beat * MUSIC_BEAT, 1.15, 0.018, 'chord');
    }
    note(chord[0]! - 12, at, 0.65, 0.13, 'bass');
    note(chord[0]! - 12, at + MUSIC_BEAT * 2, 0.55, 0.1, 'bass');

    // Driving bass: the root on every off-beat once a game is getting tight.
    if (tension >= 0.55) {
      for (const beat of [0.5, 1.5, 2.5, 3.5]) {
        note(chord[0]! - 12, at + beat * MUSIC_BEAT, 0.22, 0.055 * tension, 'bass');
      }
    }

    // The tune: sparser when calm, lifted an octave on its peaks when tense.
    const motifBar = motif.melody[bar % motif.melody.length]!;
    const voice = motif.voice;
    for (let step = 0; step < 8; step++) {
      // A small swing makes the offbeats less mechanical.
      const time = at + (step / 2 + (step % 2 ? 0.065 : 0)) * MUSIC_BEAT;
      const offset = motifBar[step];
      const calmRest = tension < 0.2 && step % 2 === 1;
      if (offset !== null && offset !== undefined && !calmRest) {
        const peak = tension >= 0.78 && step % 4 === 0 ? 12 : 0;
        note(
          offset + motif.lift + peak + (Math.floor(bar / 8) % 2 && step === 6 ? 12 : 0),
          time,
          voice === 'bell' ? 1.4 : voice === 'pluck' ? 0.35 : 0.75,
          (step % 2 ? 0.047 : 0.06) * (voice === 'bell' ? 0.8 : 1),
          voice,
        );
      }
      if (tension >= 0.2) brush(time, false);
      // Sixteenths on the hats when it is all on the line.
      if (tension >= 0.7) brush(time + MUSIC_BEAT / 4, false, 0.7);
    }
    if (tension >= 0.2) {
      brush(at + MUSIC_BEAT, true);
      brush(at + MUSIC_BEAT * 3, true);
    }
    // A heartbeat under it all from the middle of the range up.
    if (tension >= 0.35) {
      kick(at, tension);
      kick(at + MUSIC_BEAT * 2, tension);
      if (tension >= 0.8) kick(at + MUSIC_BEAT * 2.5, tension * 0.7);
    }
  };
}
