import { describe, expect, it } from 'vitest';
import { bagWanted, createBag, syncBag } from '../shared/bag.ts';
import { careHelps, CARE_FOOD_MS, CARE_MEDICAL_MS, tickCare } from '../shared/care.ts';
import type { ItemMove } from '../shared/item-move.ts';
import { applyItemMove } from '../shared/item-move-sim.ts';
import type { PlayerState, SimState } from '../shared/sim-state.ts';
import { emptySupplies } from '../shared/supply-types.ts';
import { quietSim } from './helpers/sim-harness.ts';

const TICK_MS = 50;

/** Two survivors side by side, the giver with one of `type` in the pack. */
function pair(type: 'bandage' | 'canned_food'): { state: SimState; giver: PlayerState; receiver: PlayerState } {
  const { state } = quietSim(['a', 'b']);
  const [giver, receiver] = state.players as [PlayerState, PlayerState];
  for (const p of state.players) {
    p.inventory = createBag('satchel');
    p.supplies = emptySupplies();
    p.medkits = 0;
    p.moving = false;
  }
  receiver.x = giver.x + 20;
  receiver.y = giver.y;
  giver.supplies![type] = 1;
  syncBag(giver.inventory, bagWanted(giver));
  return { state, giver, receiver };
}

const giveMove = (giver: PlayerState, receiver: PlayerState, type: string): ItemMove => {
  const item = [...giver.inventory.pack.items, ...giver.inventory.pockets.items].find((each) => each.type === type)!;
  const grid = giver.inventory.pack.items.includes(item) ? 'pack' : 'pockets';
  return { id: 1, item: item.id, type, from: { kind: 'cell', grid, x: item.x, y: item.y }, to: { kind: 'player', id: receiver.id } };
};

const run = (state: SimState, ms: number): void => {
  for (let t = 0; t < ms; t += TICK_MS) tickCare(state, TICK_MS);
};
const eventTypes = (state: SimState): string[] => state.events.map((event) => event.type);

describe('care', () => {
  it('refuses a receiver out of reach', () => {
    const { state, giver, receiver } = pair('bandage');
    receiver.needs!.bleeding = true;
    receiver.x = giver.x + 200;
    expect(applyItemMove(state, giver, giveMove(giver, receiver, 'bandage'))).toBe('too_far');
    expect(giver.supplies!.bandage).toBe(1);
  });

  it('refuses food for a fed receiver', () => {
    const { state, giver, receiver } = pair('canned_food');
    receiver.needs!.hunger = 0;
    receiver.health = receiver.maxHealth;
    expect(careHelps(receiver, 'canned_food')).toBe(false);
    expect(applyItemMove(state, giver, giveMove(giver, receiver, 'canned_food'))).toBe('not_needed');
  });

  it('bandages a bleeding receiver after 2500 ms', () => {
    const { state, giver, receiver } = pair('bandage');
    receiver.needs!.bleeding = true;
    expect(applyItemMove(state, giver, giveMove(giver, receiver, 'bandage'))).toBeNull();
    expect(giver.supplies!.bandage).toBe(0);
    expect(giver.inventory.pack.items.concat(giver.inventory.pockets.items)).toEqual([]);
    run(state, CARE_MEDICAL_MS - 200);
    expect(receiver.needs!.bleeding).toBe(true);
    run(state, 300);
    expect(receiver.needs!.bleeding).toBe(false);
    expect(eventTypes(state)).toEqual(expect.arrayContaining(['care_start', 'care_reply', 'care_done']));
    expect(giver.care).toBeNull();
  });

  it('breaks when the receiver moves, and the item goes back to the giver cell', () => {
    const { state, giver, receiver } = pair('bandage');
    receiver.needs!.bleeding = true;
    const move = giveMove(giver, receiver, 'bandage');
    applyItemMove(state, giver, move);
    run(state, 1000);
    receiver.moving = true;
    run(state, TICK_MS);
    expect(eventTypes(state)).toContain('care_break');
    expect(giver.supplies!.bandage).toBe(1);
    const back = giver.inventory.pack.items.find((item) => item.type === 'bandage');
    expect(back).toMatchObject({ x: move.from.kind === 'cell' ? move.from.x : -1, y: move.from.kind === 'cell' ? move.from.y : -1 });
  });

  it('leaves the item at the giver feet when the bag filled up meanwhile', () => {
    const { state, giver, receiver } = pair('bandage');
    receiver.needs!.bleeding = true;
    applyItemMove(state, giver, giveMove(giver, receiver, 'bandage'));
    // Stuff every cell with plank-sized junk by turning the grids full of knives would be fragile: shrink the bag instead.
    giver.inventory.pack.cols = 0;
    giver.inventory.pack.rows = 0;
    giver.inventory.pockets.cols = 0;
    giver.inventory.pockets.rows = 0;
    receiver.moving = true;
    state.pickups = [];
    run(state, TICK_MS);
    expect(giver.supplies!.bandage).toBe(0);
    expect(state.pickups.some((pickup) => pickup.type === 'bandage' && pickup.x === giver.x && pickup.y === giver.y)).toBe(true);
  });

  it('drops the item on the ground when the giver dies mid-care', () => {
    const { state, giver, receiver } = pair('canned_food');
    receiver.needs!.hunger = 80;
    applyItemMove(state, giver, giveMove(giver, receiver, 'canned_food'));
    run(state, CARE_FOOD_MS / 3);
    giver.status = 'dead';
    state.pickups = [];
    run(state, TICK_MS);
    expect(state.pickups.some((pickup) => pickup.type === 'canned_food')).toBe(true);
    expect(giver.care).toBeNull();
    expect(receiver.needs!.hunger).toBe(80);
  });
});
