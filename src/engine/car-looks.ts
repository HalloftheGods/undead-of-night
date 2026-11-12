// How a car on the map looks: which coat its spot gives it, and the light bars on police cars and
// ambulances, blinking over the art and throwing their colour on the road.

import type { PropInstance, PropKind, WorldMap } from '../../shared/protocol.ts';
import type { VehicleBody } from '../../shared/vehicle-bodies.ts';
import type { ContainerArt } from '../art/containers.ts';
import type { ArtBook, Clip, PixelSprite } from '../art/types.ts';
import { clipIndex, drawSprite } from './sprite-cache.ts';

/** A hash of the car's spot: the same on every client, and neighbours rarely match. */
function spotHash(x: number, y: number): number {
  let h = Math.imul(Math.round(x), 0x27d4eb2d) ^ Math.imul(Math.round(y), 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return (h ^ (h >>> 13)) >>> 0;
}

/** Which of n coats the car at this spot wears. */
export function coatIndex(prop: Pick<PropInstance, 'x' | 'y'>, count: number): number {
  return count > 0 ? spotHash(prop.x, prop.y) % count : 0;
}

/** The prop's own sprite, or its coat for a car that comes in several. */
export function propSprite(art: ArtBook, prop: PropInstance): PixelSprite {
  const coats = art.environment.paintJobs[prop.kind];
  return coats ? coats[coatIndex(prop, coats.length)] : art.environment.props[prop.kind];
}

/** A searchable car's shut and searched art in its coat, or null to use its look's. */
export function paintedContainer(art: ArtBook, prop: PropInstance): ContainerArt | null {
  const coats = art.paintedContainers[prop.kind];
  return coats ? coats[coatIndex(prop, coats.length)] : null;
}

/** What each light bar throws on the road, frame by frame. */
const GLOW: Partial<Record<PropKind, readonly string[]>> = {
  police_h: ['#e85c40', '#6488bc'],
  police_v: ['#e85c40', '#6488bc'],
  ambulance_h: ['#e85c40', '#faf2d4'],
};
/** The same glow for a car that has left its spot. */
export const GLOW_BY_BODY: Partial<Record<VehicleBody, readonly string[]>> = {
  police: ['#e85c40', '#6488bc'],
  ambulance: ['#e85c40', '#faf2d4'],
};
const GLOW_RADIUS = 70;
const GLOW_STRENGTH = 0.75;
/** Up off the ground to the roof the bar sits on. */
const GLOW_HEIGHT = 14;

export interface Beacon {
  readonly x: number;
  readonly y: number;
  readonly clip: Clip;
  readonly glow: readonly string[];
  /** Each car's bar runs out of step with the others. */
  readonly phase: number;
  /** The map prop this bar sits on, or the driven car's id: a bar on a car that has driven off is the car's own. */
  readonly index?: number;
}

/** The bars still standing on their parked cars, those of cars that have driven off left out. */
export function parkedBeacons(beacons: readonly Beacon[], lifted: ReadonlySet<number>): Beacon[] {
  return beacons.filter((beacon) => beacon.index === undefined || !lifted.has(beacon.index));
}

export function beaconsOn(art: ArtBook, map: WorldMap): Beacon[] {
  const beacons: Beacon[] = [];
  for (const [index, prop] of map.props.entries()) {
    const clip = art.environment.beacons[prop.kind];
    const glow = GLOW[prop.kind];
    const hasLightBar = clip !== undefined && glow !== undefined;
    if (!hasLightBar) continue;
    beacons.push({ x: Math.round(prop.x), y: Math.round(prop.y), clip, glow, phase: (spotHash(prop.x, prop.y) % 1000) / 1000, index });
  }
  return beacons;
}

/** The frame a bar is on. With reduced motion it holds still on its first. */
export function beaconFrame(beacon: Beacon, time: number, reducedMotion: boolean): number {
  return reducedMotion ? 0 : clipIndex(beacon.clip, time + beacon.phase);
}

export interface BeaconPool {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly color: string;
  readonly strength: number;
}

export function beaconPool(beacon: Beacon, time: number, reducedMotion: boolean): BeaconPool {
  const frame = beaconFrame(beacon, time, reducedMotion);
  return { x: beacon.x, y: beacon.y - GLOW_HEIGHT, radius: GLOW_RADIUS, color: beacon.glow[frame % beacon.glow.length], strength: GLOW_STRENGTH };
}

/** The part of the world a bar must stand in to be drawn, and the view's top-left corner. */
export interface BeaconView {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly left: number;
  readonly top: number;
}

/** The lit half of each bar in view, over its car. */
export function drawBeacons(ctx: CanvasRenderingContext2D, beacons: readonly Beacon[], view: BeaconView, time: number, reducedMotion: boolean): void {
  for (const beacon of beacons) {
    const inView = beacon.x > view.x0 && beacon.x < view.x1 && beacon.y > view.y0 && beacon.y < view.y1;
    if (inView) drawSprite(ctx, beacon.clip.frames[beaconFrame(beacon, time, reducedMotion)], beacon.x - view.left, beacon.y - view.top);
  }
}
