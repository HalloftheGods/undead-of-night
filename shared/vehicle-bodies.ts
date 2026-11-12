// What a driveable car is made of: its body, the four ways it can face, and the footprint each
// facing rests on. The sim, the client's prediction and the art all read these, so a car is the
// same size everywhere.

import type { PropKind } from './map-protocol.ts';

export const VEHICLE_BODY_IDS = ['sedan', 'hatch', 'pickup', 'police', 'ambulance', 'van'] as const;
export type VehicleBody = (typeof VEHICLE_BODY_IDS)[number];

/** The way the nose points. The art has one sprite per facing; the heading itself is continuous. */
export const VEHICLE_FACINGS = ['n', 'e', 's', 'w'] as const;
export type VehicleFacing = (typeof VEHICLE_FACINGS)[number];

/** Radians on screen axes, y down: east is 0, south is a quarter turn clockwise. */
export const FACING_HEADING: Record<VehicleFacing, number> = {
  e: 0,
  s: Math.PI / 2,
  w: Math.PI,
  n: -Math.PI / 2,
};

export interface VehicleBodyDef {
  /** Nose to tail, in world pixels. */
  readonly length: number;
  /** The footprint's depth on the ground when side-on (facing east or west). */
  readonly sideDepth: number;
  /** The footprint's width when nose-up or nose-down (facing north or south). */
  readonly noseWidth: number;
  /** Radius of each end of the capsule a moving car collides as. */
  readonly radius: number;
  /** Driver included. */
  readonly seats: number;
  /** The map props this body is parked as, by facing. A body with no nose-up prop is only ever parked side-on by the map. */
  readonly props: Partial<Record<VehicleFacing, PropKind>>;
}

/** Footprints match PROP_DEFS for the props that exist, so lifting a parked car changes nothing until it moves. */
export const VEHICLE_BODIES: Record<VehicleBody, VehicleBodyDef> = {
  sedan: { length: 44, sideDepth: 18, noseWidth: 20, radius: 9, seats: 4, props: { w: 'car_sedan_h', n: 'car_sedan_v' } },
  hatch: { length: 36, sideDepth: 18, noseWidth: 20, radius: 9, seats: 4, props: { w: 'car_hatch_h', n: 'car_hatch_v' } },
  pickup: { length: 46, sideDepth: 18, noseWidth: 20, radius: 9, seats: 2, props: { w: 'pickup_h' } },
  police: { length: 44, sideDepth: 18, noseWidth: 20, radius: 9, seats: 4, props: { w: 'police_h', n: 'police_v' } },
  ambulance: { length: 52, sideDepth: 22, noseWidth: 24, radius: 11, seats: 4, props: { w: 'ambulance_h' } },
  van: { length: 52, sideDepth: 22, noseWidth: 24, radius: 11, seats: 4, props: { w: 'van_h' } },
};

export interface ParkedVehicle {
  readonly body: VehicleBody;
  readonly facing: VehicleFacing;
}

const PARKED: ReadonlyMap<PropKind, ParkedVehicle> = new Map(
  VEHICLE_BODY_IDS.flatMap((body) =>
    VEHICLE_FACINGS.flatMap((facing) => {
      const kind = VEHICLE_BODIES[body].props[facing];
      return kind ? [[kind, { body, facing }] as const] : [];
    }),
  ),
);

/** The body and facing a map prop is parked as, or null for anything that cannot be driven (wrecks included). */
export function parkedVehicle(kind: PropKind): ParkedVehicle | null {
  return PARKED.get(kind) ?? null;
}

export const isSideOn = (facing: VehicleFacing): boolean => facing === 'e' || facing === 'w';

/** Width and height of the ground a resting car covers. */
export function restSize(body: VehicleBody, facing: VehicleFacing): { readonly w: number; readonly h: number } {
  const def = VEHICLE_BODIES[body];
  return isSideOn(facing) ? { w: def.length, h: def.sideDepth } : { w: def.noseWidth, h: def.length };
}

/**
 * A vehicle's x,y is the centre of its footprint. A map prop's x,y is the centre of the footprint's
 * bottom edge, so the two differ by half the footprint's height.
 */
export function centreOfProp(parked: ParkedVehicle, propX: number, propY: number): { readonly x: number; readonly y: number } {
  return { x: propX, y: propY - restSize(parked.body, parked.facing).h / 2 };
}

/** Where a prop of this body and facing would be anchored for a car centred here: what y-sorting and sprite anchors use. */
export function anchorOfCentre(body: VehicleBody, facing: VehicleFacing, x: number, y: number): { readonly x: number; readonly y: number } {
  return { x, y: y + restSize(body, facing).h / 2 };
}

/** The solid box a resting car occupies, in the same shape world-query's Box uses. */
export function restBox(body: VehicleBody, facing: VehicleFacing, x: number, y: number): { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number } {
  const { w, h } = restSize(body, facing);
  return { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 };
}
