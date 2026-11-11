import { describe, expect, it } from 'vitest';
import { applyBagCommit } from '../shared/bag-sim.ts';
import { createBag } from '../shared/bag.ts';
import { BOTTLE_CARRY } from '../shared/bottles.ts';
import { townContainers } from '../shared/containers.ts';
import { updateSearch } from '../shared/container-search.ts';
import type { GridItem } from '../shared/grid-inventory.ts';
import { FIREWORK_CARRY, FOUNTAIN_CARRY, stashIn } from '../shared/throwables.ts';
import type { Stash } from '../shared/throwables.ts';
import { quietSim } from './helpers/sim-harness.ts';
import type { PlayerState, SimState } from '../shared/sim-state.ts';

const cell = (id: string, type: string, x = 0, ammo?: number): GridItem => ({ id, type, x, y: 0, rotated: false, ...(ammo ? { ammo } : {}) });

/** A commit as the modal sends it after taking `items` out of container 0. */
function takeCommit(state: SimState, items: readonly GridItem[]) {
  const id = townContainers(state.map)[0]!.id;
  const left = state.containers[id].items!.filter((i) => !items.some((t) => t.id === i.id));
  return { layout: [], drop: [], container: { id, items: left, taken: items, deposited: [] } };
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

describe('taking a counter-only item from a container through the modal commit', () => {
  it.each([
    ['firework', (p: PlayerState) => p.fireworks],
    ['fountain', (p: PlayerState) => p.fountains],
    ['bottle', (p: PlayerState) => p.bottles],
  ] as const)('credits one %s once, removes it from the container, and does not throw', (type, counter) => {
    const { state, p } = openedWith([cell('c1', type)]);
    p.bottles = 0;
    p.fireworks = 0;
    p.fountains = 0;
    const commit = takeCommit(state, [cell('c1', type)]);
    expect(() => applyBagCommit(state, p, commit)).not.toThrow();
    expect(counter(p)).toBe(1);
    expect(state.containers[commit.container.id].items).toEqual([]);
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
    const commit = takeCommit(state, [cell('c1', type), cell('c2', 'medkit', 3)]);
    expect(() => applyBagCommit(state, p, commit)).not.toThrow();
    expect(get(p)).toBe(cap);
    expect(p.medkits).toBe(1);
    expect(state.containers[commit.container.id].items!.map((i) => i.type)).toEqual([type]);
  });

  it('refuses a type it does not recognise and keeps it in the container', () => {
    const { state, p } = openedWith([cell('c1', 'banana_peel'), cell('c2', 'medkit', 3)]);
    const commit = takeCommit(state, [cell('c1', 'banana_peel'), cell('c2', 'medkit', 3)]);
    expect(() => applyBagCommit(state, p, commit)).not.toThrow();
    expect(p.medkits).toBe(1);
    expect(state.containers[commit.container.id].items!.map((i) => i.type)).toEqual(['banana_peel']);
  });

  it('does not credit an item the container never held, or the same one twice', () => {
    const { state, p } = openedWith([cell('c1', 'firework')]);
    p.fireworks = 0;
    const commit = takeCommit(state, [cell('c1', 'firework'), cell('c1', 'firework'), cell('forged', 'firework', 2)]);
    applyBagCommit(state, p, commit);
    expect(p.fireworks).toBe(1);
  });

  it('still takes a gun with its rounds, and a candy', () => {
    const { state, p } = openedWith([cell('c1', 'shotgun', 0, 5), cell('c2', 'jawbreaker', 4)]);
    applyBagCommit(state, p, takeCommit(state, [cell('c1', 'shotgun', 0, 5), cell('c2', 'jawbreaker', 4)]));
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
    applyBagCommit(state, p, { layout: [], drop: [], container: { id: container.id, items: held.filter((i) => i.type !== kind), taken, deposited: [] } });
    expect(kind === 'firework' ? p.fireworks : p.fountains).toBe(1);
    expect(state.containers[container.id].items!.some((i) => i.type === kind)).toBe(false);
  });
});
