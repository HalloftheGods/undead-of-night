import { describe, expect, it } from 'vitest';
import { parseBagCommit } from '../shared/bag-commit.ts';
import { applyBagCommit } from '../shared/bag-sim.ts';
import { ammoBoxRounds, bagWanted, createBag, stampAmmoBoxes, syncBag } from '../shared/bag.ts';
import { WEAPONS } from '../shared/constants.ts';
import { emptySupplies } from '../shared/supply-types.ts';
import { heldActions } from '../src/game/inventory/held-actions.ts';
import { quietSim, steps } from './helpers/sim-harness.ts';

const noAmmo = { pistol: 0, carbine: 0, shotgun: 0 };
const boxesIn = (bag: ReturnType<typeof createBag>, type: string) => [...bag.pack.items, ...bag.pockets.items].filter((item) => item.type === type);

describe('ammo boxes', () => {
  it('hold a full magazine each, so spare rounds are counted in magazines', () => {
    expect(ammoBoxRounds('pistol_ammo')).toBe(WEAPONS.pistol.magSize);
    expect(ammoBoxRounds('carbine_ammo')).toBe(WEAPONS.carbine.magSize);
    expect(ammoBoxRounds('shells')).toBe(WEAPONS.shotgun.magSize);
    expect(bagWanted({ medkits: 0, knife: false, ammoBag: { ...noAmmo, pistol: 25 } }).pistol_ammo).toBe(3);
    expect(bagWanted({ medkits: 0, knife: false, ammoBag: noAmmo }).pistol_ammo).toBe(0);
  });

  it('are stamped full except the last, which holds the rest', () => {
    const bag = createBag('satchel');
    const ammoBag = { ...noAmmo, pistol: 25 };
    syncBag(bag, bagWanted({ medkits: 0, knife: false, ammoBag }));
    stampAmmoBoxes(bag, ammoBag);
    expect(boxesIn(bag, 'pistol_ammo').map((item) => item.ammo)).toEqual([12, 12, 1]);
  });

  it('go as the spare rounds are spent', () => {
    const { sim, state } = quietSim();
    const p = state.players[0]!;
    p.ammoBag = { ...noAmmo, pistol: 24 };
    steps(sim, 1);
    expect(boxesIn(p.inventory, 'pistol_ammo').length).toBe(2);
    p.ammoBag.pistol = 12;
    steps(sim, 1);
    expect(boxesIn(p.inventory, 'pistol_ammo').length).toBe(1);
    p.ammoBag.pistol = 0;
    steps(sim, 1);
    expect(boxesIn(p.inventory, 'pistol_ammo').length).toBe(0);
  });

  it('are refused on pickup when the bag has no slot, except to top up a part box', () => {
    const { sim, state } = quietSim();
    const p = state.players[0]!;
    p.bottles = 0;
    p.ammoBag = { ...noAmmo, pistol: 6 };
    const slots = p.inventory.pack.rows * p.inventory.pack.cols + p.inventory.pockets.rows * p.inventory.pockets.cols;
    p.supplies = { ...emptySupplies(), bandage: slots - 1 };
    steps(sim, 1);
    expect(boxesIn(p.inventory, 'pistol_ammo').length).toBe(1);
    state.pickups.push({ id: 'ammo-a', type: 'pistol_ammo', x: p.x, y: p.y, ttl: null, rounds: 10 });
    steps(sim, 3);
    expect(p.ammoBag.pistol).toBe(12);
    expect(state.pickups.find((item) => item.id === 'ammo-a')?.rounds).toBe(4);
    steps(sim, 3);
    expect(p.ammoBag.pistol).toBe(12);
  });

  it('loading one queues a reload for the gun in hand and leaves the box until the rounds are used', () => {
    const { sim, state } = quietSim();
    const p = state.players[0]!;
    p.ammoBag = { ...noAmmo, pistol: 12 };
    steps(sim, 1);
    p.reloadQueued = false;
    applyBagCommit(state, p, { layout: [], drop: [], use: [{ type: 'pistol_ammo', count: 1 }] });
    expect(p.reloadQueued).toBe(true);
    expect(boxesIn(p.inventory, 'pistol_ammo').length).toBe(1);
  });

  it('travel in a commit as a use row', () => {
    const commit = parseBagCommit({ layout: [], drop: [], use: [{ type: 'shells', count: 1 }] });
    expect(commit?.use).toEqual([{ type: 'shells', count: 1 }]);
  });

  it('give the held item a LOAD button and no drop', () => {
    const actions = heldActions({ id: 'x', type: 'pistol_ammo', x: 0, y: 0, rotated: false });
    expect(actions).toEqual([{ kind: 'use', label: 'LOAD' }]);
  });
});
