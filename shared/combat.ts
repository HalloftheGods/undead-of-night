import { BRITTLE_HEAL, sugarById, sugarOf } from './candy.ts';
import {
  BLOATER_BURST_PLAYER_DAMAGE,
  BLOATER_BURST_RADIUS,
  BLOATER_BURST_ZOMBIE_DAMAGE,
  KNOCKBACK_SPEED,
  PLAYER_RADIUS,
  TICK_DT,
} from './constants.ts';
import { chainKill, chainMultiplier } from './kill-chain.ts';
import { eventOf } from './night-events.ts';
import { bossDown } from './bosses.ts';
import { headOnBulletPlane, headshotMultiplier } from './headshots.ts';
import type { EntityId } from './protocol.ts';
import { maybeDropOnKill } from './pickups.ts';
import { hurtPlayer } from './player-health.ts';
import { PIERCE_DAMAGE_SCALE } from './round-effect-data.ts';
import type { BulletState, SimState, ZombieState } from './sim-state.ts';
import { emit } from './sim-state.ts';
import { segmentHitsSolid } from './world-query.ts';
import { startHunting } from './zombie-senses.ts';
import { announcePierce, applyRoundEffect, corrosionScale } from './zombie-status.ts';

/** Bullets count as this much fatter than a point against zombies. */
const BULLET_RADIUS = 2;
/** Scratch list for grid queries, reused so the bullet loop does not allocate. */
const nearby: ZombieState[] = [];

function burst(sim: SimState, z: ZombieState, killerId: EntityId | null): void {
  emit(sim, { type: 'bloater_burst', x: z.x, y: z.y, radius: BLOATER_BURST_RADIUS });
  const sheltered = (target: { x: number; y: number }): boolean => segmentHitsSolid(sim.map, z.x, z.y, target.x, target.y) !== null;
  for (const p of sim.players) {
    const inBlast = Math.hypot(p.x - z.x, p.y - z.y) <= BLOATER_BURST_RADIUS + PLAYER_RADIUS;
    const isCaughtInBurst = inBlast && !sheltered(p);
    if (isCaughtInBurst) hurtPlayer(sim, p, BLOATER_BURST_PLAYER_DAMAGE);
  }
  for (const other of sim.zombies) {
    const distance = Math.hypot(other.x - z.x, other.y - z.y);
    const inBlast = other !== z && distance <= BLOATER_BURST_RADIUS + other.radius;
    const isOtherCaughtInBurst = inBlast && !sheltered(other);
    if (isOtherCaughtInBurst) {
      const angle = Math.atan2(other.y - z.y, other.x - z.x);
      damageZombie(sim, other, BLOATER_BURST_ZOMBIE_DAMAGE, angle, killerId);
    }
  }
}

function killZombie(sim: SimState, z: ZombieState, angle: number, killerId: EntityId | null): void {
  const present = sim.players.find((p) => p.id === killerId);
  // A killer who has dropped out (a burn lands after they go) keeps the credit for when they return.
  const away = present ? undefined : [...sim.departed.values()].find((p) => p.id === killerId);
  const killer = present ?? away;
  // A kill in a chain pays more, the bonus rounded down so a single kill pays exactly its worth.
  const chain = killer ? chainKill(sim, killer.id) : 1;
  const points = Math.floor(z.points * chainMultiplier(chain) * (eventOf(sim)?.points ?? 1));
  if (killer) {
    killer.score += points;
    killer.kills += 1;
    const brittle = BRITTLE_HEAL * sugarOf(killer, 'witchs_brittle');
    const standing = killer.status === 'alive';
    if (standing) killer.health = Math.min(killer.maxHealth, killer.health + brittle);
  }
  emit(sim, {
    type: 'zombie_die',
    zombieId: z.id,
    zombieType: z.type,
    x: z.x,
    y: z.y,
    angle,
    killerId,
    points: killer ? points : z.points,
    chain,
  });
  // The bunker's horde drops nothing: the chest is the reward. Off the overrun this rolls as it always has.
  const bunkerHorde = z.horde && sim.overrun !== null;
  if (!bunkerHorde) maybeDropOnKill(sim, z.x, z.y, killer);
  const isBloater = z.type === 'bloater';
  if (isBloater) burst(sim, z, killerId);
  bossDown(sim, z);
}

/** Dead zombies stay in the list with health 0 until the end of the tick. */
export function damageZombie(
  sim: SimState,
  z: ZombieState,
  damage: number,
  angle: number,
  killerId: EntityId | null,
  corrodes = false,
): void {
  const isAlreadyDead = z.health <= 0;
  if (isAlreadyDead) return;
  z.health -= damage * (corrodes ? corrosionScale(z) : 1);
  const turnsOnShooter = killerId !== null && !z.horde;
  if (turnsOnShooter) startHunting(sim, z);
  // Big bodies shove less.
  const shove = KNOCKBACK_SPEED * Math.min(1, (6 / z.radius) ** 2);
  z.knockX += Math.cos(angle) * shove;
  z.knockY += Math.sin(angle) * shove;
  emit(sim, { type: 'zombie_hit', zombieId: z.id, zombieType: z.type, x: z.x, y: z.y, angle });
  const isKilled = z.health <= 0;
  if (isKilled) {
    z.health = 0;
    killZombie(sim, z, angle, killerId);
  }
}

/** Damage with no blow behind it, as from a fire: nothing flinches and nothing new turns round. */
export function woundZombie(sim: SimState, z: ZombieState, damage: number, killerId: EntityId | null): void {
  const isAlreadyDead = z.health <= 0;
  if (isAlreadyDead) return;
  z.health -= damage * corrosionScale(z);
  const killed = z.health <= 0;
  if (!killed) return;
  z.health = 0;
  killZombie(sim, z, z.angle, killerId);
}

/** Fraction along the segment where it enters the circle, or Infinity on a miss. */
function segmentEntersCircle(
  x0: number,
  y0: number,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  radius: number,
): number {
  const fx = x0 - cx;
  const fy = y0 - cy;
  const c = fx * fx + fy * fy - radius * radius;
  const startsInside = c <= 0;
  if (startsInside) return 0;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const discriminant = b * b - 4 * a * c;
  const neverEnters = a === 0 || discriminant < 0;
  if (neverEnters) return Infinity;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : Infinity;
}

/** Fraction along the path where it enters the head this bullet was aimed at, or Infinity. */
function aimedHeadOnPath(sim: SimState, b: BulletState, dx: number, dy: number): number {
  const aimed = b.headTarget;
  const headStillThere = aimed && aimed.health > 0;
  if (!headStillThere) return Infinity;
  const head = headOnBulletPlane(sim, aimed, b.shooterId);
  return segmentEntersCircle(b.x, b.y, dx, dy, head.x, head.y, head.radius + BULLET_RADIUS);
}

function firstZombieOnPath(sim: SimState, b: BulletState, dx: number, dy: number): { zombie: ZombieState; t: number } | null {
  nearby.length = 0;
  sim.grid.query(b.x + dx / 2, b.y + dy / 2, Math.hypot(dx, dy) / 2 + BULLET_RADIUS, nearby);
  let zombie: ZombieState | null = null;
  let best = Infinity;
  for (const z of nearby) {
    const hittable = z.health > 0 && z !== b.passed;
    if (!hittable) continue;
    const t = segmentEntersCircle(b.x, b.y, dx, dy, z.x, z.y, z.radius + BULLET_RADIUS);
    const isNearestHit = t < best;
    if (isNearestHit) {
      best = t;
      zombie = z;
    }
  }
  const headT = aimedHeadOnPath(sim, b, dx, dy);
  const headFirst = headT < best;
  if (headFirst) return { zombie: b.headTarget as ZombieState, t: headT };
  return zombie ? { zombie, t: best } : null;
}

/** A piercing round goes on with less behind it, and whatever head it was after is behind it now. */
function passThrough(sim: SimState, b: BulletState, z: ZombieState): void {
  b.passed = z;
  b.damage *= PIERCE_DAMAGE_SCALE;
  const headBehind = b.headTarget === z;
  if (headBehind) b.headTarget = null;
  announcePierce(sim, z);
}

/** Lands the bullet on a body. True if it carries on out the far side. */
function strike(sim: SimState, b: BulletState, z: ZombieState, angle: number): boolean {
  const damage = b.damage * headshotMultiplier(sim, b, z, angle);
  damageZombie(sim, z, damage, angle, b.shooterId, b.effect === 'acid');
  if (b.effect) applyRoundEffect(sim, b.effect, z, b.shooterId, b.volley);
  const pierces = b.effect === 'piercing' || sugarById(sim, b.shooterId, 'bat_bites') > 0;
  const carriesOn = pierces && !b.passed;
  if (carriesOn) passThrough(sim, b, z);
  return carriesOn;
}

/** Returns false once the bullet is spent. The whole of `length` is swept, so speed cannot tunnel. */
function sweepBullet(sim: SimState, b: BulletState, length: number): boolean {
  const speed = Math.hypot(b.vx, b.vy);
  const dx = (b.vx / speed) * length;
  const dy = (b.vy / speed) * length;
  const angle = Math.atan2(b.vy, b.vx);

  const wall = segmentHitsSolid(sim.map, b.x, b.y, b.x + dx, b.y + dy);
  const wallT = wall ? Math.hypot(wall.x - b.x, wall.y - b.y) / length : Infinity;
  const target = firstZombieOnPath(sim, b, dx, dy);

  const struck = target !== null && target.t <= wallT;
  if (struck) {
    const carriesOn = strike(sim, b, target.zombie, angle);
    if (!carriesOn) return false;
    const travelled = target.t * length;
    b.x += dx * target.t;
    b.y += dy * target.t;
    b.rangeLeft -= travelled;
    return sweepBullet(sim, b, length - travelled);
  }
  if (wall) {
    emit(sim, { type: 'bullet_impact', x: wall.x, y: wall.y, angle });
    return false;
  }
  b.x += dx;
  b.y += dy;
  b.rangeLeft -= length;
  const inWorld = b.x >= 0 && b.y >= 0 && b.x <= sim.map.width && b.y <= sim.map.height;
  return b.rangeLeft > 0 && inWorld;
}

const advanceBullet = (sim: SimState, b: BulletState): boolean =>
  sweepBullet(sim, b, Math.min(Math.hypot(b.vx, b.vy) * TICK_DT, b.rangeLeft));

export function updateBullets(sim: SimState): void {
  sim.bullets = sim.bullets.filter((b) => advanceBullet(sim, b));
}
