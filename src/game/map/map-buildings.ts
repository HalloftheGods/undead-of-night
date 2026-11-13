// Buildings on the map screen as little pixel-art roofs: a coloured roof by what the place is for, a front wall
// with its windows and door along the bottom, and a painted sign on the roof for the places worth running to.
// A new kind of building needs only a line in BUILDING_LOOK; a new kind of place, a line in PLACE_LOOK.

import type { BuildingKind } from '@shared/protocol.ts';
import { drawRows, MAP_INK } from './map-sprite.ts';
import type { MapIcon } from './map-sprite.ts';

/** What a place is for. The key lists one line per group, in this order. */
export const PLACE_GROUPS = ['medical', 'police', 'guns', 'food', 'work', 'school', 'homes'] as const;
export type PlaceGroup = (typeof PLACE_GROUPS)[number];

type RoofShape = 'flat' | 'gable' | 'tin';
type Emblem = 'cross' | 'star' | 'pistol' | 'apple' | 'wrench' | 'bell';
type Extra = 'lights' | 'vents' | 'chimney';

interface BuildingLook {
  readonly group: PlaceGroup;
  readonly roof: RoofShape;
  readonly extra?: Extra;
}

interface PlaceLook {
  readonly label: string;
  /** Dark, mid and light of the roof. */
  readonly roof: readonly [string, string, string];
  /** The sign painted on the roof, if the place has one. */
  readonly emblem: Emblem | null;
  /** Which building stands for the group in the key. */
  readonly sample: BuildingKind;
}

export const PLACE_LOOK: Record<PlaceGroup, PlaceLook> = {
  medical: { label: 'Medical', roof: ['#6e2a2e', '#b04a42', '#dc7a62'], emblem: 'cross', sample: 'pharmacy' },
  police: { label: 'Police', roof: ['#283e66', '#4a78a8', '#82aed6'], emblem: 'star', sample: 'police' },
  guns: { label: 'Guns', roof: ['#6e4a1e', '#b8843a', '#e4b866'], emblem: 'pistol', sample: 'gun_shop' },
  food: { label: 'Food', roof: ['#30522e', '#5c9450', '#94c474'], emblem: 'apple', sample: 'grocery' },
  work: { label: 'Garages and yards', roof: ['#4a3e30', '#86745a', '#b4a27c'], emblem: 'wrench', sample: 'garage' },
  school: { label: 'School', roof: ['#4e3466', '#8a62a8', '#b690d4'], emblem: 'bell', sample: 'school' },
  homes: { label: 'Homes', roof: ['#38323e', '#5e5462', '#857888'], emblem: null, sample: 'house' },
};

export const BUILDING_LOOK: Record<BuildingKind, BuildingLook> = {
  pharmacy: { group: 'medical', roof: 'flat' },
  clinic: { group: 'medical', roof: 'flat', extra: 'vents' },
  hospital: { group: 'medical', roof: 'flat', extra: 'vents' },
  school: { group: 'school', roof: 'flat', extra: 'vents' },
  police: { group: 'police', roof: 'flat', extra: 'lights' },
  gun_shop: { group: 'guns', roof: 'flat' },
  grocery: { group: 'food', roof: 'flat', extra: 'vents' },
  discount: { group: 'food', roof: 'flat' },
  diner: { group: 'food', roof: 'flat', extra: 'chimney' },
  garage: { group: 'work', roof: 'tin' },
  warehouse: { group: 'work', roof: 'tin', extra: 'vents' },
  radio_station: { group: 'work', roof: 'flat', extra: 'vents' },
  house: { group: 'homes', roof: 'gable', extra: 'chimney' },
  apartment: { group: 'homes', roof: 'flat', extra: 'vents' },
  upstairs: { group: 'homes', roof: 'gable' },
  cellar: { group: 'homes', roof: 'gable' },
  apartment_upstairs: { group: 'homes', roof: 'flat' },
  hospital_upstairs: { group: 'medical', roof: 'flat', extra: 'vents' },
  school_upstairs: { group: 'school', roof: 'flat', extra: 'vents' },
  sewer_maze: { group: 'work', roof: 'flat' },
};

const SHADOW = '#050609';
const WALL = '#2c2a34';
const GLASS = '#5c6c86';
const GLASS_LIT = '#e8c66a';
const DOORWAY = '#120e14';
const PLATE = '#ece2c6';
const BRICK = '#6a3430';
const METAL = '#7c8494';
const LIGHT_RED = '#ff4a4a';
const LIGHT_BLUE = '#4aa8ff';
/** Rows of front wall under the roof: the eave, then the wall with its windows and door. */
const FRONT = 3;
const PLATE_SIZE = 7;

/** 5 by 5 signs, painted dark on a pale plate. */
const EMBLEMS: Record<Emblem, readonly string[]> = {
  cross: ['..#..', '..#..', '#####', '..#..', '..#..'],
  star: ['..#..', '.###.', '#####', '.###.', '.#.#.'],
  pistol: ['#####', '#####', '.##..', '.#...', '.#...'],
  apple: ['...#.', '.##..', '#####', '#####', '.###.'],
  wrench: ['#...#', '##.##', '.###.', '..#..', '..#..'],
  bell: ['..#..', '.###.', '.###.', '#####', '..#..'],
};

export interface MapBox {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** A steady per-building number, so windows and texture differ from house to house but never flicker. */
function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b, 0xc2b2ae35);
  h ^= h >>> 13;
  return Math.imul(h, 0x27d4eb2f) >>> 0;
}

function paintRoof(ctx: CanvasRenderingContext2D, box: MapBox, roofH: number, shape: RoofShape, [dark, mid, light]: readonly string[]): void {
  const w = box.x1 - box.x0;
  ctx.fillStyle = mid;
  ctx.fillRect(box.x0, box.y0, w, roofH);
  const isFlat = shape === 'flat';
  if (isFlat) {
    // A pale parapet round the edge, with its shadow falling on the roof inside.
    ctx.fillStyle = light;
    ctx.fillRect(box.x0, box.y0, w, 1);
    ctx.fillRect(box.x0, box.y0, 1, roofH);
    ctx.fillStyle = dark;
    ctx.fillRect(box.x0 + 1, box.y0 + 1, w - 2, 1);
    ctx.fillRect(box.x0 + 1, box.y0 + 1, 1, roofH - 1);
    ctx.fillRect(box.x1 - 1, box.y0, 1, roofH);
    return;
  }
  const isTin = shape === 'tin';
  if (isTin) {
    // Corrugated sheet: dark ribs every other column, catching the light along the top.
    ctx.fillStyle = dark;
    for (let x = box.x0 + 1; x < box.x1; x += 2) ctx.fillRect(x, box.y0 + 1, 1, roofH - 1);
    ctx.fillStyle = light;
    ctx.fillRect(box.x0, box.y0, w, 1);
    return;
  }
  // A pitched roof: the sunny slope above the ridge, the shaded one below it, with shingle seams.
  const ridge = box.y0 + Math.floor(roofH / 2);
  ctx.fillStyle = light;
  ctx.fillRect(box.x0, box.y0, w, ridge - box.y0);
  ctx.fillStyle = dark;
  ctx.fillRect(box.x0, ridge, w, 1);
  for (let y = box.y0 + 1; y < box.y0 + roofH; y += 2) {
    const isRidge = y === ridge;
    if (isRidge) continue;
    for (let x = box.x0 + ((y >> 1) % 3); x < box.x1; x += 3) ctx.fillRect(x, y, 1, 1);
  }
}

function paintFront(ctx: CanvasRenderingContext2D, box: MapBox, dark: string, doorPx: number, seed: number): void {
  const w = box.x1 - box.x0;
  const top = box.y1 - FRONT;
  ctx.fillStyle = dark;
  ctx.fillRect(box.x0, top, w, 1);
  ctx.fillStyle = WALL;
  ctx.fillRect(box.x0, top + 1, w, FRONT - 1);
  const door = box.x0 + doorPx - 1;
  for (let x = box.x0 + 2; x < box.x1 - 1; x += 3) {
    const byDoor = x >= door - 1 && x <= door + 2;
    if (byDoor) continue;
    ctx.fillStyle = hash(seed, x) % 4 === 0 ? GLASS_LIT : GLASS;
    ctx.fillRect(x, top + 1, 1, 1);
  }
  ctx.fillStyle = DOORWAY;
  ctx.fillRect(door, top + 1, 2, FRONT - 1);
}

function paintEmblem(ctx: CanvasRenderingContext2D, box: MapBox, roofH: number, emblem: Emblem, ink: string): void {
  const left = box.x0 + Math.floor((box.x1 - box.x0 - PLATE_SIZE) / 2);
  const top = box.y0 + Math.max(1, Math.floor((roofH - PLATE_SIZE) / 2));
  ctx.fillStyle = MAP_INK;
  ctx.fillRect(left + 1, top, PLATE_SIZE - 2, PLATE_SIZE);
  ctx.fillRect(left, top + 1, PLATE_SIZE, PLATE_SIZE - 2);
  ctx.fillStyle = PLATE;
  ctx.fillRect(left + 1, top + 1, PLATE_SIZE - 2, PLATE_SIZE - 2);
  drawRows(ctx, left + 1, top + 1, EMBLEMS[emblem], { '#': ink });
}

function paintExtra(ctx: CanvasRenderingContext2D, box: MapBox, extra: Extra, w: number): void {
  const isLightBar = extra === 'lights';
  if (isLightBar) {
    ctx.fillStyle = LIGHT_RED;
    ctx.fillRect(box.x0 + 2, box.y0 + 2, 2, 1);
    ctx.fillStyle = LIGHT_BLUE;
    ctx.fillRect(box.x0 + 4, box.y0 + 2, 2, 1);
    return;
  }
  const isChimney = extra === 'chimney';
  ctx.fillStyle = MAP_INK;
  ctx.fillRect(box.x1 - 5, box.y0 + 1, 3, 3);
  ctx.fillStyle = isChimney ? BRICK : METAL;
  ctx.fillRect(box.x1 - 4, box.y0 + 1, 2, 2);
  const hasRoomForTwo = !isChimney && w >= 22;
  if (!hasRoomForTwo) return;
  ctx.fillStyle = MAP_INK;
  ctx.fillRect(box.x0 + 2, box.y0 + 2, 3, 3);
  ctx.fillStyle = METAL;
  ctx.fillRect(box.x0 + 3, box.y0 + 2, 2, 2);
}

/** Paints one building into its footprint, with its outline and drop shadow just outside it. */
export function paintBuilding(ctx: CanvasRenderingContext2D, box: MapBox, kind: BuildingKind, doorPx: number, seed: number): void {
  const look = BUILDING_LOOK[kind];
  const place = PLACE_LOOK[look.group];
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  const roofH = h - FRONT;
  ctx.fillStyle = SHADOW;
  ctx.fillRect(box.x0, box.y0, w + 2, h + 2);
  ctx.fillStyle = MAP_INK;
  ctx.fillRect(box.x0 - 1, box.y0 - 1, w + 2, h + 2);
  paintRoof(ctx, box, roofH, look.roof, place.roof);
  paintFront(ctx, box, place.roof[0], doorPx, seed);
  if (look.extra) paintExtra(ctx, box, look.extra, w);
  if (place.emblem) paintEmblem(ctx, box, roofH, place.emblem, place.roof[0]);
}

const ICON_W = 16;
const ICON_H = 13;

/** A small building of the group's sample kind, for the key. */
export function placeIcon(group: PlaceGroup): MapIcon {
  const box = { x0: 1, y0: 1, x1: 1 + ICON_W, y1: 1 + ICON_H };
  return { w: ICON_W + 3, h: ICON_H + 3, paint: (ctx) => paintBuilding(ctx, box, PLACE_LOOK[group].sample, 5, 7) };
}
