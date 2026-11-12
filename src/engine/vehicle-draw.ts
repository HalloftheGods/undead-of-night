// Driven cars on screen: the sprite for the way the nose points, in the coat its parking spot gave it,
// a shadow under it, and the light bars on police cars and ambulances that ride along.

import type { PropInstance, VehicleView } from '../../shared/protocol.ts';
import { anchorOfCentre, restSize } from '../../shared/vehicle-bodies.ts';
import type { VehicleBody } from '../../shared/vehicle-bodies.ts';
import type { ArtBook, PixelSprite } from '../art/types.ts';
import { coatIndex, GLOW_BY_BODY } from './car-looks.ts';
import type { Beacon } from './car-looks.ts';
import { drawSprite } from './sprite-cache.ts';

const SHADOW_RGBA = 'rgba(4, 5, 10, 0.5)';

/** The car's sprite for its facing, in the coat its spot gave it. */
export function vehicleSprite(art: ArtBook, car: Pick<VehicleView, 'body' | 'facing'>, parked: Pick<PropInstance, 'x' | 'y'> | undefined): PixelSprite {
  const coats = art.vehicles[car.body][car.facing];
  return coats[parked ? coatIndex(parked, coats.length) : 0];
}

/** Where the car stands on screen, in whole pixels: its footprint's bottom edge, which is also what it is sorted by. */
export function vehicleAnchor(car: Pick<VehicleView, 'body' | 'facing' | 'x' | 'y'>): { readonly x: number; readonly y: number } {
  const at = anchorOfCentre(car.body, car.facing, car.x, car.y);
  return { x: Math.round(at.x), y: Math.round(at.y) };
}

/** A flat pixel ellipse over the car's footprint, rows stepped by hand so the edge stays hard. */
export function drawVehicleShadow(ctx: CanvasRenderingContext2D, car: Pick<VehicleView, 'body' | 'facing' | 'x' | 'y'>, left: number, top: number): void {
  const { w, h } = restSize(car.body, car.facing);
  const cx = Math.round(car.x) - left;
  const cy = Math.round(car.y) - top;
  const rows = h + 2;
  ctx.fillStyle = SHADOW_RGBA;
  for (let row = 0; row < rows; row += 1) {
    const ny = ((row + 0.5) / rows) * 2 - 1;
    const half = Math.round(((w + 2) / 2) * Math.sqrt(1 - ny * ny));
    ctx.fillRect(cx - half, cy - Math.round(rows / 2) + row, half * 2, 1);
  }
}

/** The car at its place on screen. */
export function drawVehicle(ctx: CanvasRenderingContext2D, art: ArtBook, car: VehicleView, parked: Pick<PropInstance, 'x' | 'y'> | undefined, left: number, top: number): void {
  const at = vehicleAnchor(car);
  drawSprite(ctx, vehicleSprite(art, car, parked), at.x - left, at.y - top);
}

/** Where the car's light bar and road glow are this frame, one per car that has one. */
export function vehicleBeacons(art: ArtBook, cars: readonly VehicleView[], props: readonly { readonly prop: PropInstance }[]): Beacon[] {
  const beacons: Beacon[] = [];
  for (const car of cars) {
    const clip = art.vehicleBeacons[car.body]?.[car.facing];
    const glow = glowOf(car.body);
    if (!clip || !glow) continue;
    const at = vehicleAnchor(car);
    const parked = props[car.id]?.prop;
    beacons.push({ x: at.x, y: at.y, clip, glow, phase: parked ? coatIndex(parked, 1000) / 1000 : 0, index: car.id });
  }
  return beacons;
}

function glowOf(body: VehicleBody): readonly string[] | undefined {
  return GLOW_BY_BODY[body];
}

/** Screen shake for a crash of this strength (0..1 of top speed): a bump at a scrape, a hard jolt at full tilt. */
export function crashShake(strength: number): number {
  return Math.min(1, 0.15 + Math.max(0, strength) * 0.7);
}
