import { generateWorldMap, tileKindAt } from '../../shared/world-map.ts';
import { BUILDING_DEFS, TILE_SIZE } from '../../shared/protocol.ts';
import type { TileKind, WorldMap } from '../../shared/protocol.ts';
import type { ArtBook, PixelSprite } from '../art/types.ts';
import { tileVariant } from '../engine/tile-layer.ts';
import { propSprite } from '../engine/car-looks.ts';
import { paintBuilding } from './map-buildings.ts';
import { paintGround, paintScenery } from './map-ground.ts';
import { TILE_RGB } from './town-map.ts';

/** The magazine's snapshots: the game's own tiles and sprites, posed on a patch of ground and baked to one sprite. */
export type PhotoName =
  | 'cover'
  | 'vanRoad'
  | 'aiming'
  | 'gunshot'
  | 'quiet'
  | 'stockroom'
  | 'searching'
  | 'crowd'
  | 'vanPanorama'
  | 'workshop'
  | 'squad'
  | 'town';

export type MagazinePhotos = Readonly<Record<PhotoName, PixelSprite>>;

interface Placed {
  readonly sprite: PixelSprite;
  readonly x: number;
  readonly y: number;
}

type GroundPick = (col: number, row: number) => TileKind;

/** A town that lays out well for a picture. Any seed would do: this one is simply the one in the photo. */
const POSTCARD_SEED = 1986;
const TOWN_CLIP_W = 288;
const TOWN_CLIP_H = 200;

const SOUTH = 2;
const EAST = 0;
const WEST = 4;
const NORTH = 6;

function blit(rgba: Uint8ClampedArray, width: number, height: number, { sprite, x, y }: Placed): void {
  const left = Math.round(x - sprite.ax);
  const top = Math.round(y - sprite.ay);
  for (let row = 0; row < sprite.h; row += 1) {
    const toY = top + row;
    const rowOnPhoto = toY >= 0 && toY < height;
    if (!rowOnPhoto) continue;
    for (let col = 0; col < sprite.w; col += 1) {
      const toX = left + col;
      const from = (row * sprite.w + col) * 4;
      const shows = sprite.rgba[from + 3] !== 0 && toX >= 0 && toX < width;
      if (shows) rgba.set(sprite.rgba.subarray(from, from + 4), (toY * width + toX) * 4);
    }
  }
}

/** Lays the ground, then stands everything on it back to front, like the game does. */
export function composeScene(
  art: ArtBook,
  width: number,
  height: number,
  ground: GroundPick,
  items: readonly Placed[],
  offsetX = 0,
  offsetY = 0,
): PixelSprite {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const firstCol = Math.floor(offsetX / TILE_SIZE);
  const firstRow = Math.floor(offsetY / TILE_SIZE);
  for (let row = firstRow; row * TILE_SIZE < offsetY + height; row += 1) {
    for (let col = firstCol; col * TILE_SIZE < offsetX + width; col += 1) {
      const variants = art.environment.tiles[ground(col, row)];
      const sprite = variants[tileVariant(col, row, POSTCARD_SEED, variants.length)];
      blit(rgba, width, height, { sprite: { ...sprite, ax: 0, ay: 0 }, x: col * TILE_SIZE - offsetX, y: row * TILE_SIZE - offsetY });
    }
  }
  const backToFront = [...items].sort((a, b) => a.y - b.y);
  for (const item of backToFront) blit(rgba, width, height, { ...item, x: item.x - offsetX, y: item.y - offsetY });
  return { w: width, h: height, ax: 0, ay: 0, rgba };
}

/** A real clip of a generated town, buildings, props and all. */
export function townClip(art: ArtBook, map: WorldMap, centerX: number, centerY: number, width: number, height: number): PixelSprite {
  const left = Math.max(0, Math.min(map.width - width, Math.round(centerX - width / 2)));
  const top = Math.max(0, Math.min(map.height - height, Math.round(centerY - height / 2)));
  const reach = (x: number, y: number) => x > left - 260 && x < left + width + 260 && y > top - 100 && y < top + height + 200;
  const buildings = map.buildings.map((building) => {
    const facades = art.environment.buildings[building.kind];
    const { w, h } = BUILDING_DEFS[building.kind];
    return { sprite: facades[building.variant % facades.length], x: building.x + w / 2, y: building.y + h };
  });
  const props = map.props.map((prop) => ({ sprite: propSprite(art, prop), x: prop.x, y: prop.y }));
  const near = [...buildings, ...props].filter((item) => reach(item.x, item.y));
  const clamp = (value: number, most: number) => Math.max(0, Math.min(most - 1, value));
  const ground: GroundPick = (col, row) => tileKindAt(map, clamp(col, map.cols), clamp(row, map.rows));
  return composeScene(art, width, height, ground, near, left, top);
}

/** A road running across the picture, with the kerbs and verges a real street gets. */
function streetGround(roadTop: number, roadRows: number, verge: TileKind): GroundPick {
  const bands = new Map<number, TileKind>([
    [-2, 'sidewalk'],
    [-1, 'curb_s'],
    [roadRows, 'curb_n'],
    [roadRows + 1, 'sidewalk'],
  ]);
  for (let row = 0; row < roadRows; row += 1) bands.set(row, 'asphalt');
  bands.set(Math.floor(roadRows / 2), 'lane_h');
  return (_col, row) => bands.get(row - roadTop) ?? verge;
}

const survivorIdle = (art: ArtBook, who: number, dir: number) => art.survivors[who].weapons.pistol.idle[dir].frames[0];
const survivorFiring = (art: ArtBook, who: number, dir: number) => art.survivors[who].weapons.pistol.fire[dir].frames[0];
const walker = (art: ArtBook, dir: number, frame = 0) => art.zombies.walker.walk[dir].frames[frame];
const runner = (art: ArtBook, dir: number, frame = 0) => art.zombies.runner.walk[dir].frames[frame];

function vanRoad(art: ArtBook): PixelSprite {
  const { props, escapeVan } = art.environment;
  return composeScene(art, 176, 144, streetGround(3, 5, 'grass'), [
    { sprite: props.tree, x: 30, y: 30 },
    { sprite: props.street_lamp, x: 128, y: 34 },
    { sprite: props.bush, x: 90, y: 26 },
    { sprite: escapeVan, x: 112, y: 92 },
    { sprite: props.barrier, x: 150, y: 70 },
    { sprite: survivorIdle(art, 0, EAST), x: 62, y: 102 },
    { sprite: walker(art, EAST), x: 16, y: 86 },
    { sprite: walker(art, EAST, 1), x: 6, y: 112 },
    { sprite: props.rubble, x: 36, y: 128 },
    { sprite: props.hydrant, x: 150, y: 136 },
  ]);
}

function gunshot(art: ArtBook): PixelSprite {
  const { props } = art.environment;
  return composeScene(art, 176, 160, streetGround(4, 5, 'sidewalk'), [
    { sprite: props.dumpster, x: 26, y: 46 },
    { sprite: props.street_lamp, x: 144, y: 44 },
    { sprite: survivorFiring(art, 1, EAST), x: 84, y: 96 },
    { sprite: walker(art, EAST), x: 16, y: 84 },
    { sprite: runner(art, WEST), x: 158, y: 112 },
    { sprite: walker(art, NORTH), x: 96, y: 156 },
    { sprite: walker(art, SOUTH, 1), x: 118, y: 40 },
    { sprite: props.car_wreck_h, x: 30, y: 142 },
  ]);
}

function aiming(art: ArtBook): PixelSprite {
  const { props } = art.environment;
  return composeScene(art, 176, 112, streetGround(2, 5, 'grass'), [
    { sprite: props.bush, x: 26, y: 12 },
    { sprite: survivorFiring(art, 2, EAST), x: 54, y: 76 },
    { sprite: walker(art, WEST), x: 128, y: 76 },
    { sprite: art.ui.crosshairHead, x: 126, y: 52 },
    { sprite: props.hydrant, x: 150, y: 106 },
  ]);
}

function quiet(art: ArtBook): PixelSprite {
  const { props } = art.environment;
  return composeScene(art, 176, 104, streetGround(1, 4, 'grass'), [
    { sprite: props.dumpster, x: 46, y: 84 },
    { sprite: survivorIdle(art, 0, WEST), x: 80, y: 92 },
    { sprite: walker(art, WEST), x: 150, y: 44 },
    { sprite: walker(art, WEST, 1), x: 118, y: 56 },
    { sprite: walker(art, WEST), x: 34, y: 48 },
  ]);
}

function stockroom(art: ArtBook): PixelSprite {
  const { containers, ui } = art;
  const ground: GroundPick = () => 'floor_tile';
  return composeScene(art, 160, 96, ground, [
    { sprite: containers.shelf.opened, x: 30, y: 42 },
    { sprite: containers.shelf.closed, x: 76, y: 42 },
    { sprite: containers.locker.opened, x: 118, y: 42 },
    { sprite: containers.fridge.closed, x: 142, y: 42 },
    { sprite: survivorIdle(art, 4, NORTH), x: 72, y: 84 },
    { sprite: ui.pickupIcons.shells, x: 28, y: 70 },
    { sprite: ui.pickupIcons.medkit, x: 118, y: 72 },
    { sprite: ui.pickupIcons.pistol_ammo, x: 136, y: 84 },
  ]);
}

function searching(art: ArtBook): PixelSprite {
  const { containers } = art;
  const ground: GroundPick = () => 'floor_wood';
  return composeScene(art, 160, 112, ground, [
    { sprite: containers.fridge.opened, x: 26, y: 46 },
    { sprite: containers.shelf.closed, x: 70, y: 46 },
    { sprite: containers.locker.closed, x: 116, y: 46 },
    { sprite: art.environment.props.table, x: 132, y: 100 },
    { sprite: survivorIdle(art, 4, NORTH), x: 32, y: 84 },
    { sprite: art.ui.pickupIcons.bandage, x: 58, y: 80 },
  ]);
}

function crowd(art: ArtBook): PixelSprite {
  const { props } = art.environment;
  const horde: Placed[] = [];
  for (let index = 0; index < 22; index += 1) {
    const x = 12 + ((index * 53) % 196);
    const y = 42 + ((index * 37) % 100);
    const sprite = index % 5 === 3 ? runner(art, SOUTH, index % 2) : walker(art, SOUTH, index % 2);
    horde.push({ sprite, x, y });
  }
  return composeScene(art, 220, 150, streetGround(1, 7, 'grass'), [
    ...horde,
    { sprite: art.zombies.brute.walk[SOUTH].frames[0], x: 150, y: 96 },
    { sprite: art.zombies.bloater.walk[SOUTH].frames[0], x: 66, y: 84 },
    { sprite: props.car_sedan_h, x: 196, y: 140 },
  ]);
}

function vanPanorama(art: ArtBook): PixelSprite {
  const { props, escapeVan } = art.environment;
  return composeScene(art, 400, 224, streetGround(5, 6, 'grass'), [
    { sprite: props.tree, x: 40, y: 34 },
    { sprite: props.tree, x: 356, y: 40 },
    { sprite: props.street_lamp, x: 150, y: 56 },
    { sprite: props.street_lamp, x: 300, y: 56 },
    { sprite: props.fence_h, x: 210, y: 34 },
    { sprite: props.fence_h, x: 242, y: 34 },
    { sprite: escapeVan, x: 200, y: 136 },
    { sprite: survivorIdle(art, 2, WEST), x: 238, y: 142 },
    { sprite: walker(art, EAST), x: 150, y: 128 },
    { sprite: walker(art, EAST, 1), x: 140, y: 150 },
    { sprite: runner(art, EAST), x: 110, y: 138 },
    { sprite: props.car_wreck_h, x: 60, y: 118 },
    { sprite: props.sandbags, x: 316, y: 120 },
    { sprite: props.rubble, x: 350, y: 168 },
    { sprite: props.barrier, x: 50, y: 188 },
    { sprite: props.hydrant, x: 276, y: 206 },
    { sprite: props.bush, x: 380, y: 214 },
    { sprite: props.bush, x: 18, y: 214 },
  ]);
}

function workshop(art: ArtBook): PixelSprite {
  const { containers } = art;
  const ground: GroundPick = () => 'floor_concrete';
  return composeScene(art, 144, 96, ground, [
    { sprite: containers.bench.closed, x: 52, y: 44 },
    { sprite: containers.shelf.opened, x: 112, y: 44 },
    { sprite: survivorIdle(art, 3, NORTH), x: 54, y: 82 },
    { sprite: art.ui.pickupIcons.toolkit, x: 104, y: 74 },
    { sprite: art.ui.pickupIcons.barrel, x: 20, y: 72 },
  ]);
}

function squad(art: ArtBook): PixelSprite {
  const { props } = art.environment;
  return composeScene(art, 208, 144, () => 'grass', [
    { sprite: props.tree, x: 34, y: 56 },
    { sprite: props.tree, x: 180, y: 50 },
    { sprite: props.fire_barrel, x: 104, y: 60 },
    { sprite: survivorIdle(art, 0, SOUTH), x: 76, y: 88 },
    { sprite: survivorIdle(art, 3, SOUTH), x: 104, y: 92 },
    { sprite: survivorIdle(art, 4, SOUTH), x: 132, y: 88 },
    { sprite: walker(art, EAST), x: 22, y: 112 },
    { sprite: walker(art, WEST, 1), x: 188, y: 118 },
    { sprite: props.bush, x: 104, y: 136 },
  ]);
}

function cover(art: ArtBook): PixelSprite {
  const { props, escapeVan } = art.environment;
  return composeScene(art, 256, 144, streetGround(3, 5, 'grass'), [
    { sprite: props.tree, x: 22, y: 36 },
    { sprite: props.street_lamp, x: 100, y: 36 },
    { sprite: props.tree, x: 232, y: 34 },
    { sprite: escapeVan, x: 192, y: 84 },
    { sprite: walker(art, EAST), x: 14, y: 84 },
    { sprite: walker(art, EAST, 1), x: 34, y: 104 },
    { sprite: runner(art, EAST), x: 10, y: 122 },
    { sprite: survivorIdle(art, 0, SOUTH), x: 74, y: 118 },
    { sprite: survivorIdle(art, 1, SOUTH), x: 100, y: 124 },
    { sprite: survivorIdle(art, 2, SOUTH), x: 126, y: 118 },
    { sprite: survivorIdle(art, 3, SOUTH), x: 152, y: 124 },
    { sprite: survivorIdle(art, 4, SOUTH), x: 178, y: 118 },
  ]);
}

export function worldMapPhoto(map: WorldMap): PixelSprite {
  const width = map.cols;
  const height = map.townRows ?? map.rows;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  paintGround(ctx, map, { width, height, tilePx: 1, textured: true }, (kind) => TILE_RGB[kind]);
  paintScenery(ctx, map.props, 1);
  for (const building of map.buildings) {
    const box = {
      x0: Math.round(building.x / TILE_SIZE),
      y0: Math.round(building.y / TILE_SIZE),
      x1: Math.round((building.x + BUILDING_DEFS[building.kind].w) / TILE_SIZE),
      y1: Math.round((building.y + BUILDING_DEFS[building.kind].h) / TILE_SIZE),
    };
    const doorPx = Math.round(BUILDING_DEFS[building.kind].doorX / TILE_SIZE);
    paintBuilding(ctx, box, building.kind, doorPx, Math.round(building.x) ^ Math.round(building.y));
  }
  const imgData = ctx.getImageData(0, 0, width, height);
  return { w: width, h: height, ax: 0, ay: 0, rgba: imgData.data };
}

function town(art: ArtBook, map?: WorldMap): PixelSprite {
  const targetMap = map ?? generateWorldMap(POSTCARD_SEED);
  return worldMapPhoto(targetMap);
}

const developed = new WeakMap<ArtBook, MagazinePhotos>();

/** Every snapshot the magazine prints, developed once per art book. */
export function magazinePhotos(art: ArtBook, currentMap?: WorldMap): MagazinePhotos {
  if (currentMap) {
    return {
      cover: cover(art),
      vanRoad: vanRoad(art),
      aiming: aiming(art),
      gunshot: gunshot(art),
      quiet: quiet(art),
      stockroom: stockroom(art),
      searching: searching(art),
      crowd: crowd(art),
      vanPanorama: vanPanorama(art),
      workshop: workshop(art),
      squad: squad(art),
      town: town(art, currentMap),
    };
  }
  let photos = developed.get(art);
  if (!photos) {
    photos = {
      cover: cover(art),
      vanRoad: vanRoad(art),
      aiming: aiming(art),
      gunshot: gunshot(art),
      quiet: quiet(art),
      stockroom: stockroom(art),
      searching: searching(art),
      crowd: crowd(art),
      vanPanorama: vanPanorama(art),
      workshop: workshop(art),
      squad: squad(art),
      town: town(art),
    };
    developed.set(art, photos);
  }
  return photos;
}
