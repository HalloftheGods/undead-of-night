import { sugarOf } from './candy.ts';
import { characterOf } from './characters.ts';
import { damageZombie } from './combat.ts';
import {
  KNIFE_COOLDOWN_SEC,
  KNIFE_STAGGER_IMMUNE_SEC,
  MELEE_ARC_RAD,
  MELEE_COOLDOWN_SEC,
  MELEE_DAMAGE,
  MELEE_KNOCKBACK_SPEED,
  MELEE_MAX_TARGETS,
  MELEE_RANGE,
  MELEE_STAGGER_IMMUNE_SEC,
  MELEE_STAGGER_SEC,
  PLAYER_RADIUS,
  TICK_DT,
} from './constants.ts';
import type { PlayerState, SimState, ZombieState } from './sim-state.ts';
import { emit } from './sim-state.ts';
import { segmentHitsSolid } from './world-query.ts';

/** With a knife in the other hand the shove goes in point first. Just as silent, and still only every so often per body. */
export const KNIFE_DAMAGE = MELEE_DAMAGE * 4.5;

const nearby: ZombieState[] = [];

function inArc(p: PlayerState, z: ZombieState): boolean {
  const turn = Math.atan2(z.y - p.y, z.x - p.x) - p.angle;
  return Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))) <= MELEE_ARC_RAD;
}

function shove(sim: SimState, p: PlayerState, z: ZombieState): void {
  const angle = Math.atan2(z.y - p.y, z.x - p.x);
  const meleeSugar = Math.max(sugarOf(p, 'licorice_lash'), sugarOf(p, 'fang_taffy'));
  const boost = 1 + meleeSugar;
  damageZombie(sim, z, (p.knife ? KNIFE_DAMAGE : MELEE_DAMAGE) * boost, angle, p.id);
  // Big bodies shove less, as they do from bullets.
  const force = MELEE_KNOCKBACK_SPEED * characterOf(p.skin).shoveForce * Math.min(1, (6 / z.radius) ** 2);
  z.knockX += Math.cos(angle) * force;
  z.knockY += Math.sin(angle) * force;
  z.windupLeft = 0;
  z.recoveryLeft = 0;
  z.attacking = false;
  z.cooldownLeft = Math.max(z.cooldownLeft, p.knife ? KNIFE_STAGGER_IMMUNE_SEC : MELEE_STAGGER_SEC);
  z.staggerImmuneLeft = p.knife ? KNIFE_STAGGER_IMMUNE_SEC : MELEE_STAGGER_IMMUNE_SEC;
}

/** A body still reeling from the last shove keeps its footing and keeps swinging. */
function canStagger(z: ZombieState): boolean {
  return z.health > 0 && z.staggerImmuneLeft <= 0;
}

/** The bodies in front of the player that a shove can move, nearest first. */
function shoveTargets(sim: SimState, p: PlayerState): ZombieState[] {
  nearby.length = 0;
  sim.grid.query(p.x, p.y, MELEE_RANGE + PLAYER_RADIUS, nearby);
  const reachable = nearby.filter((z) => canStagger(z) && inArc(p, z) && !segmentHitsSolid(sim.map, p.x, p.y, z.x, z.y));
  const distance = (z: ZombieState): number => (z.x - p.x) ** 2 + (z.y - p.y) ** 2;
  return reachable.sort((a, b) => distance(a) - distance(b)).slice(0, MELEE_MAX_TARGETS);
}

/** A shove with whatever is in hand. It needs no ammo and makes no noise. */
export function updateMelee(sim: SimState, p: PlayerState): void {
  p.meleeCooldown = Math.max(0, p.meleeCooldown - TICK_DT);
  const wanted = p.meleeQueued;
  p.meleeQueued = false;
  const ready = wanted && p.meleeCooldown === 0;
  if (!ready) return;

  p.meleeCooldown = p.knife ? KNIFE_COOLDOWN_SEC : MELEE_COOLDOWN_SEC;
  const targets = shoveTargets(sim, p);
  for (const z of targets) shove(sim, p, z);
  emit(sim, { type: 'melee', playerId: p.id, x: p.x, y: p.y, angle: p.angle, hit: targets.length > 0 });
}
