import {
  AMMO_FLOOR_SHARE,
  AMMO_PICKUPS,
  AMMO_POPULATION_SHARE,
  PLAYER_RADIUS,
  RESTOCK_ITEMS,
  RESTOCK_MIN_DISTANCE,
  ROAMER_MIX,
  STANDING_POPULATION,
  WEAPONS,
  ZOMBIES,
} from './constants.ts';
import { settleContainerAmmo, stockContainers, stockEmptyHomes } from './container-loot.ts';
import type { Point } from './flow-field.ts';
import { difficultyDef, scaleRounds } from './difficulty.ts';
import type { DifficultyId } from './difficulty.ts';
import { placeTownKits } from './kit-loot.ts';
import { placeKitchenKnives } from './kitchen-knives.ts';
import { levelDef } from './levels.ts';
import { placeTownParts } from './part-loot.ts';
import { isAmmoPickup, spawnPickup } from './pickups.ts';
import { placeRadio } from './radio.ts';
import { PART_ORDER } from './gun-upgrade-data.ts';
import { KIT_ORDER } from './round-effect-data.ts';
import { townContainers } from './containers.ts';
import { BUILDING_DEFS, TILE_SIZE } from './protocol.ts';
import type { BuildingInstance, BuildingKind, PickupType, WeaponId, WorldMap } from './protocol.ts';
import { createRng, pick, pickWeighted, randInt, shuffle } from './rng.ts';
import type { Rng } from './rng.ts';
import type { PickupState, SimState } from './sim-state.ts';
import { blockedTiles, buildingAt, buildingBox, circleHitsSolid, doorBox, isSolidProp, propBox } from './world-query.ts';
import { isStorey, townBuildings } from './storeys.ts';

export interface LootRule {
  /** How many items a building of this kind holds, inclusive. */
  readonly items: readonly [number, number];
  /** Relative odds of each item. */
  readonly table: Partial<Record<PickupType, number>>;
  /** Always here, on top of `items`. */
  readonly fixed?: readonly PickupType[];
  /** Ammo here is a half-empty box. */
  readonly smallAmmo?: boolean;
}

/** The sewers hold nothing to pick up. */
const NOTHING_UNDERGROUND: LootRule = { items: [0, 0], table: { bandage: 1 } };

export const LOOT_RULES: Record<BuildingKind, LootRule> = {
  pharmacy: { items: [2, 4], table: { medkit: 3.6, disinfectant: 3, antibiotics: 3, bandage: 2.4 } },
  clinic: { items: [3, 4], fixed: ['disinfectant'], table: { medkit: 3.5, antibiotics: 3.5, bandage: 3, water_bottle: 1 } },
  // The town's biggest store of medicine, and the most guarded: a medkit in the emergency bay every time.
  hospital: { items: [3, 5], fixed: ['medkit'], table: { antibiotics: 3.5, bandage: 3.5, medkit: 2, disinfectant: 2, pistol_ammo: 0.4 } },
  // A nurse's office and a kitchen: first aid, clean water, and the odd knife.
  school: { items: [1, 3], table: { bandage: 3, water_bottle: 2.5, canned_food: 1, knife: 1, pistol_ammo: 1 }, smallAmmo: true },
  police: { items: [3, 4], fixed: ['carbine'], table: { pistol_ammo: 3, carbine_ammo: 4, shells: 1 } },
  gun_shop: { items: [3, 4], fixed: ['shotgun'], table: { pistol_ammo: 3, shells: 3, carbine_ammo: 1 } },
  garage: { items: [0, 2], table: { pistol_ammo: 3, shells: 1.5, bandage: 1, knife: 0.4, water_bottle: 0.6, disinfectant: 0.6 } },
  warehouse: { items: [0, 2], table: { pistol_ammo: 3, carbine_ammo: 1.5, shells: 1.5, bandage: 1, water_bottle: 0.6, canned_food: 0.6 } },
  radio_station: { items: [1, 3], table: { pistol_ammo: 2, carbine_ammo: 1, bandage: 2, water_bottle: 2, canned_food: 1 } },
  grocery: { items: [1, 3], fixed: ['canned_food'], table: { water_bottle: 3.5, canned_food: 3.5, bandage: 2, pistol_ammo: 1 }, smallAmmo: true },
  // Cheap goods off the shelves: always canned food and bottled water, bandages, the odd knife, a half box of rounds.
  discount: { items: [0, 2], fixed: ['canned_food', 'water_bottle'], table: { canned_food: 2.5, water_bottle: 2.5, bandage: 2.5, pistol_ammo: 1, knife: 0.5 }, smallAmmo: true },
  diner: { items: [1, 2], fixed: ['canned_food'], table: { water_bottle: 2.5, canned_food: 2.5, knife: 2, bandage: 1.5, pistol_ammo: 0.5 }, smallAmmo: true },
  house: { items: [-1, 1], table: { pistol_ammo: 2, canned_food: 1.5, water_bottle: 1.5, bandage: 2.5, disinfectant: 0.5, knife: 0.1 }, smallAmmo: true },
  apartment: { items: [-1, 1], table: { pistol_ammo: 2.5, canned_food: 1.5, water_bottle: 1.5, bandage: 1.5, disinfectant: 0.5 }, smallAmmo: true },
  // What was put away upstairs, and what was hidden in the cellar: worth the trip down, and the noise it brings.
  // No ammo up or down: the town's rounds are budgeted, so these floors are for first aid, and the candy hidden in them.
  upstairs: { items: [0, 1], table: { bandage: 3, canned_food: 1, water_bottle: 1, knife: 0.3 } },
  cellar: { items: [0, 2], table: { bandage: 2, medkit: 1, canned_food: 1, water_bottle: 1, knife: 0.5 } },
  apartment_upstairs: { items: [0, 1], table: { bandage: 3, canned_food: 1, water_bottle: 1, knife: 0.3 } },
  // The wards keep their own first aid; the classrooms upstairs, a nurse's kit and a confiscated knife.
  hospital_upstairs: { items: [1, 3], table: { bandage: 3, medkit: 2, antibiotics: 2, disinfectant: 1 } },
  school_upstairs: { items: [0, 2], table: { bandage: 3, water_bottle: 2, knife: 0.5 } },
  sewer_maze: NOTHING_UNDERGROUND,
};

const STOREY_LOOT_SALT = 0x55504457;

/** Tiles in front of a door kept free of loot. */
const DOOR_CLEAR_TILES = 3;
/** A spot this close to a piece of furniture counts as next to it. */
const NEXT_TO_FURNITURE = 14;
const SPOT_CLEARANCE = PLAYER_RADIUS;

const spotCache = new WeakMap<WorldMap, Map<string, readonly Point[]>>();

/** Fraction of a shot that lands on something. Spread and overkill eat the rest. */
const SHOT_EFFICIENCY = 0.75;
const WALKER_SHARE = 1 - ROAMER_MIX.bloater - ROAMER_MIX.runner;
const AVERAGE_ROAMER_HEALTH = WALKER_SHARE * ZOMBIES.walker.health + ROAMER_MIX.runner * ZOMBIES.runner.health + ROAMER_MIX.bloater * ZOMBIES.bloater.health;
const POPULATION_HEALTH = STANDING_POPULATION * AVERAGE_ROAMER_HEALTH;
/** Damage all the map's ammo should add up to, on paper. */
const AMMO_DAMAGE_BUDGET = (POPULATION_HEALTH * AMMO_POPULATION_SHARE) / SHOT_EFFICIENCY;

function roundDamage(weapon: WeaponId): number {
  const { damage, pellets } = WEAPONS[weapon];
  // A shotgun's cone is wide, so about half of it finds the target.
  return damage * Math.max(1, pellets / 2);
}

/** What one pickup's rounds are worth in damage, if every one of them is fired. */
function damageOf(item: Pick<PickupState, 'type' | 'rounds'>): number {
  if (isAmmoPickup(item.type)) return item.rounds * roundDamage(AMMO_PICKUPS[item.type].weapon);
  const isGun = item.type === 'carbine' || item.type === 'shotgun';
  return isGun ? WEAPONS[item.type as WeaponId].foundAmmo * roundDamage(item.type as WeaponId) : 0;
}

/** Share of the standing population the given loot could kill. Exported for the balance spec. */
export function ammoKillShare(items: readonly Pick<PickupState, 'type' | 'rounds'>[]): number {
  const total = items.reduce((sum, item) => sum + damageOf(item), 0);
  return (total * SHOT_EFFICIENCY) / POPULATION_HEALTH;
}

function furnitureIn(map: WorldMap): Map<string, ReturnType<typeof propBox>[]> {
  const found = new Map<string, ReturnType<typeof propBox>[]>();
  for (const prop of map.props) {
    if (!isSolidProp(prop)) continue;
    const owner = buildingAt(map, prop.x, prop.y - 1);
    if (!owner) continue;
    const list = found.get(owner.id);
    if (list) list.push(propBox(prop));
    else found.set(owner.id, [propBox(prop)]);
  }
  return found;
}

function floorSpots(map: WorldMap, building: BuildingInstance): Point[] {
  const { x0, y0, x1, y1 } = buildingBox(building);
  const door = doorBox(building);
  const blocked = blockedTiles(map);
  const spots: Point[] = [];
  for (let y = y0; y < y1; y += TILE_SIZE) {
    for (let x = x0; x < x1; x += TILE_SIZE) {
      const free = blocked[(y / TILE_SIZE) * map.cols + x / TILE_SIZE] === 0;
      const inDoorway = !isStorey(building) && x >= door.x0 && x < door.x1 && y >= y1 - DOOR_CLEAR_TILES * TILE_SIZE;
      const spot = { x: x + TILE_SIZE / 2, y: y + TILE_SIZE / 2 };
      const usable = free && !inDoorway && !circleHitsSolid(map, spot.x, spot.y, SPOT_CLEARANCE);
      if (usable) spots.push(spot);
    }
  }
  return spots;
}

/** Floor beside the furniture of each building, and any open floor where a room has none. */
export function lootSpots(map: WorldMap, building: BuildingInstance): readonly Point[] {
  let cache = spotCache.get(map);
  if (!cache) {
    cache = new Map();
    const furniture = furnitureIn(map);
    for (const each of map.buildings) {
      const floor = floorSpots(map, each);
      const boxes = furniture.get(each.id) ?? [];
      const beside = floor.filter((spot) =>
        boxes.some((box) => {
          const dx = spot.x - Math.max(box.x0, Math.min(spot.x, box.x1));
          const dy = spot.y - Math.max(box.y0, Math.min(spot.y, box.y1));
          return Math.hypot(dx, dy) <= NEXT_TO_FURNITURE;
        }),
      );
      cache.set(each.id, beside.length > 0 ? beside : floor);
    }
    spotCache.set(map, cache);
  }
  return cache.get(building.id) ?? [];
}

const rollItem = (rng: Rng, rule: LootRule): PickupType => pickWeighted(rng, rule.table);

function roundsIn(type: PickupType, rule: LootRule, difficulty: DifficultyId): number {
  if (!isAmmoPickup(type)) return 0;
  const { rounds } = AMMO_PICKUPS[type];
  return scaleRounds(rule.smallAmmo ? Math.ceil(rounds / 2) : rounds, difficulty);
}

function stock(sim: SimState, building: BuildingInstance, items: readonly PickupType[], rng: Rng = sim.rng): void {
  const rule = LOOT_RULES[building.kind];
  // A second pass over a building, such as the ammo top-up, keeps off the spots the first one filled.
  const isTaken = (spot: Point): boolean => sim.pickups.some((item) => item.x === spot.x && item.y === spot.y);
  const spots = shuffle(rng, lootSpots(sim.map, building).filter((spot) => !isTaken(spot)));
  items.slice(0, spots.length).forEach((type, index) => {
    spawnPickup(sim, type, spots[index].x, spots[index].y, roundsIn(type, rule, sim.difficulty));
  });
}

/**
 * Brings the floors to their share of the ammo and says what they came to. Odd finds go first when
 * they hold too much, and a short town gets another box from wherever one would lie.
 */
function settleFloorAmmo(sim: SimState, share: number): number {
  const removable = shuffle(sim.rng, sim.pickups.filter((item) => isAmmoPickup(item.type)));
  let total = sim.pickups.reduce((sum, item) => sum + damageOf(item), 0);
  while (total > share && removable.length > 0) {
    const item = removable.pop() as PickupState;
    total -= damageOf(item);
    sim.pickups.splice(sim.pickups.indexOf(item), 1);
  }
  for (const building of shuffle(sim.rng, [...townBuildings(sim.map)])) {
    const rule = LOOT_RULES[building.kind];
    const type = rollItem(sim.rng, rule);
    const worth = damageOf({ type, rounds: roundsIn(type, rule, sim.difficulty) });
    const fits = isAmmoPickup(type) && total + worth <= share;
    if (!fits) continue;
    stock(sim, building, [type]);
    total += worth;
  }
  return total;
}

/** Stocks the town for a new run. */
export function placeTownLoot(sim: SimState): void {
  const upOrDown = createRng(sim.map.seed ^ STOREY_LOOT_SALT);
  for (const building of townBuildings(sim.map)) {
    const rule = LOOT_RULES[building.kind];
    const count = Math.max(0, randInt(sim.rng, rule.items[0], rule.items[1]));
    const rolled = Array.from({ length: count }, () => rollItem(sim.rng, rule));
    stock(sim, building, [...(rule.fixed ?? []), ...rolled]);
  }
  stockContainers(sim, upOrDown);
  const budget = AMMO_DAMAGE_BUDGET * levelDef(sim.level).difficulty * difficultyDef(sim.difficulty).ammo;
  const onFloors = settleFloorAmmo(sim, budget * AMMO_FLOOR_SHARE);
  settleContainerAmmo(sim, budget - onFloors, damageOf);
  stockEmptyHomes(sim);
  placeRadio(sim);
  placeKitchenKnives(sim);
  placeTownParts(sim, (building) => lootSpots(sim.map, building));
  placeTownKits(sim, (building) => lootSpots(sim.map, building));
  placeDiscountRareShelves(sim);
  stockStoreys(sim, upOrDown);
}

const DISCOUNT_RARE_SALT = 0x505d15c;
const DISCOUNT_RARE_ITEMS: readonly PickupType[] = [...KIT_ORDER, ...PART_ORDER];

/** Guarantees that S.O.S. Discount's shelves always carry a rare item (kit or gun part). */
function placeDiscountRareShelves(sim: SimState): void {
  const discountShelves = townContainers(sim.map).filter(
    (container) => container.buildingKind === 'discount' && container.kind === 'shelf'
  );
  const hasShelves = discountShelves.length > 0;
  if (!hasShelves) return;

  const rng = createRng(sim.map.seed ^ DISCOUNT_RARE_SALT);
  const targetShelf = pick(rng, discountShelves);
  const rareItem = pick(rng, DISCOUNT_RARE_ITEMS);
  sim.containers[targetShelf.id].loot = { type: rareItem, rounds: 0 };
}

/** The floors above and below get their own finds, last, on their own generator: the town's rolls are as they were. */
function stockStoreys(sim: SimState, rng: Rng): void {
  for (const storey of sim.map.buildings.filter(isStorey)) {
    const rule = LOOT_RULES[storey.kind];
    const count = Math.max(0, randInt(rng, rule.items[0], rule.items[1]));
    stock(sim, storey, Array.from({ length: count }, () => rollItem(rng, rule)), rng);
  }
}

function gunsMissing(sim: SimState): Set<string> {
  const missing = new Set<string>(['carbine', 'shotgun']);
  for (const item of sim.pickups) missing.delete(item.type);
  for (const p of sim.players) {
    for (const gun of p.owned) missing.delete(gun);
  }
  return missing;
}

/** A little more, somewhere far off. A gun lost with a dead teammate returns to its shop. */
export function restockLoot(sim: SimState): void {
  const standing = sim.players.filter((p) => p.status !== 'dead');
  const farOff = (building: BuildingInstance): boolean => {
    const { w, h } = BUILDING_DEFS[building.kind];
    return standing.every((p) => Math.hypot(building.x + w / 2 - p.x, building.y + h / 2 - p.y) >= RESTOCK_MIN_DISTANCE);
  };
  const candidates = shuffle(sim.rng, townBuildings(sim.map).filter(farOff));
  for (const building of candidates.slice(0, RESTOCK_ITEMS)) {
    stock(sim, building, [rollItem(sim.rng, LOOT_RULES[building.kind])]);
  }
  const lost = gunsMissing(sim);
  for (const building of candidates) {
    const gun = LOOT_RULES[building.kind].fixed?.find((type) => lost.has(type));
    if (gun) stock(sim, building, [gun]);
  }
}
