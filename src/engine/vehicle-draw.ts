// Driven cars on screen: the sprite for the way the nose points, in the coat its parking spot gave it,
// a shadow under it, and the light bars on police cars and ambulances that ride along. Square to the
// screen a car is its hand-drawn facing; between facings it is a turn model, so a turn reads as one motion.

import type { PropInstance, VehicleView } from '../../shared/protocol.ts';
import { anchorOfCentre, restSize, VEHICLE_BODIES } from '../../shared/vehicle-bodies.ts';
import type { VehicleBody, VehicleFacing } from '../../shared/vehicle-bodies.ts';
import { turnGround } from '../art/environment/vehicle-turn-model.ts';
import type { ArtBook, PixelSprite } from '../art/types.ts';
import { coatIndex, GLOW_BY_BODY } from './car-looks.ts';
import type { Beacon } from './car-looks.ts';
import { drawSprite } from './sprite-cache.ts';
import { squareFacing, turnBeacon, turnHeading, turnSprite, turnStepOf, warmTurn } from './vehicle-turns.ts';

const SHADOW_RGBA = 'rgba(4, 5, 10, 0.5)';

/** What is needed to pick a car's picture. With no heading it is drawn by its facing alone. */
type Posed = Pick<VehicleView, 'body' | 'facing'> & { readonly heading?: number };
type Placed = Posed & Pick<VehicleView, 'x' | 'y'>;

/** The step of the ring the car is drawn at when it is between two facings, or null where a hand-drawn facing serves. */
function turnOf(car: Posed): number | null {
  if (car.heading === undefined) return null;
  const step = turnStepOf(car.heading);
  return squareFacing(step) === null ? step : null;
}

/** The facing drawn for a car that is square to the screen: the one its nose points along, whatever facing the physics still holds. */
function facingDrawn(car: Posed): VehicleFacing {
  if (car.heading === undefined) return car.facing;
  return squareFacing(turnStepOf(car.heading)) ?? car.facing;
}

function coatOf(art: ArtBook, body: VehicleBody, parked: Pick<PropInstance, 'x' | 'y'> | undefined): number {
  return parked ? coatIndex(parked, art.vehicles[body].w.length) : 0;
}

/** The car's sprite for the way its nose points, in the coat its spot gave it. */
export function vehicleSprite(art: ArtBook, car: Posed, parked: Pick<PropInstance, 'x' | 'y'> | undefined): PixelSprite {
  const coat = coatOf(art, car.body, parked);
  const turn = turnOf(car);
  return turn === null ? art.vehicles[car.body][facingDrawn(car)][coat] : turnSprite(art, car.body, coat, turn);
}

/** Where the car stands on screen, in whole pixels: its footprint's bottom edge, which is also what it is sorted by. */
export function vehicleAnchor(car: Pick<VehicleView, 'body' | 'facing' | 'x' | 'y'>): { readonly x: number; readonly y: number } {
  const at = anchorOfCentre(car.body, car.facing, car.x, car.y);
  return { x: Math.round(at.x), y: Math.round(at.y) };
}

/** Where the car's picture is pinned: a hand-drawn facing at its footprint's bottom edge like a prop, a turn model at the car's centre. */
function pictureSpot(car: Placed): { readonly x: number; readonly y: number } {
  if (turnOf(car) !== null) return { x: Math.round(car.x), y: Math.round(car.y) };
  return vehicleAnchor({ ...car, facing: facingDrawn(car) });
}

/** A flat pixel ellipse, rows stepped by hand so the edge stays hard. */
function shadowEllipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const rows = Math.round(h) + 2;
  ctx.fillStyle = SHADOW_RGBA;
  for (let row = 0; row < rows; row += 1) {
    const ny = ((row + 0.5) / rows) * 2 - 1;
    const half = Math.round(((w + 2) / 2) * Math.sqrt(1 - ny * ny));
    ctx.fillRect(cx - half, cy - Math.round(rows / 2) + row, half * 2, 1);
  }
}

/** The shadow over the ground the car covers: its resting footprint when square to the screen, the turned one between facings. */
export function drawVehicleShadow(ctx: CanvasRenderingContext2D, car: Placed, left: number, top: number): void {
  const cx = Math.round(car.x) - left;
  const cy = Math.round(car.y) - top;
  const turn = turnOf(car);
  if (turn === null) {
    const { w, h } = restSize(car.body, facingDrawn(car));
    shadowEllipse(ctx, cx, cy, w, h);
    return;
  }
  const ground = turnGround(VEHICLE_BODIES[car.body], turnHeading(turn));
  shadowEllipse(ctx, cx, cy + ground.drop, ground.w, ground.h);
}

/** The car at its place on screen. A rolling car also has one more of its turn models drawn ahead of need. */
export function drawVehicle(ctx: CanvasRenderingContext2D, art: ArtBook, car: VehicleView, parked: Pick<PropInstance, 'x' | 'y'> | undefined, left: number, top: number): void {
  const at = pictureSpot(car);
  drawSprite(ctx, vehicleSprite(art, car, parked), at.x - left, at.y - top);
  if (car.speed !== 0) warmTurn(art, car.body, coatOf(art, car.body, parked), turnStepOf(car.heading));
}

/** Where the car's light bar and road glow are this frame, one per car that has one. */
export function vehicleBeacons(art: ArtBook, cars: readonly VehicleView[], props: readonly { readonly prop: PropInstance }[]): Beacon[] {
  const beacons: Beacon[] = [];
  for (const car of cars) {
    const turn = turnOf(car);
    const clip = turn === null ? art.vehicleBeacons[car.body]?.[facingDrawn(car)] : turnBeacon(art, car.body, turn);
    const glow = glowOf(car.body);
    if (!clip || !glow) continue;
    const at = pictureSpot(car);
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
