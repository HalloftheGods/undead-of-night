import { describe, expect, it } from 'vitest';
import { bagLayout, createBag } from '../shared/bag.ts';
import { townContainers } from '../shared/containers.ts';
import type { GridItem } from '../shared/grid-inventory.ts';
import { applyItemMove } from '../shared/item-move-sim.ts';
import { nextMoveId, rearrange, viewAt } from './helpers/item-moves.ts';
import { quietSim } from './helpers/sim-harness.ts';

/**
 * The host checks room for a find taken out of a container against its own copy of the bag. The player may have
 * moved things in the window to make that room: each of those moves reached the host first, so the find fits.
 */
describe('a find taken into room the player made', () => {
  it('lands in the bag when the host copy is fragmented but the player compacted it', () => {
    const { state } = quietSim();
    const p = state.players[0]!;
    p.inventory = createBag('satchel');
    p.medkits = 0;
    // Nothing else carried, so the bandages and the find are the whole bag.
    p.bottles = 0;
    p.ammoBag = { pistol: 0, carbine: 0, shotgun: 0 };
    const { pack, pockets } = p.inventory;
    // Bandages everywhere but four scattered cells: four free, no 2x2 anywhere.
    const holes = new Set(['0,0', '2,0', '0,2', '2,2']);
    let serial = 0;
    const bandage = (x: number, y: number): GridItem => ({ id: `b${serial++}`, type: 'bandage', x, y, rotated: false });
    for (let y = 0; y < pack.rows; y++) for (let x = 0; x < pack.cols; x++) if (!holes.has(`${x},${y}`)) pack.items.push(bandage(x, y));
    for (let y = 0; y < pockets.rows; y++) for (let x = 0; x < pockets.cols; x++) pockets.items.push(bandage(x, y));
    p.supplies = { bandage: serial, canned_food: 0, water_bottle: 0, disinfectant: 0, antibiotics: 0 };
    p.inventory.serial = serial;

    // The player makes the room in the window: the three bandages in the top-left 2x2 go to three of the holes.
    const container = townContainers(state.map)[0]!;
    const containerState = state.containers[container.id];
    const medkit: GridItem = { id: 'cont-1', type: 'medkit', x: 0, y: 0, rotated: false };
    containerState.items = [medkit];
    const spare = ['2,0', '0,2', '2,2'];
    const inCorner = pack.items.filter((item) => item.x < 2 && item.y < 2);
    expect(inCorner).toHaveLength(3);
    for (const item of inCorner) {
      const [x, y] = spare.shift()!.split(',').map(Number);
      expect(rearrange(state, p, item, 'pack', 'pack', x!, y!)).toBeNull();
    }

    viewAt(state, p, container.id);
    const move = { id: nextMoveId(p), item: medkit.id, type: 'medkit', from: { kind: 'cell' as const, grid: 'container' as const, x: 0, y: 0 }, to: { kind: 'cell' as const, grid: 'pack' as const, x: 0, y: 0, rotated: false }, container: container.id };
    expect(applyItemMove(state, p, move)).toBeNull();

    expect(p.medkits).toBe(1);
    expect(state.containers[container.id].items).toEqual([]);
    expect(bagLayout(p.inventory)).toContainEqual({ type: 'medkit', grid: 'pack', x: 0, y: 0, rotated: false });
  });

  it('lands the find in the chosen cell and leaves what is held where it is', () => {
    const { state } = quietSim();
    const p = state.players[0]!;
    p.inventory = createBag('satchel');
    p.medkits = 0;
    // Nothing else carried, so the bandage and the find are the whole bag.
    p.bottles = 0;
    p.ammoBag = { pistol: 0, carbine: 0, shotgun: 0 };
    p.supplies = { bandage: 1, canned_food: 0, water_bottle: 0, disinfectant: 0, antibiotics: 0 };
    p.inventory.pack.items.push({ id: 'b0', type: 'bandage', x: 4, y: 3, rotated: false });
    const container = townContainers(state.map)[0]!;
    const containerState = state.containers[container.id];
    const medkit: GridItem = { id: 'cont-1', type: 'medkit', x: 0, y: 0, rotated: false };
    containerState.items = [medkit];
    viewAt(state, p, container.id);
    const take = (x: number, y: number) => ({ id: nextMoveId(p), item: medkit.id, type: 'medkit', from: { kind: 'cell' as const, grid: 'container' as const, x: 0, y: 0 }, to: { kind: 'cell' as const, grid: 'pack' as const, x, y, rotated: false }, container: container.id });
    // Aimed over the bandage: no room there, and nothing moves.
    expect(applyItemMove(state, p, take(3, 2))).toBe('no_room');
    expect(containerState.items).toHaveLength(1);
    expect(applyItemMove(state, p, take(0, 0))).toBeNull();
    expect(p.medkits).toBe(1);
    expect(p.inventory.pack.items.find((item) => item.type === 'bandage')).toMatchObject({ x: 4, y: 3 });
    expect(p.inventory.pack.items.find((item) => item.type === 'medkit')).toMatchObject({ x: 0, y: 0 });
  });
});
