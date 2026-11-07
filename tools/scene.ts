// A mock street at game scale, so art can be judged in context rather than on a grid.
// The night mode approximates the game's lighting pass (moon ambient read from the engine, the viewer's
// aura, the haze add-back, and shadows blended the engine's way); the client's renderer is the real one,
// and lamp pools and the beam here are still hand-placed guesses.

import { TILE_SIZE } from '../shared/protocol.ts';
import type { BuildingKind, PropKind, TileKind, WeaponId, ZombieType } from '../shared/protocol.ts';
import type { ArtBook, PixelSprite } from '../src/art/types.ts';
import { NIGHT_AMBIENT } from '../src/engine/lighting.ts';
import { drawSprite, Sheet } from './sheet.ts';

/** The engine's shadow: rgba(4, 5, 10, 0.42), see SHADOW_ALPHA in src/engine/entity-renderer.ts. */
const SHADOW_ALPHA = 0.42;
const SHADOW_RGB = [4, 5, 10] as const;
/** The engine's HAZE in src/engine/lighting.ts: the light itself added back at this strength. */
const HAZE = 0.11;
/** The viewer's own glow: #b8a488 at 0.62, radius 38 (copied values, not imported). */
const AURA = { radius: 38, r: (0xb8 / 255) * 0.62, g: (0xa4 / 255) * 0.62, b: (0x88 / 255) * 0.62 };
const VIEWER = { x: 218, y: 186 };

const WIDTH = 480;
const HEIGHT = 270;
const COLS = WIDTH / TILE_SIZE;
const ROWS = Math.ceil(HEIGHT / TILE_SIZE);

function tileAt(col: number, row: number): TileKind {
  const isTopSidewalk = row <= 7;
  if (isTopSidewalk) return col >= 21 && col < 25 && row >= 3 ? 'dirt' : 'sidewalk';
  const isNorthCurb = row === 8;
  if (isNorthCurb) return 'curb_n';
  const isSouthCurb = row === 14;
  if (isSouthCurb) return 'curb_s';
  const isBottomVerge = row > 14;
  if (isBottomVerge) return col < 7 ? 'grass' : 'sidewalk';
  const isCrosswalk = col >= 13 && col < 15;
  if (isCrosswalk) return 'crosswalk_v';
  const isLaneRow = row === 11;
  if (isLaneRow) return col % 2 === 0 ? 'lane_h' : 'asphalt';
  const isParkingLine = row === 9 && col >= 3 && col < 9;
  if (isParkingLine) return 'parking_line';
  return (col * 7 + row * 3) % 5 === 0 ? 'asphalt_cracked' : 'asphalt';
}

/** Kind, facade, then the centre of the footprint's south edge. */
const BUILDINGS: readonly (readonly [BuildingKind, number, number, number])[] = [
  ['pharmacy', 0, 76, 112], ['house', 1, 232, 112], ['gun_shop', 0, 392, 100],
];

const PROPS: readonly (readonly [PropKind, number, number])[] = [
  ['street_lamp', 160, 124], ['hydrant', 196, 126], ['dumpster', 306, 122], ['crate_stack', 334, 124],
  ['tree', 40, 250], ['bush', 90, 246], ['tree', 450, 255], ['street_lamp', 300, 244],
  ['car_sedan_h', 76, 166], ['car_wreck_h', 150, 196], ['van_h', 390, 176], ['car_sedan_v', 300, 190],
  ['barrier', 250, 228], ['sandbags', 180, 256], ['fire_barrel', 236, 148], ['rubble', 350, 216],
];

const SURVIVORS: readonly (readonly [number, WeaponId, number, number, number])[] = [
  [0, 'pistol', 2, 218, 186], [1, 'carbine', 0, 248, 200], [2, 'shotgun', 1, 200, 214], [3, 'pistol', 4, 262, 170],
  [4, 'pistol', 0, 282, 212],
];

const ZOMBIES: readonly (readonly [ZombieType, number, number, number])[] = [
  ['walker', 4, 330, 206], ['walker', 3, 346, 164], ['runner', 4, 306, 150], ['bloater', 3, 372, 214],
  ['brute', 4, 366, 150], ['walker', 2, 216, 140], ['runner', 2, 176, 158], ['walker', 0, 120, 222],
];

interface Actor {
  readonly y: number;
  readonly shadow: number;
  readonly sprite: PixelSprite;
  readonly x: number;
}

function place(sheet: Sheet, sprite: PixelSprite, x: number, y: number): void {
  drawSprite(sheet, sprite, x - sprite.ax, y - sprite.ay, 1);
}

/** Alpha-blends one flat colour over a pixel, like canvas source-over. */
function blend(sheet: Sheet, x: number, y: number, rgb: readonly number[], alpha: number): void {
  const insideSheet = x >= 0 && y >= 0 && x < sheet.w && y < sheet.h;
  if (!insideSheet) return;
  const i = (y * sheet.w + x) * 4;
  for (let c = 0; c < 3; c++) sheet.data[i + c] = sheet.data[i + c] * (1 - alpha) + rgb[c] * alpha;
}

function groundShadow(sheet: Sheet, x: number, y: number, rx: number): void {
  const ry = Math.max(2, rx * 0.4);
  for (let j = -ry; j <= ry; j++) {
    for (let i = -rx; i <= rx; i++) {
      const insideShadow = (i * i) / (rx * rx) + (j * j) / (ry * ry) <= 1;
      if (insideShadow) blend(sheet, Math.round(x + i), Math.round(y + j), SHADOW_RGB, SHADOW_ALPHA);
    }
  }
}

function buildActors(book: ArtBook): Actor[] {
  const buildings = BUILDINGS.map(([kind, variant, x, y]) => ({ x, y, sprite: book.environment.buildings[kind][variant], shadow: 0 }));
  const props = PROPS.map(([kind, x, y]) => ({ x, y, sprite: book.environment.props[kind], shadow: 0 }));
  const survivors = SURVIVORS.map(([skin, weapon, dir, x, y]) => ({
    x, y, shadow: 7, sprite: book.survivors[skin].weapons[weapon].walk[dir].frames[0],
  }));
  const zombies = ZOMBIES.map(([type, dir, x, y]) => ({
    x, y, shadow: type === 'brute' ? 11 : 7, sprite: book.zombies[type].walk[dir].frames[0],
  }));
  const flames = PROPS.filter(([kind]) => kind === 'fire_barrel').map(([, x, y]) => ({
    x, y: y + 1, shadow: 0, sprite: book.environment.barrelFire.frames[0],
  }));
  return [...buildings, ...props, ...survivors, ...zombies, ...flames].sort((a, b) => a.y - b.y);
}

interface Pool {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const POOLS: readonly Pool[] = [
  { x: 160, y: 118, radius: 90, r: 1, g: 0.86, b: 0.62 },
  { x: 300, y: 238, radius: 80, r: 1, g: 0.86, b: 0.62 },
  { x: 236, y: 140, radius: 60, r: 1, g: 0.6, b: 0.3 },
];

/** How much of a light reaches a point, in three hard steps like a banded pixel-art light. */
function band(t: number): number {
  const isNearLight = t < 0.45;
  if (isNearLight) return 1;
  const isMidLight = t < 0.75;
  if (isMidLight) return 0.65;
  return t < 1 ? 0.35 : 0;
}

function flashlight(x: number, y: number): number {
  const dx = x - 218;
  const dy = y - 186;
  return Math.abs(Math.atan2(dy, dx)) < 0.5 ? band(Math.hypot(dx, dy) / 170) : 0;
}

/** Multiplies the scene by dark blue, then lifts it back inside lamp pools and the flashlight cone. */
function nightPass(sheet: Sheet): void {
  const ambient = { r: NIGHT_AMBIENT[0] / 255, g: NIGHT_AMBIENT[1] / 255, b: NIGHT_AMBIENT[2] / 255 };
  for (let y = 0; y < sheet.h; y++) {
    for (let x = 0; x < sheet.w; x++) {
      let r = ambient.r;
      let g = ambient.g;
      let b = ambient.b;
      for (const pool of POOLS) {
        const light = band(Math.hypot(x - pool.x, (y - pool.y) * 1.3) / pool.radius);
        r = Math.max(r, light * pool.r);
        g = Math.max(g, light * pool.g);
        b = Math.max(b, light * pool.b);
      }
      const beam = flashlight(x, y);
      r = Math.max(r, beam);
      g = Math.max(g, beam * 0.96);
      b = Math.max(b, beam * 0.86);
      const aura = band(Math.hypot(x - VIEWER.x, y - VIEWER.y) / AURA.radius);
      r = Math.max(r, aura * AURA.r);
      g = Math.max(g, aura * AURA.g);
      b = Math.max(b, aura * AURA.b);
      const at = (y * sheet.w + x) * 4;
      sheet.data[at] = sheet.data[at] * r + 255 * r * HAZE;
      sheet.data[at + 1] = sheet.data[at + 1] * g + 255 * g * HAZE;
      sheet.data[at + 2] = sheet.data[at + 2] * b + 255 * b * HAZE;
    }
  }
}

export function renderScene(book: ArtBook, scale: number, night: boolean): Sheet {
  const scene = new Sheet(WIDTH, HEIGHT, 0);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const variants = book.environment.tiles[tileAt(col, row)];
      drawSprite(scene, variants[(col * 3 + row * 5) % variants.length], col * TILE_SIZE, row * TILE_SIZE, 1);
    }
  }
  const decals = [...book.fx.bloodDecals, ...book.fx.acidDecals];
  decals.forEach((decal, i) => place(scene, decal, 280 + i * 28, 196 + (i % 2) * 18));
  const pickups = Object.values(book.pickups);
  pickups.forEach((clip, i) => place(scene, clip.frames[0], 130 + i * 30, 234));
  const actors = buildActors(book);
  for (const actor of actors) {
    const castsShadow = actor.shadow > 0;
    if (castsShadow) groundShadow(scene, actor.x, actor.y, actor.shadow);
    place(scene, actor.sprite, actor.x, actor.y);
  }
  if (night) nightPass(scene);
  return scene.scaled(scale);
}
