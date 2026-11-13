import { townContainers } from './containers.ts';
import type { BuildingKind, PickupType } from './protocol.ts';
import { createRng, shuffle } from './rng.ts';
import type { SimState } from './sim-state.ts';

/** Roughly one town in two has a Radio left in a building. */
export const RADIO_ODDS = 0.5;
/** Every car has a radio in it, and about one in ten still works, so going through cars is how most players find one. */
export const CAR_RADIO_ODDS = 0.1;
/** Keeps the Radio's rolls apart from the town's own use of its seed. */
const RADIO_SALT = 0x52414449;
const CAR_RADIO_SALT = 0x43415252;
/** Where a Radio is left: the places someone would have kept one. */
export const RADIO_PLACES: ReadonlySet<BuildingKind | 'outdoors'> = new Set(['house', 'apartment', 'diner', 'garage', 'radio_station']);

const SMALL_FINDS: ReadonlySet<PickupType> = new Set(['bandage', 'knife']);

/**
 * Whether the town's container could give up its place to a Radio: only bare ones or those holding a
 * small find, so the ammo the town settled on stays as it was.
 */
function canTakeRadio(sim: SimState, id: number): boolean {
  const held = sim.containers[id].loot;
  return held === null || SMALL_FINDS.has(held.type);
}

function placeCarRadios(sim: SimState): void {
  const rng = createRng(sim.map.seed ^ CAR_RADIO_SALT);
  for (const car of townContainers(sim.map).filter((container) => container.kind === 'car')) {
    const works = rng() < CAR_RADIO_ODDS;
    const hasOne = works && canTakeRadio(sim, car.id);
    if (hasOne) sim.containers[car.id].loot = { type: 'radio', rounds: 0 };
  }
}

/** The town a home run is owed a radio in: town 2, until everyone in the room has one. Arcade keeps the odds above. */
export const RADIO_TOWN = 2;

const radioOwed = (sim: SimState): boolean => sim.homeRun !== null && sim.level === RADIO_TOWN && sim.players.some((p) => p.home !== null && p.home.radio !== true);

/**
 * Leaves Radios in some cars and at most one in a building. All of it is picked from the town's seed alone,
 * on generators of its own, so it never moves the simulation's rolls, and a Radio is never loose on the floor.
 */
export function placeRadio(sim: SimState): void {
  placeCarRadios(sim);
  const rng = createRng(sim.map.seed ^ RADIO_SALT);
  const townHasRadio = rng() < RADIO_ODDS || radioOwed(sim);
  if (!townHasRadio) return;
  const places = townContainers(sim.map).filter((container) => RADIO_PLACES.has(container.buildingKind));
  const chosen = shuffle(rng, places).find(({ id }) => canTakeRadio(sim, id));
  if (chosen) sim.containers[chosen.id].loot = { type: 'radio', rounds: 0 };
}

/** The first container holding a Radio, or null when this town has none. */
export function radioContainerId(sim: SimState): number | null {
  const held = sim.containers.findIndex((state) => state.loot?.type === 'radio');
  return held < 0 ? null : held;
}
