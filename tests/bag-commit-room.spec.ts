import { describe, expect, it } from 'vitest';
import { applyBagCommit } from '../shared/bag-sim.ts';
import { bagLayout, createBag } from '../shared/bag.ts';
import type { BagLayoutRow } from '../shared/bag.ts';
import { townContainers } from '../shared/containers.ts';
import type { GridItem } from '../shared/grid-inventory.ts';
import { quietSim } from './helpers/sim-harness.ts';

/**
 * The host checks room for a find taken out of a container against its own copy of the bag. The player may have
 * moved things in the window to make that room: the commit's layout shows it, and the find must not be refused.
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

    // The player's layout: the same bandages packed from the far corner, and the medkit in the 2x2 that opened up.
    const layout: BagLayoutRow[] = [{ type: 'medkit', grid: 'pack', x: 0, y: 0, rotated: false }];
    let placed = 0;
    for (let y = 0; y < pack.rows; y++) {
      for (let x = 0; x < pack.cols; x++) {
        const inMedkit = x < 2 && y < 2;
        if (inMedkit || placed >= serial - 4) continue;
        layout.push({ type: 'bandage', grid: 'pack', x, y, rotated: false });
        placed++;
      }
    }
    for (let y = 0; y < pockets.rows; y++) for (let x = 0; x < pockets.cols; x++) layout.push({ type: 'bandage', grid: 'pockets', x, y, rotated: false });
    expect(placed + 4).toBe(serial);

    const container = townContainers(state.map)[0]!;
    const containerState = state.containers[container.id];
    containerState.opened = true;
    const medkit: GridItem = { id: 'cont-1', type: 'medkit', x: 0, y: 0, rotated: false };
    containerState.items = [medkit];

    applyBagCommit(state, p, { layout, drop: [], container: { id: container.id, items: [], taken: [medkit], deposited: [] } });

    expect(p.medkits).toBe(1);
    expect(state.containers[container.id].items).toEqual([]);
    expect(bagLayout(p.inventory)).toContainEqual({ type: 'medkit', grid: 'pack', x: 0, y: 0, rotated: false });
  });

  it('keeps the host arrangement when the layout does not place everything held', () => {
    const { state } = quietSim();
    const p = state.players[0]!;
    p.inventory = createBag('satchel');
    p.medkits = 0;
    // Nothing else carried, so the bandages and the find are the whole bag.
    p.bottles = 0;
    p.ammoBag = { pistol: 0, carbine: 0, shotgun: 0 };
    p.supplies = { bandage: 1, canned_food: 0, water_bottle: 0, disinfectant: 0, antibiotics: 0 };
    p.inventory.pack.items.push({ id: 'b0', type: 'bandage', x: 4, y: 3, rotated: false });
    const container = townContainers(state.map)[0]!;
    const containerState = state.containers[container.id];
    containerState.opened = true;
    const medkit: GridItem = { id: 'cont-1', type: 'medkit', x: 0, y: 0, rotated: false };
    containerState.items = [medkit];
    // A layout that leaves the held bandage out: nothing held is moved, and the find still goes in where it fits.
    const layout: BagLayoutRow[] = [{ type: 'medkit', grid: 'pack', x: 0, y: 0, rotated: false }];
    applyBagCommit(state, p, { layout, drop: [], container: { id: container.id, items: [], taken: [medkit], deposited: [] } });
    expect(p.medkits).toBe(1);
    expect(p.inventory.pack.items.find((item) => item.type === 'bandage')).toMatchObject({ x: 4, y: 3 });
  });
});
