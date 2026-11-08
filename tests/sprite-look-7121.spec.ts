// The rules every survivor shares (#7121): an outline that keeps an edge on the darkest
// fills, an in-hue arm contact line, far legs that never turn to outline ink, boots lit
// from the left, and a small build whose gun leaves its legs in view.

import { describe, expect, it } from 'vitest';
import { WEAPON_ORDER } from '../shared/protocol.ts';
import { litRim, PixelCanvas } from '../src/art/kit.ts';
import type { DrawnDir, Legend } from '../src/art/kit.ts';
import { darker, INK, INK_SOFT, lighter, RAMPS } from '../src/art/palette.ts';
import type { Color } from '../src/art/palette.ts';
import { buildSurvivors, MUZZLE_OFFSETS } from '../src/art/survivors.ts';
import { CELL_H, CELL_W, Cell } from '../src/art/survivors/cell.ts';
import { BANDUS } from '../src/art/survivors/bandus.ts';
import { LEG_SETS } from '../src/art/survivors/legs.ts';
import { NIGHT } from '../src/art/survivors/night.ts';
import { REX } from '../src/art/survivors/rex.ts';
import { bodyDrop, drawPose, farLegsLegend, gunDrop, legStrip, legTrim } from '../src/art/survivors/rig.ts';
import type { Person } from '../src/art/survivors/rig.ts';
import { SATORI } from '../src/art/survivors/satori.ts';
import { SOL } from '../src/art/survivors/sol.ts';
import type { PixelSprite } from '../src/art/types.ts';

const CAST: readonly (readonly [string, Person])[] = [
  ['night', NIGHT], ['bandus', BANDUS], ['satori', SATORI], ['rex', REX], ['sol', SOL],
];
const INKS = new Set<Color>(RAMPS.ink);
const LEG_LETTERS = 'rqpRQPgfe';
const DRAWN_DIRS: readonly DrawnDir[] = [0, 1, 2, 6, 7];

function colorAt(sprite: PixelSprite, x: number, y: number): Color | null {
  const i = (y * sprite.w + x) * 4;
  const transparent = sprite.rgba[i + 3] === 0;
  return transparent ? null : (sprite.rgba[i] << 16) | (sprite.rgba[i + 1] << 8) | sprite.rgba[i + 2];
}

function count(sprite: PixelSprite, color: Color): number {
  let n = 0;
  for (let y = 0; y < sprite.h; y++) for (let x = 0; x < sprite.w; x++) n += colorAt(sprite, x, y) === color ? 1 : 0;
  return n;
}

function inkLetters(legend: Legend): string[] {
  return Object.entries(legend).filter(([, color]) => color !== null && INKS.has(color)).map(([letter]) => letter);
}

describe('lit-side outline', () => {
  it('sits two steps below the fill, or a step above it when the fill is its ramp floor', () => {
    expect(litRim(RAMPS.blood[2])).toBe(RAMPS.blood[0]);
    expect(litRim(RAMPS.blood[1])).toBe(RAMPS.blood[0]);
    expect(litRim(RAMPS.wood[0])).toBe(RAMPS.wood[1]);
    expect(litRim(RAMPS.violet[0])).toBe(RAMPS.violet[1]);
    expect(litRim(INK)).toBe(INK_SOFT);
  });

  it('never repeats the fill on the lit side of PixelCanvas.outline', () => {
    const floor = RAMPS.wood[0];
    const canvas = new PixelCanvas(3, 3).px(1, 1, floor).outline({ selective: true });
    expect(canvas.get(1, 0)).toBe(lighter(floor, 1));
    expect(canvas.get(0, 1)).toBe(lighter(floor, 1));
    expect(canvas.get(2, 1)).toBe(INK);
    expect(canvas.get(1, 2)).toBe(INK);
  });

  it('bakes the same outline in Cell.toSprite as PixelCanvas.outline', () => {
    const legend: Legend = {
      a: RAMPS.wood[0], b: RAMPS.blood[2], c: RAMPS.violet[0], d: INK, e: RAMPS.ink[1], f: RAMPS.bone[3],
    };
    const rows = ['..aab..', '.abcdef', 'aabbcc.', '.ffe.da', '..cc...'];
    const cell = new Cell();
    cell.grid(10, 12, rows, legend);
    const canvas = new PixelCanvas(CELL_W, CELL_H).grid(10, 12, rows, legend).outline({ selective: true });
    expect(Array.from(cell.toSprite().rgba)).toEqual(Array.from(canvas.data));
  });
});

describe('arm contact line', () => {
  const body = RAMPS.violet[1];
  const part = RAMPS.skin[2];

  function bodyCell(): Cell {
    const cell = new Cell();
    cell.rect(0, 0, 12, 12, body);
    return cell;
  }

  it('keeps the plain overlay: a fixed colour below and right of the part', () => {
    const cell = bodyCell();
    cell.overlay((layer) => layer.rect(2, 2, 2, 2, part), INK_SOFT);
    const sprite = cell.toSprite();
    expect(colorAt(sprite, 2, 4)).toBe(INK_SOFT);
    expect(colorAt(sprite, 4, 2)).toBe(INK_SOFT);
  });

  it('shades the body in its own hue and leaves no right-hand speck where the part steps on down', () => {
    const cell = bodyCell();
    // A two pixel stair going down and to the right.
    cell.overlay((layer) => {
      layer.px(3, 3, part);
      layer.px(4, 4, part);
    }, { rim: (under) => darker(under, 1) });
    const sprite = cell.toSprite();
    const shade = darker(body, 1);
    expect(colorAt(sprite, 3, 4)).toBe(shade);
    expect(colorAt(sprite, 4, 5)).toBe(shade);
    expect(colorAt(sprite, 5, 4)).toBe(shade);
    // Right of the upper step the part carries on below, so the body stays as it was.
    expect(colorAt(sprite, 4, 3)).toBe(body);
  });

  it('works the covering colour out from the body under it, reading the body before the part', () => {
    const cell = new Cell();
    cell.rect(0, 0, 4, 4, body);
    cell.overlay((layer) => layer.rect(1, 1, 4, 1, part), {
      rim: () => INK_SOFT,
      over: (color, under) => (under === body ? RAMPS.skin[1] : color),
    });
    const sprite = cell.toSprite();
    expect(colorAt(sprite, 1, 1)).toBe(RAMPS.skin[1]);
    // Off the body the part keeps its own colour.
    expect(colorAt(sprite, 4, 1)).toBe(part);
  });
});

describe('far legs', () => {
  it('never draws a far leg letter in outline ink unless the near leg is ink too', () => {
    for (const [name, person] of CAST) {
      const far = farLegsLegend(person);
      for (const letter of LEG_LETTERS) {
        const color = far[letter];
        const near = person.legend[letter];
        const nearIsInk = near !== null && near !== undefined && INKS.has(near);
        const farIsInk = color !== null && color !== undefined && INKS.has(color);
        expect(farIsInk ? color : null, `${name} ${letter}`).toBe(farIsInk && nearIsInk ? near : null);
      }
    }
  });

  it('shades the right-hand leg facing the camera and from behind, as the light falls', () => {
    // Bear has no leg trim, so the strips hang from the hip line unmoved.
    const far = farLegsLegend(BANDUS);
    for (const dir of [2, 6] as const) {
      const sprite = drawPose(BANDUS, 'pistol', dir, {});
      const right = Math.max(LEG_SETS[dir].nearX, LEG_SETS[dir].farX);
      const left = Math.min(LEG_SETS[dir].nearX, LEG_SETS[dir].farX);
      // Row 4 of a standing front or back strip is 'RQQP': x + 1 is a Q.
      expect(colorAt(sprite, right + 1, 30), `dir ${dir} right`).toBe(far.Q);
      expect(colorAt(sprite, left + 1, 30), `dir ${dir} left`).toBe(BANDUS.legend.Q);
    }
  });
});

describe('leg strips', () => {
  const lightness: Readonly<Record<string, number>> = { g: 2, f: 1, e: 0 };

  it('lights every boot from the left, in every facing and frame', () => {
    for (const dir of DRAWN_DIRS) {
      for (const [name, strip] of Object.entries(LEG_SETS[dir].strips)) {
        for (const row of strip) {
          const boot = row.replace(/[^gfe]/g, '');
          const levels = [...boot].map((letter) => lightness[letter]);
          expect(levels, `${dir} ${name} ${row}`).toEqual([...levels].sort((a, b) => b - a));
        }
      }
    }
  });

  it('keeps the boot colour on a lifted foot instead of only the sole', () => {
    for (const dir of DRAWN_DIRS) {
      for (const [name, strip] of Object.entries(LEG_SETS[dir].strips)) {
        const firstFoot = strip.find((row) => /[gfe]/.test(row)) ?? '';
        expect(firstFoot, `${dir} ${name}`).toMatch(/g/);
      }
    }
  });

  it('gives a much shorter leg one boot row fewer and keeps the sole on the floor row', () => {
    for (const dir of DRAWN_DIRS) {
      for (const [name, strip] of Object.entries(LEG_SETS[dir].strips)) {
        for (const trim of [0, 1, 3]) {
          const { rows, dy } = legStrip(strip, trim);
          expect(trim + dy + rows.length, `${dir} ${name} trim ${trim}`).toBe(strip.length);
          expect(rows[rows.length - 1]).toBe(strip[strip.length - 1]);
          const boots = (s: readonly string[]): number => s.filter((row) => /[gf]/.test(row)).length;
          const lost = boots(strip.slice(trim)) - boots(rows);
          expect(lost, `${dir} ${name} trim ${trim}`).toBe(trim >= 2 && boots(strip.slice(trim)) >= 2 ? 1 : 0);
        }
      }
    }
  });

  it('returns the same rows for the same strip and trim, so compiled grids stay cached', () => {
    const strip = LEG_SETS[2].strips.stand;
    expect(legStrip(strip, 3).rows).toBe(legStrip(strip, 3).rows);
  });
});

describe('small build', () => {
  it('holds the gun higher than the body drop by the leg trim, and reports that drop', () => {
    const art = buildSurvivors();
    CAST.forEach(([name, person], skin) => {
      expect(gunDrop(person), name).toBe(bodyDrop(person) - legTrim(person));
      expect(art[skin].gunDrop, name).toBe(gunDrop(person));
    });
  });

  it('puts every skin muzzle offset on its own barrel tip', () => {
    const art = buildSurvivors();
    art.forEach((skin, index) => {
      for (const id of WEAPON_ORDER) {
        MUZZLE_OFFSETS[id].forEach(({ x, y }, dir) => {
          const frame = skin.weapons[id].idle[dir].frames[0];
          expect(colorAt(frame, x + frame.ax, y + frame.ay + skin.gunDrop), `skin ${index} ${id} ${dir}`).not.toBeNull();
        });
      }
    });
  });

  it('leaves most of Kai’s legs in view from the front, as from behind', () => {
    const marker = RAMPS.teal[1];
    const legs = Object.fromEntries([...LEG_LETTERS].map((letter) => [letter, marker]));
    const marked: Person = { ...SOL, legend: { ...SOL.legend, ...legs }, farLegend: { ...SOL.farLegend, ...legs } };
    const fromBehind = count(drawPose(marked, 'pistol', 6, {}), marker);
    for (const dir of [0, 1, 2] as const) {
      const seen = count(drawPose(marked, 'pistol', dir, {}), marker);
      expect(seen / fromBehind, `dir ${dir}`).toBeGreaterThanOrEqual(0.75);
    }
  });
});

describe('collar shadow', () => {
  it('darkens only the under grid, straight below the part, where nothing covers it', () => {
    const legend: Legend = { u: RAMPS.blood[2], h: RAMPS.wood[1], x: RAMPS.metal[2] };
    const cell = new Cell();
    const under = { rows: ['uuuuu', 'uuuuu', 'uuuuu', 'uuuuu'], legend, x: 0, y: 2 };
    const head = { rows: ['hhh', 'hhh'], legend, x: 1, y: 1 };
    cell.grid(under.x, under.y, under.rows, legend);
    cell.grid(head.x, head.y, head.rows, legend);
    cell.px(3, 3, RAMPS.metal[2]);
    cell.shadeBelow(head, under, 2);
    const sprite = cell.toSprite();
    const shade = darker(RAMPS.blood[2], 1);
    expect(colorAt(sprite, 1, 3)).toBe(shade);
    expect(colorAt(sprite, 1, 4)).toBe(shade);
    expect(colorAt(sprite, 1, 5)).toBe(RAMPS.blood[2]);
    expect(colorAt(sprite, 0, 3)).toBe(RAMPS.blood[2]);
    // Something painted over the torso since keeps its colour.
    expect(colorAt(sprite, 3, 3)).toBe(RAMPS.metal[2]);
  });
});

describe('outline ink in survivor legends', () => {
  /** Letters drawn as outline in the grids. */
  const OUTLINE = ['k', 'K'];
  /**
   * Fill letters that still map to ink, left to the per-person tasks of #7116. Shrink
   * this as they land; nothing may be added.
   */
  const KNOWN_INK_FILLS: Readonly<Record<string, { readonly legend: string; readonly far: string }>> = {
    night: { legend: 'N', far: 'N' },
    bandus: { legend: '', far: '' },
    satori: { legend: '', far: '' },
    rex: { legend: '', far: '' },
    sol: { legend: '', far: '' },
  };

  it('maps no new letter to outline ink', () => {
    for (const [name, person] of CAST) {
      const known = KNOWN_INK_FILLS[name];
      for (const letter of inkLetters(person.legend)) expect(OUTLINE.includes(letter) || known.legend.includes(letter), `${name} legend ${letter}`).toBe(true);
      for (const letter of inkLetters(person.farLegend)) expect(OUTLINE.includes(letter) || known.far.includes(letter), `${name} far ${letter}`).toBe(true);
    }
  });

  it.todo('maps only outline letters to ink in every legend and farLegend, once the per-person tasks of #7116 land');
});
