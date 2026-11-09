// The four merchants as people in the bunker: they wander its rooms, stop for whoever walks up and trade where they
// stand. Sim state, so every client sees them in the same place. The fight with the horde is in merchant-fight.ts.

import { MERCHANT_REACH, MERCHANT_ROAM, MERCHANT_STARTS } from './bunker-map.ts';
import { PLAYER_RADIUS, TICK_DT, WEAPONS } from './constants.ts';
import { FlowField } from './flow-field.ts';
import { MERCHANT_IDS, isBunkerMap } from './home-protocol.ts';
import type { MerchantEntity, MerchantId, Station } from './home-protocol.ts';
import { stepMovement } from './movement.ts';
import type { WeaponId } from './protocol.ts';
import { createRng, randRange } from './rng.ts';
import type { Rng } from './rng.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { round2 } from './snapshot-build.ts';
import { circleHitsSolid, segmentHitsSolid } from './world-query.ts';

/** A stroll, well under a survivor's walk, so anyone can catch up with them. */
export const MERCHANT_WALK_SPEED = 30;
/** They are tougher than a survivor: the horde has to work to put one down. */
export const MERCHANT_HEALTH = 140;
/** A customer this near stops a merchant, a little further out than the reach to open the shop, so they wait to be caught. */
const SERVE_RANGE = MERCHANT_REACH + 16;
/** Closer than this to where they are going, they are there. */
const ARRIVE_PX = 4;
/** Under this share of a stride, something is in the way. */
const BLOCKED_PROGRESS = 0.3;
/** Seconds of getting nowhere before a merchant gives up on where they were going. */
const STUCK_SEC = 1.2;
/** Tries at a clear spot to walk to before standing a while instead. */
const GOAL_TRIES = 8;

/** Each merchant's gun: they shoot back when the horde is in. */
const ARMS: Readonly<Record<MerchantId, WeaponId>> = {
  gunsmith: 'carbine',
  quartermaster: 'shotgun',
  medic: 'pistol',
  powder: 'shotgun',
};

export interface MerchantState {
  readonly kind: 'merchant';
  readonly id: MerchantId;
  x: number;
  y: number;
  angle: number;
  moving: boolean;
  status: 'alive' | 'downed';
  health: number;
  readonly maxHealth: number;
  readonly weapon: WeaponId;
  /** Rounds in the gun. They carry as many spares as they like. */
  ammo: number;
  /** Seconds left on a reload, 0 when not reloading. */
  reloadLeft: number;
  fireCooldown: number;
  /** Where they are walking to, or null while standing. */
  goal: { x: number; y: number } | null;
  /** Seconds to stand before choosing somewhere to go. */
  pauseLeft: number;
  /** Seconds they have been getting nowhere. */
  stuckLeft: number;
  /** Leads them round the bunker's walls to their goal. */
  readonly field: FlowField;
  /** `sim.tick` when the field was last laid toward the goal. */
  fieldTick: number;
  /** Their own rolls, so walking about never moves the sim's stream and every town rolls as it did before them. */
  readonly rng: Rng;
}

/** Keeps the merchants' streams apart from every other the run seeds. */
const MERCHANT_SALT = 0x3e7c4a11;

function newMerchant(sim: SimState, id: MerchantId, index: number): MerchantState {
  const start = MERCHANT_STARTS[id];
  const weapon = ARMS[id];
  const rng = createRng((sim.runSeed ^ MERCHANT_SALT) + index * 0x9e3779b1);
  return {
    kind: 'merchant',
    id,
    x: start.x,
    y: start.y,
    angle: Math.PI / 2,
    moving: false,
    status: 'alive',
    health: MERCHANT_HEALTH,
    maxHealth: MERCHANT_HEALTH,
    weapon,
    ammo: WEAPONS[weapon].magSize,
    reloadLeft: 0,
    fireCooldown: 0,
    goal: null,
    pauseLeft: randRange(rng, 1, 5),
    stuckLeft: 0,
    field: new FlowField(sim.map),
    fieldTick: -1,
    rng,
  };
}

/** The merchants in their first places, for a bunker just raised. Anywhere else there are none. */
export function placeMerchants(sim: SimState): void {
  sim.merchants = isBunkerMap(sim.map) ? MERCHANT_IDS.map((id, index) => newMerchant(sim, id, index)) : [];
}

/** On their feet: the ones a customer can open, and the horde can go for. */
export const standingMerchants = (sim: Pick<SimState, 'merchants'>): MerchantState[] => sim.merchants.filter((m) => m.status === 'alive');

/** A circle round each merchant on their feet, which opens their shop like a station's. */
export function merchantStations(merchants: readonly Pick<MerchantEntity, 'id' | 'x' | 'y' | 'status'>[]): Station[] {
  return merchants.filter((m) => m.status === 'alive').map((m) => ({ id: m.id, x: m.x, y: m.y, radius: MERCHANT_REACH }));
}

/** Lays the field toward a point. */
export function layField(sim: SimState, m: MerchantState, to: readonly { x: number; y: number }[]): void {
  m.field.recompute(to);
  m.fieldTick = sim.tick;
}

/** One tick toward `to`: straight there with a clear line, else round the walls along the field. True if they got anywhere. */
export function walkTo(sim: SimState, m: MerchantState, to: { x: number; y: number }, speed: number): boolean {
  const clear = segmentHitsSolid(sim.map, m.x, m.y, to.x, to.y) === null;
  const waypoint = clear ? to : m.field.nextWaypoint(m.x, m.y, PLAYER_RADIUS) ?? to;
  const dirX = waypoint.x - m.x;
  const dirY = waypoint.y - m.y;
  const isThere = Math.hypot(dirX, dirY) < 1e-6;
  if (isThere) return false;
  const moved = stepMovement(sim.map, m.x, m.y, dirX, dirY, speed, TICK_DT, PLAYER_RADIUS);
  const progress = Math.hypot(moved.x - m.x, moved.y - m.y);
  m.angle = Math.atan2(dirY, dirX);
  m.x = moved.x;
  m.y = moved.y;
  m.moving = progress > 0;
  return progress >= speed * TICK_DT * BLOCKED_PROGRESS;
}

/** The customer they would stop for: someone on their feet close by, or anyone with their shop open. */
function customerOf(sim: SimState, m: MerchantState): PlayerState | null {
  let best: PlayerState | null = null;
  let bestGap = Infinity;
  for (const p of sim.players) {
    const gap = Math.hypot(p.x - m.x, p.y - m.y);
    const shopping = p.home?.station === m.id;
    const close = p.status === 'alive' && gap <= SERVE_RANGE;
    const nearer = (shopping || close) && gap < bestGap;
    if (nearer) {
      best = p;
      bestGap = gap;
    }
  }
  return best;
}

/** A clear spot somewhere they like to be, or null if a few tries find none. */
function pickGoal(sim: SimState, rng: Rng): { x: number; y: number } | null {
  for (let attempt = 0; attempt < GOAL_TRIES; attempt++) {
    const box = MERCHANT_ROAM[Math.floor(rng() * MERCHANT_ROAM.length)];
    const x = randRange(rng, box.x0, box.x1);
    const y = randRange(rng, box.y0, box.y1);
    const isClear = !circleHitsSolid(sim.map, x, y, PLAYER_RADIUS + 2);
    if (isClear) return { x, y };
  }
  return null;
}

function standAWhile(m: MerchantState): void {
  m.goal = null;
  m.moving = false;
  m.stuckLeft = 0;
  m.pauseLeft = randRange(m.rng, 2, 7);
}

/** Stands a while, then walks somewhere, then stands again; and stops to face anyone who walks up. */
export function roam(sim: SimState, m: MerchantState): void {
  const customer = customerOf(sim, m);
  if (customer) {
    m.moving = false;
    m.angle = Math.atan2(customer.y - m.y, customer.x - m.x);
    return;
  }
  const resting = m.pauseLeft > 0;
  if (resting) {
    m.pauseLeft = Math.max(0, m.pauseLeft - TICK_DT);
    m.moving = false;
    return;
  }
  const hasNowhereToGo = m.goal === null;
  if (hasNowhereToGo) {
    m.goal = pickGoal(sim, m.rng);
    if (m.goal) layField(sim, m, [m.goal]);
  }
  const goal = m.goal;
  if (!goal) {
    standAWhile(m);
    return;
  }
  const arrived = Math.hypot(goal.x - m.x, goal.y - m.y) <= ARRIVE_PX;
  if (arrived) {
    standAWhile(m);
    return;
  }
  const gotAnywhere = walkTo(sim, m, goal, MERCHANT_WALK_SPEED);
  m.stuckLeft = gotAnywhere ? 0 : m.stuckLeft + TICK_DT;
  const givesUp = m.stuckLeft >= STUCK_SEC;
  if (givesUp) standAWhile(m);
}

/** The merchants for the snapshot: everyone there, wherever the players are, since the bunker is small. */
export function merchantView(m: MerchantState): MerchantEntity {
  const total = WEAPONS[m.weapon].reloadMs / 1000;
  const reload = m.reloadLeft > 0 ? Math.max(0.01, 1 - m.reloadLeft / total) : 0;
  return {
    id: m.id,
    x: round2(m.x),
    y: round2(m.y),
    angle: round2(m.angle),
    moving: m.moving,
    status: m.status,
    health: Math.round(m.health),
    maxHealth: m.maxHealth,
    weapon: m.weapon,
    reload: round2(reload),
  };
}
