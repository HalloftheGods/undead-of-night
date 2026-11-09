// The merchants when the blast door gives: they shoot at the horde, back off from what gets close, and fall in
// with the survivors when nothing is in sight. One downed by the horde lies there until it is over, then gets up.

import { layField, roam, standingMerchants, walkTo } from './bunker-merchants.ts';
import type { MerchantState } from './bunker-merchants.ts';
import { MUZZLE_OFFSET, PLAYER_RADIUS, TICK_DT, WEAPONS } from './constants.ts';
import { isBunkerMap } from './home-protocol.ts';
import type { SimState, ZombieState } from './sim-state.ts';
import { alivePlayers, emit, entityId } from './sim-state.ts';
import { segmentHitsSolid } from './world-query.ts';

/** How far a merchant picks out a zombie to shoot. */
const SIGHT_RANGE = 220;
/** Their rounds hit softer than a survivor's, so the fight is still the survivors' to win. */
const DAMAGE_SCALE = 0.6;
/** And they shoot slower, with a shakier hand. */
const FIRE_INTERVAL_SCALE = 1.8;
const EXTRA_SPREAD_RAD = 0.05;
/** Anything closer than this, they back away from as they shoot. */
const BACK_OFF_GAP = 22;
const BACK_OFF_SPEED = 58;
/** With nothing to shoot, they come to within this of the nearest survivor. */
const REGROUP_PX = 44;
const REGROUP_SPEED = 60;
/** How often the way to the survivors is laid again. */
const REGROUP_FIELD_TICKS = 20;

/** The merchants are in the fight: the horde is through the door. */
export const merchantsFighting = (sim: SimState): boolean => sim.overrun?.phase === 'breached';

/** The nearest horde zombie on its feet within sight, if there is a clear line to it. */
function targetOf(sim: SimState, m: MerchantState): ZombieState | null {
  let best: ZombieState | null = null;
  let bestGap = SIGHT_RANGE * SIGHT_RANGE;
  for (const z of sim.zombies) {
    const gap = (z.x - m.x) ** 2 + (z.y - m.y) ** 2;
    const nearer = z.health > 0 && gap < bestGap;
    if (nearer) {
      best = z;
      bestGap = gap;
    }
  }
  const inSight = best !== null && segmentHitsSolid(sim.map, m.x, m.y, best.x, best.y) === null;
  return inSight ? best : null;
}

function reload(sim: SimState, m: MerchantState): void {
  m.reloadLeft = Math.max(0, m.reloadLeft - TICK_DT);
  const done = m.reloadLeft === 0;
  if (done) m.ammo = WEAPONS[m.weapon].magSize;
}

function fire(sim: SimState, m: MerchantState): void {
  const stats = WEAPONS[m.weapon];
  const volley = entityId(sim, 'v');
  for (let i = 0; i < stats.pellets; i++) {
    const angle = m.angle + (m.rng() * 2 - 1) * (stats.spreadRad + EXTRA_SPREAD_RAD);
    sim.bullets.push({
      id: entityId(sim, 'b'),
      shooterId: m.id,
      x: m.x,
      y: m.y,
      vx: Math.cos(angle) * stats.bulletSpeed,
      vy: Math.sin(angle) * stats.bulletSpeed,
      damage: stats.damage * DAMAGE_SCALE,
      rangeLeft: stats.range,
      headTarget: null,
      volley,
    });
  }
  emit(sim, {
    type: 'shot',
    playerId: m.id,
    weapon: m.weapon,
    x: m.x + Math.cos(m.angle) * MUZZLE_OFFSET,
    y: m.y + Math.sin(m.angle) * MUZZLE_OFFSET,
    angle: m.angle,
  });
  m.ammo -= 1;
  m.fireCooldown = (stats.fireIntervalMs / 1000) * FIRE_INTERVAL_SCALE;
  const isEmpty = m.ammo <= 0;
  if (isEmpty) m.reloadLeft = stats.reloadMs / 1000;
}

/** Steps straight away from a zombie that has come too close. */
function backOff(sim: SimState, m: MerchantState, z: ZombieState): void {
  const awayX = m.x - z.x;
  const awayY = m.y - z.y;
  const away = { x: m.x + awayX * 4, y: m.y + awayY * 4 };
  const facing = m.angle;
  walkTo(sim, m, away, BACK_OFF_SPEED);
  m.angle = facing;
}

/** With nothing in sight, toward the nearest survivor on their feet, to fight beside them. */
function regroup(sim: SimState, m: MerchantState): void {
  const players = alivePlayers(sim);
  let nearest = players[0];
  for (const p of players) {
    const nearer = Math.hypot(p.x - m.x, p.y - m.y) < Math.hypot(nearest.x - m.x, nearest.y - m.y);
    if (nearer) nearest = p;
  }
  const close = !nearest || Math.hypot(nearest.x - m.x, nearest.y - m.y) <= REGROUP_PX;
  if (close) {
    m.moving = false;
    return;
  }
  const stale = sim.tick - m.fieldTick >= REGROUP_FIELD_TICKS;
  if (stale) layField(sim, m, players);
  walkTo(sim, m, nearest, REGROUP_SPEED);
}

/** One tick of the fight for a merchant on their feet. */
function fight(sim: SimState, m: MerchantState): void {
  m.goal = null;
  m.fireCooldown = Math.max(0, m.fireCooldown - TICK_DT);
  const reloading = m.reloadLeft > 0;
  if (reloading) reload(sim, m);
  const target = targetOf(sim, m);
  if (!target) {
    regroup(sim, m);
    return;
  }
  m.angle = Math.atan2(target.y - m.y, target.x - m.x);
  const gap = Math.hypot(target.x - m.x, target.y - m.y) - target.radius - PLAYER_RADIUS;
  const tooClose = gap < BACK_OFF_GAP;
  if (tooClose) backOff(sim, m, target);
  else m.moving = false;
  const ready = m.reloadLeft === 0 && m.fireCooldown === 0 && gap <= WEAPONS[m.weapon].range;
  if (ready) fire(sim, m);
}

/** A zombie's blow lands on a merchant. At nothing left they go down, and stay down until the horde is over. */
export function hurtMerchant(sim: SimState, m: MerchantState, damage: number): void {
  const isAlreadyDown = m.status !== 'alive';
  if (isAlreadyDown) return;
  m.health = Math.max(0, m.health - damage);
  emit(sim, { type: 'merchant_hurt', merchant: m.id, x: m.x, y: m.y });
  const goesDown = m.health === 0;
  if (!goesDown) return;
  m.status = 'downed';
  m.moving = false;
  m.reloadLeft = 0;
  emit(sim, { type: 'merchant_downed', merchant: m.id, x: m.x, y: m.y });
}

/** The horde is over, held or lost: the downed get up, healed, and everyone has a full gun again. */
function getUp(sim: SimState, m: MerchantState): void {
  const wasDown = m.status === 'downed';
  m.status = 'alive';
  m.health = m.maxHealth;
  m.ammo = WEAPONS[m.weapon].magSize;
  m.reloadLeft = 0;
  if (wasDown) m.pauseLeft = 2;
}

/** One tick for every merchant, from `step()` in the bunker. */
export function updateMerchants(sim: SimState): void {
  const inBunker = isBunkerMap(sim.map);
  if (!inBunker) return;
  const fighting = merchantsFighting(sim);
  for (const m of sim.merchants) {
    const hurtOrSpent = m.status === 'downed' || m.health < m.maxHealth || m.ammo < WEAPONS[m.weapon].magSize;
    const shouldGetUp = !fighting && hurtOrSpent;
    if (shouldGetUp) getUp(sim, m);
  }
  for (const m of standingMerchants(sim)) {
    if (fighting) fight(sim, m);
    else roam(sim, m);
  }
}
