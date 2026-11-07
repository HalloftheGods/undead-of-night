// The van's drive across the screen when the party leaves the bunker or comes home. Pure timing:
// VanTransition.vue draws it. It only follows where the snapshot says the party is, so it never
// holds up the sim, the network or a save. The world has already been rebuilt when a drive starts,
// which is why the cover is whole from the first frame and only lifts after the cut.

/** Out of the bunker into a town, or back home. */
export type VanTrip = 'leaving' | 'returning';

/** A sound the drive asks for, at its moment. */
export type VanCue = 'depart' | 'arrive' | 'door';

export interface VanTimeline {
  /** The whole drive, in ms. */
  readonly total: number;
  /** From here the cover lifts off the world. */
  readonly cut: number;
  /** When the van is on the move, from the start, in ms. */
  readonly driveMs: number;
  /** When the door shuts on the way home, or null for none. */
  readonly doorAt: number | null;
}

export interface VanFrame {
  /** The van's centre across the screen: 0 the left edge, 1 the right. */
  readonly x: number;
  /** 1 nose right, -1 nose left. */
  readonly facing: 1 | -1;
  /** 0 standing to 1 flat out, which drives the bounce and the puffs. */
  readonly speed: number;
  /** Screen widths covered so far, which scrolls the road. */
  readonly travelled: number;
  /** How much of the world the cover hides: 1 all of it. */
  readonly cover: number;
  /** Which of the two wheel frames shows. */
  readonly wheel: 0 | 1;
  /** Art pixels the body sits up off the wheels. */
  readonly bob: 0 | 1;
}

/** A puff of exhaust left where the van's tail was. */
export interface VanPuff {
  /** The van's centre when it was let out, as in `VanFrame.x`. */
  readonly x: number;
  /** 0 just out to 1 gone. */
  readonly age: number;
}

export interface VanRun {
  readonly trip: VanTrip;
  /** The page clock (performance.now) the drive started at. */
  readonly startedMs: number;
  /** Skipped past the cut, so no door is heard. */
  readonly skipped: boolean;
}

const FULL: VanTimeline = { total: 2500, cut: 2000, driveMs: 1900, doorAt: null };
const HOME_FULL: VanTimeline = { ...FULL, driveMs: 1500, doorAt: 1700 };
/** Reduced motion: the van stands still and the cover simply fades. */
const STILL: VanTimeline = { total: 1200, cut: 700, driveMs: 0, doorAt: null };
const HOME_STILL: VanTimeline = { ...STILL, doorAt: 300 };

/** Off the left edge to off the right when leaving; in from the right to the middle coming home. */
const LEAVE_FROM = -0.3;
const LEAVE_SPAN = 1.6;
const HOME_FROM = 1.3;
const HOME_SPAN = 0.8;
const PUFF_EVERY_MS = 160;
const PUFF_LIFE_MS = 700;
const PUFF_MIN_SPEED = 0.1;
/** Screen widths per wheel frame. */
const WHEEL_STEP = 0.02;
const BOB_MS = 90;
const BOB_MIN_SPEED = 0.05;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function vanTimeline(trip: VanTrip, reduced: boolean): VanTimeline {
  const home = trip === 'returning';
  if (reduced) return home ? HOME_STILL : STILL;
  return home ? HOME_FULL : FULL;
}

/** The drive a change in where the party is calls for. The first sighting, and leaving home mode, call for none. */
export function tripFor(wasInBunker: boolean | null, inBunker: boolean | null): VanTrip | null {
  const unknown = wasInBunker === null || inBunker === null;
  const isNoTransition = unknown || wasInBunker === inBunker;
  if (isNoTransition) return null;
  return inBunker ? 'returning' : 'leaving';
}

/** Leaving pulls away from a crawl; coming home it brakes to a stop in the middle. */
function drive(trip: VanTrip, p: number): { x: number; speed: number } {
  const isLeaving = trip === 'leaving';
  if (isLeaving) {
    const eased = 0.3 * p + 0.7 * p * p;
    return { x: LEAVE_FROM + LEAVE_SPAN * eased, speed: (0.3 + 1.4 * p) / 1.7 };
  }
  const eased = 1 - (1 - p) * (1 - p);
  return { x: HOME_FROM - HOME_SPAN * eased, speed: 1 - p };
}

export function vanFrame(trip: VanTrip, ms: number, reduced: boolean): VanFrame {
  const line = vanTimeline(trip, reduced);
  const facing = trip === 'leaving' ? 1 : -1;
  const cover = ms < line.cut ? 1 : clamp01(1 - (ms - line.cut) / (line.total - line.cut));
  const standing = line.driveMs === 0;
  if (standing) return { x: 0.5, facing, speed: 0, travelled: 0, cover, wheel: 0, bob: 0 };
  const p = clamp01(ms / line.driveMs);
  const { x, speed: moving } = drive(trip, p);
  const speed = p >= 1 ? 0 : moving;
  const start = trip === 'leaving' ? LEAVE_FROM : HOME_FROM;
  const travelled = Math.abs(x - start);
  const wheel = Math.floor(travelled / WHEEL_STEP) % 2 === 0 ? 0 : 1;
  const bob = speed > BOB_MIN_SPEED && Math.floor(ms / BOB_MS) % 2 === 1 ? 1 : 0;
  return { x, facing, speed, travelled, cover, wheel, bob };
}

/** The puffs still in the air at `ms`, oldest first. None while the van stands. */
export function vanPuffs(trip: VanTrip, ms: number, reduced: boolean): VanPuff[] {
  const puffs: VanPuff[] = [];
  const { driveMs } = vanTimeline(trip, reduced);
  const first = Math.max(0, Math.ceil((ms - PUFF_LIFE_MS) / PUFF_EVERY_MS)) * PUFF_EVERY_MS;
  for (let at = first; at <= Math.min(ms, driveMs); at += PUFF_EVERY_MS) {
    const { x, speed } = vanFrame(trip, at, reduced);
    const smoking = speed >= PUFF_MIN_SPEED;
    if (smoking) puffs.push({ x, age: (ms - at) / PUFF_LIFE_MS });
  }
  return puffs;
}

/** The sounds whose moment falls in (fromMs, toMs]. Pass -1 as `fromMs` for the start. */
export function vanCues(run: VanRun, fromMs: number, toMs: number, reduced: boolean): VanCue[] {
  const crossed = (at: number): boolean => fromMs < at && at <= toMs;
  const cues: VanCue[] = [];
  const starting = crossed(0);
  if (starting) cues.push(run.trip === 'leaving' ? 'depart' : 'arrive');
  const { doorAt } = vanTimeline(run.trip, reduced);
  const doorShuts = doorAt !== null && !run.skipped && crossed(doorAt);
  if (doorShuts) cues.push('door');
  return cues;
}

export function runOver(run: VanRun, nowMs: number, reduced: boolean): boolean {
  return nowMs - run.startedMs >= vanTimeline(run.trip, reduced).total;
}

/** A second sighting of the same drive keeps the one on screen; a turn the other way starts again under a whole cover. */
export function nextRun(run: VanRun | null, trip: VanTrip | null, nowMs: number, reduced: boolean): VanRun | null {
  const noChange = trip === null;
  if (noChange) return run;
  const sameDrive = run !== null && run.trip === trip && !runOver(run, nowMs, reduced);
  return sameDrive ? run : { trip, startedMs: nowMs, skipped: false };
}

/** A key or a click jumps to the cut, so the cover starts lifting at once. */
export function skipRun(run: VanRun, nowMs: number, reduced: boolean): VanRun {
  const { cut } = vanTimeline(run.trip, reduced);
  return { ...run, startedMs: Math.min(run.startedMs, nowMs - cut), skipped: true };
}

/** Share of the window the van may fill, across and down. A phone gets a wider share so it still reads. */
const VAN_WIDE_SHARE = 0.5;
const VAN_NARROW_SHARE = 0.6;
const VAN_TALL_SHARE = 0.3;
const NARROW_VIEW = 600;
const MIN_ART_PX = 2;

/** CSS px per art pixel for the van: whole pixels, as big as the window allows. */
export function vanPixel(viewW: number, viewH: number, artW: number, artH: number): number {
  const across = viewW < NARROW_VIEW ? VAN_NARROW_SHARE : VAN_WIDE_SHARE;
  const fits = Math.min((viewW * across) / artW, (viewH * VAN_TALL_SHARE) / artH);
  return Math.max(MIN_ART_PX, Math.floor(fits));
}
