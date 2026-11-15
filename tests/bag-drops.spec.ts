import { describe, expect, it } from 'vitest';
import { AMMO_BOX_TYPES, ammoBoxRounds, BAG_ITEM_TYPES, bagLayout, isDroppableBagItem } from '../shared/bag.ts';
import { PICKUP_TYPES } from '../shared/protocol.ts';
import { takeItem } from '../shared/pickups.ts';
import { actOn } from './helpers/item-moves.ts';
import { quietSim, steps } from './helpers/sim-harness.ts';

function carrying(set: (p: ReturnType<typeof quietSim>['state']['players'][number]) => void) {
  const quiet = quietSim();
  const p = quiet.state.players[0]!;
  p.medkits = 0;
  p.materials!.planks = 0;
  set(p);
  steps(quiet.sim, 1);
  return { ...quiet, p };
}

/** Drops one of `type` from the bag (the DROP button): the rest of the bag stays where it is. */
function dropOne(state: ReturnType<typeof quietSim>['state'], p: ReturnType<typeof quietSim>['state']['players'][number], type: string) {
  const others = bagLayout(p.inventory).filter((row) => row.type !== type);
  expect(actOn(state, p, type, 'ground')).toBeNull();
  for (const row of others) expect(bagLayout(p.inventory)).toContainEqual(row);
}

describe('dropping anything the bag holds', () => {
  it('lets every bag item be dropped, and every one has a world pickup to leave', () => {
    for (const type of BAG_ITEM_TYPES) {
      expect(isDroppableBagItem(type), type).toBe(true);
      expect((PICKUP_TYPES as readonly string[]).includes(type), type).toBe(true);
    }
  });

  it('leaves a bottle on the ground at the survivor, theirs to take back once they step off it', () => {
    const { state, p } = carrying((who) => { who.bottles = 2; });
    dropOne(state, p, 'bottle');
    expect(p.bottles).toBe(1);
    const left = state.pickups.find((item) => item.type === 'bottle');
    expect(left).toMatchObject({ x: p.x, y: p.y, leftBy: p.id });
    expect(takeItem(p, left!)).toBe(true);
    expect(p.bottles).toBe(2);
  });

  it('drops a firework and a fountain as pickups of their own', () => {
    const { state, p } = carrying((who) => { who.bottles = 0; who.fireworks = 1; who.fountains = 1; });
    dropOne(state, p, 'firework');
    dropOne(state, p, 'fountain');
    expect(p.fireworks).toBe(0);
    expect(p.fountains).toBe(0);
    expect(state.pickups.map((item) => item.type)).toEqual(expect.arrayContaining(['firework', 'fountain']));
  });

  it('drops a box of rounds with the rounds in it, out of the spare rounds', () => {
    const type = AMMO_BOX_TYPES[0];
    const size = ammoBoxRounds(type);
    const { state, p } = carrying((who) => { who.bottles = 0; who.ammoBag.pistol = size + 3; });
    const loaded = p.guns.pistol?.ammo;
    dropOne(state, p, type);
    const box = state.pickups.find((item) => item.type === type);
    expect(box?.rounds).toBe(size);
    expect(p.ammoBag.pistol).toBe(3);
    expect(p.guns.pistol?.ammo).toBe(loaded);
  });
});
