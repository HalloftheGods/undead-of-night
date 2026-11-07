import { TILE_SIZE } from './protocol.ts';
import { needsDirt } from './biomes.ts';
import { raiseLandmark } from './landmarks.ts';
import type { PropKind, TileKind } from './protocol.ts';
import type { MapBuilder } from './map-builder.ts';
import { pick, randInt, randRange } from './rng.ts';
import type { Box } from './world-query.ts';

const STALL_DEPTH_TILES = 3;
const BAY_PITCH_TILES = 7;
const FENCE_LENGTH = 32;
/** The fence sits in the outermost tiles, so nothing walkable is left outside it. */
const FENCE_SPAN_FROM_EDGE = 10;
const FENCE_DEPTH = 6;

const inset = (area: Box, by: number): Box => ({
  x0: area.x0 + by,
  y0: area.y0 + by,
  x1: area.x1 - by,
  y1: area.y1 - by,
});

/** Painted bays with every other space at most occupied. */
export function fillParking(b: MapBuilder, lot: Box): void {
  b.fill(lot, 'asphalt');
  const col0 = lot.x0 / TILE_SIZE;
  const row0 = lot.y0 / TILE_SIZE;
  const cols = (lot.x1 - lot.x0) / TILE_SIZE;
  const rows = (lot.y1 - lot.y0) / TILE_SIZE;

  for (let i = 0; i < 40; i++) {
    b.setTile(col0 + Math.floor(b.rng() * cols), row0 + Math.floor(b.rng() * rows), 'asphalt_cracked');
  }
  for (let bayRow = 2; bayRow + STALL_DEPTH_TILES < rows; bayRow += BAY_PITCH_TILES) {
    for (let row = bayRow; row < bayRow + STALL_DEPTH_TILES; row++) {
      for (let col = 1; col < cols - 1; col += 2) b.setTile(col0 + col, row0 + row, 'parking_line');
    }
    const bottom = (row0 + bayRow + STALL_DEPTH_TILES) * TILE_SIZE - 4;
    for (let col = 2; col < cols - 2; col += 2) {
      const isStallTaken = b.rng() < 0.55;
      if (isStallTaken) b.place('car_sedan_v', (col0 + col + 0.5) * TILE_SIZE, bottom, 16);
    }
  }
  b.scatter('van_h', lot, 1, 24);
  b.scatter('car_wreck_h', lot, 1, 24);
  lightLot(b, lot);
  b.scatter('rubble', lot, 3);
}

/** Lamps on the lot's corners and, on a long side, at an even pitch between them. */
function lightLot(b: MapBuilder, lot: Box): void {
  const edge = 14;
  const pitch = 18 * TILE_SIZE;
  for (const y of [lot.y0 + edge + 4, lot.y1 - edge]) {
    const span = lot.x1 - lot.x0 - 2 * edge;
    const gaps = Math.max(1, Math.round(span / pitch));
    for (let i = 0; i <= gaps; i++) b.place('street_lamp', Math.round(lot.x0 + edge + (span * i) / gaps), y, 8);
  }
}

/** Lamps beside a straight path, alternating sides, clear of the middle where the safe square is. */
function lightPath(b: MapBuilder, from: number, to: number, centre: number, horizontal: boolean, clear: number, pathAt: number): void {
  const pitch = 15 * TILE_SIZE;
  let north = true;
  for (const sign of [-1, 1]) {
    for (let at = centre + sign * clear; at > from && at < to; at += sign * pitch) {
      const beside = north ? pathAt - 3 : pathAt + TILE_SIZE + 9;
      if (horizontal) b.place('street_lamp', at, beside, 12);
      else b.place('street_lamp', beside, at, 12);
      north = !north;
    }
  }
}

/** A stand of one species: trunks close together, as a wood grows. */
function grove(b: MapBuilder, kind: PropKind, x: number, y: number, count: number, radius: number, onlyOn?: TileKind): void {
  const patch: Box = { x0: x - radius, y0: y - radius, x1: x + radius, y1: y + radius };
  b.scatter(kind, patch, Math.ceil(count * b.biome.lush), 24, needsDirt(kind) ? 'dirt' : onlyOn);
}

/** How far from the spawn a park's set pieces stand: in its corners, clear of the safe square. */
const FEATURE_REACH = { x: 205, y: 190 };
const FEATURE_MARGIN = 100;
const CORNERS: readonly (readonly [number, number])[] = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

function cornerSpot(b: MapBuilder, lot: Box, [sx, sy]: readonly [number, number]): { x: number; y: number } {
  const x = b.spawn.x + sx * FEATURE_REACH.x;
  const y = b.spawn.y + sy * FEATURE_REACH.y;
  return {
    x: Math.min(lot.x1 - FEATURE_MARGIN, Math.max(lot.x0 + FEATURE_MARGIN, x)),
    y: Math.min(lot.y1 - FEATURE_MARGIN, Math.max(lot.y0 + FEATURE_MARGIN, y)),
  };
}

/** The biome's park layout and landmark, each in a corner of its own. Run before the trees so they grow round them. */
function parkFeatures(b: MapBuilder, lot: Box): void {
  const { park, pondTile, landmark, ground } = b.biome;
  const first = randInt(b.rng, 0, 3);
  const second = (first + randInt(b.rng, 1, 3)) % 4;
  const { x, y } = b.spawn;
  const spot = cornerSpot(b, lot, CORNERS[first]);
  const settles: TileKind[] = [ground, 'dirt'];
  if (park === 'ring') {
    for (let angle = 0; angle < Math.PI * 2; angle += 0.02) {
      b.setTile(Math.floor((x + Math.cos(angle) * 185) / TILE_SIZE), Math.floor((y + Math.sin(angle) * 185) / TILE_SIZE), 'dirt');
    }
    for (let i = 0; i < 8; i++) {
      const angle = Math.PI / 8 + (i * Math.PI) / 4;
      b.place('street_lamp', Math.round(x + Math.cos(angle) * 205), Math.round(y + Math.sin(angle) * 205), 12);
    }
  } else if (park === 'pond') {
    for (let pass = 0; pass < 2; pass++) b.blob(spot.x, spot.y, 96, pondTile, settles);
  } else if (park === 'crater') {
    for (let pass = 0; pass < 2; pass++) b.blob(spot.x, spot.y, 84, pondTile, settles);
    b.scatter('rubble', { x0: spot.x - 70, y0: spot.y - 70, x1: spot.x + 70, y1: spot.y + 70 }, 10);
    for (let i = 0; i < 3; i++) b.place('fire_barrel', Math.round(spot.x + Math.cos(i * 2.1) * 52), Math.round(spot.y + Math.sin(i * 2.1) * 52), 8);
  } else if (park === 'clearing') {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const onPath = Math.abs(Math.sin(angle * 2)) < 0.25;
      if (!onPath) grove(b, b.biome.stand, x + Math.cos(angle) * 250, y + Math.sin(angle) * 235, 5, 34);
    }
  }
  if (landmark) raiseLandmark(b, landmark, cornerSpot(b, lot, CORNERS[second]));
}

/** A neglected park with dirt cross paths and the safe open square at its middle. */
export function fillPark(b: MapBuilder, lot: Box): void {
  const { ground } = b.biome;
  b.fill(lot, ground);
  const { x, y } = b.spawn;
  const pathX = Math.floor(x / TILE_SIZE) * TILE_SIZE;
  const pathY = Math.floor(y / TILE_SIZE) * TILE_SIZE;
  b.fill({ x0: pathX, y0: lot.y0, x1: pathX + TILE_SIZE, y1: lot.y1 }, 'dirt');
  b.fill({ x0: lot.x0, y0: pathY, x1: lot.x1, y1: pathY + TILE_SIZE }, 'dirt');
  for (let pass = 0; pass < 2; pass++) {
    b.blob(x, y, 130, 'sidewalk', ground);
    b.blob(x, y, 130, 'sidewalk', 'dirt');
  }
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      b.place('sandbags', x + sx * 118, y + sy * 124, 12);
      b.place('fire_barrel', x + sx * 136, y + sy * 86, 12);
      b.place(b.species('bush'), x + sx * 150, y + sy * 150);
    }
  }
  for (const [lx, ly] of [[0, -140], [0, 140], [-140, 0], [140, 0]]) b.place('street_lamp', x + lx, y + ly);
  lightPath(b, lot.x0, lot.x1, x, true, 140 + 10 * TILE_SIZE, pathY);
  lightPath(b, lot.y0, lot.y1, y, false, 140 + 10 * TILE_SIZE, pathX);
  parkFeatures(b, lot);
  // The biome's trees scattered, with stands of its own species among them.
  b.flora('tree', lot, 20);
  for (let i = 0; i < 5; i++) {
    const wood = inset(lot, 24);
    grove(b, b.biome.stand, randRange(b.rng, wood.x0, wood.x1), randRange(b.rng, wood.y0, wood.y1), randInt(b.rng, 4, 7), 40);
  }
  b.flora('bush', lot, 26);
  b.scatter('rubble', lot, Math.ceil(4 * b.biome.debris));
}

/** An abandoned checkpoint: sandbag lines, burn barrels, whatever they could not carry. */
export function fillCamp(b: MapBuilder, lot: Box): void {
  b.fill(lot, 'dirt');
  b.blob(lot.x0 + 80, lot.y0 + 90, 60, 'grass', 'dirt');
  b.blob(lot.x1 - 90, lot.y1 - 70, 70, 'grass', 'dirt');
  b.scatter('sandbags', lot, 6);
  b.scatter('barrier', lot, 4);
  b.scatter('car_wreck_h', lot, 2);
  b.scatter('fire_barrel', lot, 3);
  b.scatter('crate_stack', lot, 4);
  b.scatter('rubble', lot, Math.ceil(6 * b.biome.debris));
  b.flora('bush', lot, 4);
}

/** The strip inside the fence that no block reaches. */
export function fillVerge(b: MapBuilder, strip: Box): void {
  const area = (strip.x1 - strip.x0) * (strip.y1 - strip.y0);
  const count = Math.max(1, Math.round(area / 9000));
  const kinds: readonly PropKind[] = ['tree', 'tree', 'bush', 'bush', 'rubble'];
  const dry: readonly PropKind[] = ['bush', 'bush', 'tree'];
  const { ground } = b.biome;
  const bare: TileKind = ground === 'grass' ? 'dirt' : 'grass';
  for (let i = 0; i < count; i++) {
    b.flora(pick(b.rng, kinds), strip, 1, 32, ground);
    const x = randRange(b.rng, strip.x0, strip.x1);
    const y = randRange(b.rng, strip.y0, strip.y1);
    const growsGrove = b.rng() < 0.35;
    if (growsGrove) {
      grove(b, b.biome.stand, x, y, randInt(b.rng, 3, 6), 36, ground);
    } else {
      const isDryPatch = ground === 'grass' && b.rng() < 0.3;
      if (isDryPatch) {
        // A dry patch: bare ground with the plants that live on it.
        b.blob(x, y, 34, 'dirt', 'grass');
        grove(b, b.species(pick(b.rng, dry)), x, y, randInt(b.rng, 2, 4), 24, 'dirt');
        grove(b, b.species('bush'), x, y, 3, 28, 'dirt');
      } else {
        b.blob(x, y, 30, bare, ground);
      }
    }
  }
}

/** A closed fence around the whole map. */
export function raiseFence(b: MapBuilder): void {
  const width = b.cols * TILE_SIZE;
  const height = b.rows * TILE_SIZE;
  for (let x = FENCE_LENGTH / 2; x < width; x += FENCE_LENGTH) {
    b.fixture('fence_h', x, FENCE_SPAN_FROM_EDGE + FENCE_DEPTH);
    b.fixture('fence_h', x, height - FENCE_SPAN_FROM_EDGE);
  }
  for (let y = FENCE_LENGTH; y <= height; y += FENCE_LENGTH) {
    b.fixture('fence_v', FENCE_SPAN_FROM_EDGE + FENCE_DEPTH / 2, y);
    b.fixture('fence_v', width - FENCE_SPAN_FROM_EDGE - FENCE_DEPTH / 2, y);
  }
}
