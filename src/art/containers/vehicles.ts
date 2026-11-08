// Cars after someone has been through them: the glass punched out, flecks of it on the ground, and
// a door left hanging. Glass is found by colour, so one pass fits every body and facing.

import type { PropKind } from '../../../shared/protocol.ts';
import { seeded } from '../kit.ts';
import type { PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Color, Ramp } from '../palette.ts';
import type { PixelSprite } from '../types.ts';
import { bakeStage, glints, over, stage, tipped } from './stage.ts';
import type { ContainerArt } from './stage.ts';
import { BLACK, CAR_PAINTS, LOT_PAINTS } from '../environment/car-paints.ts';
import { AMBULANCE } from '../environment/emergency.ts';
import { VAN_LIVERIES, WORK_VAN } from '../environment/van.ts';
import { RUST, STEEL } from '../environment/vehicles.ts';

const { ink, metal, denim, bone, wood, ash } = RAMPS;

const GLASS: readonly Color[] = [denim[0], denim[1]];

function isGlass(c: PixelCanvas, x: number, y: number): boolean {
  const color = c.get(x, y);
  return color !== null && GLASS.includes(color);
}

/** Every pane goes dark, with a few jagged teeth of glass left in the frame. */
function shatter(c: PixelCanvas, seed: number): void {
  const rng = seeded(seed);
  const before = c.clone();
  const teeth = [denim[2], metal[3], denim[2], bone[3]];
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      if (!isGlass(before, x, y)) continue;
      const rim = [[0, -1], [-1, 0], [1, 0], [0, 1]].some(([dx, dy]) => !isGlass(before, x + dx, y + dy));
      c.px(x, y, rim && rng() < 0.2 ? teeth[Math.floor(rng() * teeth.length)] : ink[0]);
    }
  }
}

/** A side door opened out towards the camera, foreshortened, over the dark of the cabin. */
function sideDoor(c: PixelCanvas, x: number, y: number, w: number, h: number, paint: Ramp): void {
  c.rect(x, y, w, h, ink[0]).rect(x + 3, y + 1, 4, h - 2, wood[1]);
  over(c, (layer) => {
    layer.poly([[x, y - 4], [x + 6, y - 1], [x + 6, y + h + 3], [x, y + h]], paint[2]);
    layer.line(x, y - 4, x + 6, y - 1, paint[1]);
    layer.poly([[x + 1, y - 2], [x + 5, y], [x + 5, y + 3], [x + 1, y + 1]], ink[0]);
    layer.px(x + 2, y, denim[2]).px(x + 4, y + 2, metal[3]);
    layer.rect(x + 4, y + 5, 1, 2, paint[0]);
  });
}

/** A boot lid raised on its hinge over the dark well it covered, on a car parked across the view. */
function poppedBoot(c: PixelCanvas, x: number, y: number, h: number, paint: Ramp): void {
  const reach = 6;
  const rise = 9;
  c.rect(x, y, 6, h, ink[0]).rect(x + 1, y + h - 3, 2, 2, wood[1]);
  over(c, (layer) => {
    layer.poly([[x, y], [x, y + h], [x + reach, y + h - rise], [x + reach, y - rise]], paint[1]);
    layer.line(x + reach, y - rise, x + reach, y + h - rise, paint[2]).line(x, y, x + reach, y - rise, paint[2]);
  });
}

/** Spare rows over a car for the raised boot lid. */
const LID_ROOM = 8;

/** Where a side-on car's boot and front door are, from the left of its footprint. */
interface SideOnCut {
  readonly kind: PropKind;
  readonly boot: number;
  readonly door: number;
  readonly seed: number;
}

/** Any side-on car: glass out, boot up, the front door hanging. */
function sideOnOpened(sprite: PixelSprite, paint: Ramp, { kind, boot, door, seed }: SideOnCut): PixelSprite {
  const s = stage(kind, sprite, 3, 7, LID_ROOM);
  const { c, left, ground } = s;
  shatter(c, seed);
  poppedBoot(c, left + boot, LID_ROOM + 5, 9, paint);
  sideDoor(c, left + door, LID_ROOM + 15, 8, 7, paint);
  glints(c, [[left + 3, ground + 2], [left + 9, ground + 4], [left + door + 10, ground + 1], [left + door + 14, ground + 3], [left + boot - 3, ground + 1], [left + boot + 1, ground + 3], [left + door + 7, ground + 4]]);
  return bakeStage(s);
}

/** The glass burned out long ago, so what was left of it glints in the frames. */
function wreckOpened(wreck: PixelSprite): PixelSprite {
  const s = stage('car_wreck_h', wreck, 3, 7, LID_ROOM);
  const { c, left, ground } = s;
  poppedBoot(c, left + 38, LID_ROOM + 8, 8, RUST);
  sideDoor(c, left + 17, LID_ROOM + 16, 8, 6, RUST);
  const y = LID_ROOM;
  glints(c, [[left + 11, y + 8], [left + 13, y + 10], [left + 33, y + 8], [left + 35, y + 11], [left + 4, ground + 2], [left + 28, ground + 2], [left + 33, ground + 4], [left + 38, ground + 1]]);
  return bakeStage(s);
}

/** Nose up: the driver's door thrown wide from the front pillar. */
function noseUpOpened(kind: PropKind, sedan: PixelSprite, paint: Ramp): PixelSprite {
  const s = stage(kind, sedan, 7, 5);
  const { c, left, right, ground } = s;
  shatter(c, 23);
  over(c, (layer) => {
    const y = 20;
    layer.poly([[left, y], [left - 5, y + 3], [left - 5, y + 9], [left, y + 8]], paint[2]);
    layer.line(left, y, left - 5, y + 3, paint[1]);
    layer.rect(left - 4, y + 3, 3, 2, ink[0]);
  });
  glints(c, [[right + 2, 22], [right + 3, 27], [right + 2, 33], [left - 3, 33], [left - 2, 37], [left + 4, ground + 2], [left + 14, ground + 3]]);
  return bakeStage(s);
}

/** The sliding door run back along its rail, the load bay turned out on the road. */
function vanOpened(kind: PropKind, van: PixelSprite, side: Ramp): PixelSprite {
  const s = stage(kind, van, 3, 7);
  const { c, left, ground } = s;
  const top = 15;
  shatter(c, 37);
  c.rect(left + 22, top + 1, 14, 15, ink[0]);
  c.rect(left + 24, top + 8, 4, 7, wood[1]).rect(left + 24, top + 8, 4, 1, wood[2]);
  c.rect(left + 30, top + 11, 4, 4, ash[0]);
  over(c, (layer) => {
    layer.rect(left + 37, top + 1, 12, 15, side[1]).rect(left + 37, top + 1, 12, 1, side[2]).rect(left + 37, top + 1, 1, 15, side[2]);
    tipped(layer, left + 25, ground + 1, wood[2]);
    tipped(layer, left + 33, ground + 3, bone[1]);
  });
  glints(c, [[left + 3, ground + 2], [left + 8, ground + 4], [left + 13, ground + 1], [left + 17, ground + 3], [left + 44, ground + 2]]);
  return bakeStage(s);
}

const SEDAN_CUT: SideOnCut = { kind: 'car_sedan_h', boot: 38, door: 17, seed: 11 };
const HATCH_CUT: SideOnCut = { kind: 'car_hatch_h', boot: 30, door: 17, seed: 13 };
const PICKUP_CUT: SideOnCut = { kind: 'pickup_h', boot: 40, door: 17, seed: 17 };
const POLICE_CUT: SideOnCut = { kind: 'police_h', boot: 38, door: 17, seed: 19 };

export type CarLook = 'car' | 'car_v' | 'wreck' | 'van' | 'hatch' | 'hatch_v' | 'pickup' | 'police' | 'police_v' | 'ambulance';

const art = (closed: PixelSprite, opened: PixelSprite): ContainerArt => ({ closed, opened });

export function buildCarArt(props: Record<PropKind, PixelSprite>): Record<CarLook, ContainerArt> {
  return {
    car: art(props.car_sedan_h, sideOnOpened(props.car_sedan_h, STEEL, SEDAN_CUT)),
    car_v: art(props.car_sedan_v, noseUpOpened('car_sedan_v', props.car_sedan_v, RUST)),
    wreck: art(props.car_wreck_h, wreckOpened(props.car_wreck_h)),
    van: art(props.van_h, vanOpened('van_h', props.van_h, WORK_VAN.side)),
    hatch: art(props.car_hatch_h, sideOnOpened(props.car_hatch_h, STEEL, HATCH_CUT)),
    hatch_v: art(props.car_hatch_v, noseUpOpened('car_hatch_v', props.car_hatch_v, STEEL)),
    pickup: art(props.pickup_h, sideOnOpened(props.pickup_h, STEEL, PICKUP_CUT)),
    police: art(props.police_h, sideOnOpened(props.police_h, BLACK, POLICE_CUT)),
    police_v: art(props.police_v, noseUpOpened('police_v', props.police_v, BLACK)),
    ambulance: art(props.ambulance_h, vanOpened('ambulance_h', props.ambulance_h, AMBULANCE.side)),
  };
}

/** Shut and searched art for every coat in paintJobs, the paints in the same order. */
export function buildPaintedCars(paintJobs: Partial<Record<PropKind, readonly PixelSprite[]>>): Partial<Record<PropKind, readonly ContainerArt[]>> {
  const coats = (kind: PropKind, open: (sprite: PixelSprite, paint: Ramp, i: number) => PixelSprite, paints: readonly Ramp[]): readonly ContainerArt[] =>
    (paintJobs[kind] ?? []).map((sprite, i) => art(sprite, open(sprite, paints[i], i)));
  const vans = VAN_LIVERIES.map((livery) => livery.side);
  return {
    car_sedan_h: coats('car_sedan_h', (sprite, paint) => sideOnOpened(sprite, paint, SEDAN_CUT), CAR_PAINTS),
    car_sedan_v: coats('car_sedan_v', (sprite, paint) => noseUpOpened('car_sedan_v', sprite, paint), LOT_PAINTS),
    car_hatch_h: coats('car_hatch_h', (sprite, paint) => sideOnOpened(sprite, paint, HATCH_CUT), CAR_PAINTS),
    car_hatch_v: coats('car_hatch_v', (sprite, paint) => noseUpOpened('car_hatch_v', sprite, paint), CAR_PAINTS),
    pickup_h: coats('pickup_h', (sprite, paint) => sideOnOpened(sprite, paint, PICKUP_CUT), CAR_PAINTS),
    van_h: coats('van_h', (sprite, side) => vanOpened('van_h', sprite, side), vans),
  };
}
