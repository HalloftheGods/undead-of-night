// Turns a highlighted survivor through all eight facings, one step at a time.

/** dirFromAngle indices (0=E 1=SE 2=S 3=SW 4=W 5=NW 6=N 7=NE) from the front, round the full circle. */
export const SPIN_ORDER: readonly number[] = [2, 3, 4, 5, 6, 7, 0, 1];
export const FRONT_FACING = 2;
export const SPIN_STEP_MS = 180;

type TimerHandle = ReturnType<typeof setInterval>;

export interface SpinTimers {
  readonly set: (tick: () => void, ms: number) => TimerHandle;
  readonly clear: (handle: TimerHandle) => void;
}

// Called on globalThis, not as a method of this object: a browser throws Illegal invocation otherwise.
// The spinner keeps the handle and clears it on every restart and stop.
const BROWSER_TIMERS: SpinTimers = {
  set: (tick, ms) => globalThis.setInterval(tick, ms),
  clear: (handle) => globalThis.clearInterval(handle),
};

/** Reduced motion stills only a touch screen's turn, which nobody asked for. Pointing at a survivor asks to see it turn. */
export function holdsStill(touchOnly: boolean, wantsCalm: boolean): boolean {
  return touchOnly && wantsCalm;
}

export interface Spinner {
  /** Begin turning from the front. Calling again restarts from the front. */
  start(): void;
  /** Stop and return to the front view. */
  stop(): void;
}

/** Reports each facing to draw. Timers are injectable so the cadence can be tested. */
export function createSpinner(show: (facing: number) => void, timers: SpinTimers = BROWSER_TIMERS): Spinner {
  let handle: TimerHandle | null = null;
  let step = 0;

  function halt(): void {
    const stale = handle;
    handle = null;
    const hasStaleTimer = stale !== null;
    if (hasStaleTimer) timers.clear(stale);
  }

  return {
    start() {
      halt();
      step = 0;
      show(SPIN_ORDER[step]);
      handle = timers.set(() => {
        step = (step + 1) % SPIN_ORDER.length;
        show(SPIN_ORDER[step]);
      }, SPIN_STEP_MS);
    },
    stop() {
      halt();
      show(FRONT_FACING);
    },
  };
}
