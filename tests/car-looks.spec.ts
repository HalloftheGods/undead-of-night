import { describe, expect, it } from 'vitest';
import { townContainers } from '../shared/containers.ts';
import { generateWorldMap } from '../shared/world-map.ts';
import { buildArtBook } from '../src/art/index.ts';
import { beaconPool, beaconsOn, coatIndex } from '../src/engine/car-looks.ts';

const book = buildArtBook();

describe('car coats', () => {
  it('gives each coat the size and anchor of its prop, shut and searched', () => {
    for (const [kind, coats] of Object.entries(book.environment.paintJobs)) {
      const base = book.environment.props[kind as keyof typeof book.environment.props];
      for (const coat of coats!) expect([kind, coat.w, coat.h, coat.ax, coat.ay]).toEqual([kind, base.w, base.h, base.ax, base.ay]);
      expect(book.paintedContainers[kind as keyof typeof book.paintedContainers], kind).toHaveLength(coats!.length);
    }
  });

  it('picks the same coat for the same spot, and spreads a street across the coats', () => {
    expect(coatIndex({ x: 120, y: 340 }, 12)).toBe(coatIndex({ x: 120, y: 340 }, 12));
    const seen = new Set(Array.from({ length: 60 }, (_, i) => coatIndex({ x: 200 + i * 37, y: 500 }, 12)));
    expect(seen.size).toBeGreaterThan(8);
  });
});

describe('emergency vehicles', () => {
  it('blinks a police bar red then blue, and holds it still with reduced motion', () => {
    const [beacon] = beaconsOn(book, { props: [{ kind: 'police_h', x: 100, y: 100 }] } as never);
    const colors = new Set([0, 0.25, 0.5, 0.75].map((t) => beaconPool(beacon, t, false).color));
    expect(colors).toEqual(new Set(['#e85c40', '#6488bc']));
    const still = new Set([0, 0.25, 0.5, 0.75].map((t) => beaconPool(beacon, t, true).color));
    expect(still.size).toBe(1);
  });

  it('parks them in towns and stocks them from the station and the clinic', () => {
    const kinds = new Set<string>();
    const stocks = new Map<string, string>();
    for (let seed = 1; seed <= 6; seed++) {
      const map = generateWorldMap(seed);
      for (const prop of map.props) kinds.add(prop.kind);
      for (const container of townContainers(map)) stocks.set(container.prop, container.stock);
    }
    for (const kind of ['police_h', 'ambulance_h', 'car_hatch_h', 'pickup_h', 'car_hatch_v']) expect(kinds.has(kind), kind).toBe(true);
    expect(stocks.get('police_h')).toBe('police');
    expect(stocks.get('ambulance_h')).toBe('clinic');
    expect(stocks.get('car_sedan_h')).toBe('outdoors');
  });
});
