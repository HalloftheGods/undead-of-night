// Every enterable building starts here: a canvas sized from BUILDING_DEFS, the 3/4 split
// between roof and south front wall, and the door at doorX.
//
// The ground row is the footprint's south edge and the sprite tops out RISE pixels above
// its north edge. A taller front wall simply eats into the roof, so a three-storey block
// and a one-storey diner share the same rise and the shell always covers the footprint.

import { BUILDING_DEFS, DOOR_WIDTH } from '../../../shared/protocol.ts';
import type { BuildingKind } from '../../../shared/protocol.ts';
import type { PixelSprite } from '../types.ts';
import { PixelCanvas } from '../kit.ts';
import { RAMPS } from '../palette.ts';
import type { Color } from '../palette.ts';
import { bake, groundShadow } from './common.ts';
import type { Trim } from './facade.ts';

const { ink, metal, concrete, denim, wood, fire } = RAMPS;

/** How far art may climb above the footprint's north edge. */
export const RISE = 28;
const SIDE_MARGIN = 2;
const SHADOW_ROWS = 4;

export interface Shell {
  readonly c: PixelCanvas;
  /** First and last footprint columns on the canvas. */
  readonly left: number;
  readonly right: number;
  readonly footW: number;
  /** Footprint south edge: the row just under the wall. */
  readonly ground: number;
  /** First row of the front wall. */
  readonly wallTop: number;
  /** First and one-past-last columns of the door opening. */
  readonly doorL: number;
  readonly doorR: number;
}

export function startShell(kind: BuildingKind, wallHeight: number): Shell {
  const def = BUILDING_DEFS[kind];
  const ground = RISE + def.h;
  const c = new PixelCanvas(def.w + SIDE_MARGIN * 2, ground + SHADOW_ROWS);
  const left = SIDE_MARGIN;
  const doorL = left + def.doorX - DOOR_WIDTH / 2;
  groundShadow(c, left, ground, def.w + 2, 3);
  return {
    c,
    left,
    right: left + def.w - 1,
    footW: def.w,
    ground,
    wallTop: ground - wallHeight,
    doorL,
    doorR: doorL + DOOR_WIDTH,
  };
}

export function bakeShell(s: Shell): PixelSprite {
  s.c.outline({ selective: true });
  const sprite = bake(s.c, s.left, s.footW, s.ground);
  const spec = drawnDoors.get(s.c);
  if (spec) shellDoors.set(sprite, spec);
  return sprite;
}

/** glass and timber swing inward; steel is a plain fire door; shutter rolls up out of sight. */
export type DoorKind = 'glass' | 'timber' | 'steel' | 'shutter';

/** The door a shell was drawn with: what swings shut in it, and how tall the opening is. */
export interface DoorSpec {
  readonly kind: DoorKind;
  readonly height: number;
}

const PLAIN_DOOR: DoorSpec = { kind: 'steel', height: 22 };
const drawnDoors = new WeakMap<PixelCanvas, DoorSpec>();
const shellDoors = new WeakMap<PixelSprite, DoorSpec>();

/** The door of a baked shell, so a shut one can be drawn into the very opening the art left. */
export function doorSpecOf(shell: PixelSprite): DoorSpec {
  return shellDoors.get(shell) ?? PLAIN_DOOR;
}

const LEAF_W = 5;

function leaf(s: Shell, x: number, top: number, kind: DoorKind): void {
  const { c, ground } = s;
  const height = ground - top - 2;
  const tone = kind === 'timber' ? wood : metal;
  c.rect(x, top + 1, LEAF_W, height, tone[1]);
  c.rect(x, top + 1, LEAF_W, 1, tone[2]).rect(x, top + height, LEAF_W, 1, tone[0]);
  const inner = LEAF_W - 2;
  const paint: Record<DoorKind, () => void> = {
    steel: () => c.rect(x + 1, top + 4, inner, 5, tone[0]),
    timber: () => c.rect(x + 1, top + 4, inner, 6, denim[0]).rect(x + 1, top + 12, inner, height - 14, tone[0]),
    glass: () => c.rect(x + 1, top + 3, inner, height - 5, denim[0]).px(x + 1, top + 4, denim[2]),
    shutter: () => c,
  };
  paint[kind]();
}

/**
 * The door gap as a real opening: DOOR_WIDTH of dark with the floor showing through, leaves
 * folded back to the jambs, surround and lit sill. The surround sits outside the 32px.
 */
export function doorway(s: Shell, height: number, kind: DoorKind, trim: Trim, floor: Color): void {
  const { c, ground, doorL, doorR } = s;
  const [dark, face, light] = trim;
  const top = ground - height;
  drawnDoors.set(c, { kind, height });
  c.rect(doorL - 2, top - 2, DOOR_WIDTH + 4, height + 2, face);
  c.rect(doorL - 2, top - 2, DOOR_WIDTH + 4, 1, light).rect(doorL - 2, top - 2, 1, height + 2, light);
  c.rect(doorR + 1, top - 1, 1, height + 1, dark);
  c.rect(doorL, top, DOOR_WIDTH, height, ink[0]);
  // The room's floor, tapering into the dark, so the eye reads depth rather than a black panel.
  for (let row = 0; row < 5; row++) {
    const inset = 12 - row * 3;
    c.rect(doorL + inset, ground - 5 + row, DOOR_WIDTH - inset * 2, 1, row < 2 ? ink[1] : floor);
  }
  const rolledUp = kind === 'shutter';
  if (rolledUp) {
    c.rect(doorL, top, DOOR_WIDTH, 5, metal[1]);
    for (let y = top + 1; y < top + 5; y += 2) c.rect(doorL, y, DOOR_WIDTH, 1, metal[0]);
    c.rect(doorL, top + 5, DOOR_WIDTH, 1, metal[2]);
  } else {
    leaf(s, doorL, top, kind);
    leaf(s, doorR - LEAF_W, top, kind);
  }
  c.rect(doorL - 2, ground - 1, DOOR_WIDTH + 4, 1, concrete[3]);
}

/** A caged bulkhead lamp that still works: a small warm mark over a way in. */
export function caseLamp(c: PixelCanvas, x: number, y: number): void {
  c.rect(x, y, 8, 1, metal[2]).rect(x + 1, y + 1, 6, 2, fire[2]).rect(x + 2, y + 1, 4, 1, fire[3]);
  c.rect(x, y + 1, 1, 2, metal[0]).rect(x + 7, y + 1, 1, 2, metal[0]);
}
