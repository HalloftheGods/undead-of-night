// Kai's costumes (#7172): the list, the palette and the portrait frame, his build, and
// the owner's hard rule that every costume keeps his round glasses exactly as the
// default draws them, in every facing.

import { describe, expect, it } from 'vitest';
import { WEAPON_ORDER } from '../shared/protocol.ts';
import type { DrawnDir, Legend } from '../src/art/kit.ts';
import { inPalette, RAMPS } from '../src/art/palette.ts';
import type { Color } from '../src/art/palette.ts';
import { ANCHOR_X } from '../src/art/survivors/cell.ts';
import { idleClips, weaponClips } from '../src/art/survivors/clips.ts';
import { SOL_COSTUMES } from '../src/art/survivors/costumes/sol.ts';
import { standingFrame } from '../src/art/survivors/fallen.ts';
import { PORTRAIT_FRAME } from '../src/art/survivors/portrait.ts';
import { bodyDrop, drawPose, HEAD_BOTTOM } from '../src/art/survivors/rig.ts';
import type { Person } from '../src/art/survivors/rig.ts';
import { SOL } from '../src/art/survivors/sol.ts';
import type { PixelSprite } from '../src/art/types.ts';

const DRAWN: readonly DrawnDir[] = [0, 1, 2, 6, 7];
/** The letters Kai's heads draw his glasses with: rims, lens glint, pupils, lower rims. */
const GLASSES = new Set(['K', 'k', 'l', 'm']);
const INKS = new Set<Color>(RAMPS.ink);
const COSTUMES = SOL_COSTUMES.slice(1);

function colorAt(sprite: PixelSprite, x: number, y: number): Color | null {
  const i = (y * sprite.w + x) * 4;
  const transparent = sprite.rgba[i + 3] === 0;
  return transparent ? null : (sprite.rgba[i] << 16) | (sprite.rgba[i + 1] << 8) | sprite.rgba[i + 2];
}

/** Pixels that are off the palette or neither clear nor opaque. */
function strayPixels(sprite: PixelSprite): number {
  let count = 0;
  for (let i = 0; i < sprite.w * sprite.h; i++) {
    const alpha = sprite.rgba[i * 4 + 3];
    const color = (sprite.rgba[i * 4] << 16) | (sprite.rgba[i * 4 + 1] << 8) | sprite.rgba[i * 4 + 2];
    const stray = (alpha !== 0 && alpha !== 255) || (alpha === 255 && !inPalette(color));
    if (stray) count++;
  }
  return count;
}

/** Opaque pixels outside the portrait frame. */
function clipped(sprite: PixelSprite): number {
  const { x, y, w, h } = PORTRAIT_FRAME;
  let count = 0;
  for (let row = 0; row < sprite.h; row++) {
    for (let col = 0; col < sprite.w; col++) {
      const inside = col >= x && col < x + w && row >= y && row < y + h;
      const outsideOpaque = !inside && colorAt(sprite, col, row) !== null;
      if (outsideOpaque) count++;
    }
  }
  return count;
}

/** Every frame the rig draws for a person: all weapons, all clips, plus the front pose. */
function allFrames(person: Person): PixelSprite[] {
  const frames = [standingFrame(person, 0, 'stand', 0, 0, 0)];
  for (const weapon of WEAPON_ORDER) {
    const kit = weaponClips(person, weapon);
    for (const clips of [kit.idle, kit.walk, kit.fire, kit.reload]) for (const clip of clips) frames.push(...clip.frames);
  }
  return frames;
}

/** Where a head grid puts each pixel in the cell at rest, as rig.placePart does. */
function headOrigin(person: Person, dir: DrawnDir): readonly [number, number] {
  const part = person.heads[dir];
  const w = Math.max(...part.rows.map((row) => row.length));
  const x = Math.floor(ANCHOR_X - w / 2) + (part.dx ?? 0);
  const y = HEAD_BOTTOM - part.rows.length + (part.dy ?? 0) + bodyDrop(person);
  return [x, y];
}

/** The cell pixels of Kai's glasses in one facing at rest. */
function glassesPixels(dir: DrawnDir): readonly (readonly [number, number])[] {
  const [x0, y0] = headOrigin(SOL, dir);
  const pixels: [number, number][] = [];
  SOL.heads[dir].rows.forEach((row, y) => [...row].forEach((letter, x) => {
    if (GLASSES.has(letter)) pixels.push([x0 + x, y0 + y]);
  }));
  return pixels;
}

/** The colour a person's head grid gives one cell pixel at rest, or null where it draws nothing. */
function headColor(person: Person, dir: DrawnDir, x: number, y: number): Color | null {
  const [x0, y0] = headOrigin(person, dir);
  const letter = person.heads[dir].rows[y - y0]?.[x - x0];
  const drawn = letter !== undefined && letter !== '.';
  return drawn ? person.legend[letter] ?? null : null;
}

function inkLetters(legend: Legend): string[] {
  return Object.entries(legend).filter(([, color]) => color !== null && INKS.has(color)).map(([letter]) => letter).sort();
}

describe("Kai's costumes (#7172)", () => {
  it('lists the default first, then the three hero costumes, with unique lowercase ids', () => {
    expect(SOL_COSTUMES[0]).toEqual({ id: 'kid', name: 'Kid', person: SOL });
    expect(SOL_COSTUMES.map((c) => c.id)).toEqual(['kid', 'plumber', 'adventurer', 'caped']);
    expect(SOL_COSTUMES.map((c) => c.name)).toEqual(['Kid', 'Plumber', 'Adventurer', 'Caped Hero']);
    const ids = SOL_COSTUMES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+$/);
  });

  it('keeps his small build', () => {
    for (const { person } of COSTUMES) {
      expect([person.shorter, person.spread, person.thick]).toEqual([SOL.shorter, SOL.spread, SOL.thick]);
    }
  });

  it('keeps his glasses at the same cell pixels in the same colours in every drawn facing', () => {
    for (const { id, person } of COSTUMES) {
      for (const dir of DRAWN) {
        const pixels = glassesPixels(dir);
        expect(pixels.length, `${id} facing ${dir}`).toBeGreaterThan(0);
        const theirs = pixels.map(([x, y]) => headColor(person, dir, x, y));
        const his = pixels.map(([x, y]) => headColor(SOL, dir, x, y));
        expect(theirs, `${id} facing ${dir}`).toEqual(his);
      }
    }
  });

  it('draws the glasses the same as the default in the standing frame of every facing and weapon', () => {
    for (const { id, person } of COSTUMES) {
      for (const weapon of WEAPON_ORDER) {
        for (const dir of DRAWN) {
          const mine = drawPose(person, weapon, dir, {});
          const his = drawPose(SOL, weapon, dir, {});
          const pixels = glassesPixels(dir);
          const at = (sprite: PixelSprite) => pixels.map(([x, y]) => colorAt(sprite, x, y));
          expect(at(mine), `${id} ${weapon} facing ${dir}`).toEqual(at(his));
        }
      }
    }
  });

  it('adds no outline-ink fills to his legends', () => {
    for (const { person } of COSTUMES) {
      expect(inkLetters(person.legend)).toEqual(inkLetters(SOL.legend));
      expect(inkLetters(person.farLegend)).toEqual(inkLetters(SOL.farLegend));
    }
  });

  it('draws every frame from the palette with alpha 0 or 255', () => {
    for (const { id, person } of SOL_COSTUMES) {
      const stray = allFrames(person).reduce((sum, frame) => sum + strayPixels(frame), 0);
      expect(stray, id).toBe(0);
    }
  });

  it('stays in the portrait frame in the front pose and every pistol facing', () => {
    for (const { id, person } of SOL_COSTUMES) {
      const sprites = [standingFrame(person, 0, 'stand', 0, 0, 0), ...idleClips(person, 'pistol').map((c) => c.frames[0])];
      expect(sprites.map(clipped), id).toEqual(sprites.map(() => 0));
    }
  });

  it('never leaves the frame further than the default in any frame of any weapon', () => {
    const his = allFrames(SOL).map(clipped);
    for (const { id, person } of COSTUMES) {
      const theirs = allFrames(person).map(clipped);
      expect(theirs.every((count, i) => count <= his[i]), id).toBe(true);
    }
  });

  it('looks different from the default in at least one facing', () => {
    const his = idleClips(SOL, 'pistol').map((c) => c.frames[0].rgba.join());
    for (const { id, person } of COSTUMES) {
      const theirs = idleClips(person, 'pistol').map((c) => c.frames[0].rgba.join());
      expect(theirs.some((frame, i) => frame !== his[i]), id).toBe(true);
    }
  });
});
