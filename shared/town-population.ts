import {
  POPULATION_TOPUP_SEC,
  ROAMER_MIX,
  SCREAMER_FROM_LEVEL,
  SCREAMER_SHARE,
  SCREAMER_SHARE_PER_LEVEL,
  SPAWN_SAFE_RADIUS,
  TICK_DT,
  TOPUP_MIN_DISTANCE,
  ZOMBIES,
  ZOMBIE_CAP,
} from './constants.ts';
import type { Point } from './flow-field.ts';
import { levelDef } from './levels.ts';
import { lootSpots } from './loot.ts';
import type { BuildingInstance, BuildingKind, ZombieType } from './protocol.ts';
import { pick, randRange } from './rng.ts';
import type { SimState } from './sim-state.ts';
import { hiddenFromEveryone } from './sim-state.ts';
import { spawnZombie } from './waves.ts';
import { buildingAt, circleHitsSolid, isBlockedAt } from './world-query.ts';
import { townBuildings, townHeight } from './storeys.ts';

/** Share of the standing population that sits inside buildings. */
const INDOOR_SHARE = 0.45;
const SPOT_TRIES = 40;
/** The first tough type appears in the streets from this horde on. */
const BRUTE_FROM_WAVE = 4;
/** Share of roamers that are brutes once they have started to appear. */
const BRUTE_SHARE = 0.03;
/** Places worth raiding start with something in the way. */
const GUARDS: Partial<Record<BuildingKind, number>> = { police: 4, gun_shop: 3, clinic: 2, pharmacy: 2 };

/** Share of a level's roamers that are screamers. */
export function screamerShare(level: number): number {
  const early = level < SCREAMER_FROM_LEVEL;
  return early ? 0 : SCREAMER_SHARE + SCREAMER_SHARE_PER_LEVEL * (level - SCREAMER_FROM_LEVEL);
}

function rollType(sim: SimState): ZombieType {
  const { mix } = levelDef(sim.level);
  const roll = sim.rng();
  const bloatersEnd = ROAMER_MIX.bloater + mix.bloater;
  const runnersEnd = bloatersEnd + ROAMER_MIX.runner + mix.runner;
  const isBloaterRoll = roll < bloatersEnd;
  if (isBloaterRoll) return 'bloater';
  const isRunnerRoll = roll < runnersEnd;
  if (isRunnerRoll) return 'runner';
  const bruteShare = mix.brute + (sim.wave >= BRUTE_FROM_WAVE ? BRUTE_SHARE : 0);
  const brutesEnd = runnersEnd + bruteShare;
  const screamersEnd = brutesEnd + screamerShare(sim.level);
  const bruteRolled = roll < brutesEnd;
  if (bruteRolled) return 'brute';
  return roll < screamersEnd ? 'screamer' : 'walker';
}

const clearFor = (sim: SimState, type: ZombieType, spot: Point): boolean =>
  !isBlockedAt(sim.map, spot.x, spot.y) && !circleHitsSolid(sim.map, spot.x, spot.y, ZOMBIES[type].radius + 1);

function indoorSpot(sim: SimState, building: BuildingInstance, type: ZombieType): Point | null {
  const spots = lootSpots(sim.map, building);
  const hasNoSpots = spots.length === 0;
  if (hasNoSpots) return null;
  const spot = pick(sim.rng, spots);
  return clearFor(sim, type, spot) ? spot : null;
}

function outdoorSpot(sim: SimState, type: ZombieType): Point | null {
  const spot = { x: randRange(sim.rng, 0, sim.map.width), y: randRange(sim.rng, 0, townHeight(sim.map)) };
  const outside = buildingAt(sim.map, spot.x, spot.y) === null;
  return outside && clearFor(sim, type, spot) ? spot : null;
}

/** A place for one more body, out of reach of `allowed`, or null if the tries ran out. */
function findSpot(sim: SimState, type: ZombieType, allowed: (spot: Point) => boolean): Point | null {
  for (let attempt = 0; attempt < SPOT_TRIES; attempt++) {
    const indoors = sim.rng() < INDOOR_SHARE;
    const spot = indoors ? indoorSpot(sim, pick(sim.rng, townBuildings(sim.map)), type) : outdoorSpot(sim, type);
    const found = spot !== null && allowed(spot);
    if (found) return spot;
  }
  return null;
}

const farFromSpawn = (sim: SimState, spot: Point): boolean =>
  Math.hypot(spot.x - sim.map.spawn.x, spot.y - sim.map.spawn.y) >= SPAWN_SAFE_RADIUS;

function placeGuards(sim: SimState): void {
  for (const building of townBuildings(sim.map)) {
    const guards = GUARDS[building.kind] ?? 0;
    for (let i = 0; i < guards && sim.zombies.length < sim.populationTarget; i++) {
      const spot = indoorSpot(sim, building, 'walker');
      const placeable = spot !== null && farFromSpawn(sim, spot);
      if (placeable) spawnZombie(sim, 'walker', spot.x, spot.y);
    }
  }
}

/** Fills the town for a new run, leaving the ground around the spawn empty. */
export function seedPopulation(sim: SimState): void {
  placeGuards(sim);
  while (sim.zombies.length < sim.populationTarget) {
    const type = rollType(sim);
    const spot = findSpot(sim, type, (candidate) => farFromSpawn(sim, candidate));
    if (!spot) return;
    spawnZombie(sim, type, spot.x, spot.y);
  }
}

/** One replacement at a time, out of sight, so a cleared street fills back in slowly. */
export function updatePopulation(sim: SimState): void {
  sim.topUpTimer -= TICK_DT;
  const isTopUpPending = sim.topUpTimer > 0;
  if (isTopUpPending) return;
  sim.topUpTimer = POPULATION_TOPUP_SEC;
  const roamers = sim.zombies.filter((z) => !z.horde).length;
  // A horde's waiting bodies hold their places under the cap, so the HUD's count stays true.
  const wanted = roamers < sim.populationTarget && sim.zombies.length + sim.spawnQueue.length < ZOMBIE_CAP;
  if (!wanted) return;
  const type = rollType(sim);
  const spot = findSpot(sim, type, (candidate) => hiddenFromEveryone(sim, candidate, TOPUP_MIN_DISTANCE));
  if (spot) spawnZombie(sim, type, spot.x, spot.y);
}
