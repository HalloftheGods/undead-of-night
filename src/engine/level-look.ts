import type { LevelTheme } from '../../shared/levels.ts';
import type { NightEventId } from '../../shared/night-events.ts';
import type { Rgb } from './light-field.ts';
import { NIGHT_AMBIENT } from './lighting.ts';

export type WeatherKind = 'soot' | 'rain' | 'spores' | 'snow' | 'hive' | 'embers';

/** A flat colour over something, alpha 0..1. */
export interface Tint {
  readonly color: string;
  readonly alpha: number;
}

/**
 * How a town looks. Every level draws the same art, so a look is what goes over
 * it: the ground tint is baked into the chunks once, the ambient rides on the
 * lightmap, and the wash and weather are a handful of rectangles a frame.
 */
export interface LevelLook {
  /** Whatever no lamp reaches is multiplied by this. */
  readonly ambient: Rgb;
  readonly ground: Tint | null;
  /** Laid over the lit world, under anything that lights itself. */
  readonly wash: Tint | null;
  /** How far the wash's alpha swings either way, on a slow beat. */
  readonly washPulse: number;
  /** Replaces every street lamp's own colour. */
  readonly lampColor: string | null;
  /** One lamp in this many still works. */
  readonly lampEvery: number;
  readonly lampStrength: number;
  readonly weather: WeatherKind | null;
}

const NIGHT: LevelLook = {
  ambient: NIGHT_AMBIENT,
  ground: null,
  wash: null,
  washPulse: 0,
  lampColor: null,
  lampEvery: 1,
  lampStrength: 1,
  weather: null,
};

export const LEVEL_LOOKS: Record<LevelTheme, LevelLook> = {
  night: NIGHT,
  // Lamps on a generator: warm and steady, with no sky over them and nothing falling.
  bunker: { ...NIGHT, ambient: [96, 78, 62], lampColor: '#ffb066', weather: null },
  'industrial-dusk': {
    ...NIGHT,
    ambient: [92, 62, 58],
    ground: { color: '#7a5238', alpha: 0.16 },
    wash: { color: '#c8743a', alpha: 0.06 },
    weather: 'soot',
  },
  flooded: {
    ...NIGHT,
    ambient: [18, 36, 66],
    ground: { color: '#1c4a7c', alpha: 0.42 },
    wash: { color: '#0e3460', alpha: 0.1 },
    lampColor: '#7fb4e0',
    weather: 'rain',
  },
  contaminated: {
    ...NIGHT,
    ambient: [48, 70, 30],
    ground: { color: '#5c7a2a', alpha: 0.24 },
    wash: { color: '#8fbf3a', alpha: 0.1 },
    lampColor: '#c4f048',
    weather: 'spores',
  },
  blackout: { ...NIGHT, ambient: [10, 11, 20], lampEvery: 6, lampStrength: 0.7 },
  emergency: {
    ...NIGHT,
    ambient: [64, 20, 22],
    ground: { color: '#6a1a18', alpha: 0.18 },
    wash: { color: '#c8201a', alpha: 0.06 },
    washPulse: 0.05,
    lampColor: '#ff3a2a',
  },
  snow: {
    ...NIGHT,
    ambient: [170, 180, 204],
    ground: { color: '#dfe8f2', alpha: 0.62 },
    wash: { color: '#dfe8f2', alpha: 0.12 },
    weather: 'snow',
  },
  infested: {
    ...NIGHT,
    ambient: [50, 26, 70],
    ground: { color: '#4a2470', alpha: 0.26 },
    wash: { color: '#7a2fa8', alpha: 0.1 },
    lampColor: '#b070d0',
    weather: 'hive',
  },
  burning: {
    ...NIGHT,
    ambient: [118, 54, 26],
    ground: { color: '#7a3010', alpha: 0.2 },
    wash: { color: '#e8701c', alpha: 0.1 },
    washPulse: 0.02,
    lampColor: '#ffb060',
    weather: 'embers',
  },
};

/**
 * A night event laid over a town's look: fog greys the world and pales the ambient, a blood moon reddens
 * the sky with a slow pulse, and a power cut kills most of the lamps and the ambient with them.
 */
export function withEvent(look: LevelLook, event: NightEventId | null): LevelLook {
  const isFog = event === 'fog';
  if (isFog) return { ...look, wash: { color: '#a9b2bc', alpha: 0.26 }, washPulse: 0.03, ambient: mix(look.ambient, [120, 126, 134], 0.4) };
  const isBloodMoon = event === 'blood_moon';
  if (isBloodMoon) return { ...look, wash: { color: '#b3121c', alpha: 0.1 }, washPulse: 0.04, ambient: mix(look.ambient, [120, 24, 28], 0.5) };
  const isPowerCut = event === 'power_cut';
  if (isPowerCut) return { ...look, ambient: [10, 11, 20], lampEvery: Math.max(look.lampEvery, 6), lampStrength: Math.min(look.lampStrength, 0.7) };
  return look;
}

function mix(a: Rgb, b: Rgb, share: number): Rgb {
  const blend = (i: 0 | 1 | 2) => Math.round(a[i] * (1 - share) + b[i] * share);
  return [blend(0), blend(1), blend(2)];
}

/** Whether this street lamp, by its place in the map's list, still has power. */
export function lampWorks(look: LevelLook, index: number): boolean {
  return index % look.lampEvery === 0;
}
