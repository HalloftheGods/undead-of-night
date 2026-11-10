import { describe, expect, it } from 'vitest';
import {
  BUILDING_DEFS,
  BUILDING_KINDS,
  DOOR_WIDTH,
  PROP_DEFS,
  PROP_KINDS,
  TILE_KINDS,
  TILE_SIZE,
} from '../shared/protocol.ts';
import type { TileKind } from '../shared/protocol.ts';
import { buildEnvironment } from '../src/art/environment.ts';
import { spriteToCanvas } from '../src/art/kit.ts';
import { RAMPS } from '../src/art/palette.ts';
import type { PixelSprite } from '../src/art/types.ts';

const environment = buildEnvironment();

type Edge = 'top' | 'bottom' | 'left' | 'right';

const FLOORS = ['floor_wood', 'floor_tile', 'floor_concrete', 'floor_carpet'] as const;
const FURNITURE = ['shelf', 'counter', 'table', 'sofa', 'bed', 'locker', 'fridge', 'workbench', 'gas_pump'] as const;
const SIDES = ['top', 'bottom', 'left', 'right'] as const;
const MIN_FACADES = { house: 3, apartment: 2, warehouse: 2 } as const;
const MAX_RISE = 28;
const MAX_BELOW_GROUND = 4;

function edge(sprite: PixelSprite, side: Edge): (number | null)[] {
  const canvas = spriteToCanvas(sprite);
  const last = TILE_SIZE - 1;
  return Array.from({ length: TILE_SIZE }, (_, i) => {
    if (side === 'top') return canvas.get(i, 0);
    if (side === 'bottom') return canvas.get(i, last);
    return canvas.get(side === 'left' ? 0 : last, i);
  });
}

/** Facing edges of any two variants must match pixel for pixel along a continuous marking. */
function seams(kind: TileKind, near: Edge, far: Edge): void {
  for (const a of environment.tiles[kind]) {
    for (const b of environment.tiles[kind]) expect(edge(a, near), kind).toEqual(edge(b, far));
  }
}

/** A curb keeps a stone joint on one side of the tile, so each side must agree across variants. */
function sameStone(kind: TileKind, sides: readonly Edge[], from: number, to: number): void {
  for (const side of sides) {
    const stones = environment.tiles[kind].map((tile) => edge(tile, side).slice(from, to));
    for (const stone of stones) expect(stone, `${kind} ${side}`).toEqual(stones[0]);
  }
}

/** Every shell of every kind, with a label a failure can name. */
// The sewers have no shell (nothing is drawn over a tunnel), so the shell contracts are for the buildings that do.
const SHELLS = BUILDING_KINDS.filter((kind) => !kind.startsWith('sewer_')).flatMap((kind) =>
  environment.buildings[kind].map((sprite, variant) => ({ kind, variant, sprite, label: `${kind}/${variant}` })),
);

const footprintLeft = (sprite: PixelSprite, w: number): number => sprite.ax - w / 2;

describe('environment tiles', () => {
  it('gives every kind two to four opaque variants', () => {
    for (const kind of TILE_KINDS) {
      const variants = environment.tiles[kind];
      expect(variants.length, kind).toBeGreaterThanOrEqual(2);
      expect(variants.length, kind).toBeLessThanOrEqual(4);
      for (const tile of variants) expect(edge(tile, 'top').includes(null), kind).toBe(false);
    }
  });

  it('keeps plain ground one colour along every edge', () => {
    for (const kind of ['asphalt', 'asphalt_cracked', 'grass', 'dirt'] as const) {
      for (const tile of environment.tiles[kind]) {
        for (const side of SIDES) {
          expect(new Set(edge(tile, side)).size, `${kind} ${side}`).toBe(1);
        }
      }
    }
  });

  it('runs markings unbroken across variants', () => {
    seams('crosswalk_h', 'left', 'right');
    seams('crosswalk_v', 'top', 'bottom');
    seams('parking_line', 'top', 'bottom');
    sameStone('curb_n', ['left', 'right'], 0, 6);
    sameStone('curb_s', ['left', 'right'], 9, 16);
    sameStone('curb_e', ['top', 'bottom'], 10, 16);
    sameStone('curb_w', ['top', 'bottom'], 0, 6);
  });

  it('gives every floor two or three fully opaque, distinct variants', () => {
    for (const kind of FLOORS) {
      const variants = environment.tiles[kind];
      expect(variants.length, kind).toBeGreaterThanOrEqual(2);
      expect(variants.length, kind).toBeLessThanOrEqual(3);
      for (const tile of variants) expect(tile.rgba.every((value, i) => i % 4 !== 3 || value === 255), kind).toBe(true);
      expect(new Set(variants.map((tile) => tile.rgba.join())).size, kind).toBe(variants.length);
    }
  });

  it('keeps a floor outer ring identical in every variant, so any two can touch', () => {
    for (const kind of FLOORS) {
      for (const side of SIDES) {
        const edges = environment.tiles[kind].map((tile) => edge(tile, side));
        for (const other of edges) expect(other, `${kind} ${side}`).toEqual(edges[0]);
      }
    }
  });
});

describe('environment props', () => {
  it('anchors every prop inside its art at the footprint centre', () => {
    for (const kind of PROP_KINDS) {
      const sprite = environment.props[kind];
      const { w, h } = PROP_DEFS[kind];
      expect(sprite.ay, kind).toBeGreaterThanOrEqual(h);
      expect(sprite.ax, kind).toBeGreaterThanOrEqual(w / 2);
      expect(sprite.w - sprite.ax, kind).toBeGreaterThanOrEqual(w / 2);
    }
  });

  it('covers the solid footprint of every piece of furniture', () => {
    for (const kind of FURNITURE) {
      const sprite = environment.props[kind];
      const canvas = spriteToCanvas(sprite);
      const { w, h } = PROP_DEFS[kind];
      const cx = sprite.ax;
      const bottom = sprite.ay - 1;
      // Both ends of the footprint's centre line, rather than every corner: tables stand on legs.
      expect(canvas.get(cx, bottom - h + 1), `${kind} rear`).not.toBeNull();
      expect(canvas.get(cx - Math.floor(w / 2), sprite.ay - h - 1), `${kind} left`).not.toBeNull();
      expect(canvas.get(cx + Math.floor(w / 2) - 1, sprite.ay - h - 1), `${kind} right`).not.toBeNull();
    }
  });

  it('tiles fence_h end to end: same width as its footprint, rails meeting at the joint', () => {
    const sprite = environment.props.fence_h;
    const canvas = spriteToCanvas(sprite);
    expect(sprite.w).toBe(PROP_DEFS.fence_h.w);
    expect(sprite.ax).toBe(PROP_DEFS.fence_h.w / 2);
    const railRows = Array.from({ length: sprite.h }, (_, y) => y).filter((y) => canvas.get(sprite.w - 1, y) !== null && canvas.get(sprite.w / 2, y) !== null);
    expect(railRows.length).toBeGreaterThanOrEqual(3);
    for (const y of railRows) expect(canvas.get(0, y), `row ${y}`).not.toBeNull();
  });

  it('leaves real holes in the fence mesh', () => {
    const canvas = spriteToCanvas(environment.props.fence_h);
    const midRow = environment.props.fence_h.ay - 10;
    const holes = Array.from({ length: canvas.w }, (_, x) => canvas.get(x, midRow)).filter((color) => color === null);
    expect(holes.length).toBeGreaterThan(canvas.w / 2);
  });

  it('tiles fence_v end to end: one footprint per segment and no gap where they overlap', () => {
    const sprite = environment.props.fence_v;
    const canvas = spriteToCanvas(sprite);
    const { h } = PROP_DEFS.fence_v;
    expect(sprite.ay).toBeGreaterThanOrEqual(h);
    expect(sprite.w).toBe(PROP_DEFS.fence_v.w);
    // The rail is drawn down the whole strip, so segments placed h apart always join.
    const railCol = Array.from({ length: sprite.w }, (_, x) => x).find((x) => canvas.get(x, 0) !== null);
    expect(railCol).toBeDefined();
    for (let y = 0; y < sprite.ay - 1; y++) expect(canvas.get(railCol ?? 0, y), `row ${y}`).not.toBeNull();
  });

  it('keeps the flame clip looping on four frames', () => {
    expect(environment.barrelFire.frames).toHaveLength(4);
    expect(environment.barrelFire.loop).toBe(true);
  });
});

describe('environment buildings', () => {
  it('has a shell for every kind, with enough facades on the repeated ones', () => {
    for (const kind of BUILDING_KINDS) expect(environment.buildings[kind].length, kind).toBeGreaterThanOrEqual(1);
    for (const [kind, count] of Object.entries(MIN_FACADES)) {
      const shells = environment.buildings[kind as keyof typeof MIN_FACADES];
      expect(shells.length, kind).toBeGreaterThanOrEqual(count);
      expect(new Set(shells.map((shell) => shell.rgba.join())).size, kind).toBe(shells.length);
    }
  });

  it('sizes every shell from its footprint and anchors it at the bottom centre', () => {
    for (const { kind, sprite, label } of SHELLS) {
      const { w, h } = BUILDING_DEFS[kind];
      expect(sprite.w, label).toBeGreaterThanOrEqual(w);
      expect(sprite.ay, label).toBeGreaterThanOrEqual(h);
      expect(footprintLeft(sprite, w), label).toBeGreaterThanOrEqual(0);
      expect(sprite.ax + w / 2, label).toBeLessThanOrEqual(sprite.w);
    }
  });

  it('rises no more than the allowance above the footprint', () => {
    for (const { kind, sprite, label } of SHELLS) {
      expect(sprite.ay - BUILDING_DEFS[kind].h, label).toBeLessThanOrEqual(MAX_RISE);
      expect(sprite.h - sprite.ay, label).toBeLessThanOrEqual(MAX_BELOW_GROUND);
    }
  });

  it('covers every pixel of the footprint, so nothing shows through until the roof fades', () => {
    for (const { kind, sprite, label } of SHELLS) {
      const { w, h } = BUILDING_DEFS[kind];
      const canvas = spriteToCanvas(sprite);
      const left = footprintLeft(sprite, w);
      const holes: string[] = [];
      for (let y = sprite.ay - h; y < sprite.ay; y++) {
        for (let x = left; x < left + w; x++) {
          const showsThrough = canvas.get(x, y) === null;
          if (showsThrough) holes.push(`${x},${y}`);
        }
      }
      expect(holes.slice(0, 5), label).toEqual([]);
    }
  });

  it('draws the door as a dark opening DOOR_WIDTH wide at doorX, with solid wall either side', () => {
    const dark = new Set<number>(RAMPS.ink);
    for (const { kind, sprite, label } of SHELLS) {
      const { w, doorX } = BUILDING_DEFS[kind];
      const canvas = spriteToCanvas(sprite);
      const doorLeft = footprintLeft(sprite, w) + doorX - DOOR_WIDTH / 2;
      // Eight rows up: over the floor showing through, under any rolled shutter.
      const row = sprite.ay - 8;
      const mid = doorLeft + DOOR_WIDTH / 2;
      for (let x = mid - 8; x < mid + 8; x++) expect(dark.has(canvas.get(x, row) ?? -1), `${label} col ${x}`).toBe(true);
      expect(dark.has(canvas.get(doorLeft - 2, row) ?? -1), `${label} left surround`).toBe(false);
      expect(dark.has(canvas.get(doorLeft + DOOR_WIDTH + 1, row) ?? -1), `${label} right surround`).toBe(false);
    }
  });
});

describe('environment interior', () => {
  it('sizes the wall pieces to tile along a wall', () => {
    const { wallFace, wallCap, doorMat } = environment.interior;
    expect(wallFace.w).toBe(TILE_SIZE);
    expect(wallFace.h).toBeGreaterThanOrEqual(16);
    expect(wallFace.h).toBeLessThanOrEqual(24);
    expect([wallCap.w, wallCap.h]).toEqual([TILE_SIZE, TILE_SIZE]);
    expect(doorMat.w).toBe(DOOR_WIDTH);
  });

  it('keeps wall pieces opaque, so they hide the floor under them', () => {
    const { wallFace, wallCap } = environment.interior;
    for (const piece of [wallFace, wallCap]) expect(piece.rgba.every((value, i) => i % 4 !== 3 || value === 255)).toBe(true);
  });

  it('seams wallFace left to right', () => {
    const canvas = spriteToCanvas(environment.interior.wallFace);
    const column = (x: number) => Array.from({ length: canvas.h }, (_, y) => canvas.get(x, y));
    const joint = column(TILE_SIZE - 1).filter((color, y) => color === column(0)[y]);
    // The boarding has a joint in the last column, so only those rows may differ.
    expect(joint.length).toBeGreaterThanOrEqual(canvas.h - 6);
  });
});
