import type { PlayerState, SimState, ZombieState } from './sim-state.ts';
import { TICK_DT } from './constants.ts';
import {
  themeOf,
  TRACK_EVERY_TICKS,
  TRACK_FOLLOW_REACH,
  TRACK_LIFE_SEC,
  TRACK_LIMIT,
  TRACK_SNIFF_RADIUS,
} from './town-rules.ts';
import type { Footprint, ZombieTrail } from './town-rules.ts';
import { segmentHitsSolid } from './world-query.ts';

/** The heading from this walker's last print, or where they are aiming when this is their first. */
function headingOf(sim: SimState, p: PlayerState): number {
  for (let i = sim.tracks.length - 1; i >= 0; i -= 1) {
    const last = sim.tracks[i];
    const isSomeoneElses = last.by !== p.id;
    if (isSomeoneElses) continue;
    const moved = last.x !== p.x || last.y !== p.y;
    return moved ? Math.atan2(p.y - last.y, p.x - last.x) : (last.angle ?? p.angle);
  }
  return p.angle;
}

/** Walking or sprinting outdoors in snow leaves prints. Sneaking and standing do not. */
export function leaveFootprint(sim: SimState, p: PlayerState): void {
  const snowy = themeOf(sim.level) === 'snow';
  const printing = snowy && p.moving && p.stance !== 'sneak' && p.indoors === null;
  const due = sim.tick % TRACK_EVERY_TICKS === 0;
  const skip = !printing || !due;
  if (skip) return;
  sim.tracks.push({ x: p.x, y: p.y, by: p.id, angle: headingOf(sim, p), left: TRACK_LIFE_SEC });
  const overLimit = sim.tracks.length > TRACK_LIMIT;
  if (overLimit) sim.tracks.shift();
}

/** Snow fills the prints in. */
export function ageFootprints(sim: SimState): void {
  const anyPrints = sim.tracks.length > 0;
  if (!anyPrints) return;
  for (const print of sim.tracks) print.left -= TICK_DT;
  sim.tracks = sim.tracks.filter((print) => print.left > 0);
}

const livingMaker = (sim: SimState, by: string): PlayerState | undefined =>
  sim.players.find((p) => p.id === by && p.status === 'alive');

/** The freshest print under this zombie left by someone still on their feet, or null. */
export function printUnder(sim: SimState, z: ZombieState): Footprint | null {
  const reach = (TRACK_SNIFF_RADIUS + z.radius) ** 2;
  let best: Footprint | null = null;
  for (const print of sim.tracks) {
    const onIt = (print.x - z.x) ** 2 + (print.y - z.y) ** 2 <= reach;
    const fresher = best === null || print.left > best.left;
    const isBetterScent = onIt && fresher && livingMaker(sim, print.by);
    if (isBetterScent) best = print;
  }
  return best;
}

/** True while whoever left this trail is still on their feet. */
export function trailMakerAlive(sim: SimState, trail: ZombieTrail): boolean {
  return livingMaker(sim, trail.by) !== undefined;
}

/**
 * Where the trail goes next from x,y: the oldest of that walker's prints that is newer than the one
 * reached, close by, with no wall between. Oldest first means a doubled-back loop is walked in full.
 */
export function nextPrint(sim: SimState, trail: ZombieTrail, x: number, y: number): Footprint | null {
  const reach = TRACK_FOLLOW_REACH ** 2;
  let best: Footprint | null = null;
  for (const print of sim.tracks) {
    const candidate = print.by === trail.by && print.left > trail.left && (best === null || print.left < best.left);
    if (!candidate) continue;
    const near = (print.x - x) ** 2 + (print.y - y) ** 2 <= reach;
    const isVisibleNearPrint = near && !segmentHitsSolid(sim.map, x, y, print.x, print.y);
    if (isVisibleNearPrint) best = print;
  }
  return best;
}
