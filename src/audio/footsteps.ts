import type { EntityId, PlayerEntity, Stance, TileKind, WorldMap } from '../../shared/protocol.ts';
import { GROUND_EFFECTS, groundAt } from '../../shared/ground.ts';
import { playerSpeed } from '../../shared/players.ts';
import type { SfxName } from './sfx-registry.ts';
import type { PlayOpts } from './mixer.ts';

/** Which footstep a surface sounds like. Floors, roads and anything off the map are plain. */
export function stepSfxFor(kind: TileKind | null): SfxName {
  return (kind && SURFACE_STEP[kind]) || 'step_hard';
}

const SURFACE_STEP: Readonly<Partial<Record<TileKind, SfxName>>> = {
  grass: 'step_soft',
  dirt: 'step_soft',
  water: 'step_water',
  snow: 'step_snow',
  sludge: 'step_sludge',
  ash: 'step_ash',
};

/** Slow enough to be sneaking, fast enough to be sprinting, or neither. */
function stanceBySpeed(ratio: number): Stance {
  const isSneaking = ratio < SNEAK_BELOW;
  if (isSneaking) return 'sneak';
  return ratio > SPRINT_ABOVE ? 'sprint' : 'walk';
}

/** World pixels between steps. Sneaking takes short, rare steps; sprinting long, quick ones. */
const STRIDE: Record<Stance, number> = { sneak: 40, walk: 26, sprint: 30 };
/** Steps stay low so they never mask gunfire or groans; sneaking is barely there. */
const STEP_GAIN: Record<Stance, number> = { sneak: 0.3, walk: 0.8, sprint: 1.1 };
/** Measured speed, as a share of that player's walk, that separates the stances. */
const SNEAK_BELOW = 0.78;
const SPRINT_ABOVE = 1.15;
/** A move this many times a sprint's pace is a teleport or a respawn, not a stride. */
const TELEPORT_RATIO = 3 * 1.4;

export type StepPlayer = (name: SfxName, opts: PlayOpts) => void;

interface Walker {
  x: number;
  y: number;
  /** Distance walked since the last step. */
  acc: number;
  /** Frame this walker was last seen on, to drop the ones who left. */
  seen: number;
}

/** Turns where players are, frame to frame, into footsteps on the ground under them. */
export class FootstepTracker {
  private readonly walkers = new Map<EntityId, Walker>();
  private frame = 0;

  /**
   * One frame. Stance is read from how fast a player actually moved, undone for the ground's drag, so
   * the local player and everyone else are treated alike. Positions are the rendered, interpolated ones.
   * The local player's own steps are never attenuated; the rest fall off with distance in the mixer.
   */
  tick(players: readonly PlayerEntity[], localId: EntityId | null, map: WorldMap, dt: number, play: StepPlayer): void {
    this.frame += 1;
    for (const p of players) this.step(p, p.id === localId, map, dt, play);
    const hasGoneWalkers = this.walkers.size > players.length;
    if (hasGoneWalkers) this.drop();
  }

  reset(): void {
    this.walkers.clear();
  }

  private step(p: PlayerEntity, local: boolean, map: WorldMap, dt: number, play: StepPlayer): void {
    let w = this.walkers.get(p.id);
    if (!w) {
      w = { x: p.x, y: p.y, acc: 0, seen: this.frame };
      this.walkers.set(p.id, w);
    }
    w.seen = this.frame;
    const dist = Math.hypot(p.x - w.x, p.y - w.y);
    w.x = p.x;
    w.y = p.y;
    const isResting = p.status !== 'alive' || dt <= 0;
    if (isResting) {
      w.acc = 0;
      return;
    }
    const isStandingStill = dist === 0;
    if (isStandingStill) return;
    const kind = groundAt(map, p.x, p.y);
    const drag = (kind && GROUND_EFFECTS[kind]?.speed) || 1;
    const ratio = dist / dt / (playerSpeed(p.skin) * drag);
    const stance = stanceBySpeed(ratio);
    // A jump (a respawn, a van ride) is no stride: the count starts again and nothing sounds.
    const isTeleport = ratio > TELEPORT_RATIO;
    w.acc = isTeleport ? 0 : Math.min(w.acc + dist, STRIDE[stance] * 2);
    const isMidStride = w.acc < STRIDE[stance];
    if (isMidStride) return;
    w.acc -= STRIDE[stance];
    play(stepSfxFor(kind), local ? { local: true, gain: STEP_GAIN[stance] } : { x: p.x, y: p.y, gain: STEP_GAIN[stance] });
  }

  private drop(): void {
    for (const [id, w] of this.walkers) {
      const isGone = w.seen !== this.frame;
      if (isGone) this.walkers.delete(id);
    }
  }
}

/** The zombies heavy enough to be heard walking. */
export interface Stomper {
  readonly id: EntityId;
  readonly x: number;
  readonly y: number;
  readonly type: string;
  readonly boss?: string;
}

/** Brutes and bosses: the ones heavy enough to be heard walking. */
function isHeavy(z: Stomper): boolean {
  return z.boss !== undefined || z.type === 'brute';
}

/** World pixels between a heavy zombie's footfalls: a boss's stride is longer. */
const STOMP_STRIDE = 34;
const BOSS_STRIDE = 46;
/** A jump this far in one frame is a respawn or a stairwell, not a stride. */
const STOMP_JUMP = 60;

/** Footfalls for brutes and bosses, so a big one is heard before it is seen. Others shuffle quietly. */
export class StompTracker {
  private readonly walkers = new Map<EntityId, Walker>();
  private frame = 0;

  tick(zombies: readonly Stomper[], play: StepPlayer): void {
    this.frame += 1;
    for (const z of zombies) if (isHeavy(z)) this.step(z, play);
    for (const [id, w] of this.walkers) this.forgetIfGone(id, w);
  }

  reset(): void {
    this.walkers.clear();
  }

  private forgetIfGone(id: EntityId, w: Walker): void {
    const gone = w.seen !== this.frame;
    if (gone) this.walkers.delete(id);
  }

  private step(z: Stomper, play: StepPlayer): void {
    const w = this.walkers.get(z.id);
    if (!w) {
      this.walkers.set(z.id, { x: z.x, y: z.y, acc: 0, seen: this.frame });
      return;
    }
    w.seen = this.frame;
    const dist = Math.hypot(z.x - w.x, z.y - w.y);
    w.x = z.x;
    w.y = z.y;
    const jumped = dist > STOMP_JUMP;
    if (jumped) {
      w.acc = 0;
      return;
    }
    const stride = z.boss ? BOSS_STRIDE : STOMP_STRIDE;
    w.acc += dist;
    const midStride = w.acc < stride;
    if (midStride) return;
    w.acc %= stride;
    play('step_stomp', z.boss ? { x: z.x, y: z.y, gain: 1.5, pitch: 0.7 } : { x: z.x, y: z.y });
  }
}
