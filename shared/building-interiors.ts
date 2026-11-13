import { BUILDING_DEFS, PROP_DEFS, TILE_SIZE, WALL_THICKNESS } from './protocol.ts';
import type { BuildingInstance, BuildingKind, PropKind } from './protocol.ts';
import type { MapBuilder } from './map-builder.ts';

/** `left` and `bottom` are pixels from the footprint's top left corner. */
type Slot = readonly [kind: PropKind, left: number, bottom: number, odds?: number];

const NORTH_WALL = TILE_SIZE;
/** Keeps deeper pieces clear of the north wall's own thickness. */
const NORTH_DEEP = 18;
const NORTH_BED = 38;
/** A bed against the west wall, below the back corner a house keeps bare for its stairs. */
const STAIRS_CLEAR_BED = 72;

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
  // Stores by the back door, the operating table, two exam rooms; the nurses' station in the corridor; imaging,
  // the waiting room with reception, and two trolleys in the emergency bay.
  hospital: [
    ['shelf', 6, NORTH_WALL], ['locker', 90, NORTH_WALL], ['shelf', 6, 50],
    ['bed', 148, NORTH_BED], ['locker', 114, 74], ['locker', 190, 74],
    ['bed', 223, NORTH_BED], ['locker', 264, NORTH_WALL], ['bed', 290, NORTH_BED],
    ['counter', 96, 92],
    ['workbench', 6, 146], ['bed', 72, 176],
    ['table', 104, 148], ['counter', 170, 146], ['sofa', 104, 186], ['sofa', 180, 186, 0.6],
    ['bed', 224, 176], ['bed', 290, 176, 0.7], ['locker', 298, 142],
  ],
  // Two beds to a patient room, and a station for the nurses with the linen in the corridor outside.
  hospital_upstairs: [
    ['bed', 6, NORTH_BED], ['bed', 56, NORTH_BED], ['bed', 86, NORTH_BED], ['bed', 136, NORTH_BED],
    ['bed', 166, NORTH_BED], ['bed', 216, NORTH_BED, 0.7], ['locker', 246, NORTH_WALL], ['bed', 290, NORTH_BED],
    ['shelf', 152, 90],
    ['bed', 6, 176], ['bed', 56, 176, 0.7], ['counter', 86, 180], ['locker', 144, 142],
    ['bed', 166, 176], ['bed', 216, 176], ['bed', 246, 176], ['locker', 298, 142],
  ],
  // Kit in the gym, rows of desks in the classrooms, lockers down the hall, the secretary's counter in the office,
  // and the cafeteria's serving counter over its tables.
  school: [
    ['shelf', 6, NORTH_WALL], ['locker', 114, NORTH_WALL],
    ['table', 148, 28], ['table', 174, 28], ['table', 225, 28], ['table', 258, 28],
    ['locker', 6, 72], ['locker', 22, 72], ['locker', 38, 72, 0.6], ['locker', 128, 72], ['locker', 144, 72], ['locker', 192, 72], ['locker', 208, 72],
    ['locker', 6, 112], ['locker', 22, 112], ['locker', 224, 112], ['locker', 240, 112, 0.6],
    ['locker', 6, 126], ['counter', 56, 159], ['table', 6, 164],
    ['fridge', 210, 126], ['counter', 234, 130],
    ['table', 180, 168], ['table', 206, 168], ['table', 232, 168], ['table', 258, 168],
  ],
  // Classrooms with desks along the back, benches in the science lab, the library and one more classroom.
  school_upstairs: [
    ['table', 6, 28], ['table', 32, 28],
    ['workbench', 104, 26], ['workbench', 144, 26],
    ['table', 225, 28], ['table', 258, 28],
    ['locker', 72, 72], ['locker', 88, 72], ['locker', 104, 72, 0.6], ['locker', 176, 72], ['locker', 192, 72],
    ['locker', 112, 112], ['locker', 128, 112], ['locker', 224, 112], ['locker', 240, 112],
    ['shelf', 6, 128], ['shelf', 6, 164], ['shelf', 38, 164], ['shelf', 70, 164], ['table', 112, 164],
    ['table', 150, 160], ['table', 176, 160], ['table', 232, 160], ['table', 258, 160],
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
    // Parked nose to the back wall in line with the front door (its left edge is the door's centre less half the car), so it backs straight out through the door; the lane in front of it stays clear.
    ['car_sedan_v', 38, 80, 0.7],
    ['crate_stack', 100, 70],
  ],
  warehouse: [
    ['shelf', 16, NORTH_WALL], ['shelf', 48, NORTH_WALL], ['shelf', 80, NORTH_WALL], ['shelf', 112, NORTH_WALL],
    ['crate_stack', 16, 54], ['crate_stack', 60, 54], ['crate_stack', 104, 54],
    ['crate_stack', 16, 100], ['crate_stack', 60, 100], ['crate_stack', 104, 100, 0.6],
    ['workbench', 194, NORTH_DEEP],
    ['shelf', 156, 64], ['shelf', 202, 100, 0.6],
  ],
  radio_station: [
    ['shelf', 16, NORTH_WALL], ['locker', 52, NORTH_WALL], ['locker', 92, NORTH_WALL], ['shelf', 112, NORTH_WALL],
    ['counter', 16, 56],
    ['table', 130, 56],
    ['sofa', 16, 96, 0.6],
    ['fridge', 138, 96],
  ],
  // Bedroom west of the inside wall at 54, kitchen east of it with the back door, living room along the front.
  // The bedroom's back corner is left bare for the stairs, and a house with stairs has no inside wall.
  house: [
    ['bed', 6, STAIRS_CLEAR_BED],
    ['locker', 38, 14, 0.5],
    ['fridge', 90, 40],
    ['sofa', 70, 90],
    ['table', 6, 90],
  ],
  // A spacious entrance lobby: waiting lounge on the west, reception on the east, and two flights of stairs in the back walls.
  apartment: [
    ['locker', 40, 14],
    ['table', 18, 80],
    ['sofa', 12, 122],
    ['fridge', 104, 14],
    ['counter', 100, 74],
    ['shelf', 114, 122, 0.6],
  ],
  // One bedroom under the roof, with two beds and the stairs coming up in the same back corner as below.
  upstairs: [
    ['bed', 6, STAIRS_CLEAR_BED], ['locker', 38, 14], ['locker', 58, 14],
    ['bed', 82, NORTH_BED],
    ['shelf', 6, 90], ['table', 82, 90, 0.6],
  ],
  // Two flats upstairs with stairs coming up in both back corners: beds pushed clear of the landings.
  apartment_upstairs: [
    ['bed', 6, STAIRS_CLEAR_BED], ['locker', 38, 14],
    ['table', 6, 116],
    ['sofa', 40, 122],
    ['fridge', 106, 14], ['bed', 130, STAIRS_CLEAR_BED],
    ['table', 130, 116],
    ['shelf', 84, 122, 0.5],
  ],
  // One room under the whole house, stores along the walls and the stairs coming down in the same corner.
  cellar: [
    ['shelf', 34, NORTH_WALL], ['workbench', 66, NORTH_DEEP], ['shelf', 6, 90],
    ['crate_stack', 6, 74],
    ['crate_stack', 86, 90],
  ],
  // The sewers are bare: their fittings are the ladder and the trench.
  sewer_maze: [],
  camp_market: [],
  camp_workshop: [],
  camp_quarters: [],
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
