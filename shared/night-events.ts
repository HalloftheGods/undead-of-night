// Night events: some towns get a night unlike the rest. Fog, a blood moon or a power cut, drawn from the
// town's own seed on a generator of its own, so the sim's rolls never move and the client can name it from
// the snapshot's map seed without being told.

import { isBunkerSeed } from './home-protocol.ts';
import { createRng, pick } from './rng.ts';
import type { SimState } from './sim-state.ts';
import { themeOf } from './town-rules.ts';

export type NightEventId = 'fog' | 'blood_moon' | 'power_cut';

export interface NightEvent {
  readonly id: NightEventId;
  readonly name: string;
  readonly blurb: string;
  /** How far zombies see, as a share of the usual. */
  readonly sight: number;
  /** How far zombies hear. */
  readonly hearing: number;
  /** Horde size. */
  readonly horde: number;
  /** Points for each kill. */
  readonly points: number;
}

export const NIGHT_EVENTS: Readonly<Record<NightEventId, NightEvent>> = {
  fog: { id: 'fog', name: 'Fog', blurb: 'Nobody sees far tonight. Zombies walk right up before they spot you.', sight: 0.55, hearing: 1, horde: 1, points: 1 },
  blood_moon: { id: 'blood_moon', name: 'Blood moon', blurb: 'Hordes twice the size, and every kill is worth double.', sight: 1, hearing: 1, horde: 2, points: 2 },
  power_cut: { id: 'power_cut', name: 'Power cut', blurb: 'The lights are out. Zombies see less, but they hear further.', sight: 0.7, hearing: 1.3, horde: 1, points: 1 },
};

/** The first town is for learning the game; events start on the second. */
export const FIRST_EVENT_LEVEL = 2;
/** The share of towns that get an event. */
export const EVENT_CHANCE = 0.3;
const EVENT_SALT = 0x4e494748;
const EVENT_ORDER: readonly NightEventId[] = ['fog', 'blood_moon', 'power_cut'];

/** The event a town gets, or null. A blackout town is already dark, so a power cut there turns into fog. */
export function nightEventFor(mapSeed: number, level: number): NightEvent | null {
  const eligible = level >= FIRST_EVENT_LEVEL && !isBunkerSeed(mapSeed);
  if (!eligible) return null;
  const rng = createRng((mapSeed ^ EVENT_SALT) >>> 0);
  const isQuietNight = rng() >= EVENT_CHANCE;
  if (isQuietNight) return null;
  const id = pick(rng, EVENT_ORDER);
  const alreadyDark = id === 'power_cut' && themeOf(level) === 'blackout';
  return NIGHT_EVENTS[alreadyDark ? 'fog' : id];
}

/** The last town asked about, since every zombie asks every tick. */
let cached: { seed: number; level: number; event: NightEvent | null } | null = null;

/** The event in force for the town the sim is in. */
export function eventOf(sim: Pick<SimState, 'map' | 'level'>): NightEvent | null {
  const fresh = cached !== null && cached.seed === sim.map.seed && cached.level === sim.level;
  if (!fresh) cached = { seed: sim.map.seed, level: sim.level, event: nightEventFor(sim.map.seed, sim.level) };
  return cached?.event ?? null;
}
