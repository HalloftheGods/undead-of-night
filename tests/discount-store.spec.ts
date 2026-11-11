import { describe, expect, it } from 'vitest';
import { furnish } from '../shared/building-interiors.ts';
import { CONTAINER_LOOT } from '../shared/container-loot.ts';
import { LOOT_RULES } from '../shared/loot.ts';
import type { MapBuilder } from '../shared/map-builder.ts';
import { BUILDING_DEFS, BUILDING_KINDS, TILE_SIZE, WALL_THICKNESS } from '../shared/protocol.ts';
import type { BuildingInstance, BuildingKind, PropInstance } from '../shared/protocol.ts';
import { hasDiscountStore } from '../shared/town-buildings.ts';
import { townContainers } from '../shared/containers.ts';
import { PART_ORDER } from '../shared/gun-upgrade-data.ts';
import { KIT_ORDER } from '../shared/round-effect-data.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { stateOf } from './helpers/sim-harness.ts';
import { buildingBox, generateWorldMap, propBox } from '../shared/world-map.ts';

const TOWNS = 200;
/** The store's odds are two in three; 200 towns land well inside this. */
const STORE_SHARE: readonly [number, number] = [0.55, 0.8];
const NEVER_DISPLACED: readonly BuildingKind[] = ['pharmacy', 'clinic', 'police'];

/** Every piece of a kind's layout, optional ones included. */
function everyPiece(kind: BuildingKind): { building: BuildingInstance; props: PropInstance[] } {
  const building: BuildingInstance = { id: 'b1', kind, x: 8 * TILE_SIZE, y: 8 * TILE_SIZE, variant: 0 };
  const props: PropInstance[] = [];
  const builder = { rng: () => 0, fixture: (prop: PropInstance['kind'], x: number, y: number) => props.push({ kind: prop, x, y }) };
  furnish(builder as unknown as MapBuilder, building);
  return { building, props };
}

describe('S.O.S. Discount', () => {
  it('is a shop a little smaller than the grocery, under its own name', () => {
    const store = BUILDING_DEFS.discount;
    expect(store.label).toBe('S.O.S. Discount');
    expect(store.w).toBeLessThan(BUILDING_DEFS.grocery.w);
    expect(store.h).toBeLessThan(BUILDING_DEFS.grocery.h);
  });

  it.each(BUILDING_KINDS.filter((kind) => !kind.startsWith('sewer_')))('%s: has an interior and loot on its floors and in its furniture', (kind) => {
    expect(everyPiece(kind).props.length).toBeGreaterThan(0);
    expect(Object.keys(LOOT_RULES[kind].table).length).toBeGreaterThan(0);
    expect(Object.keys(CONTAINER_LOOT[kind].table).length).toBeGreaterThan(0);
  });

  it('keeps every piece inside the walls, with no two overlapping', () => {
    const { building, props } = everyPiece('discount');
    const room = buildingBox(building);
    const boxes = props.map(propBox);
    for (const box of boxes) {
      expect(box.x0).toBeGreaterThanOrEqual(room.x0 + WALL_THICKNESS);
      expect(box.x1).toBeLessThanOrEqual(room.x1 - WALL_THICKNESS);
      expect(box.y0).toBeGreaterThanOrEqual(room.y0 + WALL_THICKNESS);
      expect(box.y1).toBeLessThanOrEqual(room.y1 - WALL_THICKNESS);
    }
    boxes.forEach((a, i) => {
      for (const b of boxes.slice(i + 1)) {
        const overlaps = a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
        expect(overlaps, `${JSON.stringify(a)} and ${JSON.stringify(b)}`).toBe(false);
      }
    });
  });

  it(`stands in about two towns in three, never twice, and never in place of medicine or the law (${TOWNS} towns)`, () => {
    let towns = 0;
    for (let seed = 1; seed <= TOWNS; seed++) {
      const { buildings } = generateWorldMap(seed);
      const count = (kind: BuildingKind) => buildings.filter((b) => b.kind === kind).length;
      // A town without room for it Downtown, once the hospital stands, goes without.
      expect(count('discount'), `seed ${seed}`).toBeLessThanOrEqual(hasDiscountStore(seed) ? 1 : 0);
      for (const kind of NEVER_DISPLACED) expect(count(kind), `seed ${seed} ${kind}`).toBeGreaterThanOrEqual(1);
      towns += count('discount');
    }
    expect(towns / TOWNS).toBeGreaterThanOrEqual(STORE_SHARE[0]);
    expect(towns / TOWNS).toBeLessThanOrEqual(STORE_SHARE[1]);
  }, 120000);

  it('opens from the first level, whatever the biome', () => {
    const seed = Array.from({ length: 20 }, (_, i) => i + 1).find(hasDiscountStore) ?? 1;
    for (const level of [1, 4, 7, 10]) expect(generateWorldMap(seed, level).buildings.some((b) => b.kind === 'discount'), `level ${level}`).toBe(true);
  });

  it('always stocks canned food and bottled water on its floor', () => {
    expect(LOOT_RULES.discount.fixed).toEqual(['canned_food', 'water_bottle']);
  });

  it('always carries a rare kit or gun part on its shelves', () => {
    const rarePool = new Set([...KIT_ORDER, ...PART_ORDER]);
    const seeds = Array.from({ length: 30 }, (_, i) => i + 1).filter(hasDiscountStore).slice(0, 5);
    for (const seed of seeds) {
      const sim = new GameSimulation({ seed });
      const state = stateOf(sim);
      const discountShelves = townContainers(state.map).filter(
        (c) => c.buildingKind === 'discount' && c.kind === 'shelf'
      );
      const shelfLoots = discountShelves.map((c) => state.containers[c.id].loot?.type);
      const hasRare = shelfLoots.some((type) => type !== undefined && rarePool.has(type as never));
      expect(hasRare, `seed ${seed} discount store shelves should carry a rare item`).toBe(true);
    }
  });
});
