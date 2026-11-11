import { characterOf } from './characters.ts';
import { rollFind } from './container-loot.ts';
import { containerInReach, SEARCH_SEC, townContainers } from './containers.ts';
import type { Container, ContainerLoot } from './containers.ts';
import type { PickupType } from './protocol.ts';
import { TICK_DT } from './constants.ts';
import { isBunkerMap } from './home-protocol.ts';
import { spawnPickup } from './pickups.ts';
import { isSalvagePickup } from './salvage-data.ts';
import { isTreasurePickup } from './treasure.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { emit } from './sim-state.ts';
import { pickWeighted } from './rng.ts';
import { makeNoise } from './zombie-senses.ts';
import { maybeCarAlarm, scroungeBottle } from './bottles.ts';
import { stashIn, takeStash } from './throwables.ts';
import { candyIn, STICKY_SEARCH_SCALE, sugarOf, takeCandy } from './candy.ts';
import { hasKeepsake, RABBIT_LUCK } from './keepsakes.ts';
import { isBooth, sellFireworks } from './fireworks-booth.ts';
import { AMMO_PICKUPS } from './constants.ts';
import { PICKUP_TYPES } from './events.ts';
import { groundBuildingId } from './leftovers.ts';
import { isAmmoPickup } from './pickups.ts';
import { pick } from './rng.ts';
import type { PickupState } from './sim-state.ts';
import { buildingAt } from './world-query.ts';

/** Odds that a search knocks something over. */
export const CLATTER_CHANCE = 0.1;
/** Zombies this close hear it, a good way short of a pistol. */
export const CLATTER_RADIUS = 170;

export function stopSearch(p: PlayerState): void {
  p.searchingId = null;
  p.searchLeft = 0;
  p.search = 0;
}

function startSearch(sim: SimState, p: PlayerState): void {
  const free = p.searchHeld && !p.searchSpent && !p.moving;
  const target = free ? containerInReach(sim.map, p.x, p.y, (id) => sim.containers[id].opened) : null;
  if (!target) return;
  p.searchingId = target.id;
  const stickyScale = 1 - (1 - STICKY_SEARCH_SCALE) * sugarOf(p, 'sticky_fingers');
  p.searchLeft = SEARCH_SEC[target.kind] * stickyScale;
}

/** Treasure and salvage: put away for the trip home, and searched for as if the container were empty. */
export const isHomeFind = (type: PickupType): boolean => isTreasurePickup(type) || isSalvagePickup(type);

interface Finds {
  /** Treasure or salvage put away here. It takes the place of nothing: a search of it still rolls for luck and for a bottle. */
  readonly treasure: ContainerLoot | null;
  /** What was put away here or, rolled now so every client agrees, what a lucky searcher turns up anyway. */
  readonly ordinary: ContainerLoot | null;
}

const BOX_AMMO_FIND_CHANCE = 0.55;

function scroungeBoxAmmo(sim: SimState, p: PlayerState, container: Container): ContainerLoot | null {
  const isBox = container.kind === 'box';
  if (!isBox) return null;
  const isLucky = sim.rng() < BOX_AMMO_FIND_CHANCE;
  if (!isLucky) return null;

  const weapon = p.weapon;
  const isShotgun = weapon === 'shotgun';
  if (isShotgun) return { type: 'shells', rounds: 2 };

  const isCarbine = weapon === 'carbine';
  if (isCarbine) return { type: 'carbine_ammo', rounds: 6 };

  return { type: 'pistol_ammo', rounds: 4 };
}

const POLICE_CAR_GUN_CHANCE = 0.45;
const AMBULANCE_MED_CHANCE = 0.65;

const AMBULANCE_MED_TABLE: Partial<Record<PickupType, number>> = {
  medkit: 4,
  bandage: 3,
  antibiotics: 3,
  disinfectant: 3,
};

function scroungeEmergencyVehicle(sim: SimState, container: Container): ContainerLoot | null {
  const isPolice = container.prop === 'police_h' || container.prop === 'police_v';
  if (isPolice) {
    const isGunFound = sim.rng() < POLICE_CAR_GUN_CHANCE;
    if (!isGunFound) return null;
    const rollsShotgun = sim.rng() < 0.5;
    const gunType: PickupType = rollsShotgun ? 'shotgun' : 'carbine';
    return { type: gunType, rounds: 0 };
  }

  const isAmbulance = container.prop === 'ambulance_h';
  if (isAmbulance) {
    const isMedFound = sim.rng() < AMBULANCE_MED_CHANCE;
    if (!isMedFound) return null;
    const medType = pickWeighted(sim.rng, AMBULANCE_MED_TABLE);
    return { type: medType, rounds: 0 };
  }

  return null;
}

const DUMPSTER_BASE_CHANCE = 0.3;

function scroungeDumpster(sim: SimState, p: PlayerState, container: Container): ContainerLoot | null {
  const isDumpster = container.kind === 'dumpster';
  if (!isDumpster) return null;
  const luck = characterOf(p.skin).searchLuck + (hasKeepsake(p, 'rabbit_foot') ? RABBIT_LUCK : 0);
  const isLucky = sim.rng() < DUMPSTER_BASE_CHANCE + luck;
  if (!isLucky) return null;
  const type = pick(sim.rng, PICKUP_TYPES);
  const rounds = isAmmoPickup(type) ? Math.ceil(AMMO_PICKUPS[type].rounds / 2) : 0;
  return { type, rounds };
}

/** Odds an empty search turns up a scrawled map of someone else's cache. */
export const MAP_CLUE_CHANCE = 0.2;

/** Marks one unvisited building that still holds loot, so the team's map shows what is in it. */
function revealCache(sim: SimState): boolean {
  const isHiddenCache = (item: PickupState): boolean => {
    if (item.ttl !== null) return false;
    const building = buildingAt(sim.map, item.x, item.y);
    return building !== null && !sim.entered.has(groundBuildingId(building));
  };
  const caches = sim.pickups.filter(isHiddenCache);
  const hasNoCache = caches.length === 0;
  if (hasNoCache) return false;
  const chosen = pick(sim.rng, caches);
  const building = buildingAt(sim.map, chosen.x, chosen.y);
  if (building) sim.entered.add(groundBuildingId(building));
  return true;
}

function findIn(sim: SimState, p: PlayerState, id: number): Finds {
  const { loot } = sim.containers[id];
  const treasure = loot !== null && isHomeFind(loot.type) ? loot : null;
  const stored = treasure ? null : loot;
  const luck = characterOf(p.skin).searchLuck + (hasKeepsake(p, 'rabbit_foot') ? RABBIT_LUCK : 0);
  // A candy bowl holds candy and nothing else, however lucky the hand in it.
  const isBowl = townContainers(sim.map)[id].kind === 'bowl';
  const lucky = stored === null && !isBowl && sim.rng() < luck;
  const ordinary = lucky ? rollFind(sim, townContainers(sim.map)[id].stock) : stored;
  return { treasure, ordinary };
}

/** Whatever was in it falls at the searcher's feet, for them or for whoever has room for it. */
function finishSearch(sim: SimState, p: PlayerState, id: number): void {
  const isFireworksBus = isBooth(townContainers(sim.map)[id]);
  if (isFireworksBus) {
    sellFireworks(sim, p, id);
    stopSearch(p);
    p.searchSpent = true;
    return;
  }
  const state = sim.containers[id];
  const { treasure, ordinary } = findIn(sim, p, id);
  state.opened = true;
  state.loot = null;
  const { clatterChance, noise } = characterOf(p.skin);
  const noisy = sim.rng() < CLATTER_CHANCE * clatterChance;
  const container = townContainers(sim.map)[id];
  const serviceLoot = ordinary === null ? scroungeEmergencyVehicle(sim, container) : null;
  const dumpsterLoot = ordinary === null && serviceLoot === null ? scroungeDumpster(sim, p, container) : null;
  const boxAmmo = ordinary === null && serviceLoot === null ? scroungeBoxAmmo(sim, p, container) : null;
  if (serviceLoot) spawnPickup(sim, serviceLoot.type, p.x, p.y, serviceLoot.rounds);
  if (dumpsterLoot) spawnPickup(sim, dumpsterLoot.type, p.x, p.y, dumpsterLoot.rounds);
  if (boxAmmo) spawnPickup(sim, boxAmmo.type, p.x, p.y, boxAmmo.rounds);
  const foundLoot = ordinary !== null || treasure !== null || serviceLoot !== null || dumpsterLoot !== null || boxAmmo !== null;
  const rollsClue = !foundLoot && container.kind !== 'bowl' && sim.rng() < MAP_CLUE_CHANCE;
  const clue = rollsClue && revealCache(sim);
  const found = foundLoot || clue;
  if (noisy) makeNoise(sim, p.x, p.y, CLATTER_RADIUS * noise);
  if (treasure) spawnPickup(sim, treasure.type, p.x, p.y, treasure.rounds);
  if (ordinary) spawnPickup(sim, ordinary.type, p.x, p.y, ordinary.rounds);
  const bottle = ordinary === null && serviceLoot === null && boxAmmo === null && container.kind !== 'bowl' && scroungeBottle(sim, p);
  const thrown = takeStash(p, stashIn(sim.map.seed, container));
  const candy = thrown ? null : takeCandy(p, candyIn(sim.map.seed, container));
  const stash = thrown ?? (candy ? 'candy' : null);
  maybeCarAlarm(sim, container);
  emit(sim, { type: 'container_opened', playerId: p.id, container: id, x: p.x, y: p.y, found: found || stash !== null, noisy, ...(bottle ? { bottle } : {}), ...(stash ? { stash } : {}), ...(candy ? { candy } : {}), ...(clue ? { clue: true as const } : {}) });
  stopSearch(p);
  p.searchSpent = true;
}

/** Ends a search the player or a teammate has put a stop to. */
function keepSearching(sim: SimState, p: PlayerState, id: number, hurt: boolean): void {
  const interrupted = p.moving || hurt;
  if (interrupted) p.searchSpent = true;
  const stopped = interrupted || !p.searchHeld || sim.containers[id].opened;
  if (stopped) stopSearch(p);
}

function advanceSearch(sim: SimState, p: PlayerState, id: number): void {
  const stickyScale = 1 - (1 - STICKY_SEARCH_SCALE) * sugarOf(p, 'sticky_fingers');
  const total = SEARCH_SEC[townContainers(sim.map)[id].kind] * stickyScale;
  p.searchLeft -= TICK_DT;
  // A floor above zero keeps "searching" distinct from "not searching" on the first tick.
  p.search = Math.max(0.01, 1 - p.searchLeft / total);
  const done = p.searchLeft <= 1e-9;
  if (done) finishSearch(sim, p, id);
}

/** Holding the key works through what is in reach. Moving or taking a hit undoes it, and it wants a fresh press. */
export function updateSearch(sim: SimState, p: PlayerState): void {
  const released = !p.searchHeld;
  if (released) p.searchSpent = false;
  // The bunker has no containers, and `sim.containers` still holds the last town's.
  if (isBunkerMap(sim.map)) return;
  const hurt = p.health < p.searchHealth;
  p.searchHealth = p.health;
  const searchingId = p.searchingId;
  const isSearching = searchingId !== null;
  if (isSearching) keepSearching(sim, p, searchingId, hurt);
  const isIdle = p.searchingId === null;
  if (isIdle) startSearch(sim, p);
  const openingId = p.searchingId;
  const isStillSearching = openingId !== null;
  if (isStillSearching) advanceSearch(sim, p, openingId);
}

/** The ids of everything opened in this town, for every client to draw. */
export function openedContainers(sim: SimState): number[] {
  const opened: number[] = [];
  sim.containers.forEach(({ opened: isOpen }, id) => {
    if (isOpen) opened.push(id);
  });
  return opened;
}
