// A town is built in phases, and each phase draws from a random stream of its own, so a draw added to one
// phase never moves what a later one lays down. The plan (roads, blocks, districts) keeps the town's own seed;
// every other phase salts it, in the STOREY_FURNISH_SALT style. Interiors go one step further: each building
// is furnished from a stream keyed to where it stands, so changing one room leaves every other room alone.

import { createRng } from './rng.ts';
import type { Rng } from './rng.ts';

export type MapPhase = 'plan' | 'buildings' | 'interiors' | 'terrain' | 'lights';

export type MapSalts = Readonly<Record<MapPhase, number>>;

/** The salts towns are built with. Changing any of them changes towns: bump PROTOCOL_VERSION. */
export const MAP_SALTS: MapSalts = {
  plan: 0,
  buildings: 0x424c4447,
  interiors: 0x494e5452,
  terrain: 0x54455252,
  lights: 0x4c495445,
};

const MIX = 0x9e3779b1;

/** The stream one phase of the town on `seed` draws from. */
export function mapStream(seed: number, phase: MapPhase, salts: MapSalts = MAP_SALTS): Rng {
  return createRng((seed ^ salts[phase]) >>> 0);
}

/** The stream one building's interior is furnished from, keyed to the town and to where the building stands. */
export function interiorStream(seed: number, x: number, y: number, salts: MapSalts = MAP_SALTS): Rng {
  const keyed = Math.imul((seed ^ salts.interiors) >>> 0, MIX) ^ Math.imul(x | 0, 0x85ebca6b) ^ Math.imul(y | 0, 0xc2b2ae35);
  return createRng(keyed >>> 0);
}
