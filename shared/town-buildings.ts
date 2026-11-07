import { furnish } from './building-interiors.ts';
import { backDoorBox } from './building-plans.ts';
import { BUILDING_DEFS, DOOR_WIDTH, TILE_SIZE } from './protocol.ts';
import type { BuildingInstance, BuildingKind, TileKind } from './protocol.ts';
import type { MapBuilder } from './map-builder.ts';
import { createRng, pick, randInt } from './rng.ts';
import { EDGE_TILES, MAP_TILES, WALK_TILES, rectBox } from './town-plan.ts';
import type { Block, TownPlan, TownStyle } from './town-plan.ts';
import { fillCamp, fillParking } from './world-blocks.ts';
import { doorBox } from './world-query.ts';

/** Paved strip plus a tile of clearance between a row of buildings and the row behind it. */
const LANE_TILES = 3;
const LANE_PAVED_TILES = 2;
/** Tiles kept clear in front of a door. */
const DOOR_APRON_TILES = 3;
/** Tiles of paving kept clear behind a back door. */
const BACK_STEP_TILES = 1;
const FORECOURT_W_TILES = 7;
const FORECOURT_H_TILES = 5;

/** The town's one S.O.S. Discount, when it has one: downtown's first plot once every wish there stands. */
const STORE: BuildingKind = 'discount';
const STORE_DISTRICT: TownStyle = 'downtown';
const STORE_ODDS = 2 / 3;
/** Off the town's seed, so a town without the store is laid out exactly as it was before there was one. */
const STORE_SALT = 0x5050;

export const hasDiscountStore = (seed: number): boolean => createRng(seed ^ STORE_SALT)() < STORE_ODDS;

interface DistrictStyle {
  readonly ground: TileKind;
  /** Tiles between the block's south edge and the first row's walls. */
  readonly front: number;
  readonly gap: readonly [number, number];
  /** Chance of leaving a vacant plot instead of the next filler. */
  readonly vacancy: number;
  /** What the district is mostly made of, once its wishes are placed. */
  readonly fillers: readonly BuildingKind[];
  /** What must exist here. Anything that cannot fit moves on to the next district. */
  readonly wishes: readonly BuildingKind[];
  /** Kind, count per 400 tiles, and the ground it needs: dry plants only take root on bare dirt. */
  readonly clutter: readonly (readonly [Parameters<MapBuilder['scatter']>[0], number, TileKind?])[];
}

const STYLES: Record<TownStyle, DistrictStyle> = {
  old_town: {
    ground: 'dirt',
    front: 0,
    gap: [2, 3],
    vacancy: 0.1,
    fillers: ['house', 'house', 'house', 'house', 'apartment', 'apartment'],
    wishes: ['grocery', 'diner', 'garage', 'pharmacy', 'diner'],
    clutter: [['bush', 6], ['tree', 3], ['dumpster', 1], ['crate_stack', 1], ['rubble', 2]],
  },
  riverside: {
    ground: 'grass',
    front: 2,
    gap: [3, 5],
    vacancy: 0.15,
    fillers: ['house', 'house', 'house', 'house', 'house', 'apartment'],
    wishes: ['grocery', 'diner'],
    clutter: [['tree', 3], ['pine', 4], ['bush', 5], ['rubble', 1]],
  },
  industrial: {
    ground: 'dirt',
    front: 0,
    gap: [3, 6],
    vacancy: 0.25,
    fillers: ['warehouse', 'warehouse', 'garage'],
    wishes: ['warehouse', 'garage', 'warehouse'],
    clutter: [['crate_stack', 5], ['dumpster', 2], ['barrier', 2], ['fire_barrel', 1], ['rubble', 3], ['bush', 3, 'dirt'], ['tree', 1, 'dirt']],
  },
  downtown: {
    ground: 'sidewalk',
    front: 0,
    gap: [2, 3],
    vacancy: 0.05,
    // Houses are here for the shallow rows, where a diner would otherwise be the only thing that fits.
    fillers: ['apartment', 'apartment', 'apartment', 'apartment', 'grocery', 'grocery', 'grocery', 'diner', 'house', 'house', 'house'],
    wishes: ['police', 'gun_shop', 'clinic', 'pharmacy', 'grocery', 'diner'],
    clutter: [['dumpster', 2], ['crate_stack', 1], ['rubble', 3]],
  },
};

/** Downtown goes last: it has the most room, so it takes whatever the others could not fit. */
const FILL_ORDER: readonly TownStyle[] = ['old_town', 'riverside', 'industrial', 'downtown'];

const widthOf = (kind: BuildingKind): number => BUILDING_DEFS[kind].w / TILE_SIZE;
const heightOf = (kind: BuildingKind): number => BUILDING_DEFS[kind].h / TILE_SIZE;
const plotWidth = (kind: BuildingKind): number => widthOf(kind) + (kind === 'garage' ? FORECOURT_W_TILES : 0);

/** The next building that fits: wishes, then a late arrival once every wish stands, then fillers. */
function nextKind(b: MapBuilder, style: DistrictStyle, wishes: BuildingKind[], late: BuildingKind[], room: number, height: number): BuildingKind | null {
  const fits = (kind: BuildingKind): boolean => plotWidth(kind) <= room && heightOf(kind) <= height;
  const wished = wishes.findIndex(fits);
  const hasWish = wished >= 0;
  if (hasWish) return wishes.splice(wished, 1)[0];
  const arrived = wishes.length === 0 ? late.findIndex(fits) : -1;
  const hasLateArrival = arrived >= 0;
  if (hasLateArrival) return late.splice(arrived, 1)[0];
  const fillers = style.fillers.filter(fits);
  return fillers.length > 0 ? pick(b.rng, fillers) : null;
}

/** A paved pad beside a garage with its pumps. */
function forecourt(b: MapBuilder, col: number, bottom: number): void {
  const area = rectBox({ c0: col, c1: col + FORECOURT_W_TILES - 1, r0: bottom - FORECOURT_H_TILES, r1: bottom });
  b.fill(area, 'asphalt');
  for (let c = col + 1; c < col + FORECOURT_W_TILES - 2; c += 2) b.setTile(c, bottom - 1, 'parking_line');
  const y = (bottom - 2) * TILE_SIZE;
  b.place('gas_pump', (col + 1.5) * TILE_SIZE, y, 16);
  b.place('gas_pump', (col + 4.5) * TILE_SIZE, y, 16);
  b.reserve(area);
}

/** A step of paving outside a back door, kept clear, so the door is seen from the lane and never blocked. */
function backStep(b: MapBuilder, building: BuildingInstance): void {
  const back = backDoorBox(building);
  if (!back) return;
  const step = { x0: back.x0, y0: back.y0 - BACK_STEP_TILES * TILE_SIZE, x1: back.x1, y1: back.y0 };
  b.fill(step, 'sidewalk');
  b.reserve({ ...step, x0: step.x0 - DOOR_WIDTH / 2, x1: step.x1 + DOOR_WIDTH / 2 });
}

function raise(b: MapBuilder, kind: BuildingKind, col: number, bottom: number, walkDown: number): void {
  const building = b.addBuilding(kind, col, bottom - heightOf(kind));
  const door = doorBox(building);
  // Paves from the door out to the sidewalk and keeps props from blocking it.
  b.fill({ x0: door.x0, y0: door.y1, x1: door.x1, y1: door.y1 + walkDown * TILE_SIZE }, 'sidewalk');
  const apronDepth = DOOR_APRON_TILES * TILE_SIZE;
  b.reserve({ x0: door.x0 - DOOR_WIDTH / 2, y0: door.y1, x1: door.x1 + DOOR_WIDTH / 2, y1: door.y1 + apronDepth });
  backStep(b, building);
  furnish(b, building);
  const isGarage = kind === 'garage';
  if (isGarage) forecourt(b, col + widthOf(kind) + 1, bottom);
}

/** Packs one row of buildings against `bottom`. Returns the row's top edge, or null if nothing fit. */
function packRow(b: MapBuilder, block: Block, style: DistrictStyle, bottom: number, walkDown: number, wishes: BuildingKind[], late: BuildingKind[]): number | null {
  const height = bottom - block.r0;
  let cursor = block.c0 + randInt(b.rng, 0, 2);
  let top: number | null = null;
  for (;;) {
    const leaveVacant = wishes.length === 0 && b.rng() < style.vacancy;
    if (leaveVacant) cursor += randInt(b.rng, 3, 6);
    const kind = nextKind(b, style, wishes, late, block.c1 - cursor, height);
    if (!kind) return top;
    raise(b, kind, cursor, bottom, walkDown);
    top = Math.min(top ?? bottom, bottom - heightOf(kind));
    cursor += plotWidth(kind) + randInt(b.rng, style.gap[0], style.gap[1]);
  }
}

/** Rows run from the south edge, each with its doors on a paved lane or the street. */
function fillBlock(b: MapBuilder, block: Block, style: DistrictStyle, wishes: BuildingKind[], late: BuildingKind[]): void {
  const area = rectBox(block);
  b.fill(area, style.ground === 'grass' ? b.biome.ground : style.ground);
  // No street runs along the fence, so doors facing it get a path of their own.
  const facesFence = block.r1 === MAP_TILES - EDGE_TILES;
  if (facesFence) b.fill(rectBox({ c0: block.c0, c1: block.c1, r0: block.r1, r1: block.r1 + WALK_TILES }), 'sidewalk');
  let bottom = block.r1 - style.front;
  let walkDown = style.front;
  for (;;) {
    const top = packRow(b, block, style, bottom, walkDown, wishes, late);
    const isBlockFull = top === null;
    if (isBlockFull) break;
    bottom = top - LANE_TILES;
    const isAtBlockTop = bottom <= block.r0;
    if (isAtBlockTop) break;
    walkDown = LANE_PAVED_TILES;
    b.fill(rectBox({ c0: block.c0, c1: block.c1, r0: bottom, r1: bottom + LANE_PAVED_TILES }), 'sidewalk');
  }
  const scale = ((block.c1 - block.c0) * (block.r1 - block.r0)) / 400;
  for (const [kind, count, onlyOn] of [...style.clutter, ...b.biome.extra]) b.flora(kind, area, Math.ceil(count * scale), undefined, onlyOn);
}

/**
 * Fills every block; the farthest in two districts stay open as a car park and a camp. A store
 * that finds no plot in its district is left out rather than carried on.
 */
export function raiseBuildings(b: MapBuilder, plan: TownPlan, store = false): void {
  const distance = (block: Block): number =>
    Math.hypot(((block.c0 + block.c1) / 2) * TILE_SIZE - plan.spawn.x, ((block.r0 + block.r1) / 2) * TILE_SIZE - plan.spawn.y);
  let carried: BuildingKind[] = [];
  for (const name of FILL_ORDER) {
    const style = STYLES[name];
    const blocks = plan.blocks.filter((block) => block.style === name).sort((a, c) => distance(a) - distance(c));
    const wishes = [...carried, ...style.wishes];
    const openLot = name === 'downtown' || name === 'riverside' ? blocks.pop() : undefined;
    const late: BuildingKind[] = store && name === STORE_DISTRICT ? [STORE] : [];
    for (const block of blocks) fillBlock(b, block, style, wishes, late);
    if (openLot) {
      const isDowntown = name === 'downtown';
      if (isDowntown) fillParking(b, rectBox(openLot));
      else fillCamp(b, rectBox(openLot));
    }
    carried = wishes;
  }
}
