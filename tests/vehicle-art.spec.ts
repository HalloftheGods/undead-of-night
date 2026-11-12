import { describe, expect, it } from 'vitest';
import { restSize, VEHICLE_BODY_IDS, VEHICLE_FACINGS } from '../shared/vehicle-bodies.ts';
import { buildArtBook } from '../src/art/index.ts';
import { mirrorSprite } from '../src/art/kit.ts';

const { vehicles, vehicleBeacons } = buildArtBook();

describe('vehicle art', () => {
  it('draws every body facing every way, with the same coats in each facing', () => {
    for (const body of VEHICLE_BODY_IDS) {
      const counts = VEHICLE_FACINGS.map((facing) => vehicles[body][facing].length);
      expect(counts[0], body).toBeGreaterThan(0);
      expect(new Set(counts), body).toEqual(new Set([counts[0]]));
    }
  });

  it('matches the paint jobs of the side-on prop coat for coat', () => {
    const book = buildArtBook();
    expect(vehicles.sedan.w).toEqual(book.environment.paintJobs.car_sedan_h);
    expect(vehicles.van.n).toHaveLength(book.environment.paintJobs.van_h!.length);
  });

  it('makes east the exact mirror of west', () => {
    for (const body of VEHICLE_BODY_IDS) {
      vehicles[body].w.forEach((west, i) => expect(vehicles[body].e[i]).toEqual(mirrorSprite(west)));
    }
  });

  it('covers the footprint and anchors on the bottom edge centre', () => {
    for (const body of VEHICLE_BODY_IDS) {
      for (const facing of VEHICLE_FACINGS) {
        const { w, h } = restSize(body, facing);
        for (const sprite of vehicles[body][facing]) {
          expect([body, facing, sprite.w >= w, sprite.h >= h]).toEqual([body, facing, true, true]);
          expect(Number.isInteger(sprite.ax * 2), `${body} ${facing} ax`).toBe(true);
          expect(Math.abs(sprite.ax - sprite.w / 2), `${body} ${facing} centred`).toBeLessThanOrEqual(1);
          expect(sprite.ay, `${body} ${facing} ay`).toBeLessThanOrEqual(sprite.h);
        }
      }
    }
  });

  it('gives the police car and the ambulance a light bar in every facing, as big as the body under it', () => {
    for (const body of ['police', 'ambulance'] as const) {
      for (const facing of VEHICLE_FACINGS) {
        const clip = vehicleBeacons[body]![facing];
        const base = vehicles[body][facing][0];
        for (const frame of clip.frames) expect([frame.w, frame.h, frame.ax, frame.ay]).toEqual([base.w, base.h, base.ax, base.ay]);
      }
    }
  });
});
