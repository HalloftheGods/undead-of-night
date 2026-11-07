/** A browser that wakes this late has been throttled: drop the lost time, do not replay it. */
const MAX_CATCH_UP_TICKS = 5;

/**
 * Fixed-rate timer that schedules each tick against an absolute deadline, so
 * setTimeout's lateness never accumulates. Stopping it suspends the clock:
 * time spent stopped is not owed when it starts again.
 */
export class TickClock {
  private readonly tickMs: number;
  private readonly onTick: () => void;
  private readonly now: () => number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private nextAt = 0;

  constructor(tickMs: number, onTick: () => void, now: () => number = () => performance.now()) {
    this.tickMs = tickMs;
    this.onTick = onTick;
    this.now = now;
  }

  get running(): boolean {
    return this.timer !== null;
  }

  start(): void {
    const isRunning = this.timer !== null;
    if (isRunning) return;
    this.nextAt = this.now() + this.tickMs;
    this.schedule();
  }

  stop(): void {
    const timer = this.timer;
    const isStopped = timer === null;
    if (isStopped) return;
    clearTimeout(timer);
    this.timer = null;
  }

  private schedule(): void {
    const wait = Math.max(0, this.nextAt - this.now());
    this.timer = setTimeout(this.fire, wait);
  }

  private readonly fire = (): void => {
    const now = this.now();
    let ticks = 0;
    while (now >= this.nextAt && ticks < MAX_CATCH_UP_TICKS) {
      this.nextAt += this.tickMs;
      ticks += 1;
      this.onTick();
      // onTick may have stopped the clock.
      const isStopped = this.timer === null;
      if (isStopped) return;
    }
    const isBehind = now >= this.nextAt;
    if (isBehind) this.nextAt = now + this.tickMs;
    this.schedule();
  };
}
