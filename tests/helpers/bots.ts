import { EXIT_RADIUS, MEDKIT_MAX, PLAYER_RADIUS, WEAPONS } from '../../shared/constants.ts';
import { containerInReach, townContainers } from '../../shared/containers.ts';
import type { Container } from '../../shared/containers.ts';
import { FlowField } from '../../shared/flow-field.ts';
import type { Point } from '../../shared/flow-field.ts';
import { WEAPON_ORDER } from '../../shared/protocol.ts';
import type { BuildingInstance, ClientInputPacket, PickupEntity, PlayerEntity, SnapshotPacket, WeaponId, WorldMap, ZombieEntity } from '../../shared/protocol.ts';
import { buildingBox, doorBox, generateWorldMap, segmentHitsSolid } from '../../shared/world-map.ts';
import { buildingAt, circleHitsSolid } from '../../shared/world-query.ts';

const KEEP_AWAY = 70;
const ENGAGE = 170;

function nearestZombie(me: PlayerEntity, zombies: readonly ZombieEntity[]): ZombieEntity | null {
  let best: ZombieEntity | null = null;
  let bestDistance = Infinity;
  for (const z of zombies) {
    const distance = Math.hypot(z.x - me.x, z.y - me.y);
    const isNearer = distance < bestDistance;
    if (isNearer) {
      bestDistance = distance;
      best = z;
    }
  }
  return best;
}

/**
 * Circles the nearest threat and shoots it, the way a casual player kites:
 * back off inside KEEP_AWAY, orbit otherwise, collect anything lying about.
 * Stateful only in its orbit direction, which flips when it gets stuck.
 */
export class CirclingBot {
  private readonly id: string;
  private readonly map: WorldMap;
  private seq = 0;
  private orbit = 1;
  private lastX = 0;
  private lastY = 0;
  /** Guns seen fully empty, skipped until an ammo pickup. */
  private readonly drained = new Set<WeaponId>();

  constructor(id: string, map: WorldMap) {
    this.id = id;
    this.map = map;
  }

  private bestGun(me: PlayerEntity): WeaponId {
    const loaded = WEAPON_ORDER.filter((id) => me.owned.includes(id) && !this.drained.has(id));
    return loaded[loaded.length - 1];
  }

  private headFor(dirX: number, dirY: number, shoot: boolean, angle: number, me: PlayerEntity): ClientInputPacket {
    const dryMag = me.ammo === 0;
    const isGunDrained = dryMag && me.reserve === 0;
    if (isGunDrained) this.drained.add(me.weapon);
    this.seq += 1;
    return {
      seq: this.seq,
      up: dirY < -0.3,
      down: dirY > 0.3,
      left: dirX < -0.3,
      right: dirX > 0.3,
      angle,
      shoot,
      reload: dryMag || (!shoot && me.ammo < me.magSize),
      weapon: this.bestGun(me),
      melee: false,
      heal: false,
      search: false,
    };
  }

  think(snapshot: SnapshotPacket): ClientInputPacket | null {
    const me = snapshot.players.find((p) => p.id === this.id);
    if (!me) return null;
    const restocked = snapshot.events.some((event) => event.type === 'pickup' && event.playerId === this.id);
    if (restocked) this.drained.clear();
    const stuck = me.moving && Math.hypot(me.x - this.lastX, me.y - this.lastY) < 0.5;
    if (stuck) this.orbit = -this.orbit;
    this.lastX = me.x;
    this.lastY = me.y;

    const target = nearestZombie(me, snapshot.zombies);
    const loot = snapshot.pickups.find((item) => Math.hypot(item.x - me.x, item.y - me.y) < 150);
    const distance = target ? Math.hypot(target.x - me.x, target.y - me.y) : Infinity;

    const isLootFar = loot && distance > 60;
    if (isLootFar) {
      const angle = target ? Math.atan2(target.y - me.y, target.x - me.x) : me.angle;
      return this.headFor(loot.x - me.x, loot.y - me.y, target !== null && distance < WEAPONS[me.weapon].range, angle, me);
    }
    if (!target) return this.headFor(this.map.spawn.x - me.x, this.map.spawn.y - me.y, false, me.angle, me);

    const toX = (target.x - me.x) / distance;
    const toY = (target.y - me.y) / distance;
    const angle = Math.atan2(toY, toX);
    const lineClear = !segmentHitsSolid(this.map, me.x, me.y, target.x, target.y);
    const shoot = lineClear && distance < WEAPONS[me.weapon].range * 0.9;

    const orbitX = -toY * this.orbit;
    const orbitY = toX * this.orbit;
    const isTooClose = distance < KEEP_AWAY;
    if (isTooClose) return this.headFor(orbitX - toX * 1.4, orbitY - toY * 1.4, shoot, angle, me);
    const isTooFar = distance > ENGAGE;
    if (isTooFar) return this.headFor(orbitX + toX, orbitY + toY, shoot, angle, me);
    return this.headFor(orbitX, orbitY, shoot, angle, me);
  }
}

/** Fires only at what is about to reach it, with runners earning a longer leash. */
const WALKER_FIRE_RANGE = 70;
const RUNNER_FIRE_RANGE = 120;
const SHOVE_RANGE = 26;
const SHOVE_EVERY_TICKS = 22;
const HEAL_BELOW = 55;
const TICKS_BEFORE_UNSTICK = 45;
/** On the way to the van, only what lies this close is worth the detour. */
const DETOUR_RANGE = 90;
/** Far enough inside the van's circle that a shove back does not put it outside. */
const BOARDED_RANGE = EXIT_RADIUS * 0.6;
const VAN_APPROACH = PLAYER_RADIUS + 8;
const COMMITTED = 0.7;
/** With this many rounds to fire and its health up, it has better things to do than open drawers. */
const ROUNDS_ENOUGH = 40;
/** It leaves the drawers alone with anything it can see this close. */
const SEARCH_SAFE_RANGE = 120;
/** A shop's shelves are not worth the night: it goes through this many in a building, then moves on. */
const SEARCHES_PER_BUILDING = 3;
/** Anything it has been after for this long, it stops being after. */
const GOAL_PATIENCE_TICKS = 600;
const SPOT_STEP = 4;
const SPOT_MARGIN = 24;

interface Goal extends Point {
  readonly key: string;
  /** Set when the point of going there is to search. */
  readonly container?: Container;
}

const containerKey = ({ id }: Container): string => `container-${id}`;

const isGun = (type: PickupEntity['type']): boolean => type === 'carbine' || type === 'shotgun';
/** Everyone knows where the guns were kept. */
const sellsWhatItLacks = (me: PlayerEntity, building: BuildingInstance): boolean =>
  (building.kind === 'police' && !me.owned.includes('carbine')) || (building.kind === 'gun_shop' && !me.owned.includes('shotgun'));
const usableRounds = (me: PlayerEntity): number => me.ammo + me.owned.reduce((sum, gun) => sum + me.ammoBag[gun], 0);

/** True if this item would do anything for the player right now. */
function wanted(me: PlayerEntity, item: PickupEntity): boolean {
  const isBandage = item.type === 'bandage';
  if (isBandage) return me.health < me.maxHealth;
  const isMedkit = item.type === 'medkit';
  if (isMedkit) return me.medkits < MEDKIT_MAX;
  const isPistolAmmo = item.type === 'pistol_ammo';
  if (isPistolAmmo) return me.ammoBag.pistol < WEAPONS.pistol.reserveCap;
  const isCarbineAmmo = item.type === 'carbine_ammo';
  if (isCarbineAmmo) return me.ammoBag.carbine < WEAPONS.carbine.reserveCap;
  const isShells = item.type === 'shells';
  if (isShells) return me.ammoBag.shotgun < WEAPONS.shotgun.reserveCap;
  const isKnife = item.type === 'knife';
  if (isKnife) return !me.knife;
  return isGun(item.type) && !me.owned.includes(item.type as WeaponId);
}

/**
 * Plays the game as intended: walks building to building taking what it needs, keeps
 * moving through trouble, shoots only what is about to reach it, shoves when it can.
 * With `leavesTown` it also heads for the van once there is one, and follows the run to the next town.
 */
export class ScavengerBot {
  private readonly id: string;
  private readonly leavesTown: boolean;
  private map: WorldMap;
  private nav: FlowField;
  private readonly searched = new Set<string>();
  /** Goals it spent too long on, and where it stands to reach the containers it has looked at. */
  private readonly abandoned = new Set<string>();
  private readonly spots = new Map<number, Point | null>();
  private goalTicks = 0;
  private holdingSearch = false;
  private seq = 0;
  private tick = 0;
  private lastShove = -SHOVE_EVERY_TICKS;
  private goalKey = '';
  private lastX = 0;
  private lastY = 0;
  private stuckTicks = 0;
  private unstickX = 0;
  private unstickY = 0;
  private unstickLeft = 0;

  constructor(id: string, map: WorldMap, leavesTown = false) {
    this.id = id;
    this.map = map;
    this.nav = new FlowField(map);
    this.leavesTown = leavesTown;
  }

  /** Everything it knew about the old town is no use in the new one. */
  private followToTown(mapSeed: number): void {
    const isSameTown = mapSeed === this.map.seed;
    if (isSameTown) return;
    this.map = generateWorldMap(mapSeed);
    this.nav = new FlowField(this.map);
    this.searched.clear();
    this.abandoned.clear();
    this.spots.clear();
    this.goalKey = '';
  }

  /** Open floor in the container's own room from which it, and nothing else, is what gets searched. */
  private spotBeside(container: Container): Point | null {
    const known = this.spots.get(container.id);
    const isKnown = known !== undefined;
    if (isKnown) return known;
    const { x0, y0, x1, y1 } = container.box;
    let found: Point | null = null;
    for (let y = y1 + SPOT_MARGIN; y >= y0 - SPOT_MARGIN && !found; y -= SPOT_STEP) {
      for (let x = x0 - SPOT_MARGIN; x <= x1 + SPOT_MARGIN && !found; x += SPOT_STEP) {
        const sameRoom = (buildingAt(this.map, x, y)?.id ?? undefined) === container.building;
        const reaches = sameRoom && containerInReach(this.map, x, y, (id) => id !== container.id) !== null;
        const isStandable = reaches && !circleHitsSolid(this.map, x, y, PLAYER_RADIUS);
        if (isStandable) found = { x, y };
      }
    }
    this.spots.set(container.id, found);
    return found;
  }

  /** The nearest thing here still worth going through: this building's furniture, or a car at the kerb. */
  private nextContainer(me: PlayerEntity, opened: ReadonlySet<number>): Container | null {
    const stocked = usableRounds(me) >= ROUNDS_ENOUGH && me.health >= HEAL_BELOW;
    if (stocked) return null;
    const here = townContainers(this.map).filter((c) => (c.building ?? null) === me.indoors);
    const spent = me.indoors !== null && here.filter((c) => opened.has(c.id)).length >= SEARCHES_PER_BUILDING;
    if (spent) return null;
    let best: Container | null = null;
    let bestDistance = me.indoors ? Infinity : DETOUR_RANGE;
    for (const container of here) {
      const distance = Math.hypot(container.x - me.x, container.y - me.y);
      const open = opened.has(container.id) || this.abandoned.has(containerKey(container));
      const isNearerUnopened = !open && distance < bestDistance;
      if (isNearerUnopened) {
        bestDistance = distance;
        best = container;
      }
    }
    return best;
  }

  private nearestBuilding(me: PlayerEntity): BuildingInstance | null {
    let best: BuildingInstance | null = null;
    let bestDistance = Infinity;
    const shops = this.map.buildings.filter((building) => !this.searched.has(building.id) && sellsWhatItLacks(me, building));
    for (const building of shops.length > 0 ? shops : this.map.buildings) {
      if (this.searched.has(building.id)) continue;
      const door = doorBox(building);
      const distance = Math.hypot(door.x0 - me.x, door.y1 - me.y);
      const isNearer = distance < bestDistance;
      if (isNearer) {
        bestDistance = distance;
        best = building;
      }
    }
    return best;
  }

  private goal(me: PlayerEntity, snapshot: SnapshotPacket, opened: ReadonlySet<number>): Goal {
    if (me.indoors) this.searched.add(me.indoors);
    const exit = this.leavesTown ? snapshot.exit : null;
    const container = exit ? null : this.nextContainer(me, opened);
    let loot: PickupEntity | null = null;
    let bestDistance = Infinity;
    for (const item of snapshot.pickups) {
      // What it set out for looks nearer than it is, or a doorway between two boxes holds it for good.
      const distance = Math.hypot(item.x - me.x, item.y - me.y) * (item.id === this.goalKey ? COMMITTED : 1);
      const walledOff = exit !== null && segmentHitsSolid(this.map, me.x, me.y, item.x, item.y);
      // What is shut in this room comes before anything but a gun seen lying across town.
      const worthTheWalk = exit === null && (container === null || isGun(item.type) || item.id === this.goalKey);
      const inRange = worthTheWalk || distance < DETOUR_RANGE;
      const giveUp = this.abandoned.has(item.id);
      const isBetterPickup = wanted(me, item) && distance < bestDistance && !walledOff && inRange && !giveUp;
      if (isBetterPickup) {
        bestDistance = distance;
        loot = item;
      }
    }
    if (loot) return { x: loot.x, y: loot.y, key: loot.id };
    // The van's spot is on its solid body, which no path ends at: the open ground in front of it is.
    if (exit) return { x: exit.x, y: exit.y + VAN_APPROACH, key: 'exit' };

    const spot = container ? this.spotBeside(container) : null;
    const canReachContainer = container && spot;
    if (canReachContainer) return { ...spot, key: containerKey(container), container };
    if (container) this.abandoned.add(containerKey(container));

    const building = this.nearestBuilding(me) ?? this.map.buildings[this.tick % this.map.buildings.length];
    const hasSearchedAll = this.searched.size >= this.map.buildings.length;
    if (hasSearchedAll) this.searched.clear();
    const box = buildingBox(building);
    const door = doorBox(building);
    return { x: (door.x0 + door.x1) / 2, y: (box.y1 - 24), key: building.id };
  }

  private gunFor(me: PlayerEntity): WeaponId {
    const loaded = WEAPON_ORDER.filter((id) => me.owned.includes(id) && me.ammoBag[id] > 0);
    const shouldKeepWeapon = me.ammo > 0 || loaded.length === 0;
    if (shouldKeepWeapon) return me.weapon;
    return loaded[loaded.length - 1];
  }

  private steer(me: PlayerEntity, goal: Goal): Point {
    const isNewGoal = goal.key !== this.goalKey;
    if (isNewGoal) {
      this.goalKey = goal.key;
      this.goalTicks = 0;
      this.nav.recompute([goal]);
    }
    this.goalTicks += 1;
    const isOutOfPatience = this.goalTicks > GOAL_PATIENCE_TICKS;
    if (isOutOfPatience) this.abandoned.add(goal.key);
    const moved = Math.hypot(me.x - this.lastX, me.y - this.lastY);
    this.lastX = me.x;
    this.lastY = me.y;
    this.stuckTicks = moved < 0.3 ? this.stuckTicks + 1 : 0;
    const isStuck = this.stuckTicks > TICKS_BEFORE_UNSTICK;
    if (isStuck) {
      this.stuckTicks = 0;
      const angle = (this.tick * 2.399) % (Math.PI * 2);
      this.unstickX = Math.cos(angle);
      this.unstickY = Math.sin(angle);
      this.unstickLeft = 20;
    }
    const isUnsticking = this.unstickLeft > 0;
    if (isUnsticking) {
      this.unstickLeft -= 1;
      return { x: this.unstickX, y: this.unstickY };
    }
    const waypoint = this.nav.nextWaypoint(me.x, me.y, PLAYER_RADIUS) ?? goal;
    return { x: waypoint.x - me.x, y: waypoint.y - me.y };
  }

  think(snapshot: SnapshotPacket): ClientInputPacket | null {
    const me = snapshot.players.find((p) => p.id === this.id);
    if (!me) return null;
    if (this.leavesTown) this.followToTown(snapshot.mapSeed);
    this.tick += 1;
    this.seq += 1;

    const target = nearestZombie(me, snapshot.zombies);
    const distance = target ? Math.hypot(target.x - me.x, target.y - me.y) : Infinity;
    const canHit = target !== null && !segmentHitsSolid(this.map, me.x, me.y, target.x, target.y);
    const reach = target?.type === 'runner' ? RUNNER_FIRE_RANGE : WALKER_FIRE_RANGE;
    const shoot = canHit && distance < reach && me.ammo > 0;
    const shove = canHit && distance < SHOVE_RANGE && this.tick - this.lastShove >= SHOVE_EVERY_TICKS;
    if (shove) this.lastShove = this.tick;

    const opened = new Set(snapshot.openedContainers);
    const goal = this.goal(me, snapshot, opened);
    let heading = this.steer(me, goal);
    const inReach = goal.container !== undefined && containerInReach(this.map, me.x, me.y, (id) => opened.has(id)) !== null;
    const searching = inReach && !(canHit && distance < SEARCH_SAFE_RANGE);
    if (searching) this.stuckTicks = 0;
    // The key wants letting go between containers, and after anything that cut a search short.
    const spent = this.holdingSearch && me.search === 0;
    this.holdingSearch = searching && !spent;
    const exit = this.leavesTown ? snapshot.exit : null;
    const boarding = exit !== null && Math.hypot(exit.x - me.x, exit.y - me.y) <= BOARDED_RANGE;
    const closingIn = target !== null && canHit && distance < 40;
    const shouldBackOff = closingIn && !boarding;
    if (shouldBackOff) {
      // Backing off while the wind-up runs out beats walking through it.
      heading = { x: me.x - target.x, y: me.y - target.y };
    }
    const length = Math.hypot(heading.x, heading.y) || 1;
    const standing = boarding || searching;
    const dirX = standing ? 0 : heading.x / length;
    const dirY = standing ? 0 : heading.y / length;
    return {
      seq: this.seq,
      up: dirY < -0.3,
      down: dirY > 0.3,
      left: dirX < -0.3,
      right: dirX > 0.3,
      angle: target ? Math.atan2(target.y - me.y, target.x - me.x) : Math.atan2(dirY, dirX),
      shoot,
      reload: me.ammo === 0 && me.reserve > 0,
      weapon: this.gunFor(me),
      melee: shove,
      heal: me.health < HEAL_BELOW && me.medkits > 0,
      search: this.holdingSearch,
    };
  }
}

/** Stands where it spawned and never lets go of the trigger. */
export class TriggerBot {
  private readonly id: string;
  private seq = 0;

  constructor(id: string) {
    this.id = id;
  }

  think(snapshot: SnapshotPacket): ClientInputPacket | null {
    const me = snapshot.players.find((p) => p.id === this.id);
    if (!me) return null;
    this.seq += 1;
    const target = nearestZombie(me, snapshot.zombies);
    return {
      seq: this.seq,
      up: false,
      down: false,
      left: false,
      right: false,
      angle: target ? Math.atan2(target.y - me.y, target.x - me.x) : me.angle,
      shoot: true,
      reload: me.ammo === 0,
      weapon: null,
      melee: false,
      heal: false,
      search: false,
    };
  }
}
