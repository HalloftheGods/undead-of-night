// The sewers under the town: a maze of brick tunnels that lies directly under the streets, one tile of
// sewer for every tile of town, in a band of its own below everything else on the map. A tunnel runs
// down the middle of a street between two crossings, so the sewer map is the street map seen from
// underneath: what is at (x, y) in town is at (x, y + the band's top) down there.
//
// The streets make a lattice of crossings. A few trunk tunnels follow the avenues the whole way; every
// other tunnel is a street's stretch between two crossings that the maze either opens (to join two parts
// that nothing else joins, or to make a loop), closes (leaving rock), or half-opens as a dead end. Side
// passages branch off the middle of a tunnel into a sump chamber. Getting from one manhole to another
// means choosing a way through it.
//
// Every manhole stands in a street at a crossing, over a ladder in a brick shaft under it. The crossing
// between street and sewer is a pair of flights like a stair's, but flagged interactive: a player has to
// press the search key to take one (see take-manhole.ts), while zombies go through on the flow field.
//
// The whole maze is one building of its own kind (isSewerBuilding) whose `of` is SEWERS_OF, so the storey
// code treats it as a floor: the rock round the tunnels is solid, nothing crosses it but by a ladder, and
// the town's own rolls (loot, residents) skip it.

import type { Flight } from './storeys.ts';
import { ANNEX_GAP_TILES } from './storeys.ts';
import { MapBuilder } from './map-builder.ts';
import { BUILDING_DEFS, SEWERS_OF, TILE_KINDS, TILE_SIZE } from './map-protocol.ts';
import type { BuildingInstance, District, MapLight, PropInstance, TileKind, WorldMap } from './protocol.ts';
import { createRng, pick, randInt, shuffle } from './rng.ts';
import type { Rng } from './rng.ts';
import type { Road } from './town-plan.ts';
import { blockedTiles } from './world-query.ts';

/** A flight a player takes by pressing the search key at it, rather than by walking onto it. */
export interface ManholeFlight extends Flight {
  readonly interactive: true;
}

/** Its own generator, so the town and the run roll exactly as they did before there were sewers. */
const SEWER_SALT = 0x53455752;

export const MIN_MANHOLES = 6;
export const MAX_MANHOLES = 8;
/** Tiles of dark between the last floor and the sewers. */
const SEWER_GAP_TILES = Math.min(ANNEX_GAP_TILES, 3);
/** A tunnel is this many tiles either side of its middle: five across, a canal between two walkways. */
const TUNNEL_HALF = 2;
/** Chance a stretch the tree leaves shut is opened anyway, making a loop. */
const LOOP_ODDS = 0.3;
/** Chance a stretch that stays shut is half-opened from one end, a dead end. */
const STUB_ODDS = 0.7;
/** How much of a shut stretch a dead end runs down, as a share of its length. */
const STUB_SHARE: readonly [number, number] = [0.3, 0.6];
/** Chance a tunnel in use has a side passage off its middle. */
const SIDE_ODDS = 0.45;
const SIDE_LENGTH: readonly [number, number] = [6, 11];
/** The sump at the end of a side passage, in tiles across. */
const CHAMBER_TILES = 7;
/** Only a road this wide is an avenue, whose tunnels are the maze's trunk: every other street is the same length, on a grid. */
const TRUNK_WIDTH_TILES = 7;
/** Where a ladder can stand, from a crossing's middle: the junction's south edge, either side of the canal. */
const SHAFT_OFFSETS: readonly (readonly [number, number])[] = [[-1, 2], [1, 2], [-2, 2], [2, 2]];
/** How far into its foot's tile the ladder's base stands: less than the half-tile a climber stands at, so they are drawn after it. */
const LADDER_BASE_PX = 4;
/** Manholes keep this far apart, in tiles. */
const MIN_SPACING_TILES = 20;

const ROAD_TILES: ReadonlySet<TileKind> = new Set<TileKind>(['asphalt', 'asphalt_cracked', 'lane_h', 'lane_v']);

export interface Crossing {
  readonly col: number;
  readonly row: number;
}

/** A straight run of tunnel along the middle of a street: tiles inclusive, along one line. */
export interface Tunnel {
  readonly horizontal: boolean;
  /** The row, for a tunnel running across; the column, for one running up and down. */
  readonly line: number;
  readonly from: number;
  readonly to: number;
  readonly kind: 'trunk' | 'branch' | 'loop' | 'dead_end' | 'side';
}

export interface Manhole {
  /** The street tile the cover is in. */
  readonly col: number;
  readonly row: number;
  /** The crossing it is at, an index into `nodes`. */
  readonly node: number;
}

export interface SewerPlan {
  readonly manholes: readonly Manhole[];
  /** Every crossing of the streets, whether the maze reaches it or not. */
  readonly nodes: readonly Crossing[];
  readonly tunnels: readonly Tunnel[];
  /** The side passages' sumps, by their middle tile. */
  readonly chambers: readonly Crossing[];
  /** The first row of the sewers: the tile at (col, row) in town is at (col, row + top) below. */
  readonly top: number;
}

export interface SewerOptions {
  /** First row of the sewer band: below the town and any floors. Defaults to just under the town's rows. */
  readonly top?: number;
  /** Whether a street tile can take a manhole: free of cars and walls, with room to walk up to it. */
  readonly isFree?: (col: number, row: number) => boolean;
}

interface Edge {
  readonly a: number;
  readonly b: number;
  readonly horizontal: boolean;
  readonly trunk: boolean;
}

/** A road's middle line: the middle row of one running across, the middle column of one running up and down. */
const middleOf = (road: Road): number => (road.horizontal ? road.r0 + ((road.r1 - road.r0 - 1) >> 1) : road.c0 + ((road.c1 - road.c0 - 1) >> 1));

const widthOf = (road: Road): number => (road.horizontal ? road.r1 - road.r0 : road.c1 - road.c0);

/** Where each street running across meets each one running up and down: the crossings, at their middles, and the streets between them. */
function latticeOf(roads: readonly Road[]): { nodes: Crossing[]; edges: Edge[] } {
  const across = roads.filter((road) => road.horizontal);
  const down = roads.filter((road) => !road.horizontal);
  const nodes: Crossing[] = [];
  const indexOf = new Map<number, number>();
  const nodeAt = (col: number, row: number): number => {
    const key = row * 4096 + col;
    const known = indexOf.get(key);
    if (known !== undefined) return known;
    nodes.push({ col, row });
    indexOf.set(key, nodes.length - 1);
    return nodes.length - 1;
  };
  const onRoad = new Map<Road, number[]>();
  for (const a of across) {
    for (const d of down) {
      // A street that ends at another only touches it, so meeting is touching or overlapping.
      const meets = d.c0 <= a.c1 && d.c1 >= a.c0 && a.r0 <= d.r1 && a.r1 >= d.r0;
      if (!meets) continue;
      const index = nodeAt(middleOf(d), middleOf(a));
      onRoad.set(a, [...(onRoad.get(a) ?? []), index]);
      onRoad.set(d, [...(onRoad.get(d) ?? []), index]);
    }
  }
  const edges: Edge[] = [];
  const seen = new Set<string>();
  for (const [road, indices] of onRoad) {
    const along = (index: number): number => (road.horizontal ? nodes[index].col : nodes[index].row);
    const ordered = [...new Set(indices)].sort((p, q) => along(p) - along(q));
    for (let k = 1; k < ordered.length; k++) {
      const [a, b] = [ordered[k - 1], ordered[k]];
      const key = `${a}-${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ a, b, horizontal: road.horizontal, trunk: widthOf(road) >= TRUNK_WIDTH_TILES });
    }
  }
  return { nodes, edges };
}

class Components {
  private readonly parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }

  find(index: number): number {
    let root = index;
    while (this.parent[root] !== root) root = this.parent[root];
    this.parent[index] = root;
    return root;
  }

  /** True if the two were apart and now are not. */
  join(a: number, b: number): boolean {
    const [ra, rb] = [this.find(a), this.find(b)];
    if (ra === rb) return false;
    this.parent[ra] = rb;
    return true;
  }
}

/** The whole stretch between an edge's crossings, or `share` of it from one end. */
function tunnelBetween(nodes: readonly Crossing[], edge: Edge, kind: Tunnel['kind'], share = 1, fromEnd = false): Tunnel {
  const a = nodes[edge.a];
  const b = nodes[edge.b];
  const [lo, hi] = edge.horizontal ? [a.col, b.col] : [a.row, b.row];
  const reach = Math.max(1, Math.round((hi - lo) * share));
  return {
    horizontal: edge.horizontal,
    line: edge.horizontal ? a.row : a.col,
    from: fromEnd ? hi - reach : lo,
    to: fromEnd ? hi : lo + reach,
    kind,
  };
}

/** Which of the lattice's stretches are open, which are half-open dead ends. `edgesUsed` are the open ones. */
function layTunnels(rng: Rng, nodes: readonly Crossing[], edges: readonly Edge[]): { tunnels: Tunnel[]; edgesUsed: Edge[] } {
  const parts = new Components(nodes.length);
  const tunnels: Tunnel[] = [];
  const edgesUsed: Edge[] = [];
  const open = (edge: Edge, kind: Tunnel['kind']): void => {
    tunnels.push(tunnelBetween(nodes, edge, kind));
    edgesUsed.push(edge);
  };
  // The avenues first: the trunk, which makes the spine everything else hangs off.
  for (const edge of edges.filter((e) => e.trunk)) {
    parts.join(edge.a, edge.b);
    open(edge, 'trunk');
  }
  const shut: Edge[] = [];
  for (const edge of shuffle(rng, edges.filter((e) => !e.trunk))) {
    if (parts.join(edge.a, edge.b)) open(edge, 'branch');
    else shut.push(edge);
  }
  for (const edge of shut) {
    if (rng() < LOOP_ODDS) {
      open(edge, 'loop');
    } else if (rng() < STUB_ODDS) {
      const share = STUB_SHARE[0] + rng() * (STUB_SHARE[1] - STUB_SHARE[0]);
      tunnels.push(tunnelBetween(nodes, edge, 'dead_end', share, rng() < 0.5));
    }
  }
  return { tunnels, edgesUsed };
}

/** Side passages: from the middle of a tunnel, away from the street, ending in a sump chamber. */
function sidePassages(rng: Rng, tunnels: readonly Tunnel[], cols: number, rows: number): { tunnels: Tunnel[]; chambers: Crossing[] } {
  const side: Tunnel[] = [];
  const chambers: Crossing[] = [];
  for (const tunnel of tunnels) {
    const fitsOne = tunnel.to - tunnel.from >= 16;
    if (!fitsOne || rng() >= SIDE_ODDS) continue;
    const at = randInt(rng, tunnel.from + 6, tunnel.to - 6);
    const away = rng() < 0.5 ? -1 : 1;
    const length = randInt(rng, SIDE_LENGTH[0], SIDE_LENGTH[1]);
    const end = tunnel.line + away * (TUNNEL_HALF + length);
    const reach = tunnel.horizontal ? rows : cols;
    const half = (CHAMBER_TILES + 1) / 2;
    const fits = end - half > 1 && end + half < reach - 1;
    if (!fits) continue;
    const [lo, hi] = away < 0 ? [end, tunnel.line] : [tunnel.line, end];
    side.push({ horizontal: !tunnel.horizontal, line: at, from: lo, to: hi, kind: 'side' });
    chambers.push(tunnel.horizontal ? { col: at, row: end } : { col: end, row: at });
  }
  return { tunnels: side, chambers };
}

const farFrom = (chosen: readonly Crossing[], spot: Crossing): boolean => chosen.every((other) => Math.hypot(other.col - spot.col, other.row - spot.row) >= MIN_SPACING_TILES);

/** 6 to 8 crossings: one in each quadrant that has one, then extras from anywhere, all well apart. */
function chooseNodes(rng: Rng, candidates: readonly number[], nodes: readonly Crossing[], cols: number, townRows: number): number[] {
  const quadrantOf = (index: number): number => (nodes[index].col < cols / 2 ? 0 : 1) + (nodes[index].row < townRows / 2 ? 0 : 2);
  const chosen: number[] = [];
  const spots = (): Crossing[] => chosen.map((index) => nodes[index]);
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const here = candidates.filter((index) => quadrantOf(index) === quadrant && farFrom(spots(), nodes[index]));
    const hasNone = here.length === 0;
    if (!hasNone) chosen.push(pick(rng, here));
  }
  const wanted = MIN_MANHOLES + Math.floor(rng() * (MAX_MANHOLES - MIN_MANHOLES + 1));
  while (chosen.length < wanted) {
    const left = candidates.filter((index) => !chosen.includes(index) && farFrom(spots(), nodes[index]));
    const hasNone = left.length === 0;
    if (hasNone) break;
    chosen.push(pick(rng, left));
  }
  return chosen.sort((a, b) => nodes[a].col - nodes[b].col || nodes[a].row - nodes[b].row);
}

/** The street tile a crossing's manhole can take: on the junction's south edge, free of anything standing. */
function shaftTile(node: Crossing, isFree: (col: number, row: number) => boolean): Crossing | null {
  for (const [dc, dr] of SHAFT_OFFSETS) {
    const spot = { col: node.col + dc, row: node.row + dr };
    if (isFree(spot.col, spot.row)) return spot;
  }
  return null;
}

/**
 * Plans the sewers: the maze under the streets, and the manholes that lead down to it. Deterministic in the
 * seed and the streets, plus whatever `isFree` says about the tiles.
 */
export function planSewers(seed: number, roads: readonly Road[], cols: number, townRows: number, options: SewerOptions = {}): SewerPlan {
  const rng = createRng(seed ^ SEWER_SALT);
  const top = options.top ?? townRows + SEWER_GAP_TILES;
  const isFree = options.isFree ?? (() => true);
  const { nodes, edges } = latticeOf(roads);
  const laid = layTunnels(rng, nodes, edges);
  // Manholes go over crossings the open tunnels join into one maze, so every one of them leads to every other.
  const parts = new Components(nodes.length);
  const reached = new Set<number>();
  for (const edge of laid.edgesUsed) {
    parts.join(edge.a, edge.b);
    reached.add(edge.a).add(edge.b);
  }
  const sizes = new Map<number, number>();
  for (const index of reached) sizes.set(parts.find(index), (sizes.get(parts.find(index)) ?? 0) + 1);
  const biggest = [...sizes.entries()].sort((p, q) => q[1] - p[1] || p[0] - q[0])[0]?.[0];
  const shafts = new Map<number, Crossing>();
  for (const index of reached) {
    const spot = parts.find(index) === biggest ? shaftTile(nodes[index], isFree) : null;
    if (spot) shafts.set(index, spot);
  }
  const picked = chooseNodes(rng, [...shafts.keys()], nodes, cols, townRows);
  const manholes: Manhole[] = picked.map((node) => ({ ...(shafts.get(node) as Crossing), node }));
  const side = sidePassages(rng, laid.tunnels.filter((t) => t.kind !== 'dead_end'), cols, townRows);
  return { manholes, nodes, tunnels: [...laid.tunnels, ...side.tunnels], chambers: side.chambers, top };
}

const tileCentre = (col: number, row: number): { x: number; y: number } => ({ x: (col + 0.5) * TILE_SIZE, y: (row + 0.5) * TILE_SIZE });

/** The sewer tile in front of a manhole's ladder: where a climber stands at the foot of it, and comes out. */
export function ladderTile(plan: Pick<SewerPlan, 'top'>, manhole: Pick<Manhole, 'col' | 'row'>): { col: number; row: number } {
  return { col: manhole.col, row: manhole.row + plan.top };
}

/** The brick pillar the ladder is bolted to: the tile north of its foot. */
export function pillarTile(plan: Pick<SewerPlan, 'top'>, manhole: Pick<Manhole, 'col' | 'row'>): { col: number; row: number } {
  const foot = ladderTile(plan, manhole);
  return { col: foot.col, row: foot.row - 1 };
}

/** The manhole covers, the ladders under them, and the two flights each pair makes. */
export function sewerCrossings(plan: SewerPlan, cols: number): { props: PropInstance[]; flights: ManholeFlight[]; ladders: PropInstance[] } {
  const props: PropInstance[] = [];
  const ladders: PropInstance[] = [];
  const flights: ManholeFlight[] = [];
  for (const manhole of plan.manholes) {
    const foot = ladderTile(plan, manhole);
    props.push({ kind: 'manhole', x: (manhole.col + 0.5) * TILE_SIZE, y: (manhole.row + 1) * TILE_SIZE });
    // The ladder is bolted to the pillar's south face and rises over it. Its base is a little way into the foot's
    // tile, but still north of where anyone stands there, so it is drawn behind the climber and never over them.
    ladders.push({ kind: 'sewer_ladder', x: (foot.col + 0.5) * TILE_SIZE, y: foot.row * TILE_SIZE + LADDER_BASE_PX });
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

/** One tunnel's tiles, as column and row spans that are inclusive. */
function spanOf(tunnel: Tunnel): { c0: number; c1: number; r0: number; r1: number } {
  return tunnel.horizontal
    ? { c0: tunnel.from - TUNNEL_HALF, c1: tunnel.to + TUNNEL_HALF, r0: tunnel.line - TUNNEL_HALF, r1: tunnel.line + TUNNEL_HALF }
    : { c0: tunnel.line - TUNNEL_HALF, c1: tunnel.line + TUNNEL_HALF, r0: tunnel.from - TUNNEL_HALF, r1: tunnel.to + TUNNEL_HALF };
}

/**
 * Paints the maze into a band that is all rock: each tunnel's walkway, its canal down the middle, then a
 * wall of brick round the lot, a tile thick, which stands between the tunnels and the rock behind.
 */
function paintMaze(annex: MapBuilder, plan: SewerPlan): void {
  const offset = plan.top;
  const floor = new Set<number>();
  const canal = new Set<number>();
  const key = (col: number, row: number): number => row * annex.cols + col;
  const carve = (c0: number, c1: number, r0: number, r1: number, into: Set<number>): void => {
    for (let row = r0; row <= r1; row++) {
      for (let col = Math.max(0, c0); col <= Math.min(annex.cols - 1, c1); col++) into.add(key(col, row + offset));
    }
  };
  for (const tunnel of plan.tunnels) {
    const { c0, c1, r0, r1 } = spanOf(tunnel);
    carve(c0, c1, r0, r1, floor);
  }
  for (const chamber of plan.chambers) {
    const half = (CHAMBER_TILES - 1) / 2;
    carve(chamber.col - half, chamber.col + half, chamber.row - half, chamber.row + half, floor);
  }
  for (const tunnel of plan.tunnels) {
    const isSide = tunnel.kind === 'side';
    if (isSide) continue;
    if (tunnel.horizontal) carve(tunnel.from, tunnel.to, tunnel.line, tunnel.line, canal);
    else carve(tunnel.line, tunnel.line, tunnel.from, tunnel.to, canal);
  }
  const isFloor = (col: number, row: number): boolean => col >= 0 && row >= 0 && col < annex.cols && row < annex.rows && floor.has(key(col, row));
  for (let row = offset; row < annex.rows; row++) {
    for (let col = 0; col < annex.cols; col++) {
      if (isFloor(col, row)) {
        annex.setTile(col, row, canal.has(key(col, row)) ? 'floor_sewer_channel' : 'floor_sewer');
        continue;
      }
      const touches = [-1, 0, 1].some((dr) => [-1, 0, 1].some((dc) => isFloor(col + dc, row + dr)));
      annex.setTile(col, row, touches ? 'sewer_wall' : 'void');
    }
  }
}

/** Lamps down the tunnels: the dim green of the emergency lights every so often, and one in each sump. */
function lampsOf(plan: SewerPlan): MapLight[] {
  const green = '#46d98a';
  const lamps: MapLight[] = [];
  for (const tunnel of plan.tunnels) {
    for (let at = tunnel.from + 5; at <= tunnel.to - 5; at += 14) {
      const centre = tunnel.horizontal ? tileCentre(at, tunnel.line + plan.top) : tileCentre(tunnel.line, at + plan.top);
      lamps.push({ x: centre.x, y: centre.y, radius: 150, color: green, flicker: tunnel.kind === 'dead_end' });
    }
  }
  for (const chamber of plan.chambers) {
    const centre = tileCentre(chamber.col, chamber.row + plan.top);
    lamps.push({ x: centre.x, y: centre.y, radius: 150, color: green, flicker: true });
  }
  return lamps;
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
 * then dark, then the maze, one tile of it for each tile of the town above. A map with no street to put a
 * manhole in is left as it was.
 */
export function withSewers(town: WorldMap, roads: readonly Road[]): WorldMap {
  const surfaceRows = town.townRows ?? town.rows;
  const def = BUILDING_DEFS.sewer_maze;
  const fitsBand = town.width === def.w && surfaceRows * TILE_SIZE === def.h;
  if (!fitsBand) return town;
  const blocked = blockedTiles(town);
  const clear = (col: number, row: number): boolean => {
    // Room to walk up to it from the north and the sides: the junction's south edge is the kerb, so nothing is south of it.
    const reaches = [[0, 0], [1, 0], [-1, 0], [0, -1]].every(([dc, dr]) => isRoad(town, col + dc, row + dr) && !blocked[(row + dr) * town.cols + col + dc]);
    return reaches && row < surfaceRows;
  };
  const top = town.rows + SEWER_GAP_TILES;
  const plan = planSewers(town.seed, roads, town.cols, surfaceRows, { top, isFree: clear });
  const hasNoManholes = plan.manholes.length === 0;
  if (hasNoManholes) return town;
  const rows = top + surfaceRows;
  const annex = new MapBuilder(town.cols, rows, createRng(town.seed ^ SEWER_SALT), town.spawn);
  annex.tiles.set(town.tiles);
  annex.fill({ x0: 0, y0: town.height, x1: town.width, y1: rows * TILE_SIZE }, 'void');
  paintMaze(annex, plan);
  for (const manhole of plan.manholes) {
    const pillar = pillarTile(plan, manhole);
    annex.setTile(pillar.col, pillar.row, 'sewer_wall');
  }
  const { props, flights, ladders } = sewerCrossings(plan, town.cols);
  const underground: District[] = plan.manholes.map((manhole) => {
    const foot = ladderTile(plan, manhole);
    const above = tileCentre(manhole.col, manhole.row);
    const name = districtNear(town.districts, above.x, above.y);
    const at = tileCentre(foot.col, foot.row);
    return { name: name ? `Sewers under ${name}` : 'Sewers', x: at.x, y: at.y, underground: true };
  });
  const maze: BuildingInstance = { id: 'sewers', kind: 'sewer_maze', x: 0, y: top * TILE_SIZE, variant: 0, of: SEWERS_OF };
  return {
    ...town,
    height: rows * TILE_SIZE,
    rows,
    townRows: surfaceRows,
    tiles: annex.tiles,
    props: [...town.props, ...props, ...ladders],
    buildings: [...town.buildings, maze],
    districts: [...town.districts, ...underground],
    flights,
    sewers: { top, lamps: lampsOf(plan) },
  };
}
