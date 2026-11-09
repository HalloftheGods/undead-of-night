import { characterOf } from './characters.ts';
import { rollFind } from './container-loot.ts';
import { containerInReach, SEARCH_SEC, townContainers } from './containers.ts';
import type { ContainerLoot } from './containers.ts';
import { TICK_DT } from './constants.ts';
import { isBunkerMap } from './home-protocol.ts';
import { spawnPickup } from './pickups.ts';
import { isTreasurePickup } from './treasure.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { emit } from './sim-state.ts';
import { makeNoise } from './zombie-senses.ts';
import { maybeCarAlarm, scroungeBottle } from './bottles.ts';
import { stashIn, takeStash } from './throwables.ts';
import { candyCarry, candyIn, takeCandy } from './candy.ts';
import { hasKeepsake, RABBIT_LUCK } from './keepsakes.ts';
import { isBooth, sellFireworks } from './fireworks-booth.ts';

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
  p.searchLeft = SEARCH_SEC[target.kind];
}

interface Finds {
  /** Treasure put away here. It takes the place of nothing: a search of it still rolls for luck and for a bottle. */
  readonly treasure: ContainerLoot | null;
  /** What was put away here or, rolled now so every client agrees, what a lucky searcher turns up anyway. */
  readonly ordinary: ContainerLoot | null;
}

function findIn(sim: SimState, p: PlayerState, id: number): Finds {
  const { loot } = sim.containers[id];
  const treasure = loot !== null && isTreasurePickup(loot.type) ? loot : null;
  const stored = treasure ? null : loot;
  const luck = characterOf(p.skin).searchLuck + (hasKeepsake(p, 'rabbit_foot') ? RABBIT_LUCK : 0);
  // A candy bowl holds candy and nothing else, however lucky the hand in it.
  const isBowl = townContainers(sim.map)[id].kind === 'bowl';
  const lucky = stored === null && !isBowl && sim.rng() < luck;
  const ordinary = lucky ? rollFind(sim, townContainers(sim.map)[id].stock) : stored;
  return { treasure, ordinary };
}

/**
 * A bowl's candy only goes into a bag with room. Full, the searcher is told so and the bowl stays out
 * for whoever comes next. True if it did.
 */
function bowlLeftFor(sim: SimState, p: PlayerState, id: number): boolean {
  const container = townContainers(sim.map)[id];
  const isFullAtBowl = container.kind === 'bowl' && p.candy.length >= candyCarry(p);
  if (!isFullAtBowl) return false;
  emit(sim, { type: 'container_opened', playerId: p.id, container: id, x: p.x, y: p.y, found: false, noisy: false, full: true });
  stopSearch(p);
  p.searchSpent = true;
  return true;
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
  const leftOut = bowlLeftFor(sim, p, id);
  if (leftOut) return;
  const state = sim.containers[id];
  const { treasure, ordinary } = findIn(sim, p, id);
  state.opened = true;
  state.loot = null;
  const { clatterChance, noise } = characterOf(p.skin);
  const noisy = sim.rng() < CLATTER_CHANCE * clatterChance;
  const found = ordinary !== null || treasure !== null;
  if (noisy) makeNoise(sim, p.x, p.y, CLATTER_RADIUS * noise);
  if (treasure) spawnPickup(sim, treasure.type, p.x, p.y, treasure.rounds);
  if (ordinary) spawnPickup(sim, ordinary.type, p.x, p.y, ordinary.rounds);
  const container = townContainers(sim.map)[id];
  const bottle = ordinary === null && container.kind !== 'bowl' && scroungeBottle(sim, p);
  const thrown = takeStash(p, stashIn(sim.map.seed, container));
  const candy = thrown ? null : takeCandy(p, candyIn(sim.map.seed, container));
  const stash = thrown ?? (candy ? 'candy' : null);
  maybeCarAlarm(sim, container);
  emit(sim, { type: 'container_opened', playerId: p.id, container: id, x: p.x, y: p.y, found: found || stash !== null, noisy, ...(bottle ? { bottle } : {}), ...(stash ? { stash } : {}), ...(candy ? { candy } : {}) });
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
  const total = SEARCH_SEC[townContainers(sim.map)[id].kind];
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
