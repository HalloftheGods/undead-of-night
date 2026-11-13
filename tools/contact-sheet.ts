// Renders the art book to a PNG so it can be judged by eye.
//   node --experimental-strip-types tools/contact-sheet.ts <group> <outfile.png> [scale] [filter]
// group: survivors | costumes | zombies | environment | containers | fx | ui | kits | all | reference | scene | scene-night | town
// filter: keep only rows whose label contains this text, e.g. "skin0/pistol/walk".
// For town it is a crop instead, "x,y,w,h" in town pixels.
// costumes: every survivor in every costume, the default first for comparison, with rows labelled
// survivor/costume/weapon/clip (plus survivor/costume/portraits, /downed and /dead), e.g.
// "night/aurora/pistol/idle". A filter of "rex/" keeps one survivor, "rex/purple/" one costume,
// "pistol/walk" one clip across all of them. Only the rows the filter keeps are drawn. "all"
// leaves costumes out. Example:
//   node --experimental-strip-types tools/contact-sheet.ts costumes out.png 4 night/aurora/ asphalt
// ground (optional 5th argument): "flat" (default) keeps the grey sheet background 0x3a3c4c, where
// every outline pixel is visible. "asphalt" lays the game's road tiles behind each row of the row-based
// groups, so edges can be judged on the ground figures stand on. It does not change scene, scene-night
// or town, which draw their own ground. Example:
//   node --experimental-strip-types tools/contact-sheet.ts survivors out.png 4 skin0/pistol/idle asphalt
// Each row shows a 1x strip under its label, for a read at true size.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildArtBook } from '../src/art/index.ts';
import { referenceWalker } from '../src/art/zombies.ts';
import type { ArtBook, Clip, DirClips, PixelSprite, SurvivorArt, SurvivorWeaponArt } from '../src/art/types.ts';
import { characterOf, costumesOf } from '../shared/characters.ts';
import { WEAPON_ORDER } from '../shared/protocol.ts';
import { KIT_ORDER } from '../shared/round-effect-data.ts';
import { encodePng } from './png.ts';
import { renderScene } from './scene.ts';
import { drawSprite, drawText, Sheet } from './sheet.ts';
import { renderTown } from './town.ts';

const DIR_NAMES = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
const WEAPON_CLIPS: readonly (keyof SurvivorWeaponArt)[] = ['idle', 'walk', 'fire', 'reload'];
const BACKGROUND = 0x3a3c4c;
const LABEL_COLUMN = 180;
const MAX_WIDTH = 1800;
const TILE_PX = 16;

type Ground = 'flat' | 'asphalt';

interface Group {
  readonly tag: string;
  readonly sprites: readonly PixelSprite[];
}

interface Row {
  readonly label: string;
  readonly groups: readonly Group[];
}

const dirRow = (label: string, clips: DirClips): Row => ({
  label,
  groups: clips.map((clip, dir) => ({ tag: DIR_NAMES[dir], sprites: clip.frames })),
});

const clipRow = (label: string, clip: Clip): Row => ({ label, groups: [{ tag: '', sprites: clip.frames }] });

const spriteRow = (label: string, sprites: readonly PixelSprite[]): Row => ({ label, groups: [{ tag: '', sprites }] });

/** A row whose sprites are drawn when the sheet lays it out, so the filter skips the rest unbuilt. */
const lazyRow = (label: string, groups: () => readonly Group[]): Row => ({
  label,
  get groups() {
    return groups();
  },
});

function survivorRows(book: ArtBook): Row[] {
  return book.survivors.flatMap((art, skin) => [
    ...WEAPON_ORDER.flatMap((id) => {
      const weapon = art.weapons[id];
      return [
        dirRow(`skin${skin}/${id}/idle`, weapon.idle),
        dirRow(`skin${skin}/${id}/walk`, weapon.walk),
        dirRow(`skin${skin}/${id}/fire`, weapon.fire),
        dirRow(`skin${skin}/${id}/reload`, weapon.reload),
      ];
    }),
    clipRow(`skin${skin}/downed`, art.downed),
    clipRow(`skin${skin}/dead`, art.dead),
  ]);
}

/** One survivor in one costume: portraits, every weapon clip, then the falls. */
function wornRows(prefix: string, record: () => SurvivorArt): Row[] {
  const clips = WEAPON_ORDER.flatMap((weapon) =>
    WEAPON_CLIPS.map((clip) => lazyRow(`${prefix}/${weapon}/${clip}`, () => dirRow('', record().weapons[weapon][clip]).groups)),
  );
  return [
    lazyRow(`${prefix}/portraits`, () => spriteRow('', record().portraits).groups),
    ...clips,
    lazyRow(`${prefix}/downed`, () => clipRow('', record().downed).groups),
    lazyRow(`${prefix}/dead`, () => clipRow('', record().dead).groups),
  ];
}

/** Every survivor in every costume, default first, labelled by the roster's ids. */
function costumeRows(book: ArtBook): Row[] {
  return book.survivors.flatMap((own, skin) =>
    costumesOf(skin).flatMap((costume, index) => wornRows(`${characterOf(skin).id}/${costume.id}`, () => own.costumes[index])),
  );
}

function zombieRows(book: ArtBook): Row[] {
  return Object.entries(book.zombies).flatMap(([type, art]) => [
    dirRow(`${type}/walk`, art.walk),
    dirRow(`${type}/attack`, art.attack),
    clipRow(`${type}/death`, art.death),
  ]);
}

function environmentRows(book: ArtBook): Row[] {
  const { tiles, props, buildings, interior, barrelFire, campFire, overrun } = book.environment;
  return [
    ...Object.entries(tiles).map(([kind, variants]) => spriteRow(`tile/${kind}`, variants)),
    ...Object.entries(props).map(([kind, sprite]) => spriteRow(`prop/${kind}`, [sprite])),
    ...Object.entries(buildings).map(([kind, variants]) => spriteRow(`building/${kind}`, variants)),
    spriteRow('overrun/blast_door', [props.blast_door, overrun.doorBuckling, overrun.doorBurst]),
    spriteRow('overrun/chest', [props.chest, overrun.chestOpen]),
    spriteRow('interior', Object.values(interior)),
    clipRow('barrelFire', barrelFire),
    clipRow('campFire', campFire),
  ];
}

/** Each searchable look, shut then searched. */
function containerRows(book: ArtBook): Row[] {
  return Object.entries(book.containers).map(([look, { closed, opened }]) => spriteRow(`container/${look}`, [closed, opened]));
}

function fxRows(book: ArtBook): Row[] {
  const { fx, pickups } = book;
  return [
    ...WEAPON_ORDER.map((id) => dirRow(`muzzle/${id}`, fx.muzzle[id])),
    dirRow('tracer', fx.tracer),
    clipRow('bulletImpact', fx.bulletImpact),
    clipRow('bloodBurst', fx.bloodBurst),
    spriteRow('bloodDecals', fx.bloodDecals),
    clipRow('acidBurst', fx.acidBurst),
    spriteRow('acidDecals', fx.acidDecals),
    clipRow('smokePuff', fx.smokePuff),
    spriteRow('shells', [fx.shellCasing, fx.shotgunShell]),
    ...Object.entries(pickups).map(([type, clip]) => clipRow(`pickup/${type}`, clip)),
  ];
}

function uiRows(book: ArtBook): Row[] {
  const { ui } = book;
  return [
    spriteRow('crosshair', [ui.crosshair, ui.crosshairHead]),
    spriteRow('weaponIcons', WEAPON_ORDER.map((id) => ui.weaponIcons[id])),
    spriteRow('pickupIcons', Object.values(ui.pickupIcons)),
    spriteRow('heart+skull', [ui.heart, ui.skull]),
    spriteRow('logo', [ui.logo]),
  ];
}

/** The four round kits as they lie on the floor and as the workbench icons draw them. */
function kitRows(book: ArtBook): Row[] {
  return [
    ...KIT_ORDER.map((kit) => clipRow(`pickup/${kit}`, book.pickups[kit])),
    spriteRow('kitIcons', KIT_ORDER.map((kit) => book.ui.pickupIcons[kit])),
  ];
}

function referenceRows(): Row[] {
  const { idle, walk } = referenceWalker();
  return [spriteRow('walker/idle S', [idle]), spriteRow('walker/walk S', walk.frames)];
}

const ROW_GROUPS: Readonly<Record<string, (book: ArtBook) => Row[]>> = {
  survivors: survivorRows,
  costumes: costumeRows,
  zombies: zombieRows,
  environment: environmentRows,
  containers: containerRows,
  fx: fxRows,
  ui: uiRows,
  kits: kitRows,
  reference: referenceRows,
  all: (book) => [...survivorRows(book), ...zombieRows(book), ...environmentRows(book), ...containerRows(book), ...fxRows(book), ...uiRows(book)],
};

function rowsFor(group: string, book: ArtBook): Row[] {
  const rows = Object.hasOwn(ROW_GROUPS, group) ? ROW_GROUPS[group] : undefined;
  if (!rows) throw new Error(`Unknown sheet "${group}"`);
  return rows(book);
}

interface Placed {
  readonly sprite: PixelSprite;
  readonly x: number;
  readonly y: number;
}

interface Laid {
  readonly placed: readonly Placed[];
  readonly tags: readonly { readonly text: string; readonly x: number; readonly y: number }[];
  readonly height: number;
}

/** Flows a row's sprites left to right, wrapping at MAX_WIDTH. Coordinates are relative to the row. */
function layoutRow(row: Row, scale: number): Laid {
  const gap = 2 * scale;
  const groupGap = 6 * scale;
  const tagHeight = row.groups.some((group) => group.tag) ? 8 : 0;
  const placed: Placed[] = [];
  const tags: { text: string; x: number; y: number }[] = [];
  let x = LABEL_COLUMN;
  let y = 4;
  let lineHeight = 0;
  for (const group of row.groups) {
    const groupWidth = group.sprites.reduce((sum, sprite) => sum + sprite.w * scale + gap, 0);
    const groupWraps = x > LABEL_COLUMN && x + groupWidth > MAX_WIDTH;
    if (groupWraps) {
      x = LABEL_COLUMN;
      y += lineHeight + 4;
      lineHeight = 0;
    }
    if (group.tag) tags.push({ text: group.tag, x, y });
    for (const sprite of group.sprites) {
      const spriteWraps = x > LABEL_COLUMN && x + sprite.w * scale > MAX_WIDTH;
      if (spriteWraps) {
        x = LABEL_COLUMN;
        y += lineHeight + 4;
        lineHeight = 0;
      }
      placed.push({ sprite, x, y: y + tagHeight });
      x += sprite.w * scale + gap;
      lineHeight = Math.max(lineHeight, sprite.h * scale + tagHeight);
    }
    x += groupGap;
  }
  return { placed, tags, height: y + lineHeight + 6 };
}

/** Lays the road tiles over one row's band, at the sheet scale, never past the band. */
function paintGround(sheet: Sheet, tiles: readonly PixelSprite[], y: number, height: number, scale: number): void {
  const step = TILE_PX * scale;
  for (let ty = 0; ty * step < height; ty++) {
    for (let tx = 0; tx * step < sheet.w; tx++) {
      const sprite = tiles[(tx * 7 + ty * 3) % tiles.length];
      for (let j = 0; j < step && ty * step + j < height; j++) {
        for (let i = 0; i < step && tx * step + i < sheet.w; i++) {
          const at = (Math.floor(j / scale) * sprite.w + Math.floor(i / scale)) * 4;
          sheet.set(tx * step + i, y + ty * step + j, (sprite.rgba[at] << 16) | (sprite.rgba[at + 1] << 8) | sprite.rgba[at + 2]);
        }
      }
    }
  }
}

function renderRows(rows: readonly Row[], scale: number, ground: Ground = 'flat', book?: ArtBook): Sheet {
  const laid = rows.map((row) => layoutRow(row, scale));
  const width = Math.max(
    LABEL_COLUMN + 40,
    ...laid.flatMap((row) => row.placed.map((item) => item.x + item.sprite.w * scale + 8)),
  );
  // Tall enough for the label and its 1x strip.
  const heights = laid.map((row, i) => Math.max(row.height, 14 + Math.max(...rows[i].groups.flatMap((g) => g.sprites.map((s) => s.h))) + 6));
  const sheet = new Sheet(width, heights.reduce((sum, h) => sum + h, 4), BACKGROUND);
  let y = 4;
  laid.forEach((row, i) => {
    const paintsAsphalt = ground === 'asphalt' && book !== undefined;
    if (paintsAsphalt) paintGround(sheet, book.environment.tiles.asphalt, y, heights[i], scale);
    drawText(sheet, rows[i].label.toUpperCase(), 4, y + 4, 0xfaf2d4);
    let strip = 4;
    for (const sprite of rows[i].groups.flatMap((group) => group.sprites)) {
      const stripFull = strip + sprite.w > LABEL_COLUMN - 4;
      if (stripFull) break;
      drawSprite(sheet, sprite, strip, y + 14, 1);
      strip += sprite.w + 1;
    }
    for (const tag of row.tags) drawText(sheet, tag.text, tag.x, y + tag.y, 0xa8a492);
    for (const item of row.placed) drawSprite(sheet, item.sprite, item.x, y + item.y, scale);
    sheet.hline(0, y + heights[i] - 1, width, 0x2c2e3a);
    y += heights[i];
  });
  return sheet;
}

function main(): void {
  const [group, outfile, scaleArg, filter, groundArg] = process.argv.slice(2);
  const knownGround = groundArg === undefined || groundArg === 'flat' || groundArg === 'asphalt';
  if (!knownGround) {
    console.error(`unknown ground "${groundArg}": use flat or asphalt`);
    process.exit(1);
  }
  const ground: Ground = groundArg === 'asphalt' ? 'asphalt' : 'flat';
  const missingArgs = !group || !outfile;
  if (missingArgs) {
    console.error('usage: contact-sheet.ts <survivors|costumes|zombies|environment|containers|fx|ui|kits|all|reference|scene|scene-night|town> <outfile.png> [scale] [filter] [flat|asphalt]');
    process.exit(1);
  }
  const started = performance.now();
  const book = buildArtBook();
  const buildMs = performance.now() - started;
  const isScene = group === 'scene' || group === 'scene-night';
  const isTown = group === 'town';
  const defaultScale = isTown ? 1 : 4;
  const scale = Number(scaleArg ?? (isScene ? 3 : defaultScale));
  let sheet: Sheet;
  if (isScene) {
    sheet = renderScene(book, scale, group === 'scene-night');
  } else if (isTown) {
    sheet = renderTown(book, scale, filter);
  } else {
    const rows = rowsFor(group, book).filter((row) => !filter || row.label.includes(filter));
    const noneMatch = rows.length === 0;
    if (noneMatch) throw new Error(`No rows match "${filter}"`);
    sheet = renderRows(rows, scale, ground, book);
  }
  mkdirSync(dirname(outfile), { recursive: true });
  writeFileSync(outfile, encodePng(sheet.w, sheet.h, sheet.data));
  process.stdout.write(`${outfile} ${sheet.w}x${sheet.h}, art book built in ${buildMs.toFixed(0)}ms\n`);
}

main();
