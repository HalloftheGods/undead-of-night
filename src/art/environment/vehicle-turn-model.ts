// A car between its four hand-drawn facings. The side-on sprite shows the roof and one flank, the
// nose-up and nose-down sprites show the roof and one end, so together they say what the whole car
// looks like. This folds them back into a small solid (a roofline along the length, skinned with the
// drawings) and draws that solid at any heading, so a turn runs from the side view to the top-down
// view through real in-between pictures instead of swapping one for the other.

import type { VehicleBodyDef } from '../../../shared/vehicle-bodies.ts';
import { PixelCanvas, spriteToCanvas } from '../kit.ts';
import type { Color } from '../palette.ts';
import type { PixelSprite } from '../types.ts';

/**
 * The hand art looks down from the south, and from higher up the more the nose points up or down the
 * screen. Side-on, the roof's width takes under half its pixels and the flank stands at full height;
 * nose-up, the length is nearly whole and the tail is squat. A turn slides between the two.
 */
const SIDE_DEPTH = 0.45;
const NOSE_DEPTH = 0.9;
const SIDE_HEIGHT = 1;
const NOSE_HEIGHT = 0.58;

/** Room for the longest body at any heading, with a clear margin for the outline. */
const SIZE = 80;
const CENTRE_X = 40;
const CENTRE_Y = 48;
/** Samples per pixel along each axis of a face: enough that no pixel of a turned face is missed. */
const SAMPLES = 3;
/** A roofline lower than this is a bumper's rounded corner, not a body. */
const LOWEST_ROOF = 6;

type Dims = Pick<VehicleBodyDef, 'length' | 'noseWidth' | 'sideDepth'>;

export interface TurnSource {
  /** Side-on with the nose to the left. */
  readonly west: PixelSprite;
  readonly north: PixelSprite;
  readonly south: PixelSprite;
}

export interface TurnModel {
  readonly dims: Dims;
  /** Height of the body at each pixel of its length, nose first. */
  readonly roofline: readonly number[];
  /** The flank at `along` pixels from the nose and `up` pixels off the ground. */
  readonly flank: (along: number, up: number) => Color | null;
  /** The top at `along` from the nose and `across` from the car's left, from the nose-up or the nose-down drawing. */
  readonly top: (noseUp: boolean, along: number, across: number) => Color | null;
  /** The end that faces the camera: the tail of a car heading up the screen, the grille of one heading down. */
  readonly end: (noseUp: boolean, across: number, up: number) => Color | null;
  readonly tailHeight: number;
  readonly noseHeight: number;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function firstOpaqueRow(canvas: PixelCanvas, column?: number): number {
  for (let y = 0; y < canvas.h; y += 1) {
    const from = column ?? 0;
    const to = column ?? canvas.w - 1;
    for (let x = from; x <= to; x += 1) {
      if (canvas.get(x, y) !== null) return y;
    }
  }
  return canvas.h;
}

/** Side-on, a column's first pixel is the far edge of the roof: take off the roof's own depth and the rest is height. */
function rooflineOf(west: PixelCanvas, left: number, ground: number, dims: Dims): number[] {
  const roofDepth = Math.round(dims.noseWidth * SIDE_DEPTH);
  return Array.from({ length: dims.length }, (_, along) => {
    const top = Math.min(ground, firstOpaqueRow(west, left + along));
    return Math.max(LOWEST_ROOF, ground - top - roofDepth);
  });
}

interface Plan {
  readonly canvas: PixelCanvas;
  readonly left: number;
  readonly firstRow: number;
  readonly ground: number;
  /** Rows of the drawing that are the top of the car, and below them the rows that are its near end. */
  readonly topRows: number;
  readonly endRows: number;
}

function planOf(sprite: PixelSprite, dims: Dims, endHeight: number): Plan {
  const canvas = spriteToCanvas(sprite);
  const ground = Math.round(sprite.ay);
  const firstRow = firstOpaqueRow(canvas) + 1;
  const endRows = Math.max(2, Math.round(endHeight * NOSE_HEIGHT));
  return { canvas, left: Math.round(sprite.ax - dims.noseWidth / 2), firstRow, ground, endRows, topRows: ground - firstRow - endRows };
}

/** Folds a body's three drawings into the solid they are views of. */
export function buildTurnModel(source: TurnSource, dims: Dims): TurnModel {
  const west = spriteToCanvas(source.west);
  const westLeft = Math.round(source.west.ax - dims.length / 2);
  const westGround = Math.round(source.west.ay);
  const roofline = rooflineOf(west, westLeft, westGround, dims);
  const tailHeight = roofline[dims.length - 3];
  const noseHeight = roofline[2];
  const north = planOf(source.north, dims, tailHeight);
  const south = planOf(source.south, dims, noseHeight);
  // One pixel in from each edge, so the drawings' own outlines are not stretched over a face.
  const column = (across: number): number => clamp(Math.floor(across), 1, dims.noseWidth - 2);
  const row = (plan: Plan, along: number): number => Math.floor((along * plan.topRows) / dims.length);

  const flank = (along: number, up: number): Color | null =>
    west.get(westLeft + clamp(Math.floor(along), 1, dims.length - 2), westGround - 1 - Math.floor(up));

  // Nose-up, the car's left is the screen's left and the nose is the first row. Nose-down, both are turned about.
  const top = (noseUp: boolean, along: number, across: number): Color | null => {
    if (noseUp) return north.canvas.get(north.left + column(across), north.firstRow + row(north, along));
    return south.canvas.get(south.left + dims.noseWidth - 1 - column(across), south.firstRow + south.topRows - 1 - row(south, along));
  };

  const end = (noseUp: boolean, across: number, up: number): Color | null => {
    if (noseUp) return north.canvas.get(north.left + column(across), north.ground - 1 - Math.floor((up * north.endRows) / tailHeight));
    return south.canvas.get(south.left + dims.noseWidth - 1 - column(across), south.ground - 1 - Math.floor((up * south.endRows) / noseHeight));
  };

  return { dims, roofline, flank, top, end, tailHeight, noseHeight };
}

export interface TurnGround {
  /** Width and height on screen of the ground the turned car covers. */
  readonly w: number;
  readonly h: number;
  /** How far below the car's centre the picture's own centre sits, so a turn meets the hand-drawn sprites at both ends. */
  readonly drop: number;
}

/** 0 side-on, 1 with the nose straight up or down the screen. */
const noseness = (heading: number): number => Math.abs(Math.sin(heading));

/** The ground under a car at this heading as the turn model draws it, for its shadow. */
export function turnGround(dims: Dims, heading: number): TurnGround {
  const sin = noseness(heading);
  const cos = Math.abs(Math.cos(heading));
  const depth = lerp(SIDE_DEPTH, NOSE_DEPTH, sin);
  const sideOnDrop = dims.sideDepth / 2 - (dims.noseWidth * SIDE_DEPTH) / 2;
  const noseUpDrop = (dims.length / 2) * (1 - NOSE_DEPTH);
  return {
    w: dims.length * cos + dims.noseWidth * sin,
    h: (dims.length * sin + dims.noseWidth * cos) * depth,
    drop: Math.round(lerp(sideOnDrop, noseUpDrop, sin)),
  };
}

/** The nearest surface seen through each pixel so far. */
class Surface {
  private readonly colors = new Int32Array(SIZE * SIZE).fill(-1);
  private readonly nearness = new Float32Array(SIZE * SIZE).fill(-Infinity);

  put(x: number, y: number, nearness: number, color: Color | null): void {
    const offPicture = x < 0 || y < 0 || x >= SIZE || y >= SIZE;
    if (color === null || offPicture) return;
    const i = y * SIZE + x;
    if (nearness <= this.nearness[i]) return;
    this.nearness[i] = nearness;
    this.colors[i] = color;
  }

  toCanvas(): PixelCanvas {
    const canvas = new PixelCanvas(SIZE, SIZE);
    this.colors.forEach((color, i) => {
      if (color >= 0) canvas.px(i % SIZE, Math.floor(i / SIZE), color);
    });
    return canvas;
  }
}

/**
 * The model at a heading (radians on screen axes: east 0, south a quarter turn clockwise), outlined
 * like the hand art. Its anchor is the centre of the car's footprint, so it is drawn at the car's
 * own x,y rather than at a prop's bottom edge.
 */
export function renderTurn(model: TurnModel, heading: number): PixelSprite {
  const { length, noseWidth } = model.dims;
  const sin = Math.sin(heading);
  const cos = Math.cos(heading);
  const depth = lerp(SIDE_DEPTH, NOSE_DEPTH, noseness(heading));
  const height = lerp(SIDE_HEIGHT, NOSE_HEIGHT, noseness(heading));
  const surface = new Surface();
  const step = 1 / SAMPLES;

  // A point of the car: `along` from the nose, `across` from its left side, `up` off the ground.
  // The car's left is south of a car heading west, which is why the side-on sprite shows it.
  const put = (along: number, across: number, up: number, color: Color | null): void => {
    const ahead = length / 2 - along;
    const left = noseWidth / 2 - across;
    const south = sin * ahead - cos * left;
    const east = cos * ahead + sin * left;
    surface.put(Math.floor(CENTRE_X + east), Math.floor(CENTRE_Y + south * depth - up * height), south * height + up * depth, color);
  };

  const noseUp = sin < 0;
  const leftFlankShows = cos < 0;
  const flankAcross = leftFlankShows ? 0 : noseWidth;
  for (let along = 0; along < length; along += step) {
    const roof = model.roofline[Math.floor(along)];
    for (let across = 0; across < noseWidth; across += step) put(along, across, roof, model.top(noseUp, along, across));
    for (let up = 0; up < roof; up += step) put(along, flankAcross, up, model.flank(along, up));
  }
  const endAlong = noseUp ? length : 0;
  const endHeight = noseUp ? model.tailHeight : model.noseHeight;
  for (let across = 0; across < noseWidth; across += step) {
    for (let up = 0; up < endHeight; up += step) put(endAlong, across, up, model.end(noseUp, across, up));
  }

  const canvas = surface.toCanvas().outline({ selective: true });
  return canvas.toSprite(SIZE, SIZE, CENTRE_X, CENTRE_Y - turnGround(model.dims, heading).drop);
}
