import { townContainers } from '../../shared/containers.ts';
import { isBunkerMap } from '../../shared/home-protocol.ts';
import { isStorey } from '../../shared/storeys.ts';
import { groundOf } from '../../shared/world-query.ts';
import { BUILDING_DEFS, TILE_KINDS, TILE_SIZE } from '../../shared/protocol.ts';
import type { BuildingInstance, BuildingKind, DropView, EntityId, ExitEntity, PlayerEntity, TileKind, WorldMap } from '../../shared/protocol.ts';
import { drawOutlinedText, FONT_HEIGHT, textWidth } from '../engine/bitmap-font.ts';
import { drawCursor } from './map-cursor.ts';
import type { CursorClock } from './map-cursor.ts';
import { isLandmark } from './run-notices.ts';

/** Map pixels per world tile. 200 tiles makes a 400px map, which scales up by whole numbers. */
const TILE_PX = 2;
const WORLD_PER_PX = TILE_SIZE / TILE_PX;
/** The bunker is 40 tiles across, so it can afford to be drawn big enough to carry its room names. */
const BUNKER_TILE_PX = 6;
const BUNKER_FLOOR: readonly [number, number, number] = [70, 58, 46];
const BUNKER_WALL: readonly [number, number, number] = [22, 20, 24];
const STATION_COLOR = '#ffb066';
/** What the bunker map's one colour means: the machines you hold E at. The rooms are named on the map itself. */
export const BUNKER_LEGEND: readonly (readonly [string, string])[] = [[STATION_COLOR, 'Stations']];

const ROAD: readonly [number, number, number] = [40, 41, 47];
const PAVEMENT: readonly [number, number, number] = [62, 62, 66];
const TILE_RGB: Record<TileKind, readonly [number, number, number]> = {
  asphalt: ROAD,
  asphalt_cracked: ROAD,
  lane_h: ROAD,
  lane_v: ROAD,
  crosswalk_h: ROAD,
  crosswalk_v: ROAD,
  parking_line: ROAD,
  sidewalk: PAVEMENT,
  curb_n: PAVEMENT,
  curb_s: PAVEMENT,
  curb_e: PAVEMENT,
  curb_w: PAVEMENT,
  grass: [30, 44, 30],
  dirt: [44, 38, 28],
  water: [24, 44, 62],
  snow: [150, 158, 170],
  ash: [48, 44, 42],
  sludge: [58, 66, 28],
  floor_wood: PAVEMENT,
  floor_tile: PAVEMENT,
  floor_concrete: PAVEMENT,
  floor_carpet: PAVEMENT,
  bunker_wall: [26, 26, 32],
  void: [0, 0, 0],
};

const MEDICAL = '#b04a42';
const ARMS = '#c8923a';
const LAW = '#4a78a8';
const FOOD = '#5c9450';
const WORK = '#86745a';
const HOMES = '#4c4c56';
const DROP_COLOR = '#e0463a';
export const EXIT_COLOR = '#ffc03c';

const BUILDING_COLOR: Record<BuildingKind, string> = {
  pharmacy: MEDICAL,
  clinic: MEDICAL,
  police: LAW,
  gun_shop: ARMS,
  grocery: FOOD,
  discount: FOOD,
  diner: FOOD,
  garage: WORK,
  warehouse: WORK,
  house: HOMES,
  apartment: HOMES,
  upstairs: HOMES,
  cellar: HOMES,
  apartment_upstairs: HOMES,
};

/** What the colours mean, for the key beside the map. */
export const TOWN_LEGEND: readonly (readonly [string, string])[] = [
  [MEDICAL, 'Medical'],
  [LAW, 'Police'],
  [ARMS, 'Guns'],
  [WORK, 'Garages and yards'],
  [FOOD, 'Food'],
  [HOMES, 'Homes'],
  [EXIT_COLOR, 'The van, once it comes'],
  [DROP_COLOR, 'A supply drop'],
];

const EDGE_COLOR = '#0b0c10';
const DISTRICT_COLOR = '#938d7a';
const LABEL_COLOR = '#e4dcc3';
export const TICK_COLOR = '#b6e04a';
export const CROSS_COLOR = '#e0463a';
const TEAM_COLOR = '#e8a33d';
const DOWNED_COLOR = '#e0463a';

const TICK_PIXELS: readonly (readonly [number, number])[] = [[0, 2], [1, 3], [2, 2], [3, 1], [4, 0]];
/** Label positions tried in turn around a building until one is clear. */
const LABEL_NUDGES: readonly number[] = [0, 7, -7, 14, -14];

interface LabelBox {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

function overlaps(a: LabelBox, b: LabelBox): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/** What a tile looks like on the map: the town's greys, or the bunker's warm floor and dark walls. */
function tileColor(map: WorldMap, kind: TileKind): readonly [number, number, number] {
  if (!isBunkerMap(map)) return TILE_RGB[kind];
  return kind === 'bunker_wall' ? BUNKER_WALL : BUNKER_FLOOR;
}

function paintTiles(ctx: CanvasRenderingContext2D, map: WorldMap, width: number, height: number, tilePx: number): void {
  const image = ctx.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    const row = Math.floor(y / tilePx) * map.cols;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = tileColor(map, TILE_KINDS[map.tiles[row + Math.floor(x / tilePx)]]);
      image.data.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  ctx.putImageData(image, 0, 0);
}

function footprint(building: BuildingInstance): LabelBox {
  const { w, h } = BUILDING_DEFS[building.kind];
  const x0 = Math.round(building.x / WORLD_PER_PX);
  const y0 = Math.round(building.y / WORLD_PER_PX);
  return { x0, y0, x1: x0 + Math.round(w / WORLD_PER_PX), y1: y0 + Math.round(h / WORLD_PER_PX) };
}

function drawPixelLine(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
): void {
  ctx.fillStyle = color;
  let cx = x0;
  let cy = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    ctx.fillRect(cx, cy, 1, 1);
    const isAtEnd = cx === x1 && cy === y1;
    if (isAtEnd) break;
    const e2 = 2 * err;
    const shouldStepX = e2 > -dy;
    if (shouldStepX) {
      err -= dy;
      cx += sx;
    }
    const shouldStepY = e2 < dx;
    if (shouldStepY) {
      err += dx;
      cy += sy;
    }
  }
}

function paintBuildings(ctx: CanvasRenderingContext2D, map: WorldMap): void {
  for (const building of map.buildings) {
    const box = footprint(building);
    ctx.fillStyle = EDGE_COLOR;
    ctx.fillRect(box.x0 - 1, box.y0 - 1, box.x1 - box.x0 + 2, box.y1 - box.y0 + 2);
    ctx.fillStyle = BUILDING_COLOR[building.kind];
    ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  }
}

/** Writes text at the first spot that does not sit on an earlier label. True if it found one. */
function placeLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  color: string,
  placed: LabelBox[],
): boolean {
  const half = Math.ceil(textWidth(text) / 2) + 1;
  for (const nudge of LABEL_NUDGES) {
    const top = y + nudge;
    const box = { x0: centerX - half, y0: top - 1, x1: centerX + half, y1: top + FONT_HEIGHT + 1 };
    const onMap = box.x0 >= 0 && box.y0 >= 0 && box.x1 <= ctx.canvas.width && box.y1 <= ctx.canvas.height;
    const clear = onMap && !placed.some((other) => overlaps(box, other));
    if (clear) {
      placed.push(box);
      drawOutlinedText(ctx, text, centerX, top, color);
      return true;
    }
  }
  return false;
}

/** A cursor that holds still, with its full label: what a paint with no clock gets. */
const STEADY_CLOCK: CursorClock = { nowMs: 0, openedMs: 0, reducedMotion: true };

/** The town as a player would sketch it: streets, buildings by use, names, and where they have been. */
export class TownMapView {
  readonly width: number;
  readonly height: number;
  /** Map pixels per world tile. */
  readonly pixelsPerTile: number;
  /** The room names that found a clear place on the map, in the order the map lists them. */
  readonly roomLabels: string[] = [];
  private readonly worldPerPx: number;
  private readonly map: WorldMap;
  private readonly base: HTMLCanvasElement;
  private readonly visited = new Set<string>();
  private readonly opened = new Set<number>();
  private readonly buildingContainers = new Map<string, number[]>();

  constructor(map: WorldMap) {
    this.map = map;
    this.pixelsPerTile = isBunkerMap(map) ? BUNKER_TILE_PX : TILE_PX;
    this.worldPerPx = TILE_SIZE / this.pixelsPerTile;
    this.width = map.cols * this.pixelsPerTile;
    // The floors above and below lie under the town, off the edge of the map: everyone on one is drawn at their house.
    this.height = (map.townRows ?? map.rows) * this.pixelsPerTile;
    this.base = document.createElement('canvas');
    this.base.width = this.width;
    this.base.height = this.height;
    for (const container of townContainers(map)) {
      if (!container.building) continue;
      const list = this.buildingContainers.get(container.building);
      if (list) {
        list.push(container.id);
      } else {
        this.buildingContainers.set(container.building, [container.id]);
      }
    }
    this.paintBase();
  }

  private paintBase(): void {
    const ctx = this.base.getContext('2d')!;
    paintTiles(ctx, this.map, this.width, this.height, this.pixelsPerTile);
    paintBuildings(ctx, this.map);
    this.paintStations(ctx);
    const placed: LabelBox[] = [];
    for (const building of this.map.buildings) {
      const named = isLandmark(building.kind) && !isStorey(building);
      if (!named) continue;
      const box = footprint(building);
      placeLabel(ctx, BUILDING_DEFS[building.kind].label, Math.round((box.x0 + box.x1) / 2), box.y1 + 3, LABEL_COLOR, placed);
    }
    for (const district of this.map.districts) {
      const x = Math.round(district.x / this.worldPerPx);
      const y = Math.round(district.y / this.worldPerPx);
      const isLabelPlaced = placeLabel(ctx, district.name, x, y, DISTRICT_COLOR, placed);
      if (isLabelPlaced) this.roomLabels.push(district.name);
    }
  }

  /** A lamp-coloured dot where each bunker station stands. The town has none. */
  private paintStations(ctx: CanvasRenderingContext2D): void {
    for (const station of this.map.stations ?? []) {
      const x = Math.round(station.x / this.worldPerPx);
      const y = Math.round(station.y / this.worldPerPx);
      ctx.fillStyle = EDGE_COLOR;
      ctx.fillRect(x - 2, y - 2, 5, 5);
      ctx.fillStyle = STATION_COLOR;
      ctx.fillRect(x - 1, y - 1, 3, 3);
    }
  }

  /** The player has been inside. Reset by making a new view for a new run. */
  markVisited(id: string): void {
    this.visited.add(id);
  }

  clearVisited(): void {
    this.visited.clear();
  }

  hasVisited(id: string): boolean {
    return this.visited.has(id);
  }

  markOpened(id: number): void {
    this.opened.add(id);
  }

  syncOpened(ids: readonly number[]): void {
    for (const id of ids) this.opened.add(id);
  }

  clearOpened(): void {
    this.opened.clear();
  }

  isCleared(id: string): boolean {
    const beenInside = this.visited.has(id);
    if (!beenInside) return false;
    const containers = this.buildingContainers.get(id);
    const hasContainers = containers !== undefined && containers.length > 0;
    if (!hasContainers) return false;
    return containers.every((containerId) => this.opened.has(containerId));
  }

  building(id: string): BuildingInstance | null {
    return this.map.buildings.find((building) => building.id === id) ?? null;
  }

  private drawTick(ctx: CanvasRenderingContext2D, building: BuildingInstance): void {
    const box = footprint(building);
    const x = box.x1 - 7;
    const y = box.y0 + 1;
    ctx.fillStyle = EDGE_COLOR;
    ctx.fillRect(x - 1, y - 1, 7, 6);
    ctx.fillStyle = TICK_COLOR;
    for (const [dx, dy] of TICK_PIXELS) ctx.fillRect(x + dx, y + dy, 1, 1);
  }

  private drawCross(ctx: CanvasRenderingContext2D, building: BuildingInstance): void {
    const box = footprint(building);
    const left = box.x0;
    const right = box.x1 - 1;
    const top = box.y0;
    const bottom = box.y1 - 1;
    const seed = (Math.round(building.x) ^ Math.round(building.y)) & 1;

    drawPixelLine(ctx, left, top + 1, right, bottom + 1, EDGE_COLOR);
    drawPixelLine(ctx, right, top + 1, left, bottom + 1, EDGE_COLOR);

    drawPixelLine(ctx, left - seed, top, right + seed, bottom, CROSS_COLOR);
    drawPixelLine(ctx, right + seed, top, left - seed, bottom, CROSS_COLOR);

    const midX = Math.round((left + right) / 2);
    const midY = Math.round((top + bottom) / 2);
    ctx.fillStyle = CROSS_COLOR;
    ctx.fillRect(midX, midY, 2, 2);
  }

  private drawTeammate(ctx: CanvasRenderingContext2D, player: PlayerEntity): void {
    const at = groundOf(this.map, player.x, player.y);
    const x = Math.round(at.x / this.worldPerPx);
    const y = Math.round(at.y / this.worldPerPx);
    ctx.fillStyle = EDGE_COLOR;
    ctx.fillRect(x - 2, y - 2, 5, 5);
    ctx.fillStyle = player.status === 'alive' ? TEAM_COLOR : DOWNED_COLOR;
    ctx.fillRect(x - 1, y - 1, 3, 3);
  }

  /** A red box where the supply drop is coming down, or came down. */
  private drawDrop(ctx: CanvasRenderingContext2D, drop: DropView): void {
    const x = Math.round(drop.x / this.worldPerPx);
    const y = Math.round(drop.y / this.worldPerPx);
    ctx.fillStyle = EDGE_COLOR;
    ctx.fillRect(x - 4, y - 4, 9, 9);
    ctx.fillStyle = DROP_COLOR;
    ctx.fillRect(x - 3, y - 3, 7, 7);
    drawOutlinedText(ctx, drop.landed ? 'SUPPLIES' : 'DROP', x, y - 5 - FONT_HEIGHT, DROP_COLOR);
  }

  private drawExit(ctx: CanvasRenderingContext2D, exit: ExitEntity): void {
    const x = Math.round(exit.x / this.worldPerPx);
    const y = Math.round(exit.y / this.worldPerPx);
    ctx.fillStyle = EDGE_COLOR;
    ctx.fillRect(x - 5, y - 3, 11, 7);
    ctx.fillStyle = EXIT_COLOR;
    ctx.fillRect(x - 4, y - 2, 9, 5);
    drawOutlinedText(ctx, 'VAN', x, y - 4 - FONT_HEIGHT, EXIT_COLOR);
  }

  paint(
    ctx: CanvasRenderingContext2D,
    players: readonly PlayerEntity[],
    localId: EntityId | null,
    exit: ExitEntity | null = null,
    openedContainers: readonly number[] = [],
    drop: DropView | null = null,
    clock: CursorClock = STEADY_CLOCK,
  ): void {
    const hasOpenedContainers = openedContainers.length > 0;
    if (hasOpenedContainers) this.syncOpened(openedContainers);
    ctx.drawImage(this.base, 0, 0);
    for (const id of this.visited) {
      const building = this.building(id);
      if (!building) continue;
      if (this.isCleared(id)) this.drawCross(ctx, building);
      this.drawTick(ctx, building);
    }
    if (exit) this.drawExit(ctx, exit);
    if (drop) this.drawDrop(ctx, drop);
    const onMap = players.filter((player) => player.status !== 'dead');
    for (const player of onMap) {
      const isTeammate = player.id !== localId;
      if (isTeammate) this.drawTeammate(ctx, player);
    }
    // The local player goes last, so nobody's mark covers the cursor.
    const local = onMap.find((player) => player.id === localId);
    const hasLocal = local !== undefined;
    const here = hasLocal ? groundOf(this.map, local.x, local.y) : null;
    if (here) drawCursor(ctx, Math.round(here.x / this.worldPerPx), Math.round(here.y / this.worldPerPx), local!.angle, clock, this);
  }
}
