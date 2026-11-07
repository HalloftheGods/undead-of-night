const SNAP_DISTANCE = 48;
const CORRECTION_RATE = 10;
/** Smaller errors are rounding between frame steps and sim ticks, not mistakes. */
const DEAD_ZONE = 0.75;
const MAX_PENDING = 90;

export interface MoveStep {
  (x: number, y: number, dirX: number, dirY: number, dt: number): { x: number; y: number };
}

/** Whether the player's body would overlap something solid here. */
export interface SolidTest {
  (x: number, y: number): boolean;
}

interface PendingInput {
  readonly seq: number;
  readonly dirX: number;
  readonly dirY: number;
}

/**
 * Moves the local player every frame, ahead of the sim. Each snapshot replays
 * the inputs the sim has not applied yet on top of its position; any difference
 * from where the player is shown drains away gently rather than popping. A
 * correction never pushes the body into a solid: a refused one means something
 * stands between the two positions, so the next snapshot snaps across it.
 */
export class LocalPredictor {
  x = 0;
  y = 0;
  private readonly step: MoveStep;
  private readonly tickDt: number;
  private readonly isSolid: SolidTest;
  private pending: PendingInput[] = [];
  private correctionX = 0;
  private correctionY = 0;
  private fixRefused = false;
  /** Time moved since the newest recorded input, which replay must also cover. */
  private partialDt = 0;
  private dirX = 0;
  private dirY = 0;

  constructor(step: MoveStep, tickDt: number, isSolid: SolidTest) {
    this.step = step;
    this.tickDt = tickDt;
    this.isSolid = isSolid;
  }

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.pending = [];
    this.correctionX = 0;
    this.correctionY = 0;
    this.fixRefused = false;
    this.partialDt = 0;
  }

  record(seq: number, dirX: number, dirY: number): void {
    this.pending.push({ seq, dirX, dirY });
    const isBacklogFull = this.pending.length > MAX_PENDING;
    if (isBacklogFull) this.pending.shift();
    this.partialDt = 0;
  }

  advance(dirX: number, dirY: number, dt: number): void {
    this.dirX = dirX;
    this.dirY = dirY;
    this.partialDt += dt;
    const moved = this.step(this.x, this.y, dirX, dirY, dt);
    const blend = 1 - Math.exp(-CORRECTION_RATE * dt);
    const fixX = this.correctionX * blend;
    const fixY = this.correctionY * blend;
    this.correctionX -= fixX;
    this.correctionY -= fixY;
    const fixedX = moved.x + fixX;
    const canFixX = !this.isSolid(fixedX, moved.y);
    this.x = canFixX ? fixedX : moved.x;
    const fixedY = moved.y + fixY;
    const canFixY = !this.isSolid(this.x, fixedY);
    this.y = canFixY ? fixedY : moved.y;
    this.fixRefused ||= !canFixX || !canFixY;
  }

  reconcile(serverX: number, serverY: number, ackedSeq: number): void {
    this.pending = this.pending.filter((input) => input.seq > ackedSeq);
    let replay = { x: serverX, y: serverY };
    for (const input of this.pending) {
      replay = this.step(replay.x, replay.y, input.dirX, input.dirY, this.tickDt);
    }
    const hasPartialStep = this.partialDt > 0;
    if (hasPartialStep) replay = this.step(replay.x, replay.y, this.dirX, this.dirY, this.partialDt);

    const errorX = replay.x - this.x;
    const errorY = replay.y - this.y;
    const error = Math.hypot(errorX, errorY);
    const isDrifting = error > DEAD_ZONE;
    const blockedOff = this.fixRefused && isDrifting;
    const mustSnap = error > SNAP_DISTANCE || blockedOff || this.isSolid(this.x, this.y);
    this.fixRefused = false;
    if (mustSnap) {
      this.x = replay.x;
      this.y = replay.y;
      this.correctionX = 0;
      this.correctionY = 0;
    } else if (isDrifting) {
      this.correctionX = errorX;
      this.correctionY = errorY;
    } else {
      this.correctionX = 0;
      this.correctionY = 0;
    }
  }
}
