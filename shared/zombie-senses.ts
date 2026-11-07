import { characterOf } from './characters.ts';
import { SCREAM_COOLDOWN_SEC, SCREAM_RADIUS, SNEAK_SIGHT_SCALE, TICK_DT, ZOMBIE_INVESTIGATE_SEC, ZOMBIE_LOSE_INTEREST_SEC, ZOMBIE_SIGHT_RANGE } from './constants.ts';
import type { PlayerState, SimState, ZombieMode, ZombieState } from './sim-state.ts';
import { emit } from './sim-state.ts';
import { buildingAt, groundOf, segmentHitsSolid } from './world-query.ts';
import { printUnder } from './snow-tracks.ts';
import { eventOf } from './night-events.ts';
import { hearingScale, sightScale, TRACK_REST_SEC, TRACK_SEARCH_SEC } from './town-rules.ts';
import type { Footprint } from './town-rules.ts';

/** Each zombie looks around once in this many ticks, a sixth of its body count per tick. */
export const SIGHT_CHECK_TICKS = 6;

function notice(sim: SimState, z: ZombieState, mode: ZombieMode, interest: number): void {
  const wasUnaware = z.mode === 'wander';
  z.mode = mode;
  z.interestLeft = interest;
  if (wasUnaware) emit(sim, { type: 'zombie_alert', zombieId: z.id, zombieType: z.type, x: z.x, y: z.y });
}

export function startHunting(sim: SimState, z: ZombieState): void {
  delete z.trail;
  notice(sim, z, 'hunt', ZOMBIE_LOSE_INTEREST_SEC);
}

/** Puts its nose down on a print and follows that walker's trail. Only this zombie knows about it. */
export function pickUpTrail(sim: SimState, z: ZombieState, print: Footprint): void {
  z.mode = 'alert';
  z.interestLeft = ZOMBIE_INVESTIGATE_SEC;
  z.trail = { by: print.by, x: print.x, y: print.y, left: print.left };
  emit(sim, { type: 'zombie_track', zombieId: z.id, zombieType: z.type, x: z.x, y: z.y });
}

/** The prints ran out: it casts about for a while where it stands, then gives up. */
export function loseTrail(z: ZombieState): void {
  const trail = z.trail;
  const hasNoFreshTrail = !trail || trail.searching;
  if (hasNoFreshTrail) return;
  trail.searching = true;
  z.interestLeft = TRACK_SEARCH_SEC;
  z.wanderLeft = 0;
  z.home = null;
}

/** Forgets everything and settles wherever it stands. */
export function backToRoaming(sim: SimState, z: ZombieState): void {
  const wasTracking = z.trail !== undefined;
  if (wasTracking) z.sniffRestLeft = TRACK_REST_SEC;
  delete z.trail;
  z.mode = 'wander';
  z.interestLeft = 0;
  z.wanderLeft = 0;
  z.home = buildingAt(sim.map, z.x, z.y)?.id ?? null;
}

/** Sound goes through walls: everything in the radius comes to look. Horde zombies already know. */
export function makeNoise(sim: SimState, x: number, y: number, radius: number): void {
  sim.noises.push({ x, y });
  const heardFrom = radius * hearingScale(sim.level) * (eventOf(sim)?.hearing ?? 1);
  const radiusSquared = heardFrom * heardFrom;
  // Upstairs and down, a noise carries as far as it would from the same spot in the house.
  const source = groundOf(sim.map, x, y);
  for (const z of sim.zombies) {
    const ear = groundOf(sim.map, z.x, z.y);
    const heard = !z.horde && z.health > 0 && (ear.x - source.x) ** 2 + (ear.y - source.y) ** 2 <= radiusSquared;
    if (!heard) continue;
    // A noise beats a nose: a bottle pulls a tracker off the trail.
    delete z.trail;
    const isHunting = z.mode === 'hunt';
    if (isHunting) z.interestLeft = ZOMBIE_LOSE_INTEREST_SEC;
    else notice(sim, z, 'alert', ZOMBIE_INVESTIGATE_SEC);
  }
}

/** How far away a zombie can pick this survivor out. */
export function spottedFrom(p: PlayerState): number {
  const sneaking = p.stance === 'sneak' ? SNEAK_SIGHT_SCALE : 1;
  return ZOMBIE_SIGHT_RANGE * characterOf(p.skin).sightRange * sneaking;
}

function seesAnyone(sim: SimState, z: ZombieState, prey: readonly PlayerState[]): boolean {
  const dark = sightScale(sim.level) * (eventOf(sim)?.sight ?? 1);
  return prey.some((p) => {
    const inRange = (p.x - z.x) ** 2 + (p.y - z.y) ** 2 <= (spottedFrom(p) * dark) ** 2;
    return inRange && !segmentHitsSolid(sim.map, z.x, z.y, p.x, p.y);
  });
}

/** A screamer that has just spotted someone calls everything in earshot to it. */
function scream(sim: SimState, z: ZombieState, was: ZombieMode): void {
  const ready = z.type === 'screamer' && (z.screamLeft ?? 0) <= 0;
  if (!ready) return;
  z.screamLeft = SCREAM_COOLDOWN_SEC;
  // From wander, noticing already sounded the alert; from alert it has not.
  const unheard = was === 'alert';
  if (unheard) emit(sim, { type: 'zombie_alert', zombieId: z.id, zombieType: z.type, x: z.x, y: z.y });
  makeNoise(sim, z.x, z.y, SCREAM_RADIUS);
}

/** Looks around when due, and lets interest run down without fresh contact. */
export function updateAwareness(sim: SimState, z: ZombieState, prey: readonly PlayerState[]): void {
  if (z.horde) return;
  const recovering = (z.screamLeft ?? 0) > 0;
  if (recovering) z.screamLeft = (z.screamLeft as number) - TICK_DT;
  const lookingNow = (sim.tick + z.senseOffset) % SIGHT_CHECK_TICKS === 0;
  const spotted = lookingNow && seesAnyone(sim, z, prey);
  if (spotted) {
    const was = z.mode;
    startHunting(sim, z);
    const fresh = was !== 'hunt';
    if (fresh) scream(sim, z, was);
    return;
  }
  const resting = (z.sniffRestLeft ?? 0) > 0;
  if (resting) z.sniffRestLeft = (z.sniffRestLeft as number) - TICK_DT;
  const sniffing = lookingNow && z.mode === 'wander' && !resting && sim.tracks.length > 0;
  const print = sniffing ? printUnder(sim, z) : null;
  if (print) {
    pickUpTrail(sim, z, print);
    return;
  }
  const isWandering = z.mode === 'wander';
  if (isWandering) return;
  z.interestLeft -= TICK_DT;
  const hasLostInterest = z.interestLeft <= 0;
  if (hasLostInterest) backToRoaming(sim, z);
}
