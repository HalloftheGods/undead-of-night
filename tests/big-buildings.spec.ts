import { describe, expect, it } from 'vitest';
import { furnish } from '../shared/building-interiors.ts';
import { PARTITIONS, backDoorBox } from '../shared/building-plans.ts';
import { CANDY_ODDS } from '../shared/candy.ts';
import { LOOT_RULES } from '../shared/loot.ts';
import type { MapBuilder } from '../shared/map-builder.ts';
import { BUILDING_DEFS, BUILDING_KINDS, TILE_SIZE, WALL_THICKNESS } from '../shared/protocol.ts';
import type { BuildingInstance, BuildingKind, PropInstance } from '../shared/protocol.ts';
import { flightAt, isStoreyKind, stairsPoint } from '../shared/storeys.ts';
import { generateWorldMap } from '../shared/world-map.ts';
import { buildingBox, doorBox, propBox } from '../shared/world-query.ts';
import { guidePlaces } from '../src/game/town-guide.ts';

const BIG: readonly BuildingKind[] = ['hospital', 'school'];
const TOWNS = 60;
/** Each should stand in nearly every town: the odd cramped town may have no plot big enough. */
const LEAST_SHARE = 0.9;

function everyPiece(kind: BuildingKind): { building: BuildingInstance; props: PropInstance[] } {
  const building: BuildingInstance = { id: 'b1', kind, x: 8 * TILE_SIZE, y: 8 * TILE_SIZE, variant: 0 };
  const props: PropInstance[] = [];
  const builder = { rng: () => 0, fixture: (prop: PropInstance['kind'], x: number, y: number) => props.push({ kind: prop, x, y }) };
  furnish(builder as unknown as MapBuilder, building);
  return { building, props };
}

type Box = ReturnType<typeof propBox>;

const overlaps = (a: Box, b: Box): boolean =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

describe('schools and hospitals', () => {
  it('are the biggest buildings in town', () => {
    const area = (kind: BuildingKind) => BUILDING_DEFS[kind].w * BUILDING_DEFS[kind].h;
    const others = BUILDING_KINDS.filter((kind) => !BIG.includes(kind) && !isStoreyKind(kind));
    for (const kind of BIG) for (const other of others) expect(area(kind), `${kind} vs ${other}`).toBeGreaterThan(area(other));
  });

  it.each(BIG)('%s: furniture stays inside the walls, off the inside walls and off itself', (kind) => {
    const { building, props } = everyPiece(kind);
    const room = buildingBox(building);
    const boxes = props.map(propBox);
    const walls = (PARTITIONS[kind] ?? []).map((r) => ({ x0: building.x + r.x0, y0: building.y + r.y0, x1: building.x + r.x1, y1: building.y + r.y1 }));
    for (const box of boxes) {
      expect(box.x0).toBeGreaterThanOrEqual(room.x0 + WALL_THICKNESS);
      expect(box.x1).toBeLessThanOrEqual(room.x1 - WALL_THICKNESS);
      expect(box.y0).toBeGreaterThanOrEqual(room.y0 + WALL_THICKNESS);
      expect(box.y1).toBeLessThanOrEqual(room.y1 - WALL_THICKNESS);
      for (const wall of walls) expect(overlaps(box, wall), `${JSON.stringify(box)} in a wall`).toBe(false);
    }
    boxes.forEach((a, i) => {
      for (const b of boxes.slice(i + 1)) expect(overlaps(a, b), `${JSON.stringify(a)} and ${JSON.stringify(b)}`).toBe(false);
    });
  });

  it.each(BIG)('%s: has rooms, and a back door that nothing stands in front of', (kind) => {
    expect((PARTITIONS[kind] ?? []).length).toBeGreaterThan(2);
    const { building, props } = everyPiece(kind);
    const back = backDoorBox(building);
    expect(back).not.toBeNull();
    const step = { ...back!, y1: back!.y1 + 24 };
    const front = doorBox(building);
    const mat = { ...front, y0: front.y0 - 24 };
    for (const box of props.map(propBox)) {
      expect(overlaps(box, step), 'blocks the back door').toBe(false);
      expect(overlaps(box, mat), 'blocks the front door').toBe(false);
    }
  });

  it('a hospital always has a medkit; a school hides more candy than any shop', () => {
    expect(LOOT_RULES.hospital.fixed).toContain('medkit');
    expect(CANDY_ODDS.school ?? 0).toBeGreaterThan(CANDY_ODDS.grocery ?? 0);
  });

  it(`stand in nearly every town, once, without pushing out medicine or the law (${TOWNS} towns)`, () => {
    const found: Record<string, number> = { hospital: 0, school: 0 };
    for (let seed = 1; seed <= TOWNS; seed++) {
      const { buildings } = generateWorldMap(seed);
      const count = (kind: BuildingKind) => buildings.filter((b) => b.kind === kind).length;
      for (const kind of BIG) {
        expect(count(kind), `seed ${seed} ${kind}`).toBeLessThanOrEqual(1);
        found[kind] += count(kind);
      }
      for (const kind of ['pharmacy', 'clinic', 'police', 'gun_shop'] as const) expect(count(kind), `seed ${seed} ${kind}`).toBeGreaterThanOrEqual(1);
    }
    for (const kind of BIG) expect(found[kind] / TOWNS, kind).toBeGreaterThanOrEqual(LEAST_SHARE);
  }, 120000);

  it('each have a second floor, up stairs you walk onto, laid out round the same corridor', () => {
    const upstairs: Partial<Record<BuildingKind, BuildingKind>> = { hospital: 'hospital_upstairs', school: 'school_upstairs' };
    for (const seed of [1, 2, 3, 99]) {
      const map = generateWorldMap(seed);
      for (const building of map.buildings.filter((b) => BIG.includes(b.kind))) {
        const floor = map.buildings.find((b) => b.of === building.id);
        expect(floor?.kind, `seed ${seed} ${building.kind}`).toBe(upstairs[building.kind]);
        const foot = stairsPoint(building)!;
        expect(flightAt(map, foot.x, foot.y)?.label).toBe('UPSTAIRS');
        expect(flightAt(map, foot.x, foot.y)?.to).toEqual(stairsPoint(floor!));
      }
    }
    for (const kind of BIG) expect((PARTITIONS[upstairs[kind]!] ?? []).length).toBeGreaterThan(4);
  });

  it('each have a page in the Town Guide', () => {
    const pages = guidePlaces().map((place) => place.id);
    expect(pages).toContain('hospital');
    expect(pages).toContain('school');
  });
});
