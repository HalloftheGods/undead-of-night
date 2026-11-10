// The sewers under the town: a chain of junctions and tunnels laid out in a band below everything else, each
// junction with an iron ladder up to a manhole in a street. The crossing between street and sewer is a pair
// of flights like a stair's, but flagged interactive: a player has to press the search key to take one (see
// take-manhole.ts), while zombies go through on the flow field as they do on stairs.
//
// The sewer pieces are buildings of their own kinds (isSewerBuilding) whose `of` is SEWERS_OF, so the storey
// code treats them as floors: the dark round them is solid, nothing crosses it but by a ladder, and the town's
// own rolls (loot, residents) skip them. They have no walls of their own, so neighbouring pieces run together
// into one tunnel.

import type { Flight } from './storeys.ts';
import { ANNEX_GAP_TILES } from './storeys.ts';
import { MapBuilder } from './map-builder.ts';
import { BUILDING_DEFS, SEWERS_OF, TILE_KINDS, TILE_SIZE } from './map-protocol.ts';
import type { BuildingInstance, District, PropInstance, TileKind, WorldMap } from './protocol.ts';
import { createRng, pick } from './rng.ts';
import type { Rng } from './rng.ts';
import type { Road } from './town-plan.ts';
import { blockedTilesWithoutVan } from './world-query.ts';

/** A flight a player takes by pressing the search key at it, rather than by walking onto it. */
export interface ManholeFlight extends Flight {
  readonly interactive: true;
}

/** Its own generator, so the town and the run roll exactly as they did before there were sewers. */
const SEWER_SALT = 0x53455752;

export const MIN_MANHOLES = 4;
export const MAX_MANHOLES = 6;
/** Tiles of dark between the last floor and the sewers. */
const SEWER_GAP_TILES = Math.min(ANNEX_GAP_TILES, 3);
/** Tiles of dark under the sewers. */
const SEWER_BOTTOM_TILES = 2;
const MARGIN_TILES = 2;
const JUNCTION_COLS = BUILDING_DEFS.sewer_junction.w / TILE_SIZE;
const TUNNEL_COLS = BUILDING_DEFS.sewer_tunnel_h.w / TILE_SIZE;
const PUMP_COLS = BUILDING_DEFS.sewer_pump_station.w / TILE_SIZE;
/** Rows of the tallest piece, which the band is as deep as. */
export const SEWER_ROWS = BUILDING_DEFS.sewer_junction.h / TILE_SIZE;
const UNIT_COLS = JUNCTION_COLS + TUNNEL_COLS;
/** Where the ladder stands in a junction, in tiles from its left, against the north wall. */
const LADDER_COL = 3;
/** The trench's first row, from the top of the junction: the tunnels (one row down) run the same line. */
const TRENCH_ROW = 3;
/** Manholes keep this far apart, so no two share a chamber and a quadrant's pick is not its neighbour's. */
const MIN_SPACING_TILES = 16;
/** How far from a crossing's middle to look for a free tile. */
const SEARCH_RADIUS = 5;
const WATER_ODDS = 0.35;

const ROAD_TILES: ReadonlySet<TileKind> = new Set<TileKind>(['asphalt', 'asphalt_cracked', 'lane_h', 'lane_v']);

export interface Manhole {
  /** The street tile the cover is in. */
  readonly col: number;
  readonly row: number;
  /** Which junction of the chain its ladder is in. */
  readonly junction: number;
}

export interface SewerPlan {
  readonly manholes: readonly Manhole[];
  readonly pieces: readonly BuildingInstance[];
  /** The first row of the sewers, and how many rows the map grows by to hold them. */
  readonly top: number;
  readonly rows: number;
  /** Per piece id, the tile laid in its trench. */
  readonly trench: ReadonlyMap<string, TileKind>;
}

export interface SewerOptions {
  /** First row of the sewer band: below the town and any floors. Defaults to just under the town's rows. */
  readonly top?: number;
  /** Whether a street tile can take a manhole: free of cars and walls, with room to walk up to it. */
  readonly isFree?: (col: number, row: number) => boolean;
}

interface Crossing {
  readonly col: number;
  readonly row: number;
}

/** Where a road running across meets a road running up and down, at the middle of the ground they share. */
function crossingsOf(roads: readonly Road[]): Crossing[] {
  const found: Crossing[] = [];
  const seen = new Set<number>();
  for (const across of roads.filter((road) => road.horizontal)) {
    for (const down of roads.filter((road) => !road.horizontal)) {
      const c0 = Math.max(down.c0, across.c0);
      const c1 = Math.min(down.c1, across.c1);
      const r0 = Math.max(across.r0, down.r0);
      const r1 = Math.min(across.r1, down.r1);
      // A street that ends at another only touches it, so meeting is touching or overlapping.
      const meets = c0 <= c1 && r0 <= r1;
      if (!meets) continue;
      const col = (c0 + c1) >> 1;
      const row = (r0 + r1) >> 1;
      const key = row * 4096 + col;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ col, row });
    }
  }
  return found;
}

/** The nearest tile to the crossing's middle that the check allows, or null. */
function freeNear(crossing: Crossing, isFree: (col: number, row: number) => boolean): Crossing | null {
  for (let ring = 0; ring <= SEARCH_RADIUS; ring++) {
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        const isOffRing = Math.max(Math.abs(dr), Math.abs(dc)) !== ring;
        if (isOffRing) continue;
        const col = crossing.col + dc;
        const row = crossing.row + dr;
        if (isFree(col, row)) return { col, row };
      }
    }
  }
  return null;
}

const farFrom = (chosen: readonly Crossing[], spot: Crossing): boolean =>
  chosen.every((other) => Math.hypot(other.col - spot.col, other.row - spot.row) >= MIN_SPACING_TILES);

/** 4 to 6 manholes: one in each quadrant that has a street crossing, then extras from anywhere, all well apart. */
function chooseManholes(rng: Rng, spots: readonly Crossing[], cols: number, townRows: number): Crossing[] {
  const quadrantOf = (spot: Crossing): number => (spot.col < cols / 2 ? 0 : 1) + (spot.row < townRows / 2 ? 0 : 2);
  const chosen: Crossing[] = [];
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const here = spots.filter((spot) => quadrantOf(spot) === quadrant && farFrom(chosen, spot));
    const hasNone = here.length === 0;
    if (!hasNone) chosen.push(pick(rng, here));
  }
  const wanted = MIN_MANHOLES + Math.floor(rng() * (MAX_MANHOLES - MIN_MANHOLES + 1));
  while (chosen.length < wanted) {
    const left = spots.filter((spot) => farFrom(chosen, spot));
    const hasNone = left.length === 0;
    if (hasNone) break;
    chosen.push(pick(rng, left));
  }
  return chosen.sort((a, b) => a.col - b.col || a.row - b.row);
}

/** Gives each manhole the junction nearest it along the chain that no other has taken. */
function assignJunctions(spots: readonly Crossing[], junctions: number): Manhole[] {
  const taken = new Set<number>();
  return spots.map((spot) => {
    const want = Math.min(junctions - 1, Math.max(0, Math.round((spot.col - MARGIN_TILES - JUNCTION_COLS / 2) / UNIT_COLS)));
    let junction = want;
    for (let step = 0; step < junctions; step++) {
      const free = [want + step, want - step].filter((k) => k >= 0 && k < junctions && !taken.has(k));
      if (free.length > 0) {
        junction = free[0];
        break;
      }
    }
    taken.add(junction);
    return { col: spot.col, row: spot.row, junction };
  });
}

/** Where the chain's junction `k` starts, in tiles from the left. */
export const junctionCol = (k: number): number => MARGIN_TILES + k * UNIT_COLS;

/**
 * Plans the sewers: a chain of junctions and tunnels ending at a pump station, and the manholes that lead
 * down to it. Deterministic in the seed and the streets, plus whatever `isFree` says about the tiles.
 */
export function planSewers(seed: number, roads: readonly Road[], cols: number, townRows: number, options: SewerOptions = {}): SewerPlan {
  const rng = createRng(seed ^ SEWER_SALT);
  const top = options.top ?? townRows + SEWER_GAP_TILES;
  const isFree = options.isFree ?? (() => true);
  const rows = top + SEWER_ROWS + SEWER_BOTTOM_TILES - townRows;
  const junctions = Math.floor((cols - MARGIN_TILES * 2 - PUMP_COLS) / UNIT_COLS);
  const spots = crossingsOf(roads)
    .map((crossing) => freeNear(crossing, isFree))
    .filter((spot): spot is Crossing => spot !== null);
  const manholes = junctions > 0 ? assignJunctions(chooseManholes(rng, spots, cols, townRows), junctions) : [];
  const pieces: BuildingInstance[] = [];
  const trench = new Map<string, TileKind>();
  const add = (id: string, kind: 'sewer_junction' | 'sewer_tunnel_h' | 'sewer_pump_station', col: number, row: number): void => {
    pieces.push({ id, kind, x: col * TILE_SIZE, y: row * TILE_SIZE, variant: 0, of: SEWERS_OF });
    trench.set(id, rng() < WATER_ODDS ? 'water' : 'sludge');
  };
  for (let k = 0; k < junctions; k++) {
    add(`sewer-j${k}`, 'sewer_junction', junctionCol(k), top);
    add(`sewer-t${k}`, 'sewer_tunnel_h', junctionCol(k) + JUNCTION_COLS, top + 1);
  }
  if (junctions > 0) add('sewer-pump', 'sewer_pump_station', junctionCol(junctions), top);
  return { manholes, pieces, top, rows, trench };
}

const tileCentre = (col: number, row: number): { x: number; y: number } => ({ x: (col + 0.5) * TILE_SIZE, y: (row + 0.5) * TILE_SIZE });

/** The sewer tile in front of a junction's ladder: where a climber stands at the foot of it, and comes out. */
export function ladderTile(plan: Pick<SewerPlan, 'top'>, manhole: Pick<Manhole, 'junction'>): { col: number; row: number } {
  return { col: junctionCol(manhole.junction) + LADDER_COL, row: plan.top + 1 };
}

/** The manhole covers, the ladders under them, and the two flights each pair makes. */
export function sewerCrossings(plan: SewerPlan, cols: number): { props: PropInstance[]; flights: ManholeFlight[]; ladders: PropInstance[] } {
  const props: PropInstance[] = [];
  const ladders: PropInstance[] = [];
  const flights: ManholeFlight[] = [];
  for (const manhole of plan.manholes) {
    const foot = ladderTile(plan, manhole);
    props.push({ kind: 'manhole', x: (manhole.col + 0.5) * TILE_SIZE, y: (manhole.row + 1) * TILE_SIZE });
    ladders.push({ kind: 'sewer_ladder', x: (foot.col + 0.5) * TILE_SIZE, y: foot.row * TILE_SIZE });
    const street = manhole.row * cols + manhole.col;
    const below = foot.row * cols + foot.col;
    const streetPoint = tileCentre(manhole.col, manhole.row);
    const belowPoint = tileCentre(foot.col, foot.row);
    flights.push(
      { from: streetPoint, to: belowPoint, fromIndex: street, toIndex: below, label: 'SEWERS', down: true, interactive: true },
      { from: belowPoint, to: streetPoint, fromIndex: below, toIndex: street, label: 'SURFACE', down: false, interactive: true },
    );
  }
  return { props, flights, ladders };
}

function isRoad(map: Pick<WorldMap, 'tiles' | 'cols' | 'rows'>, col: number, row: number): boolean {
  const onMap = col >= 0 && row >= 0 && col < map.cols && row < map.rows;
  return onMap && ROAD_TILES.has(TILE_KINDS[map.tiles[row * map.cols + col]]);
}

/** Paints one piece: concrete all over, and its trench along the middle rows, which the walkways flank. */
function paint(annex: MapBuilder, piece: BuildingInstance, trench: TileKind, top: number): void {
  const { w, h } = BUILDING_DEFS[piece.kind];
  const col = piece.x / TILE_SIZE;
  const row = piece.y / TILE_SIZE;
  for (let r = 0; r < h / TILE_SIZE; r++) {
    for (let c = 0; c < w / TILE_SIZE; c++) annex.setTile(col + c, row + r, 'floor_concrete');
  }
  for (let c = 0; c < w / TILE_SIZE; c++) {
    annex.setTile(col + c, top + TRENCH_ROW, trench);
    annex.setTile(col + c, top + TRENCH_ROW + 1, trench);
  }
}

/** The surface district nearest a point, for naming the sewers under it. */
function districtNear(districts: readonly District[], x: number, y: number): string | null {
  let best: District | null = null;
  let bestDistance = Infinity;
  for (const district of districts) {
    const distance = Math.hypot(district.x - x, district.y - y);
    const isNearer = distance < bestDistance;
    if (isNearer) {
      bestDistance = distance;
      best = district;
    }
  }
  return best?.name ?? null;
}

/**
 * Lays the sewers out in a band under everything else the map has: the tiles above carry on unchanged,
 * then dark, then the chain of tunnels. A map with no street to put a manhole in is left as it was.
 */
export function withSewers(town: WorldMap, roads: readonly Road[]): WorldMap {
  const surfaceRows = town.townRows ?? town.rows;
  // The van is not settled yet: it parks after the sewers are in, and a cover is never solid, so leaving it out changes nothing.
  const blocked = blockedTilesWithoutVan(town);
  const clear = (col: number, row: number): boolean => {
    const reaches = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([dc, dr]) => isRoad(town, col + dc, row + dr) && !blocked[(row + dr) * town.cols + col + dc]);
    return reaches && row < surfaceRows;
  };
  const plan = planSewers(town.seed, roads, town.cols, surfaceRows, { top: town.rows + SEWER_GAP_TILES, isFree: clear });
  const hasNoManholes = plan.manholes.length === 0;
  if (hasNoManholes) return town;
  const rows = plan.top + SEWER_ROWS + SEWER_BOTTOM_TILES;
  const annex = new MapBuilder(town.cols, rows, createRng(town.seed ^ SEWER_SALT), town.spawn);
  annex.tiles.set(town.tiles);
  annex.fill({ x0: 0, y0: town.height, x1: town.width, y1: rows * TILE_SIZE }, 'void');
  for (const piece of plan.pieces) paint(annex, piece, plan.trench.get(piece.id) as TileKind, plan.top);
  const { props, flights, ladders } = sewerCrossings(plan, town.cols);
  const underground: District[] = plan.manholes.map((manhole) => {
    const foot = ladderTile(plan, manhole);
    const above = tileCentre(manhole.col, manhole.row);
    const name = districtNear(town.districts, above.x, above.y);
    const at = tileCentre(foot.col, foot.row);
    return { name: name ? `Sewers under ${name}` : 'Sewers', x: at.x, y: at.y, underground: true };
  });
  return {
    ...town,
    height: rows * TILE_SIZE,
    rows,
    townRows: surfaceRows,
    tiles: annex.tiles,
    props: [...town.props, ...props, ...ladders],
    buildings: [...town.buildings, ...plan.pieces],
    districts: [...town.districts, ...underground],
    flights,
  };
}
