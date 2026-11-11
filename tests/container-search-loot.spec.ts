import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateSearch } from '../shared/container-search.ts';
import { townContainers } from '../shared/containers.ts';
import { placeItem } from '../shared/grid-inventory.ts';
import { applyBagCommit } from '../shared/bag-sim.ts';
import { createBag } from '../shared/bag.ts';
import { loadAutoCloseEmptyLoot, saveAutoCloseEmptyLoot } from '../src/game/loot-prefs.ts';
import { LocalBag } from '../src/game/local-bag.ts';
import { aHud } from './backpack-fixture.ts';
import { quietSim, steps } from './helpers/sim-harness.ts';
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
    const { sim, state } = quietSim();
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

  it('transfers item from container to player stash and updates container on commit', () => {
    const { state } = quietSim();
    const p = state.players[0]!;
    p.inventory = createBag('satchel');
    const container = townContainers(state.map)[0]!;
    const containerState = state.containers[container.id];
    containerState.opened = true;
    containerState.items = [{ id: 'cont-item-1', type: 'medkit', x: 0, y: 0, rotated: false }];

    let sentCommit: unknown = null;
    const local = new LocalBag((commit) => { sentCommit = commit; });
    const hud = aHud({ medkits: 0 });
    const working = local.open(hud, container.id, 'BOX', containerState.items);

    expect(working.container.items).toHaveLength(1);
    const item = working.container.items[0]!;
    working.container.items = [];
    placeItem(working.pack, { ...item, x: 0, y: 0 });

    local.close(working);
    expect(sentCommit).toBeDefined();

    const commit = sentCommit as any;
    expect(commit.container.id).toBe(container.id);
    expect(commit.container.items).toEqual([]);
    expect(commit.container.taken).toHaveLength(1);
    expect(commit.container.taken[0].type).toBe('medkit');

    applyBagCommit(state, p, commit);
    expect(state.containers[container.id].items).toEqual([]);
    expect(p.medkits).toBe(1);
  });

  it('depositing a knife into container takes it from player without duplication glitch', () => {
    const { state } = quietSim();
    const p = state.players[0]!;
    p.knife = true;
    p.inventory = createBag('satchel');
    const container = townContainers(state.map)[0]!;
    const containerState = state.containers[container.id];
    containerState.opened = true;
    containerState.items = [];

    let sentCommit: unknown = null;
    const local = new LocalBag((commit) => { sentCommit = commit; });
    const hud = aHud({ knife: true });
    local.sync(hud);

    const working = local.open(hud, container.id, 'BOX', []);
    expect(working.pack.items.some((i) => i.type === 'knife')).toBe(true);

    const knifeItem = working.pack.items.find((i) => i.type === 'knife')!;
    working.pack.items = working.pack.items.filter((i) => i.id !== knifeItem.id);
    placeItem(working.container, { ...knifeItem, x: 0, y: 0 });

    local.close(working);
    expect(sentCommit).toBeDefined();

    const commit = sentCommit as any;
    expect(commit.container.id).toBe(container.id);
    expect(commit.container.items).toHaveLength(1);
    expect(commit.container.deposited).toHaveLength(1);
    expect(commit.container.deposited[0].type).toBe('knife');

    applyBagCommit(state, p, commit);
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

    applyBagCommit(state, p, {
      layout: [],
      drop: [],
      container: {
        id: container.id,
        items: [{ id: 'deposited-candy', type: 'jawbreaker', x: 0, y: 0, rotated: false }],
        taken: [],
        deposited: [{ id: 'deposited-candy', type: 'jawbreaker', x: 0, y: 0, rotated: false }],
      },
    });

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
