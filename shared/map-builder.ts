import { BUILDING_DEFS, PROP_DEFS, TILE_KINDS, TILE_SIZE } from './protocol.ts';
import type { BuildingInstance, BuildingKind, PropInstance, PropKind, TileKind } from './protocol.ts';
import { isPlant, needsDirt, TEMPERATE } from './biomes.ts';
import type { Biome, SpeciesSlot } from './biomes.ts';
import { pick, randInt, randRange } from './rng.ts';
import type { Rng } from './rng.ts';
import { buildingBox } from './world-query.ts';
import type { Box } from './world-query.ts';

/** Solids keep this far apart, so every gap holds one whole free tile and fits a brute. */
export const SOLID_GAP = 32;
/** The fence stands this far in from the map's edge, and nothing solid may leave a sliver between it and itself. */
const FENCE_OUTER_EDGE = 10;
const FENCE_CLEARANCE = 40;
/** Nothing solid may stand this close to map.spawn. */
export const SPAWN_CLEARANCE = 104;

const TILE_INDEX = Object.fromEntries(TILE_KINDS.map((kind, index) => [kind, index])) as Record<TileKind, number>;
const FACADE_VARIANTS = 4;

/** Mutable working state of one map generation. */
export class MapBuilder {
  readonly cols: number;
  readonly rows: number;
  readonly rng: Rng;
  readonly tiles: Uint8Array;
  readonly props: PropInstance[] = [];
  readonly buildings: BuildingInstance[] = [];
  readonly spawn: { readonly x: number; readonly y: number };
  readonly biome: Biome;
  private readonly solids: Box[] = [];

  constructor(cols: number, rows: number, rng: Rng, spawn: { x: number; y: number }, biome: Biome = TEMPERATE) {
    this.biome = biome;
    this.cols = cols;
    this.rows = rows;
    this.rng = rng;
    this.spawn = spawn;
    this.tiles = new Uint8Array(cols * rows);
  }

  setTile(col: number, row: number, kind: TileKind): void {
    const inside = col >= 0 && row >= 0 && col < this.cols && row < this.rows;
    if (inside) this.tiles[row * this.cols + col] = TILE_INDEX[kind];
  }

  tileIs(col: number, row: number, kind: TileKind): boolean {
    return this.tiles[row * this.cols + col] === TILE_INDEX[kind];
  }

  /** Paints a pixel rectangle, which must be tile aligned. */
  fill(area: Box, kind: TileKind): void {
    for (let row = area.y0 / TILE_SIZE; row < area.y1 / TILE_SIZE; row++) {
      for (let col = area.x0 / TILE_SIZE; col < area.x1 / TILE_SIZE; col++) this.setTile(col, row, kind);
    }
  }

  /** Paints a ragged disc over any tiles of kind `over`. */
  blob(x: number, y: number, radius: number, kind: TileKind, over: TileKind | readonly TileKind[]): void {
    const settles = ([] as readonly TileKind[]).concat(over);
    const minCol = Math.floor((x - radius) / TILE_SIZE);
    const maxCol = Math.ceil((x + radius) / TILE_SIZE);
    const minRow = Math.floor((y - radius) / TILE_SIZE);
    const maxRow = Math.ceil((y + radius) / TILE_SIZE);
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const distance = Math.hypot((col + 0.5) * TILE_SIZE - x, (row + 0.5) * TILE_SIZE - y);
        const raggedRadius = radius * randRange(this.rng, 0.7, 1.1);
        const inside = col >= 0 && row >= 0 && col < this.cols && row < this.rows;
        const settlesHere = inside && distance < raggedRadius && settles.some((ground) => this.tileIs(col, row, ground));
        if (settlesHere) this.setTile(col, row, kind);
      }
    }
  }

  /** Adds a prop at its footprint's bottom centre unless that crowds the spawn or another solid. */
  place(kind: PropKind, x: number, y: number, gap = SOLID_GAP): boolean {
    const def = PROP_DEFS[kind];
    const box: Box = { x0: x - def.w / 2, y0: y - def.h, x1: x + def.w / 2, y1: y };
    const onMap = box.x0 >= 0 && box.y0 >= 0 && box.x1 <= this.cols * TILE_SIZE && box.y1 <= this.rows * TILE_SIZE;
    if (!onMap) return false;
    const isFlatProp = def.h === 0;
    if (isFlatProp) {
      const isIndoors = this.insideBuilding(x, y);
      if (isIndoors) return false;
      this.props.push({ kind, x, y });
      return true;
    }
    const isCrowded = this.crowdsSpawn(box) || this.crowdsSolid(box, gap) || this.crowdsFence(box);
    if (isCrowded) return false;
    this.solids.push(box);
    this.props.push({ kind, x, y });
    return true;
  }

  /** Adds a prop that planned its own spacing, such as furniture and the fence. */
  fixture(kind: PropKind, x: number, y: number): void {
    this.props.push({ kind, x, y });
  }

  /** Keeps later props out of an area without putting anything in it. */
  reserve(area: Box): void {
    this.solids.push(area);
  }

  /** Lays out a footprint at a tile position; walls come from the instance. */
  addBuilding(kind: BuildingKind, col: number, row: number): BuildingInstance {
    const building: BuildingInstance = {
      id: `b${this.buildings.length + 1}`,
      kind,
      x: col * TILE_SIZE,
      y: row * TILE_SIZE,
      variant: randInt(this.rng, 0, FACADE_VARIANTS - 1),
    };
    const box = buildingBox(building);
    this.buildings.push(building);
    this.fill(box, BUILDING_DEFS[kind].floor);
    this.reserve(box);
    return building;
  }

  /** Tries to drop `count` props at random inside an area, keeping whole footprints inside it. */
  /** A solid that leaves a sliver between itself and the fence would strand it, and the repair then takes the fence down. */
  private crowdsFence(box: Box): boolean {
    const near = (low: number, high: number, size: number): boolean => {
      const nearLow = high > FENCE_OUTER_EDGE && low < FENCE_CLEARANCE;
      const nearHigh = low < size - FENCE_OUTER_EDGE && high > size - FENCE_CLEARANCE;
      return nearLow || nearHigh;
    };
    return near(box.x0, box.x1, this.cols * TILE_SIZE) || near(box.y0, box.y1, this.rows * TILE_SIZE);
  }

  /** The species the biome grows where the map asks for `kind`: oaks here are dead trunks there. */
  species(kind: PropKind): PropKind {
    const options = this.biome.swap[kind as SpeciesSlot];
    return options ? pick(this.rng, options) : kind;
  }

  /** Scatters a plant as the biome grows it: its own species, as thick as it grows them. Other props go through as they are. */
  flora(kind: PropKind, area: Box, count: number, gap = SOLID_GAP, onlyOn?: TileKind): void {
    const total = isPlant(kind) ? Math.ceil(count * this.biome.lush) : count;
    for (let i = 0; i < total; i++) {
      const species = this.species(kind);
      this.scatter(species, area, 1, gap, needsDirt(species) ? 'dirt' : onlyOn);
    }
  }

  scatter(kind: PropKind, area: Box, count: number, gap = SOLID_GAP, onlyOn?: TileKind): void {
    const { w, h } = PROP_DEFS[kind];
    for (let placed = 0, tries = 0; placed < count && tries < count * 6; tries++) {
      const x = Math.round(randRange(this.rng, area.x0 + w / 2, area.x1 - w / 2));
      const y = Math.round(randRange(this.rng, area.y0 + h, area.y1));
      const allowed = !onlyOn || this.tileIs(Math.floor(x / TILE_SIZE), Math.floor((y - 1) / TILE_SIZE), onlyOn);
      const wasPlaced = allowed && this.place(kind, x, y, gap);
      if (wasPlaced) placed++;
    }
  }

  /** Walk-through scenery has no footprint to crowd anything with, but it is outdoor scenery. */
  private insideBuilding(x: number, y: number): boolean {
    return this.buildings.some((building) => {
      const { x0, y0, x1, y1 } = buildingBox(building);
      return x >= x0 && x <= x1 && y >= y0 && y <= y1;
    });
  }

  private crowdsSpawn(box: Box): boolean {
    const dx = this.spawn.x - Math.max(box.x0, Math.min(this.spawn.x, box.x1));
    const dy = this.spawn.y - Math.max(box.y0, Math.min(this.spawn.y, box.y1));
    return Math.hypot(dx, dy) < SPAWN_CLEARANCE;
  }

  private crowdsSolid(box: Box, gap: number): boolean {
    return this.solids.some(
      (other) =>
        box.x0 < other.x1 + gap && box.x1 > other.x0 - gap && box.y0 < other.y1 + gap && box.y1 > other.y0 - gap,
    );
  }
}
