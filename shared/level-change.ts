import { placeMerchants } from './bunker-merchants.ts';
import { offerKeepsakes } from './keepsakes.ts';
import { LEVEL_CLEAR_HEAL, PLAYER_RADIUS, SPAWN_SCATTER } from './constants.ts';
import { campSizeOf } from './camp/camp-latch.ts';
import type { CampSize } from './camp/camp-ring.ts';
import { stopSearch } from './container-search.ts';
import { FlowField } from './flow-field.ts';
import { BUNKER_LEVEL, BUNKER_SEED } from './home-protocol.ts';
import { parkBunkerVan } from './level-exit.ts';
import { leadInSeconds, levelPopulation, levelSeed } from './levels.ts';
import { placeTownLoot } from './loot.ts';
import { giveReturnKit } from './player-health.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { emit, openGroundNear } from './sim-state.ts';
import { seedPopulation } from './town-population.ts';
import { placeTownSalvage } from './salvage.ts';
import { placeTownTreasure } from './treasure.ts';
import { hordesSurvivedHere } from './waves.ts';
import { clearVehicles } from './vehicles.ts';
import { markTestDrive } from './vehicle-choice.ts';
import { generateWorldMap } from './world-map.ts';

function raiseMap(sim: SimState, seed: number, level: number, campSize: CampSize = 1): void {
  const sameMap = seed === sim.map.seed && campSize === (sim.map.camp?.size ?? 1);
  if (sameMap) return;
  sim.map = generateWorldMap(seed, level, campSize);
  sim.flow = new FlowField(sim.map);
  sim.noiseFlow = new FlowField(sim.map);
  if (sim.testDrive) markTestDrive(sim.map);
}

/** Nothing left of the last place: no horde, no bodies, no bullets. */
function emptyWorld(sim: SimState, level: number): void {
  sim.level = level;
  sim.exit = null;
  sim.bench = null;
  sim.phase = 'intermission';
  sim.wave = 0;
  sim.intermissionLeft = leadInSeconds(level);
  sim.hordeLeft = 0;
  sim.spawnQueue = [];
  sim.spawnTimer = 0;
  sim.populationTarget = levelPopulation(level);
  sim.topUpTimer = 0;
  sim.noises = [];
  sim.tracks = [];
  sim.spinners = [];
  sim.killChains.clear();
  sim.lures = [];
  sim.drop = null;
  sim.dropDone = false;
  sim.zombies = [];
  sim.merchants = [];
  sim.bullets = [];
  sim.pickups = [];
  sim.entered = new Set();
  sim.clues = new Map();
  sim.events = [];
  clearVehicles(sim);
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
  placeTownSalvage(sim);
}

/** Empties the world and goes home: no loot, no containers, no zombies, and the van parked. */
export function enterBunker(sim: SimState): void {
  raiseMap(sim, BUNKER_SEED, BUNKER_LEVEL, campSizeOf(sim));
  emptyWorld(sim, BUNKER_LEVEL);
  sim.containers = [];
  parkBunkerVan(sim);
  placeMerchants(sim);
}

/**
 * Rebuilds the camp at its latched size without emptying anything, for a fresh room whose first player has been further than the camp it was raised as.
 * Everything placed in the camp stands where it did, since nothing inside the smallest ring moves between sizes.
 */
export function raiseCamp(sim: SimState): void {
  const inCamp = sim.map.seed === BUNKER_SEED;
  if (inCamp) raiseMap(sim, BUNKER_SEED, BUNKER_LEVEL, campSizeOf(sim));
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
  p.spinnerQueued = false;
  p.fountainQueued = false;
  p.eatQueued = [];
  // Candy is carried on, and what is working keeps working. Fireworks are the town's: they stay behind when the van leaves it.
  p.fireworks = 0;
  p.fountains = 0;
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
  emit(sim, { type: 'wave_intermission', wave: 1, seconds: leadInSeconds(sim.level) });
}
