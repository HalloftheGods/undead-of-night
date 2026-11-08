import { offerKeepsakes } from './keepsakes.ts';
import { LEAD_IN_SEC, LEVEL_CLEAR_HEAL, PLAYER_RADIUS, SPAWN_SCATTER } from './constants.ts';
import { stopSearch } from './container-search.ts';
import { FlowField } from './flow-field.ts';
import { BUNKER_LEVEL, BUNKER_SEED } from './home-protocol.ts';
import { parkBunkerVan } from './level-exit.ts';
import { levelPopulation, levelSeed } from './levels.ts';
import { placeTownLoot } from './loot.ts';
import { giveReturnKit } from './player-health.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { emit, openGroundNear } from './sim-state.ts';
import { seedPopulation } from './town-population.ts';
import { placeTownTreasure } from './treasure.ts';
import { hordesSurvivedHere } from './waves.ts';
import { generateWorldMap } from './world-map.ts';

function raiseMap(sim: SimState, seed: number, level: number): void {
  const sameMap = seed === sim.map.seed;
  if (sameMap) return;
  sim.map = generateWorldMap(seed, level);
  sim.flow = new FlowField(sim.map);
  sim.noiseFlow = new FlowField(sim.map);
}

/** Nothing left of the last place: no horde, no bodies, no bullets. */
function emptyWorld(sim: SimState, level: number): void {
  sim.level = level;
  sim.exit = null;
  sim.bench = null;
  sim.phase = 'intermission';
  sim.wave = 0;
  sim.intermissionLeft = LEAD_IN_SEC;
  sim.hordeLeft = 0;
  sim.spawnQueue = [];
  sim.spawnTimer = 0;
  sim.populationTarget = levelPopulation(level);
  sim.topUpTimer = 0;
  sim.noises = [];
  sim.tracks = [];
  sim.fires = [];
  sim.killChains.clear();
  sim.flares = [];
  sim.drop = null;
  sim.dropDone = false;
  sim.zombies = [];
  sim.bullets = [];
  sim.pickups = [];
  sim.entered = new Set();
  sim.events = [];
  sim.flow.invalidate();
  sim.noiseFlow.invalidate();
}

/** Empties the world and raises a level's town, stocked and populated, ready for its lead-in. */
export function enterTown(sim: SimState, level: number): void {
  raiseMap(sim, levelSeed(sim.runSeed, level, sim.homeRun?.attempt), level);
  emptyWorld(sim, level);
  placeTownLoot(sim);
  seedPopulation(sim);
  placeTownTreasure(sim);
}

/** Empties the world and goes home: no loot, no containers, no zombies, and the van parked. */
export function enterBunker(sim: SimState): void {
  raiseMap(sim, BUNKER_SEED, BUNKER_LEVEL);
  emptyWorld(sim, BUNKER_LEVEL);
  sim.containers = [];
  parkBunkerVan(sim);
}

/** Puts someone down beside the town's entry. */
export function placeAtEntry(sim: SimState, p: PlayerState): void {
  const spot = openGroundNear(sim, sim.map.spawn.x, sim.map.spawn.y, 8, SPAWN_SCATTER, PLAYER_RADIUS + 1);
  p.x = spot.x;
  p.y = spot.y;
  p.moving = false;
  p.indoors = null;
  p.bleedout = 0;
  p.revive = 0;
  p.reload = 0;
  p.reloadLeft = 0;
  p.reloadQueued = false;
  p.weaponQueued = null;
  p.meleeQueued = false;
  p.healQueued = false;
  p.throwQueued = false;
  p.molotovQueued = false;
  p.flareQueued = false;
  p.eatQueued = false;
  // Candy is carried on, and what is working keeps working. Fuel and flares are the town's: they stay behind when the van leaves it.
  p.fuel = 0;
  p.flares = 0;
  p.shootQueued = false;
  stopSearch(p);
}

/** On their feet: everything carried comes along. Anyone left behind comes back like the dead do. */
function settleInNewTown(sim: SimState, p: PlayerState): void {
  const leftBehind = p.status !== 'alive';
  placeAtEntry(sim, p);
  if (leftBehind) {
    p.status = 'alive';
    giveReturnKit(p);
  } else {
    p.health = Math.min(p.maxHealth, p.health + LEVEL_CLEAR_HEAL);
  }
}

/**
 * Everyone moves on together, and so does anyone mid-refresh: a record kept for a reconnect
 * would otherwise come back standing at a spot in a town that no longer exists.
 */
export function moveToNextTown(sim: SimState): void {
  const finished = sim.level;
  const returning = sim.players.filter((p) => p.status !== 'alive');
  sim.hordesBehind += hordesSurvivedHere(sim);
  enterTown(sim, finished + 1);
  for (const p of sim.players) settleInNewTown(sim, p);
  for (const p of sim.departed.values()) settleInNewTown(sim, p);
  offerKeepsakes(sim, [...sim.players, ...sim.departed.values()]);
  emit(sim, { type: 'level_complete', level: finished });
  emit(sim, { type: 'level_start', level: sim.level });
  for (const p of returning) emit(sim, { type: 'player_revived', playerId: p.id, x: p.x, y: p.y });
  emit(sim, { type: 'wave_intermission', wave: 1, seconds: LEAD_IN_SEC });
}
