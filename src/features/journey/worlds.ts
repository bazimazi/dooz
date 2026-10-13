import { useEffect } from 'react';
import { resetMusicMood, setMusicMotif } from '@/lib/music';
import { applyWorld, type WorldLook, type WorldMotif } from '@/lib/world';
import { translate } from '@/i18n';
import { gameLabelMessages } from '@/i18n/messages/gameLabels';

/**
 * Each journey rival plays at home.
 *
 * A world is a board tint, an accent for the frame, a motif drawn into the
 * backdrop and a theme for the score. It is laid over the player's chosen
 * style rather than replacing it - the tints are translucent and the accents
 * are only ever used for decoration - so a Tabletop player still sits at a
 * wooden board in Pip's pond, just one with a green cast to the light.
 */
export interface RivalWorld extends WorldLook {
  /** What the place is called, in the interface's language, for anything that wants to name it. */
  name: string;
  /** The rival's theme in the generative score. See `MOTIFS` in `music-score.ts`. */
  music: string;
}

/** Each world, its name given as the key of its message. */
const WORLDS: Readonly<
  Record<string, Omit<RivalWorld, 'id' | 'music' | 'name'> & { name: WorldName }>
> = {
  pip: { name: 'worldPip', motif: 'pond', tint: 'rgb(60 200 130 / 0.12)', accent: '#3fbf7f' },
  mo: { name: 'worldMo', motif: 'yarn', tint: 'rgb(255 120 170 / 0.11)', accent: '#ff7aa8' },
  sage: {
    name: 'worldSage',
    motif: 'library',
    tint: 'rgb(110 130 255 / 0.12)',
    accent: '#8fa0ff',
  },
  bruno: {
    name: 'worldBruno',
    motif: 'forest',
    tint: 'rgb(170 115 55 / 0.13)',
    accent: '#c98a4b',
  },
  vex: { name: 'worldVex', motif: 'embers', tint: 'rgb(255 110 40 / 0.12)', accent: '#ff7a33' },
  nyx: { name: 'worldNyx', motif: 'eclipse', tint: 'rgb(150 90 255 / 0.14)', accent: '#a77bff' },
};

type WorldName = 'worldPip' | 'worldMo' | 'worldSage' | 'worldBruno' | 'worldVex' | 'worldNyx';

/** The world a rival plays in, or `null` for an id that is not a rival. */
export function rivalWorld(rivalId: string): RivalWorld | null {
  const world = WORLDS[rivalId];
  return world
    ? { ...world, name: translate(gameLabelMessages, world.name), id: rivalId, music: rivalId }
    : null;
}

/** Every rival's world motif, for anything that lists them. */
export const WORLD_MOTIFS: readonly WorldMotif[] = Object.values(WORLDS).map(
  (world) => world.motif,
);

/**
 * Put the page in `world` for as long as the calling screen is mounted:
 * the board tint, the backdrop motif and the rival's theme. `null` leaves
 * everything as the player's own style has it.
 */
export function useRivalWorld(world: RivalWorld | null): void {
  const id = world?.id ?? null;
  useEffect(() => {
    const look = id ? rivalWorld(id) : null;
    applyWorld(look);
    setMusicMotif(look?.music ?? null);
    return () => {
      applyWorld(null);
      resetMusicMood();
    };
  }, [id]);
}
