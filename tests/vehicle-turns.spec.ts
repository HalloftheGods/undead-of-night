import { describe, expect, it } from 'vitest';
import type { VehicleView } from '../shared/protocol.ts';
import { FACING_HEADING, VEHICLE_BODY_IDS } from '../shared/vehicle-bodies.ts';
import { buildArtBook } from '../src/art/index.ts';
import type { ArtBook } from '../src/art/types.ts';
import type { PixelSprite } from '../src/art/types.ts';
import { beaconPool } from '../src/engine/car-looks.ts';
import { vehicleAnchor, vehicleBeacons, vehicleSprite } from '../src/engine/vehicle-draw.ts';
import { isTurnWarm, squareFacing, TURN_STEPS, turnBeacon, turnHeading, turnSprite, turnStepOf, warmTurn } from '../src/engine/vehicle-turns.ts';

const art = buildArtBook();
const QUARTER = TURN_STEPS / 4;
const betweenSteps = Array.from({ length: TURN_STEPS }, (_, step) => step).filter((step) => step % QUARTER !== 0);

const opaqueRows = (sprite: PixelSprite): number => {
  let rows = 0;
  for (let y = 0; y < sprite.h; y += 1) {
    let any = false;
    for (let x = 0; x < sprite.w && !any; x += 1) any = sprite.rgba[(y * sprite.w + x) * 4 + 3] > 0;
    if (any) rows += 1;
  }
  return rows;
};

const colorsOf = (sprite: PixelSprite): Map<number, number> => {
  const counts = new Map<number, number>();
  for (let i = 0; i < sprite.rgba.length; i += 4) {
    if (sprite.rgba[i + 3] === 0) continue;
    const color = (sprite.rgba[i] << 16) | (sprite.rgba[i + 1] << 8) | sprite.rgba[i + 2];
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  return counts;
};

describe('turn steps', () => {
  it('counts clockwise from east, a quarter of the ring per facing', () => {
    expect(turnStepOf(FACING_HEADING.e)).toBe(0);
    expect(turnStepOf(FACING_HEADING.s)).toBe(QUARTER);
    expect(turnStepOf(FACING_HEADING.w)).toBe(2 * QUARTER);
    expect(turnStepOf(-Math.PI)).toBe(2 * QUARTER);
    expect(turnStepOf(FACING_HEADING.n)).toBe(3 * QUARTER);
    expect(turnStepOf(2 * Math.PI)).toBe(0);
  });

  it('takes the nearest step', () => {
    const step = (2 * Math.PI) / TURN_STEPS;
    expect(turnStepOf(step * 0.49)).toBe(0);
    expect(turnStepOf(step * 0.51)).toBe(1);
    expect(turnStepOf(-step * 0.51)).toBe(TURN_STEPS - 1);
  });

  it('gives each step its heading back', () => {
    for (let step = 0; step < TURN_STEPS; step += 1) expect(turnStepOf(turnHeading(step))).toBe(step);
  });

  it('names the facing only where the nose is square to the screen', () => {
    expect([0, QUARTER, 2 * QUARTER, 3 * QUARTER].map(squareFacing)).toEqual(['e', 's', 'w', 'n']);
    expect(betweenSteps.map(squareFacing)).toEqual(betweenSteps.map(() => null));
  });
});

describe('turn models', () => {
  it('draws every body at every step between the facings, hard-edged and anchored inside the picture', () => {
    for (const body of VEHICLE_BODY_IDS) {
      for (const step of betweenSteps) {
        const sprite = turnSprite(art, body, 0, step);
        expect(opaqueRows(sprite), `${body} ${step}`).toBeGreaterThan(10);
        expect(sprite.rgba.every((value, i) => i % 4 !== 3 || value === 0 || value === 255), `${body} ${step} alpha`).toBe(true);
        expect(sprite.ax > 0 && sprite.ax < sprite.w && sprite.ay > 0 && sprite.ay < sprite.h, `${body} ${step} anchor`).toBe(true);
      }
    }
  });

  it('draws a model once and hands the same sprite back after', () => {
    expect(turnSprite(art, 'sedan', 1, 3)).toBe(turnSprite(art, 'sedan', 1, 3));
    expect(turnSprite(art, 'sedan', 1, 3)).not.toBe(turnSprite(art, 'sedan', 2, 3));
  });

  it('is cut from the hand-drawn sprites: nearly every pixel is a colour they already use', () => {
    for (const body of VEHICLE_BODY_IDS) {
      const { w, n, s } = art.vehicles[body];
      const drawn = new Set([w[0], n[0], s[0]].flatMap((sprite) => [...colorsOf(sprite).keys()]));
      for (const step of [1, 5, 11, 14, 19, 27]) {
        const counts = colorsOf(turnSprite(art, body, 0, step));
        const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
        const known = [...counts].reduce((sum, [color, count]) => sum + (drawn.has(color) ? count : 0), 0);
        expect(known / total, `${body} ${step}`).toBeGreaterThan(0.85);
      }
    }
  });

  it('progresses from the side view to the top-down view: the picture grows taller step by step, with no jump at either end', () => {
    for (const body of VEHICLE_BODY_IDS) {
      const sideOn = opaqueRows(art.vehicles[body].w[0]);
      const noseUp = opaqueRows(art.vehicles[body].n[0]);
      const heights = Array.from({ length: QUARTER - 1 }, (_, i) => opaqueRows(turnSprite(art, body, 0, 2 * QUARTER + 1 + i)));
      for (let i = 1; i < heights.length; i += 1) expect(heights[i], `${body} step ${i}`).toBeGreaterThanOrEqual(heights[i - 1] - 1);
      expect(heights[0] - sideOn, `${body} leaves the side view`).toBeLessThanOrEqual(8);
      expect(heights[0], `${body} leaves the side view`).toBeGreaterThanOrEqual(sideOn - 2);
      expect(Math.abs(noseUp - heights[heights.length - 1]), `${body} reaches the top-down view`).toBeLessThanOrEqual(8);
    }
  });

  it('can be drawn a step at a time ahead of need, nearest first, until the ring is whole', () => {
    expect(warmTurn(art, 'pickup', 7, 3)).toBe(true);
    expect(turnSprite(art, 'pickup', 7, 3)).toBe(turnSprite(art, 'pickup', 7, 3));
    let drawn = 1;
    while (warmTurn(art, 'pickup', 7, 3)) drawn += 1;
    expect(drawn).toBe(betweenSteps.length);
  });

  it('paints the coat the car wears', () => {
    expect(colorsOf(turnSprite(art, 'sedan', 0, 5))).not.toEqual(colorsOf(turnSprite(art, 'sedan', 3, 5)));
  });
});

describe('turned light bars', () => {
  it('gives the police car and the ambulance a two-frame bar at every step, sized and anchored like the body under it', () => {
    for (const body of ['police', 'ambulance'] as const) {
      for (const step of betweenSteps) {
        const clip = turnBeacon(art, body, step)!;
        const base = turnSprite(art, body, 0, step);
        expect(clip.frames).toHaveLength(2);
        for (const frame of clip.frames) {
          expect([frame.w, frame.h, frame.ax, frame.ay], `${body} ${step}`).toEqual([base.w, base.h, base.ax, base.ay]);
          expect(colorsOf(frame).size, `${body} ${step} lit`).toBeGreaterThan(0);
        }
        expect(clip.frames[0].rgba).not.toEqual(clip.frames[1].rgba);
      }
    }
  });

  it('has none for a car with no bar', () => {
    expect(turnBeacon(art, 'sedan', 3)).toBeNull();
  });
});

describe('drawing a turning car', () => {
  const view = (over: Partial<VehicleView>): VehicleView => ({ id: 4, body: 'police', x: 300, y: 200, heading: 0, speed: 90, facing: 'e', seats: ['a'], ...over });

  it('keeps the hand-drawn sprite while the nose is square to the screen', () => {
    expect(vehicleSprite(art, view({}), undefined)).toBe(art.vehicles.police.e[0]);
    expect(vehicleSprite(art, view({ heading: FACING_HEADING.n + 0.05, facing: 'n' }), undefined)).toBe(art.vehicles.police.n[0]);
  });

  it('shows the turn model between facings, whatever facing the physics still holds', () => {
    const turning = view({ heading: 0.6, facing: 'e' });
    expect(vehicleSprite(art, turning, undefined)).toBe(turnSprite(art, 'police', 0, turnStepOf(0.6)));
  });

  it('still draws a car it is told only the facing of', () => {
    expect(vehicleSprite(art, { body: 'van', facing: 'w' }, undefined)).toBe(art.vehicles.van.w[0]);
  });

  it('turns the light bar with the car, standing on the car itself', () => {
    const [bar] = vehicleBeacons(art, [view({ heading: 0.6 })], []);
    expect(bar.clip).toBe(turnBeacon(art, 'police', turnStepOf(0.6)));
    expect([bar.x, bar.y]).toEqual([300, 200]);
  });
});

describe('where a turning car sorts and glows', () => {
  const at = (heading: number): VehicleView => ({ id: 4, body: 'police', x: 300, y: 200, heading, speed: 90, facing: 'e', seats: ['a'] });
  const lowestOffset = (sprite: PixelSprite): number => {
    for (let y = sprite.h - 1; y >= 0; y -= 1) {
      for (let x = 0; x < sprite.w; x += 1) if (sprite.rgba[(y * sprite.w + x) * 4 + 3] > 0) return y - sprite.ay;
    }
    return 0;
  };

  it('sorts a car by the foot of the picture it is drawn as, whichever facing the physics still holds', () => {
    for (const body of VEHICLE_BODY_IDS) {
      for (const step of betweenSteps) {
        const car: VehicleView = { ...at(turnHeading(step)), body };
        const sprite = vehicleSprite(art, car, undefined);
        const foot = car.y + lowestOffset(sprite);
        expect(Math.abs(vehicleAnchor(car).y - foot), `${body} ${step}`).toBeLessThanOrEqual(6);
      }
    }
  });

  it('moves the sort line smoothly through the square facings, with no jump at the boundary', () => {
    for (const step of Array.from({ length: TURN_STEPS }, (_, i) => i)) {
      const a = vehicleAnchor(at(turnHeading(step))).y;
      const b = vehicleAnchor(at(turnHeading(step + 1))).y;
      expect(Math.abs(a - b), `step ${step}`).toBeLessThanOrEqual(7);
    }
  });

  it('keeps a light bar glow on the same ground line as the car, so it does not jump at a square facing', () => {
    const glowY = (heading: number): number => {
      const [bar] = vehicleBeacons(art, [at(heading)], []);
      return beaconPool(bar, 0, true).y;
    };
    for (const step of Array.from({ length: TURN_STEPS }, (_, i) => i)) {
      expect(Math.abs(glowY(turnHeading(step)) - glowY(turnHeading(step + 1))), `step ${step}`).toBeLessThanOrEqual(7);
    }
  });

  it('lights the same half of the car on frame 0 all the way round: its left', () => {
    const litHalf = (sprite: PixelSprite, across: 'x' | 'y', _heading: number): number => {
      let sum = 0; let count = 0;
      for (let y = 0; y < sprite.h; y += 1) for (let x = 0; x < sprite.w; x += 1) {
        if (sprite.rgba[(y * sprite.w + x) * 4 + 3] === 0) continue;
        sum += across === 'x' ? x - sprite.ax : y - sprite.ay; count += 1;
      }
      return count ? sum / count : 0;
    };
    // East: the car's left is north (up), so frame 0 sits above the middle; west: the left is south, so it sits below.
    const east = litHalf(art.vehicleBeacons.police!.e.frames[0], 'y', 0);
    const west = litHalf(art.vehicleBeacons.police!.w.frames[0], 'y', Math.PI);
    expect(east).toBeLessThan(litHalf(art.vehicleBeacons.police!.e.frames[1], 'y', 0));
    expect(west).toBeGreaterThan(litHalf(art.vehicleBeacons.police!.w.frames[1], 'y', Math.PI));
  });

  it('warms the light bars too, a step at a time, so no turn builds one in the middle of a frame', () => {
    const fresh: ArtBook = { ...art };
    expect(isTurnWarm(fresh, 'police', 0, 3)).toBe(false);
    let drawn = 0;
    while (warmTurn(fresh, 'police', 0, 5)) drawn += 1;
    expect(drawn).toBe(betweenSteps.length);
    expect(betweenSteps.every((step) => isTurnWarm(fresh, 'police', 0, step))).toBe(true);
  });
});
