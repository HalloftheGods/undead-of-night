import { describe, expect, it } from 'vitest';
import { createBag } from '../shared/bag.ts';
import { BOTTLE_CARRY } from '../shared/bottles.ts';
import { townContainers } from '../shared/containers.ts';
import { updateSearch } from '../shared/container-search.ts';
import type { GridItem } from '../shared/grid-inventory.ts';
import { FIREWORK_CARRY, FOUNTAIN_CARRY, stashIn } from '../shared/throwables.ts';
import type { Stash } from '../shared/throwables.ts';
import { applyItemMove } from '../shared/item-move-sim.ts';
import { nextMoveId, takeOut, viewAt } from './helpers/item-moves.ts';
import { quietSim } from './helpers/sim-harness.ts';
import type { PlayerState, SimState } from '../shared/sim-state.ts';

const cell = (id: string, type: string, x = 0, ammo?: number): GridItem => ({ id, type, x, y: 0, rotated: false, ...(ammo ? { ammo } : {}) });

const firstId = (state: SimState): number => townContainers(state.map)[0]!.id;

/** The moves the window sends taking `items` out of container 0, one at a time. Returns each answer. */
function takeAll(state: SimState, p: PlayerState, items: readonly GridItem[]) {
  return items.map((item) => takeOut(state, p, firstId(state), item));
}

function openedWith(items: GridItem[]): { state: SimState; p: PlayerState } {
  const { state } = quietSim();
  const p = state.players[0]!;
  p.inventory = createBag('satchel');
  const id = townContainers(state.map)[0]!.id;
  state.containers[id].opened = true;
  state.containers[id].items = items;
  return { state, p };
}

describe('taking a Radio from a container with a move', () => {
  it('reports the find once, as a Radio on the floor does, so it unlocks the menu and gives up its track', () => {
    const { state, p } = openedWith([cell('r1', 'radio')]);
    const before = state.events.length;
    takeAll(state, p, [cell('r1', 'radio')]);
    const found = state.events.slice(before).filter((event) => event.type === 'pickup' && event.pickup === 'radio');
    expect(found).toHaveLength(1);
    expect(state.containers[firstId(state)].items).toEqual([]);
  });

  it('says nothing for a Radio that was not taken', () => {
    const { state, p } = openedWith([cell('r1', 'radio')]);
    viewAt(state, p, firstId(state));
    expect(state.events.some((event) => event.type === 'pickup')).toBe(false);
  });
});

describe('taking a counter-only item from a container with a move', () => {
  it.each([
    ['firework', (p: PlayerState) => p.fireworks],
    ['fountain', (p: PlayerState) => p.fountains],
    ['bottle', (p: PlayerState) => p.bottles],
  ] as const)('credits one %s once, removes it from the container, and does not throw', (type, counter) => {
    const { state, p } = openedWith([cell('c1', type)]);
    p.bottles = 0;
    p.fireworks = 0;
    p.fountains = 0;
    expect(takeAll(state, p, [cell('c1', type)])).toEqual([null]);
    expect(counter(p)).toBe(1);
    expect(state.containers[firstId(state)].items).toEqual([]);
    expect(p.inventory.pack.items.concat(p.inventory.pockets.items).filter((i) => i.type === type)).toHaveLength(1);
  });

  it.each([
    ['firework', FIREWORK_CARRY, (p: PlayerState, n: number) => { p.fireworks = n; }, (p: PlayerState) => p.fireworks],
    ['fountain', FOUNTAIN_CARRY, (p: PlayerState, n: number) => { p.fountains = n; }, (p: PlayerState) => p.fountains],
    ['bottle', BOTTLE_CARRY, (p: PlayerState, n: number) => { p.bottles = n; }, (p: PlayerState) => p.bottles],
  ] as const)('leaves a %s in the container at the carry cap and still applies the rest', (type, cap, set, get) => {
    const { state, p } = openedWith([cell('c1', type), cell('c2', 'medkit', 3)]);
    set(p, cap);
    p.medkits = 0;
    const [capped, medkit] = takeAll(state, p, [cell('c1', type), cell('c2', 'medkit', 3)]);
    expect(capped).not.toBeNull();
    expect(medkit).toBeNull();
    expect(get(p)).toBe(cap);
    expect(p.medkits).toBe(1);
    expect(state.containers[firstId(state)].items!.map((i) => i.type)).toEqual([type]);
  });

  it('refuses a type it does not recognise and keeps it in the container', () => {
    const { state, p } = openedWith([cell('c1', 'banana_peel'), cell('c2', 'medkit', 3)]);
    const [peel, medkit] = takeAll(state, p, [cell('c1', 'banana_peel'), cell('c2', 'medkit', 3)]);
    expect(peel).not.toBeNull();
    expect(medkit).toBeNull();
    expect(p.medkits).toBe(1);
    expect(state.containers[firstId(state)].items!.map((i) => i.type)).toEqual(['banana_peel']);
  });

  it('does not credit an item the container never held, or the same one twice', () => {
    const { state, p } = openedWith([cell('c1', 'firework')]);
    p.fireworks = 0;
    const answers = takeAll(state, p, [cell('c1', 'firework'), cell('c1', 'firework'), cell('forged', 'firework', 2)]);
    expect(answers).toEqual([null, 'gone', 'gone']);
    expect(p.fireworks).toBe(1);
  });

  it('still takes a gun with its rounds, and a candy', () => {
    const { state, p } = openedWith([cell('c1', 'shotgun', 0, 5), cell('c2', 'jawbreaker', 4)]);
    const id = firstId(state);
    viewAt(state, p, id);
    // A gun goes on, into its worn slot; the candy into the candy bag.
    const wearGun = { id: nextMoveId(p), item: 'c1', type: 'shotgun', from: { kind: 'cell' as const, grid: 'container' as const, x: 0, y: 0 }, to: { kind: 'gear' as const, slot: 'secondary' as const }, container: id };
    expect(applyItemMove(state, p, wearGun)).toBeNull();
    expect(takeOut(state, p, id, cell('c2', 'jawbreaker', 4))).toBeNull();
    expect(p.guns.shotgun?.ammo).toBe(5);
    expect(p.candy).toEqual(['jawbreaker']);
  });
});

describe('a search that turns up a stash', () => {
  const stashContainer = (state: SimState, kind: Stash) => townContainers(state.map).find((c) => stashIn(state.map.seed, c) === kind);

  it.each(['firework', 'fountain'] as const)('puts the %s in the container and credits nothing until it is taken', (kind) => {
    const { state } = quietSim();
    const container = stashContainer(state, kind);
    if (!container) return;
    const p = state.players[0]!;
    p.inventory = createBag('satchel');
    p.fireworks = 0;
    p.fountains = 0;
    p.x = container.x;
    p.y = container.y;
    p.searchHeld = true;
    for (let i = 0; i < 300; i += 1) updateSearch(state, p);
    const held = state.containers[container.id].items!;
    expect(held.some((i) => i.type === kind)).toBe(true);
    expect(p.fireworks + p.fountains).toBe(0);
    const taken = held.filter((i) => i.type === kind);
    for (const item of taken) expect(takeOut(state, p, container.id, item)).toBeNull();
    expect(kind === 'firework' ? p.fireworks : p.fountains).toBe(1);
    expect(state.containers[container.id].items!.some((i) => i.type === kind)).toBe(false);
  });
});
