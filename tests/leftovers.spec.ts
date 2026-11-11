import { beforeAll, describe, expect, it, vi } from 'vitest';
import { groundBuildingId, leftoversOf, supplyKindOf } from '../shared/leftovers.ts';
import { BUILDING_DEFS } from '../shared/protocol.ts';
import type { BuildingInstance, PickupType, SnapshotPacket } from '../shared/protocol.ts';
import type { PickupState, SimState } from '../shared/sim-state.ts';
import { viewFor } from '../shared/snapshot-view.ts';
import { generateWorldMap } from '../shared/world-map.ts';
import { buildingAt } from '../shared/world-query.ts';
import { isSnapshotPacket } from '../src/network/packet-guards.ts';
import { drawLeftovers, LEFTOVER_KEY, leftoverKinds } from '../src/game/map-leftovers.ts';
import { mapKey } from '../src/game/map-key.ts';
import { TownMapView } from '../src/game/town-map.ts';
import { fakeCanvas, installFakeBrowser } from './client-fake-dom.ts';
import { quietSim } from './helpers/sim-harness.ts';

const middleOf = (building: BuildingInstance): { x: number; y: number } => {
  const { w, h } = BUILDING_DEFS[building.kind];
  return { x: building.x + w / 2, y: building.y + h / 2 };
};

/** A corner well inside the walls, far enough from the middle that nobody standing there picks it up. */
const cornerOf = (building: BuildingInstance): { x: number; y: number } => ({ x: building.x + 16, y: building.y + 16 });

function firstHouse(state: SimState): BuildingInstance {
  const house = state.map.buildings.find((building) => building.kind === 'house' && building.of === undefined);
  if (!house) throw new Error('no house in this town');
  return house;
}

function drop(state: SimState, type: PickupType, at: { x: number; y: number }, ttl: number | null = null): PickupState {
  const item: PickupState = { id: `i${state.pickups.length + 1000}`, type, x: at.x, y: at.y, ttl, rounds: 6 };
  state.pickups.push(item);
  return item;
}

describe('supplies left behind', () => {
  it('sorts every pickup into med, ammo, a weapon or gear', () => {
    expect(supplyKindOf('bandage')).toBe('med');
    expect(supplyKindOf('medkit')).toBe('med');
    expect(supplyKindOf('pistol_ammo')).toBe('ammo');
    expect(supplyKindOf('shells')).toBe('ammo');
    expect(supplyKindOf('shotgun')).toBe('weapon');
    expect(supplyKindOf('knife')).toBe('weapon');
    expect(supplyKindOf('radio')).toBe('gear');
  });

  it('marks nothing in a house nobody has been inside', () => {
    const { sim, state } = quietSim();
    drop(state, 'medkit', cornerOf(firstHouse(state)));
    sim.step();
    expect(sim.snapshot().leftovers).toBeUndefined();
  });

  it('marks the house once someone has been in, keeps it after they leave, and clears it once emptied', () => {
    const { sim, state } = quietSim();
    const house = firstHouse(state);
    const medkit = drop(state, 'medkit', cornerOf(house));
    drop(state, 'pistol_ammo', cornerOf(house));
    const [p] = state.players;
    Object.assign(p, middleOf(house));
    sim.step();
    p.x = house.x - 200;
    p.y = house.y - 200;
    sim.step();
    expect(sim.snapshot().leftovers).toEqual([{ building: house.id, supplies: { med: 1, ammo: 1 } }]);

    state.pickups = state.pickups.filter((item) => item !== medkit);
    sim.step();
    expect(sim.snapshot().leftovers).toEqual([{ building: house.id, supplies: { ammo: 1 } }]);
    state.pickups = [];
    sim.step();
    expect(sim.snapshot().leftovers).toBeUndefined();
  });

  it('tells the whole team, however far away they are', () => {
    const { sim, state } = quietSim(['a', 'b']);
    const house = firstHouse(state);
    drop(state, 'bandage', cornerOf(house));
    const [a, b] = state.players;
    Object.assign(a, middleOf(house));
    b.x = house.x + 2000;
    b.y = house.y;
    sim.step();
    const frame: SnapshotPacket = sim.snapshot();
    const farView = viewFor(frame, b.id);
    expect(farView.pickups).toEqual([]);
    expect(farView.leftovers).toEqual([{ building: house.id, supplies: { med: 1 } }]);
  });

  it('ignores a kill drop that will rot away', () => {
    const { state } = quietSim();
    const house = firstHouse(state);
    drop(state, 'bandage', cornerOf(house), 5);
    expect(leftoversOf(state.map, state.pickups, new Set([house.id]))).toEqual([]);
  });

  it('counts a floor above or below as its house', () => {
    const seed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find((each) => generateWorldMap(each).buildings.some((building) => building.of !== undefined));
    const map = generateWorldMap(seed as number);
    const storey = map.buildings.find((building) => building.of !== undefined) as BuildingInstance;
    const at = middleOf(storey);
    expect(buildingAt(map, at.x, at.y)?.id).toBe(storey.id);
    const item: PickupState = { id: 'i1', type: 'medkit', ...at, ttl: null, rounds: 0 };
    expect(groundBuildingId(storey)).toBe(storey.of);
    expect(leftoversOf(map, [item], new Set([storey.of as string]))).toEqual([{ building: storey.of, supplies: { med: 1 } }]);
  });

  it('passes the packet guard, and a bad kind does not', () => {
    const { sim } = quietSim();
    const packet = sim.snapshot();
    expect(isSnapshotPacket({ ...packet, leftovers: [{ building: 'b1', supplies: { med: 2, gear: 1 } }] })).toBe(true);
    expect(isSnapshotPacket({ ...packet, leftovers: [{ building: 'b1', supplies: { med: 2, gear: 1 }, clue: true }] })).toBe(true);
    expect(isSnapshotPacket({ ...packet, leftovers: [{ building: 'b1', supplies: { cake: 1 } }] })).toBe(false);
    expect(isSnapshotPacket({ ...packet, leftovers: [{ supplies: {} }] })).toBe(false);
  });

  it('flags a building as a clue when it is in the clues set', () => {
    const { state } = quietSim();
    const house = firstHouse(state);
    drop(state, 'medkit', cornerOf(house));
    const clues = new Set([house.id]);
    const leftovers = leftoversOf(state.map, state.pickups, new Set([house.id]), clues);
    expect(leftovers).toEqual([{ building: house.id, supplies: { med: 1 }, clue: true }]);
  });
});

describe('the map marks for supplies left behind', () => {
  beforeAll(() => installFakeBrowser());

  it('lists a mark per kind in the key, in order', () => {
    expect(mapKey(false).groups.find((group) => group.title === 'Left behind')?.entries).toBe(LEFTOVER_KEY);
    expect(leftoverKinds({ gear: 1, med: 2, ammo: 0 })).toEqual(['med', 'gear']);
  });

  it('draws one glyph per kind along the building foot', () => {
    const ctx = fakeCanvas().getContext() as unknown as CanvasRenderingContext2D;
    const fills = vi.spyOn(ctx, 'fillRect');
    drawLeftovers(ctx, { x0: 10, y1: 60 }, { med: 1, weapon: 3 });
    const backings = fills.mock.calls.filter(([, , w, h]) => w === 7 && h === 7);
    expect(backings.map(([x]) => x)).toEqual([11, 18]);
  });

  it('paints the town with leftovers and clue caches without trouble', () => {
    const map = generateWorldMap(4242);
    const view = new TownMapView(map);
    const ctx = fakeCanvas().getContext() as unknown as CanvasRenderingContext2D;
    const leftovers = [
      { building: map.buildings[0].id, supplies: { ammo: 2 }, clue: true },
      { building: 'nope', supplies: { med: 1 } },
    ];
    const clock = { nowMs: 100, openedMs: 0, reducedMotion: false };
    expect(() => view.paint(ctx, [], null, null, [], null, clock, leftovers)).not.toThrow();
    const stillClock = { nowMs: 100, openedMs: 0, reducedMotion: true };
    expect(() => view.paint(ctx, [], null, null, [], null, stillClock, leftovers)).not.toThrow();
  });
});
