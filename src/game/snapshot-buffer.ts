import type { BulletEntity, EntityId, PlayerEntity, SnapshotPacket, ZombieEntity } from '../../shared/protocol.ts';

const CAPACITY = 32;
/** A gap this big is a stall or a pause, not jitter: re-anchor the clock at once. */
const RESYNC_MS = 250;
const CLOCK_SMOOTHING = 0.08;
/** Tick numbers going this far backwards mean the sim started over. */
const RESTART_TICK_GAP = 30;
/** Further than this in one step is a respawn or a restart, not movement. */
const TELEPORT_PX = 64;

export interface BufferedSnapshot {
  readonly snapshot: SnapshotPacket;
  /** Sim time of this snapshot, in ms. */
  readonly time: number;
  readonly players: ReadonlyMap<EntityId, PlayerEntity>;
  readonly zombies: ReadonlyMap<EntityId, ZombieEntity>;
}

export interface SnapshotSample {
  readonly from: BufferedSnapshot;
  readonly to: BufferedSnapshot;
  /** 0 at from, 1 at to. */
  readonly alpha: number;
}

function indexById<T extends { readonly id: EntityId }>(items: readonly T[]): Map<EntityId, T> {
  const index = new Map<EntityId, T>();
  for (const item of items) index.set(item.id, item);
  return index;
}

function buffered(snapshot: SnapshotPacket, time: number): BufferedSnapshot {
  return { snapshot, time, players: indexById(snapshot.players), zombies: indexById(snapshot.zombies) };
}

/** Holds recent snapshots on the sim's own timeline, so arrival jitter does not reach the screen. */
export class SnapshotBuffer {
  private readonly tickMs: number;
  private readonly frames: BufferedSnapshot[] = [];
  /** Local clock minus sim clock. */
  private clockOffset: number | null = null;

  constructor(tickMs: number) {
    this.tickMs = tickMs;
  }

  get size(): number {
    return this.frames.length;
  }

  get latest(): BufferedSnapshot | null {
    return this.frames[this.frames.length - 1] ?? null;
  }

  clear(): void {
    this.frames.length = 0;
    this.clockOffset = null;
  }

  push(snapshot: SnapshotPacket, nowMs: number): void {
    const newest = this.latest;
    const isStaleTick = newest && snapshot.tick <= newest.snapshot.tick;
    if (isStaleTick) {
      // A run can end between ticks, when the last survivor leaves, and the tick then stands still.
      const phaseMoved = snapshot.tick === newest.snapshot.tick && snapshot.phase !== newest.snapshot.phase;
      if (phaseMoved) {
        this.frames[this.frames.length - 1] = buffered(snapshot, newest.time);
        return;
      }
      const isLateDuplicate = newest.snapshot.tick - snapshot.tick < RESTART_TICK_GAP;
      if (isLateDuplicate) return;
      this.clear();
    }
    const time = snapshot.tick * this.tickMs;
    this.syncClock(nowMs - time);
    this.frames.push(buffered(snapshot, time));
    const isOverCapacity = this.frames.length > CAPACITY;
    if (isOverCapacity) this.frames.shift();
  }

  private syncClock(measured: number): void {
    const offset = this.clockOffset;
    const shouldResync = offset === null || Math.abs(measured - offset) > RESYNC_MS;
    if (shouldResync) {
      this.clockOffset = measured;
    } else {
      this.clockOffset = offset + (measured - offset) * CLOCK_SMOOTHING;
    }
  }

  /** The two snapshots either side of now minus delay. Clamps to the ends; never extrapolates. */
  sample(nowMs: number, delayMs: number): SnapshotSample | null {
    const frames = this.frames;
    const offset = this.clockOffset;
    const isNotReady = frames.length === 0 || offset === null;
    if (isNotReady) return null;
    const renderTime = nowMs - offset - delayMs;
    const oldest = frames[0];
    const isBeforeOldest = renderTime <= oldest.time;
    if (isBeforeOldest) return { from: oldest, to: oldest, alpha: 0 };
    for (let i = frames.length - 1; i > 0; i -= 1) {
      const from = frames[i - 1];
      const isPastFrom = renderTime >= from.time;
      if (isPastFrom) {
        const to = frames[i];
        const alpha = Math.min(1, (renderTime - from.time) / (to.time - from.time));
        return { from, to, alpha };
      }
    }
    return { from: oldest, to: oldest, alpha: 0 };
  }
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolates along the shorter way round the circle. */
export function lerpAngle(a: number, b: number, t: number): number {
  const turn = Math.PI * 2;
  const delta = ((((b - a) % turn) + turn + Math.PI) % turn) - Math.PI;
  return a + delta * t;
}

interface Placed {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

function blendPlaced<T extends Placed>(from: T | undefined, to: T, alpha: number): T {
  const isTeleport = !from || Math.hypot(to.x - from.x, to.y - from.y) > TELEPORT_PX;
  if (isTeleport) return to;
  return { ...to, x: lerp(from.x, to.x, alpha), y: lerp(from.y, to.y, alpha), angle: lerpAngle(from.angle, to.angle, alpha) };
}

/** The target snapshot's entities at interpolated positions. Anything gone from it is simply gone. */
export function interpolateZombies({ from, to, alpha }: SnapshotSample): ZombieEntity[] {
  return to.snapshot.zombies.map((zombie) => blendPlaced(from.zombies.get(zombie.id), zombie, alpha));
}

export function interpolatePlayers({ from, to, alpha }: SnapshotSample): PlayerEntity[] {
  return to.snapshot.players.map((player) => blendPlaced(from.players.get(player.id), player, alpha));
}

/** Bullets are too fast to draw late: run them forward from the newest snapshot instead. */
export function extrapolateBullets(bullets: readonly BulletEntity[], secondsAhead: number): BulletEntity[] {
  return bullets.map((b) => ({ ...b, x: b.x + b.vx * secondsAhead, y: b.y + b.vy * secondsAhead }));
}
