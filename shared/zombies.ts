import {
  FLOW_REACH_TILES,
  FLOW_REFRESH_TICKS,
  KNOCKBACK_DECAY_PER_SEC,
  NOISE_REACH_TILES,
  PLAYER_RADIUS,
  TICK_DT,
  ZOMBIE_INVESTIGATE_SEC,
  ZOMBIE_RECOVERY_SEC,
  ZOMBIE_SLEEP_RANGE,
  ZOMBIE_WANDER_SPEED_SCALE,
} from './constants.ts';
import { groundEffect } from './ground.ts';
import { stepMovement } from './movement.ts';
import { hurtPlayer } from './player-health.ts';
import { TILE_SIZE } from './protocol.ts';
import { randRange } from './rng.ts';
import type { PlayerState, SimState, ZombieState } from './sim-state.ts';
import { alivePlayers, emit, standingPlayers } from './sim-state.ts';
import type { FlowField } from './flow-field.ts';
import { buildingAt, groundOf, segmentHitsSolid } from './world-query.ts';
import { backToRoaming, loseTrail, updateAwareness } from './zombie-senses.ts';
import { nextPrint, trailMakerAlive } from './snow-tracks.ts';
import { TRACK_ARRIVE_PX, TRACKER_SPEED_SCALE } from './town-rules.ts';
import { zombieSpeed } from './zombie-status.ts';

/** Beyond this the flow field drives; closer in, a clear line means walking straight at the prey. */
const DIRECT_CHASE_RANGE = 140;
/** Closer than this the field's tiles are coarser than the gap left to close, so the centre line alone decides. */
const POINT_BLANK_RANGE = 2 * TILE_SIZE;
const SEPARATION_GAP = 3;
const SEPARATION_WEIGHT = 1.4;
/** A swing that started in reach forgives this much sidestep before it whiffs. */
const SWING_LEEWAY = 2;
const KNOCK_DECAY = Math.exp(-KNOCKBACK_DECAY_PER_SEC * TICK_DT);
const MIN_KNOCK_SPEED = 2;
/** Under this fraction of the intended stride, something solid is in the way. */
const BLOCKED_PROGRESS = 0.3;
const SIDESTEP_SEC = 0.4;
const SIDESTEP_WEIGHT = 1.6;
/** Share of wander decisions that are standing still instead of walking. */
const WANDER_PAUSE_ODDS = 0.45;

const crowd: ZombieState[] = [];

export function rebuildZombieGrid(sim: SimState): void {
  sim.grid.clear();
  for (const z of sim.zombies) sim.grid.insert(z);
}

function refreshFields(sim: SimState): void {
  const chaseDue = sim.tick % FLOW_REFRESH_TICKS === 0 || !sim.flow.ready;
  const chaseNeeded = chaseDue && sim.zombies.some((z) => z.mode === 'hunt');
  if (chaseNeeded) {
    const alive = alivePlayers(sim);
    sim.flow.recompute(alive.length > 0 ? alive : standingPlayers(sim), FLOW_REACH_TILES);
  }
  // At once, not on a schedule: whoever heard this must not walk an older noise's field.
  const hasNoises = sim.noises.length > 0;
  if (hasNoises) {
    sim.noiseFlow.recompute(sim.noises, NOISE_REACH_TILES);
    sim.noises = [];
  }
}

/** Squared distance in the town's plan, so someone upstairs is as near as the house they are in. */
function planDistance(sim: SimState, z: ZombieState, p: PlayerState): number {
  const from = groundOf(sim.map, z.x, z.y);
  const to = groundOf(sim.map, p.x, p.y);
  return (to.x - from.x) ** 2 + (to.y - from.y) ** 2;
}

/** Up or down the stairs it stands on, when that is the way the field runs. */
function takeStairs(z: ZombieState, field: FlowField): void {
  const out = field.stairsDown(z.x, z.y);
  if (!out) return;
  z.x = out.x;
  z.y = out.y;
}

function nearest(sim: SimState, z: ZombieState, players: readonly PlayerState[]): PlayerState | null {
  let best: PlayerState | null = null;
  let bestDistance = Infinity;
  for (const p of players) {
    const distance = planDistance(sim, z, p);
    const isNearer = distance < bestDistance;
    if (isNearer) {
      bestDistance = distance;
      best = p;
    }
  }
  return best;
}

const bodyGap = (z: ZombieState, p: PlayerState): number =>
  Math.hypot(p.x - z.x, p.y - z.y) - z.radius - PLAYER_RADIUS;

/** A wall is thinner than a brute's reach, so a blow has to have a clear path as well as the range. */
const canSee = (sim: SimState, z: ZombieState, p: PlayerState): boolean =>
  segmentHitsSolid(sim.map, z.x, z.y, p.x, p.y) === null;

/** Rays down the middle and both edges of the body: anything thinner than that could slip between. */
function hasClearLane(sim: SimState, z: ZombieState, p: PlayerState): boolean {
  const distance = Math.hypot(p.x - z.x, p.y - z.y);
  const isOnTop = distance === 0;
  if (isOnTop) return true;
  const sideX = (-(p.y - z.y) / distance) * z.radius;
  const sideY = ((p.x - z.x) / distance) * z.radius;
  return [-1, 0, 1].every(
    (side) => !segmentHitsSolid(sim.map, z.x + sideX * side, z.y + sideY * side, p.x + sideX * side, p.y + sideY * side),
  );
}

function applyKnockback(sim: SimState, z: ZombieState): void {
  const speed = Math.hypot(z.knockX, z.knockY);
  const isKnockSpent = speed < MIN_KNOCK_SPEED;
  if (isKnockSpent) {
    z.knockX = 0;
    z.knockY = 0;
    return;
  }
  const moved = stepMovement(sim.map, z.x, z.y, z.knockX, z.knockY, speed, TICK_DT, z.radius);
  z.x = moved.x;
  z.y = moved.y;
  z.knockX *= KNOCK_DECAY;
  z.knockY *= KNOCK_DECAY;
}

/** Pushes away from neighbours; coincident bodies part along a direction taken from the sim RNG. */
function separation(sim: SimState, z: ZombieState): { x: number; y: number } {
  crowd.length = 0;
  sim.grid.query(z.x, z.y, z.radius + SEPARATION_GAP, crowd);
  let x = 0;
  let y = 0;
  for (const other of crowd) {
    const isSelfOrDead = other === z || other.health <= 0;
    if (isSelfOrDead) continue;
    const dx = z.x - other.x;
    const dy = z.y - other.y;
    const distance = Math.hypot(dx, dy);
    const comfort = z.radius + other.radius + SEPARATION_GAP;
    const isStacked = distance === 0;
    if (isStacked) {
      const angle = sim.rng() * Math.PI * 2;
      x += Math.cos(angle);
      y += Math.sin(angle);
    } else {
      const isTooClose = distance < comfort;
      if (isTooClose) {
        const strength = 1 - distance / comfort;
        x += (dx / distance) * strength;
        y += (dy / distance) * strength;
      }
    }
  }
  return { x, y };
}

/** One tick of purposeful walking along a heading, in step with the crowd, at a share of full speed. */
function stride(sim: SimState, z: ZombieState, dirX: number, dirY: number, pace = 1): void {
  const length = Math.hypot(dirX, dirY);
  const isStill = length === 0;
  if (isStill) return;
  z.angle = Math.atan2(dirY, dirX);
  const push = separation(sim, z);
  const headingX = dirX / length;
  const headingY = dirY / length;
  const slip = z.sidestepLeft > 0 ? z.sidestepSide * SIDESTEP_WEIGHT : 0;
  z.sidestepLeft = Math.max(0, z.sidestepLeft - TICK_DT);
  // Wading and drifts slow a zombie like anyone, and a slowed one is not a blocked one.
  const footing = pace * groundEffect(sim.map, z.x, z.y).speed;
  const moved = stepMovement(
    sim.map,
    z.x,
    z.y,
    headingX + push.x * SEPARATION_WEIGHT - headingY * slip,
    headingY + push.y * SEPARATION_WEIGHT + headingX * slip,
    zombieSpeed(z) * footing,
    TICK_DT,
    z.radius,
  );
  const progress = Math.hypot(moved.x - z.x, moved.y - z.y);
  z.x = moved.x;
  z.y = moved.y;
  startSidestepIfBlocked(sim, z, progress / footing);
}

function walkToward(sim: SimState, z: ZombieState, prey: PlayerState): void {
  let dirX = prey.x - z.x;
  let dirY = prey.y - z.y;
  const distance = Math.hypot(dirX, dirY);
  const pointBlank = distance < POINT_BLANK_RANGE && !segmentHitsSolid(sim.map, z.x, z.y, prey.x, prey.y);
  // The field has no tile under a body in a part-blocked tile and would walk it back out, away from prey it can see.
  const offTheField = distance < DIRECT_CHASE_RANGE && sim.flow.distanceAt(z.x, z.y) === Infinity && canSee(sim, z, prey);
  const straightShot = pointBlank || offTheField || (distance < DIRECT_CHASE_RANGE && hasClearLane(sim, z, prey));
  if (!straightShot) {
    const waypoint = sim.flow.nextWaypoint(z.x, z.y, z.radius);
    if (waypoint) {
      dirX = waypoint.x - z.x;
      dirY = waypoint.y - z.y;
    }
  }
  stride(sim, z, dirX, dirY);
  takeStairs(z, sim.flow);
}

/** A dead-on heading gives per-axis sliding nothing to slide along, so step off to one side. */
function startSidestepIfBlocked(sim: SimState, z: ZombieState, progress: number): void {
  const blocked = progress < zombieSpeed(z) * TICK_DT * BLOCKED_PROGRESS;
  const needsNoSidestep = !blocked || z.sidestepLeft > 0;
  if (needsNoSidestep) return;
  z.sidestepLeft = SIDESTEP_SEC;
  z.sidestepSide = sim.rng() < 0.5 ? -1 : 1;
}

function startSwing(sim: SimState, z: ZombieState): void {
  z.attacking = true;
  z.windupLeft = z.windupSec;
  emit(sim, { type: 'zombie_attack', zombieId: z.id, zombieType: z.type, x: z.x, y: z.y });
}

/** The range check happens here, at the end of the wind-up, so a sidestep can dodge the blow. */
function landSwing(sim: SimState, z: ZombieState, prey: readonly PlayerState[]): void {
  const target = nearest(sim, z, prey);
  const inReach = target !== null && bodyGap(z, target) <= z.reach + SWING_LEEWAY;
  const landsSwing = inReach && canSee(sim, z, target);
  if (landsSwing) hurtPlayer(sim, target, z.damage);
  z.recoveryLeft = ZOMBIE_RECOVERY_SEC;
  z.cooldownLeft = z.cooldownSec;
}

function chooseWander(sim: SimState, z: ZombieState): void {
  const pausing = sim.rng() < WANDER_PAUSE_ODDS;
  const heading = sim.rng() * Math.PI * 2;
  z.wanderX = pausing ? 0 : Math.cos(heading);
  z.wanderY = pausing ? 0 : Math.sin(heading);
  z.wanderLeft = pausing ? randRange(sim.rng, 1, 4) : randRange(sim.rng, 1.5, 5);
}

/** Aimless shambling. A zombie that settled indoors stays indoors until something draws it out. */
function wander(sim: SimState, z: ZombieState): void {
  z.wanderLeft -= TICK_DT;
  const isWanderDone = z.wanderLeft <= 0;
  if (isWanderDone) chooseWander(sim, z);
  const standingStill = z.wanderX === 0 && z.wanderY === 0;
  if (standingStill) return;

  const speed = zombieSpeed(z) * ZOMBIE_WANDER_SPEED_SCALE * groundEffect(sim.map, z.x, z.y).speed;
  const moved = stepMovement(sim.map, z.x, z.y, z.wanderX, z.wanderY, speed, TICK_DT, z.radius);
  const leavesHome = z.home !== null && buildingAt(sim.map, moved.x, moved.y)?.id !== z.home;
  const bumped = Math.hypot(moved.x - z.x, moved.y - z.y) < speed * TICK_DT * BLOCKED_PROGRESS;
  const turnBack = leavesHome || bumped;
  if (turnBack) {
    z.wanderLeft = 0;
    return;
  }
  z.x = moved.x;
  z.y = moved.y;
  z.angle = Math.atan2(z.wanderY, z.wanderX);
}

/** Heads for the latest noise; at the end of the field there is nothing left to find. */
function investigate(sim: SimState, z: ZombieState): void {
  const waypoint = sim.noiseFlow.ready ? sim.noiseFlow.nextWaypoint(z.x, z.y, z.radius) : null;
  // A scream earlier this tick has no field yet: listen, and walk to it next tick.
  const fieldPending = sim.noises.length > 0;
  if (waypoint) stride(sim, z, waypoint.x - z.x, waypoint.y - z.y);
  else if (!fieldPending) backToRoaming(sim, z);
  if (waypoint) takeStairs(z, sim.noiseFlow);
}

/**
 * Nose down, print to print toward the newer ones. Where they run out (a doorway, a stretch sneaked,
 * snow filled in) it casts about, and awareness lets it give up when its interest runs dry.
 */
function track(sim: SimState, z: ZombieState): void {
  const trail = z.trail;
  if (!trail) return;
  trail.left -= TICK_DT;
  if (trail.searching) {
    wander(sim, z);
    return;
  }
  const arrived = (trail.x - z.x) ** 2 + (trail.y - z.y) ** 2 <= (z.radius + TRACK_ARRIVE_PX) ** 2;
  if (arrived) {
    const next = trailMakerAlive(sim, trail) ? nextPrint(sim, trail, z.x, z.y) : null;
    if (!next) {
      loseTrail(z);
      return;
    }
    trail.x = next.x;
    trail.y = next.y;
    trail.left = next.left;
    z.interestLeft = ZOMBIE_INVESTIGATE_SEC;
  }
  stride(sim, z, trail.x - z.x, trail.y - z.y, TRACKER_SPEED_SCALE);
}

function hunt(sim: SimState, z: ZombieState, prey: readonly PlayerState[], fallback: readonly PlayerState[]): void {
  const target = nearest(sim, z, prey.length > 0 ? prey : fallback);
  if (!target) return;
  const gap = bodyGap(z, target);
  const swingReady = target.status === 'alive' && gap <= z.reach && z.cooldownLeft === 0;
  const canSwing = swingReady && canSee(sim, z, target);
  if (canSwing) {
    z.angle = Math.atan2(target.y - z.y, target.x - z.x);
    startSwing(sim, z);
  } else {
    const isOutOfReach = gap > 1;
    if (isOutOfReach) walkToward(sim, z, target);
    else z.angle = Math.atan2(target.y - z.y, target.x - z.x);
  }
}

function updateZombie(sim: SimState, z: ZombieState, prey: readonly PlayerState[], fallback: readonly PlayerState[]): void {
  applyKnockback(sim, z);
  z.cooldownLeft = Math.max(0, z.cooldownLeft - TICK_DT);
  z.staggerImmuneLeft = Math.max(0, z.staggerImmuneLeft - TICK_DT);

  const isWindingUp = z.windupLeft > 0;
  if (isWindingUp) {
    z.windupLeft -= TICK_DT;
    const isWindupDone = z.windupLeft <= 1e-9;
    if (isWindupDone) {
      z.windupLeft = 0;
      landSwing(sim, z, prey);
    }
    return;
  }
  const isRecovering = z.recoveryLeft > 0;
  if (isRecovering) {
    z.recoveryLeft -= TICK_DT;
    const isRecoveryDone = z.recoveryLeft <= 1e-9;
    if (isRecoveryDone) {
      z.recoveryLeft = 0;
      z.attacking = false;
    }
    return;
  }

  updateAwareness(sim, z, prey);
  if (z.mode === 'hunt') hunt(sim, z, prey, fallback);
  else if (z.mode === 'alert' && z.trail) track(sim, z);
  else if (z.mode === 'alert') investigate(sim, z);
  else wander(sim, z);
}

function isAsleep(sim: SimState, z: ZombieState, players: readonly PlayerState[]): boolean {
  if (z.horde) return false;
  const reachSquared = ZOMBIE_SLEEP_RANGE * ZOMBIE_SLEEP_RANGE;
  return players.every((p) => planDistance(sim, z, p) > reachSquared);
}

export function updateZombies(sim: SimState): void {
  refreshFields(sim);
  const prey = alivePlayers(sim);
  const fallback = standingPlayers(sim);
  for (const z of sim.zombies) {
    const isDead = z.health <= 0;
    if (isDead) continue;
    if (!isAsleep(sim, z, fallback)) {
      updateZombie(sim, z, prey, fallback);
    } else {
      const isRoused = z.mode !== 'wander';
      if (isRoused) backToRoaming(sim, z);
    }
  }
}

/** Drops bodies flagged dead during the tick. */
export function removeDeadZombies(sim: SimState): void {
  sim.zombies = sim.zombies.filter((z) => z.health > 0);
}
