import { BUILDING_DEFS, PROP_DEFS, TILE_SIZE, WALL_THICKNESS } from './protocol.ts';
import type { BuildingInstance, BuildingKind, PropKind } from './protocol.ts';
import type { MapBuilder } from './map-builder.ts';

/** `left` and `bottom` are pixels from the footprint's top left corner. */
type Slot = readonly [kind: PropKind, left: number, bottom: number, odds?: number];

const NORTH_WALL = TILE_SIZE;
/** Keeps deeper pieces clear of the north wall's own thickness. */
const NORTH_DEEP = 18;
const NORTH_BED = 38;

/**
 * Hand-laid so every room keeps a way in from the door, with pieces against the walls. Any gap
 * a player fits through is at least 24px, so a brute (22px across) can follow; anything less
 * must be too tight for the player as well. Tile rows are 16px, so a `bottom` of 64 fills row 3.
 */
const LAYOUTS: Record<BuildingKind, readonly Slot[]> = {
  pharmacy: [
    ['shelf', 16, NORTH_WALL], ['shelf', 48, NORTH_WALL], ['shelf', 80, NORTH_WALL], ['shelf', 112, NORTH_WALL],
    ['counter', 64, 30],
    ['shelf', 16, 64], ['shelf', 112, 64],
  ],
  clinic: [
    ['bed', 16, NORTH_BED], ['bed', 64, NORTH_BED], ['bed', 112, NORTH_BED], ['bed', 160, NORTH_BED],
    ['counter', 72, 80],
    ['table', 16, 88],
    ['locker', 88, NORTH_WALL], ['shelf', 144, 96], ['locker', 16, 74, 0.5],
  ],
  police: [
    ['locker', 16, NORTH_WALL], ['locker', 32, NORTH_WALL], ['locker', 48, NORTH_WALL], ['locker', 64, NORTH_WALL],
    ['locker', 160, NORTH_WALL], ['locker', 176, NORTH_WALL], ['locker', 192, NORTH_WALL],
    ['counter', 88, 52],
    ['table', 16, 80], ['table', 184, 80],
    ['shelf', 16, 114], ['shelf', 176, 114],
  ],
  gun_shop: [
    ['shelf', 16, NORTH_WALL], ['shelf', 48, NORTH_WALL], ['shelf', 104, NORTH_WALL],
    ['counter', 80, 60],
    ['locker', 16, 64],
    ['shelf', 96, 96],
  ],
  grocery: [
    ['shelf', 16, NORTH_WALL], ['shelf', 48, NORTH_WALL], ['shelf', 80, NORTH_WALL], ['shelf', 112, NORTH_WALL],
    ['shelf', 96, 52], ['shelf', 128, 52], ['shelf', 160, 52],
    ['shelf', 96, 96], ['shelf', 128, 96], ['shelf', 160, 96],
    ['counter', 16, 60],
  ],
  discount: [
    // Stockroom in the back corner: cartons and the locked cabinet.
    ['crate_stack', 10, 22], ['locker', 34, NORTH_WALL], ['crate_stack', 10, 62, 0.6],
    ['shelf', 74, NORTH_WALL], ['shelf', 106, NORTH_WALL], ['shelf', 138, NORTH_WALL],
    ['shelf', 74, 50], ['shelf', 106, 50],
    // The checkout, just inside the door, against the front wall.
    ['counter', 80, 95], ['shelf', 136, 95, 0.6],
  ],
  diner: [
    ['fridge', 14, NORTH_WALL], ['counter', 32, NORTH_DEEP], ['fridge', 85, NORTH_WALL], ['counter', 106, NORTH_DEEP],
    ['table', 72, 64], ['table', 128, 64],
    ['sofa', 12, 90, 0.6],
  ],
  garage: [
    ['shelf', 16, NORTH_WALL], ['workbench', 82, NORTH_DEEP], ['workbench', 130, NORTH_DEEP],
    ['locker', 144, 64],
    ['car_sedan_h', 90, 80, 0.7],
    ['crate_stack', 16, 80],
  ],
  warehouse: [
    ['shelf', 16, NORTH_WALL], ['shelf', 48, NORTH_WALL], ['shelf', 80, NORTH_WALL], ['shelf', 112, NORTH_WALL],
    ['crate_stack', 16, 54], ['crate_stack', 60, 54], ['crate_stack', 104, 54],
    ['crate_stack', 16, 100], ['crate_stack', 60, 100], ['crate_stack', 104, 100, 0.6],
    ['workbench', 194, NORTH_DEEP],
    ['shelf', 156, 64], ['shelf', 202, 100, 0.6],
  ],
  // Bedroom west of the inside wall at 54, kitchen east of it with the back door, living room along the front.
  house: [
    ['bed', 6, NORTH_BED],
    ['locker', 38, 14, 0.5],
    ['fridge', 90, 40],
    ['sofa', 70, 90],
    ['table', 6, 80],
  ],
  // Two rooms either side of the hall that runs from the front door to the back, and a lobby along the front.
  apartment: [
    ['bed', 6, NORTH_BED], ['locker', 38, 14],
    ['table', 6, 80],
    ['fridge', 106, 14], ['bed', 130, NORTH_BED],
    ['table', 130, 80],
    ['sofa', 6, 122], ['shelf', 122, 122, 0.5],
  ],
  // Two bedrooms either side of the same inside wall as the house below, the landing along the front.
  // The stairs come up in the east room's south corner, which is left bare. A bed would leave the east
  // room a sliver too narrow to follow anyone through, so it is a box room with a wardrobe.
  upstairs: [
    ['bed', 6, NORTH_BED], ['locker', 38, 14],
    ['locker', 90, 14],
    ['shelf', 6, 90], ['table', 82, 90, 0.6],
  ],
  // Two more flats off the same hall, furnished the same, with the stairs coming up in the lobby's east end.
  apartment_upstairs: [
    ['bed', 6, NORTH_BED], ['locker', 38, 14],
    ['table', 6, 80],
    ['fridge', 106, 14], ['bed', 130, NORTH_BED],
    ['table', 130, 80],
    ['sofa', 6, 122], ['shelf', 122, 122, 0.5],
  ],
  // One room under the whole house, stores along the walls and the stairs coming down in the same corner.
  cellar: [
    ['shelf', 6, NORTH_WALL], ['workbench', 66, NORTH_DEEP],
    ['crate_stack', 6, 62],
    ['crate_stack', 86, 90],
  ],
};

/** A gap narrower than this looks like a way round but is not one. */
const WALL_SNAP = 24;

interface Piece {
  left: number;
  readonly width: number;
  readonly top: number;
  readonly bottom: number;
}

/** Pieces that stand in one row with no real way between them, left to right. */
function runsOf(pieces: readonly Piece[]): Piece[][] {
  const runs: Piece[][] = [];
  const sorted = [...pieces].sort((a, b) => a.left - b.left);
  for (const piece of sorted) {
    const joins = (run: Piece[]): boolean =>
      run.some((other) => {
        const sameRow = other.top < piece.bottom && piece.top < other.bottom;
        return sameRow && piece.left - (other.left + other.width) < WALL_SNAP;
      });
    const run = runs.find(joins);
    if (run) run.push(piece);
    else runs.push([piece]);
  }
  return runs;
}

/**
 * Lays a run wall to wall. When the run's free room adds up to a real aisle, the pieces close up and
 * the aisle opens at the run's widest gap; otherwise the room is shared out evenly, so no gap opens
 * up just short of passable.
 */
function spreadOut(run: Piece[], slack: number): void {
  const gaps = run.slice(1).map((piece, index) => piece.left - (run[index].left + run[index].width));
  const free = gaps.reduce((sum, gap) => sum + gap, slack);
  const widest = gaps.indexOf(Math.max(...gaps));
  const aisle = free >= WALL_SNAP;
  let x = WALL_THICKNESS;
  run.forEach((piece, index) => {
    const opensAisle = aisle && index - 1 === widest;
    const evenShare = aisle ? 0 : free / gaps.length;
    const hasPieceBefore = index > 0;
    if (hasPieceBefore) x += opensAisle ? free : evenShare;
    piece.left = x;
    x += piece.width;
  });
}

/** Closes a run up to a side wall it nearly reaches, or spreads it wall to wall when it nearly reaches both. */
function closeUp(run: Piece[], inside: number): void {
  const left = Math.min(...run.map((piece) => piece.left));
  const right = Math.max(...run.map((piece) => piece.left + piece.width));
  const nearLeft = left - WALL_THICKNESS < WALL_SNAP;
  const nearRight = inside - right < WALL_SNAP;
  const spread = nearLeft && nearRight && run.length > 1;
  if (spread) {
    spreadOut(run, inside - WALL_THICKNESS - (right - left));
    return;
  }
  const towardLeft = nearLeft ? WALL_THICKNESS - left : 0;
  const shift = nearRight && !nearLeft ? inside - right : towardLeft;
  for (const piece of run) piece.left += shift;
}

const placed = new Map<BuildingKind, readonly number[]>();

/**
 * Each piece's left edge in a kind of building. The layouts were drawn for tile-thick walls and the
 * walls are thinner, so a row that nearly meets a side wall is closed up against it instead of
 * leaving a sliver that looks like a way round.
 */
export function placedLefts(kind: BuildingKind): readonly number[] {
  const known = placed.get(kind);
  if (known) return known;
  const pieces: Piece[] = LAYOUTS[kind].map(([prop, left, bottom]) => ({ left, width: PROP_DEFS[prop].w, top: bottom - PROP_DEFS[prop].h, bottom }));
  const inside = BUILDING_DEFS[kind].w - WALL_THICKNESS;
  for (const run of runsOf(pieces)) closeUp(run, inside);
  const lefts = pieces.map((piece) => Math.round(piece.left));
  placed.set(kind, lefts);
  return lefts;
}

/** Furnishes one building. Pieces go down as fixtures: the layouts already leave their own aisles. */
export function furnish(b: MapBuilder, building: BuildingInstance): void {
  const lefts = placedLefts(building.kind);
  LAYOUTS[building.kind].forEach(([kind, , bottom, odds], index) => {
    const skipped = odds !== undefined && b.rng() >= odds;
    if (!skipped) b.fixture(kind, building.x + lefts[index] + PROP_DEFS[kind].w / 2, building.y + bottom);
  });
}
