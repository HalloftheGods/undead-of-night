// Load shedding for slow machines. When frames keep running long, the picture drops its least-noticed
// extras (spare particles, the smaller flashes of light) until it is back at the display's rate.
// Nothing here touches the sim: it only decides how much decoration a frame can afford.

/** A frame slower than this counts as running long: just under 60 fps, with room for timer jitter. */
const SLOW_FRAME_SEC = 1 / 55;
/** Back under this, the frames have room to spare again. */
const EASY_FRAME_SEC = 1 / 58;
/** How quickly the average follows the frames: about half a second at 60 fps. */
const SMOOTHING = 0.06;
/** Seconds the frames must stay slow, or easy, before the level moves. Long enough to ride out one hitch. */
const SHED_AFTER_SEC = 0.5;
const RESTORE_AFTER_SEC = 3;

/** Share of the full budget for extras at each level: everything, half, a quarter. */
export const BUDGET_SHARES: readonly number[] = [1, 0.5, 0.25];

export class FrameBudget {
  private average = 0;
  private slowFor = 0;
  private easyFor = 0;
  private current = 0;

  /** 0 is full detail; each step up sheds more. */
  get level(): number {
    return this.current;
  }

  /** The share of the full particle and light budget a frame can spend now. */
  get share(): number {
    return BUDGET_SHARES[this.current];
  }

  /** Once a frame with the time since the last one. A held or frozen frame (dt 0) says nothing. */
  update(dt: number): void {
    const passedNoTime = dt <= 0;
    if (passedNoTime) return;
    this.average = this.average === 0 ? dt : this.average + (dt - this.average) * SMOOTHING;
    const slow = this.average > SLOW_FRAME_SEC;
    const easy = this.average < EASY_FRAME_SEC;
    this.slowFor = slow ? this.slowFor + dt : 0;
    this.easyFor = easy ? this.easyFor + dt : 0;
    const shed = this.slowFor >= SHED_AFTER_SEC && this.current < BUDGET_SHARES.length - 1;
    const restore = this.easyFor >= RESTORE_AFTER_SEC && this.current > 0;
    if (shed) this.step(1);
    else if (restore) this.step(-1);
  }

  reset(): void {
    this.average = 0;
    this.slowFor = 0;
    this.easyFor = 0;
    this.current = 0;
  }

  private step(by: number): void {
    this.current += by;
    this.slowFor = 0;
    this.easyFor = 0;
  }
}
