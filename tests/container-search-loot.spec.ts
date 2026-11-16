import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateSearch } from '../shared/container-search.ts';
import { townContainers } from '../shared/containers.ts';
import { viewContainer } from '../shared/container-viewers.ts';
import { applyItemMove } from '../shared/item-move-sim.ts';
import { bagWanted, createBag, syncBag } from '../shared/bag.ts';
import { loadAutoCloseEmptyLoot, saveAutoCloseEmptyLoot } from '../src/game/loot-prefs.ts';
import { quietSim } from './helpers/sim-harness.ts';
import type { GameEvent, GridItem } from '../shared/protocol.ts';

type ContainerOpenedEvent = Extract<GameEvent, { type: 'container_opened' }>;

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe('Container search to loot grid integration', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('populates container items grid and emits container_opened with items upon finishing search', () => {
    const { state } = quietSim();
    const p = state.players[0]!;
    const container = townContainers(state.map)[0]!;
    state.containers[container.id].loot = { type: 'medkit', rounds: 0 };

    p.x = container.x;
    p.y = container.y;
    p.searchHeld = true;

    for (let i = 0; i < 150; i += 1) {
      updateSearch(state, p);
    }

    expect(state.containers[container.id].opened).toBe(true);
    const event = state.events.find((e): e is ContainerOpenedEvent => e.type === 'container_opened' && e.container === container.id);
    expect(event).toBeDefined();
    expect(event?.items).toBeDefined();
    expect(event?.items?.some((item: GridItem) => item.type === 'medkit')).toBe(true);
    expect(state.containers[container.id].items).toEqual(event?.items);
  });

  it('does not produce items when search turns up nothing', () => {
    const { state } = quietSim();
    const p = state.players[0]!;
    const container = townContainers(state.map)[0]!;
    state.containers[container.id].loot = null;
    (state as { rng: () => number }).rng = () => 0.99;

    p.x = container.x;
    p.y = container.y;
    p.searchHeld = true;

    for (let i = 0; i < 150; i += 1) {
      updateSearch(state, p);
    }

    expect(state.containers[container.id].opened).toBe(true);
    const event = state.events.find((e): e is ContainerOpenedEvent => e.type === 'container_opened' && e.container === container.id);
    expect(event).toBeDefined();
    expect(event?.items ?? []).toEqual([]);
    expect(event?.found).toBe(false);
  });

  it('reopens an already opened container immediately without search countdown', () => {
    const { state } = quietSim();
    const p = state.players[0]!;
    const container = townContainers(state.map)[0]!;
    const containerState = state.containers[container.id];
    containerState.opened = true;
    containerState.items = [{ id: 'test-1', type: 'bandage', x: 0, y: 0, rotated: false }];

    p.x = container.x;
    p.y = container.y;
    p.searchHeld = true;

    state.events = [];
    updateSearch(state, p);

    expect(p.search).toBe(0);
    const event = state.events.find((e): e is ContainerOpenedEvent => e.type === 'container_opened' && e.container === container.id);
    expect(event).toBeDefined();
    expect(event?.reopen).toBe(true);
    expect(event?.items).toHaveLength(1);
  });

  it('takes an item from the container into the pack, one move at a time', () => {
    const { state } = quietSim();
    const p = state.players[0]!;
    p.inventory = createBag('satchel');
    p.medkits = 0;
    const container = townContainers(state.map)[0]!;
    const containerState = state.containers[container.id];
    containerState.opened = true;
    containerState.items = [{ id: 'cont-item-1', type: 'medkit', x: 0, y: 0, rotated: false }];
    p.x = container.x;
    p.y = container.y;
    expect(viewContainer(state, p, container.id)).toBe(true);

    const reason = applyItemMove(state, p, {
      id: 1,
      item: 'cont-item-1',
      type: 'medkit',
      from: { kind: 'cell', grid: 'container', x: 0, y: 0 },
      to: { kind: 'cell', grid: 'pack', x: 0, y: 0, rotated: false },
      container: container.id,
    });
    expect(reason).toBeNull();
    expect(state.containers[container.id].items).toEqual([]);
    expect(p.medkits).toBe(1);
  });

  it('depositing a knife into container takes it from player without duplication glitch', () => {
    const { state } = quietSim();
    const p = state.players[0]!;
    p.knife = true;
    p.inventory = createBag('satchel');
    syncBag(p.inventory, bagWanted(p));
    const container = townContainers(state.map)[0]!;
    const containerState = state.containers[container.id];
    containerState.opened = true;
    containerState.items = [];
    p.x = container.x;
    p.y = container.y;
    viewContainer(state, p, container.id);

    const knifeItem = p.inventory.pack.items.find((i) => i.type === 'knife')!;
    const reason = applyItemMove(state, p, {
      id: 1,
      item: knifeItem.id,
      type: 'knife',
      from: { kind: 'cell', grid: 'pack', x: knifeItem.x, y: knifeItem.y },
      to: { kind: 'cell', grid: 'container', x: 2, y: 0, rotated: false },
      container: container.id,
    });
    expect(reason).toBeNull();
    expect(state.containers[container.id].items).toHaveLength(1);
    expect(state.containers[container.id].items![0].type).toBe('knife');
    expect(p.knife).toBe(false);
    expect(p.inventory.pack.items.some((i) => i.type === 'knife')).toBe(false);
  });

  it('depositing candy into container removes it from player candy bag', () => {
    const { state } = quietSim();
    const p = state.players[0]!;
    p.candy = ['jawbreaker'];
    const container = townContainers(state.map)[0]!;
    const containerState = state.containers[container.id];
    containerState.opened = true;
    containerState.items = [];
    p.x = container.x;
    p.y = container.y;
    viewContainer(state, p, container.id);

    const reason = applyItemMove(state, p, {
      id: 1,
      item: 'candy-carried-jawbreaker-0',
      type: 'jawbreaker',
      from: { kind: 'cell', grid: 'candy', x: 0, y: 5 },
      to: { kind: 'cell', grid: 'container', x: 2, y: 0, rotated: false },
      container: container.id,
    });
    expect(reason).toBeNull();
    expect(state.containers[container.id].items).toHaveLength(1);
    expect(p.candy).toEqual([]);
  });

  it('stores and retrieves autoCloseEmptyLoot preference', () => {
    saveAutoCloseEmptyLoot(false);
    expect(loadAutoCloseEmptyLoot()).toBe(false);

    saveAutoCloseEmptyLoot(true);
    expect(loadAutoCloseEmptyLoot()).toBe(true);
  });
});
