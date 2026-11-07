import { LICORICE_HEAD_MARGIN, sugarOf } from './candy.ts';
import { CHEST_HEIGHT } from './constants.ts';
import type { EntityId, ZombieEntity, ZombieType } from './protocol.ts';
import type { BulletState, PlayerState, SimState, ZombieState } from './sim-state.ts';
import { emit } from './sim-state.ts';

interface HeadRule {
  /** Pixels from the ground point up to the middle of the drawn head. */
  readonly up: number;
  /** Pixels along the facing that the head leans out. On screen, ground distance foreshortens. */
  readonly forward: number;
  readonly radius: number;
  /** What the shot's damage is multiplied by. */
  readonly damage: number;
  /** Paid to the shooter on top of anything the kill pays. */
  readonly score: number;
}

const FULL_BONUS = { damage: 2.5, score: 5 };

/** Measured off the rigs in src/art/zombies; tests/headshots.spec.ts holds them to the art. */
const HEADS: Record<ZombieType, HeadRule> = {
  walker: { up: 20.5, forward: 4, radius: 5, ...FULL_BONUS },
  runner: { up: 14, forward: 8, radius: 4.5, ...FULL_BONUS },
  bloater: { up: 27, forward: 0.5, radius: 4, ...FULL_BONUS },
  brute: { up: 26.5, forward: 6, radius: 5.5, damage: 1.5, score: 2 },
  // Drawn on the walker's rig.
  screamer: { up: 20.5, forward: 4, radius: 5, ...FULL_BONUS },
};

/** Slack around a drawn head for the stride bob, and for zombies being drawn a little late. */
export const HEAD_MARGIN = 2;
/** A co-op player also sees every zombie a network trip late. */
const COOP_HEAD_MARGIN = 4;
/** A fingertip is broader than a mouse pointer, so a touch player gets this on top of the rest. */
const TOUCH_HEAD_BONUS = 2;
/** What the crosshair goes red at under a finger. */
export const TOUCH_HEAD_MARGIN = HEAD_MARGIN + TOUCH_HEAD_BONUS;
/** Far enough from an aim point to take in any head that could be under it. */
const HEAD_SEARCH = 40;
const GROUND_TILT = 0.5;
const EIGHTH_TURN = Math.PI / 4;

const nearby: ZombieState[] = [];

type HeadBearer = Pick<ZombieEntity, 'type' | 'x' | 'y' | 'angle'>;

/** The middle of the head as drawn. Sprites turn in eighths, so this does too. */
export function headSpot(z: HeadBearer): { x: number; y: number } {
  const head = HEADS[z.type];
  const facing = Math.round(z.angle / EIGHTH_TURN) * EIGHTH_TURN;
  return {
    x: z.x + Math.cos(facing) * head.forward,
    y: z.y + Math.sin(facing) * head.forward * GROUND_TILT - head.up,
  };
}

export function isOnHead(z: HeadBearer, x: number, y: number, margin: number): boolean {
  const spot = headSpot(z);
  return Math.hypot(x - spot.x, y - spot.y) <= HEADS[z.type].radius + margin;
}

/** Only a server times the bench, and only a server's players see zombies over a network. */
const marginFor = (sim: SimState, shooter: PlayerState | undefined): number =>
  (sim.workbench === 'timed' ? COOP_HEAD_MARGIN : HEAD_MARGIN) +
  (shooter?.touchAim ? TOUCH_HEAD_BONUS : 0) +
  (shooter ? LICORICE_HEAD_MARGIN * sugarOf(shooter, 'licorice_lash') : 0);

/** The head under the crosshair as the trigger breaks, the front one if two overlap. A shot can't reach past `range`. */
export function headUnderAim(sim: SimState, p: PlayerState, range: number): ZombieState | null {
  const { aim } = p;
  const inReach = aim !== null && Math.hypot(aim.x - p.x, aim.y - p.y) <= range + HEAD_SEARCH;
  if (!inReach) return null;
  nearby.length = 0;
  sim.grid.query(aim.x, aim.y, HEAD_SEARCH, nearby);
  let front: ZombieState | null = null;
  for (const z of nearby) {
    // A boss is drawn far bigger than its kind's head map, so it takes no headshots.
    const aimedAt = z.health > 0 && z.boss === undefined && isOnHead(z, aim.x, aim.y, marginFor(sim, p));
    const nearerTheCamera = front === null || z.y > front.y;
    const isFrontTarget = aimedAt && nearerTheCamera;
    if (isFrontTarget) front = z;
  }
  return front;
}

/**
 * The head as a circle on the ground plane bullets fly in. Aim and tracers ride
 * CHEST_HEIGHT over that plane, so a shot drawn through a head passes that far below it,
 * which on a tall zombie is clear of the body circle.
 */
export function headOnBulletPlane(sim: SimState, z: ZombieState, shooterId: EntityId): { x: number; y: number; radius: number } {
  const spot = headSpot(z);
  const shooter = sim.players.find((p) => p.id === shooterId);
  return { x: spot.x, y: spot.y + CHEST_HEIGHT, radius: HEADS[z.type].radius + marginFor(sim, shooter) };
}

/** Pays out a bullet landing on the zombie it was aimed at the head of, and returns what its damage is multiplied by. */
export function headshotMultiplier(sim: SimState, b: BulletState, z: ZombieState, angle: number): number {
  const aimedHere = b.headTarget === z;
  if (!aimedHere) return 1;
  const { damage, score } = HEADS[z.type];
  const shooter = sim.players.find((p) => p.id === b.shooterId);
  if (shooter) shooter.score += score;
  emit(sim, { type: 'headshot', playerId: b.shooterId, zombieId: z.id, zombieType: z.type, ...headSpot(z), angle, points: score });
  return damage;
}
