// Bear's costume list (#7169): the grizzly first, then the polar bear, the honey bear and
// his recruit look from before the bear suit. Each must stay in the palette and the portrait
// frame like the default, keep outline ink off its fills, and look different from the grizzly.
// How each one reads on the road was judged by eye.

import { describe, expect, it } from 'vitest';
import { WEAPON_ORDER } from '../shared/protocol.ts';
import type { Legend } from '../src/art/kit.ts';
import { inPalette, RAMPS } from '../src/art/palette.ts';
import type { Color } from '../src/art/palette.ts';
import { idleClips, weaponClips } from '../src/art/survivors/clips.ts';
import { BANDUS_COSTUMES } from '../src/art/survivors/costumes/bandus.ts';
import { standingFrame } from '../src/art/survivors/fallen.ts';
import { BANDUS } from '../src/art/survivors/bandus.ts';
import { PORTRAIT_FRAME } from '../src/art/survivors/portrait.ts';
import { farLegsLegend } from '../src/art/survivors/rig.ts';
import type { Person } from '../src/art/survivors/rig.ts';
import type { PixelSprite } from '../src/art/types.ts';

const INKS = new Set<Color>(RAMPS.ink);
/** Letters drawn as outline in the grids; every other letter is a fill. */
const OUTLINE = ['k', 'K'];

function framesOf(person: Person): PixelSprite[] {
  const frames: PixelSprite[] = [standingFrame(person, 0, 'stand', 0, 0, 0)];
  for (const weapon of WEAPON_ORDER) {
    for (const clips of Object.values(weaponClips(person, weapon))) {
      for (const clip of clips) frames.push(...clip.frames);
    }
  }
  return frames;
}

/** How many opaque pixels are off the palette or half transparent. */
function offPalette(sprite: PixelSprite): number {
  let count = 0;
  for (let i = 0; i < sprite.rgba.length; i += 4) {
    const alpha = sprite.rgba[i + 3];
    const color = (sprite.rgba[i] << 16) | (sprite.rgba[i + 1] << 8) | sprite.rgba[i + 2];
    const drawn = alpha !== 0;
    const wrong = alpha !== 255 || !inPalette(color);
    count += drawn && wrong ? 1 : 0;
  }
  return count;
}

/** How many opaque pixels of the cell fall outside the portrait frame. */
function clipped(sprite: PixelSprite): number {
  const { x, y, w, h } = PORTRAIT_FRAME;
  let count = 0;
  for (let row = 0; row < sprite.h; row++) {
    for (let col = 0; col < sprite.w; col++) {
      const inside = col >= x && col < x + w && row >= y && row < y + h;
      const opaque = sprite.rgba[(row * sprite.w + col) * 4 + 3] !== 0;
      count += !inside && opaque ? 1 : 0;
    }
  }
  return count;
}

function inkFills(legend: Legend): string[] {
  return Object.entries(legend)
    .filter(([letter, color]) => color !== null && INKS.has(color) && !OUTLINE.includes(letter))
    .map(([letter]) => letter);
}

function costume(id: string): Person {
  const found = BANDUS_COSTUMES.find((each) => each.id === id);
  if (!found) throw new Error(`no costume ${id}`);
  return found.person;
}

describe("Bear's costumes (#7169)", () => {
  it('starts with the default grizzly', () => {
    expect(BANDUS_COSTUMES[0]).toMatchObject({ id: 'grizzly', person: BANDUS });
  });

  it('lists the grizzly, polar bear, honey bear and recruit under unique lowercase ids', () => {
    const ids = BANDUS_COSTUMES.map((each) => each.id);
    expect(ids).toEqual(['grizzly', 'polar', 'honey', 'recruit']);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+$/);
    expect(BANDUS_COSTUMES.map((each) => each.name)).toEqual(['Grizzly', 'Polar Bear', 'Honey Bear', 'Recruit']);
  });

  it('keeps his full height and shoulder spread in every costume', () => {
    for (const { id, person } of BANDUS_COSTUMES) {
      expect({ spread: person.spread, shorter: person.shorter }, id).toEqual({ spread: BANDUS.spread, shorter: BANDUS.shorter });
    }
  });

  it('draws every frame of every weapon in the palette, with alpha 0 or 255', () => {
    for (const { id, person } of BANDUS_COSTUMES) {
      const frames = framesOf(person);
      expect(frames.map(offPalette), id).toEqual(frames.map(() => 0));
    }
  });

  it('keeps the front pose, the eight pistol idle facings and the pistol recoil frames inside the portrait frame', () => {
    for (const { id, person } of BANDUS_COSTUMES) {
      const recoil = Object.values(weaponClips(person, 'pistol').fire).flatMap((clip) => clip.frames);
      const sprites = [standingFrame(person, 0, 'stand', 0, 0, 0), ...idleClips(person, 'pistol').map((clip) => clip.frames[0]), ...recoil];
      expect(sprites.map(clipped), id).toEqual(sprites.map(() => 0));
    }
  });

  it('maps only the outline letters to ink, near and far', () => {
    for (const { id, person } of BANDUS_COSTUMES) {
      expect(inkFills(person.legend), `${id} legend`).toEqual([]);
      expect(inkFills(farLegsLegend(person)), `${id} far legs`).toEqual([]);
    }
  });

  it('looks different from the grizzly in at least one facing', () => {
    const grizzly = idleClips(BANDUS, 'pistol').map((clip) => Array.from(clip.frames[0].rgba).join());
    for (const { id, person } of BANDUS_COSTUMES.slice(1)) {
      const facings = idleClips(person, 'pistol').map((clip) => Array.from(clip.frames[0].rgba).join());
      expect(facings.some((facing, dir) => facing !== grizzly[dir]), id).toBe(true);
    }
  });

  it('wraps a red scarf over every polar bear torso', () => {
    const polar = costume('polar');
    const blood: readonly Color[] = RAMPS.blood;
    expect(blood).toContain(polar.legend.S);
    for (const part of Object.values(polar.torsos)) expect(part.rows.join('')).toContain('S');
  });

  it('keeps the honey bear suit off the fire ramp, so it stays paler than Satori’s orange', () => {
    const honey = costume('honey');
    const fire: readonly Color[] = RAMPS.fire;
    for (const letter of 'vut') expect(fire, letter).not.toContain(honey.legend[letter]);
  });

  it('keeps the recruit in his red shirt and olive trousers', () => {
    const recruit = costume('recruit');
    expect(recruit.legend.u).toBe(RAMPS.blood[2]);
    expect(recruit.legend.q).toBe(RAMPS.olive[1]);
  });
});
