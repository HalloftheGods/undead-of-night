import { describe, expect, it } from 'vitest';
import { bagWanted, createBag, syncBag } from '../shared/bag.ts';
import { containerGridFor, SEARCH_WALK_AWAY, townContainers } from '../shared/containers.ts';
import type { Container } from '../shared/containers.ts';
import { dropStaleViewers, isViewing, viewContainer, viewedContainers } from '../shared/container-viewers.ts';
import type { ItemMove } from '../shared/item-move.ts';
import { applyItemMove } from '../shared/item-move-sim.ts';
import type { PlayerState, SimState } from '../shared/sim-state.ts';
import { quietSim } from './helpers/sim-harness.ts';

/** A searched container with room for a medkit, that is not a candy bowl, with the survivors standing at it. */
function openBox(state: SimState): Container {
  const container = townContainers(state.map).find((each) => {
    const { cols, rows } = containerGridFor(each);
    return each.kind !== 'bowl' && cols >= 3 && rows >= 2;
  })!;
  const containerState = state.containers[container.id]!;
  containerState.opened = true;
  containerState.items = [];
  for (const p of state.players) {
    p.x = container.x;
    p.y = container.y;
    p.inventory = createBag('satchel');
    p.medkits = 0;
    p.knife = false;
    p.candy = [];
  }
  return container;
}

const takeMedkit = (id: number, container: number): ItemMove => ({
  id,
  item: 'box-medkit',
  type: 'medkit',
  from: { kind: 'cell', grid: 'container', x: 0, y: 0 },
  to: { kind: 'cell', grid: 'pack', x: 0, y: 0, rotated: false },
  container,
});

const answers = (state: SimState, p: PlayerState) =>
  state.events.filter((event) => (event.type === 'move_ok' || event.type === 'move_no') && event.playerId === p.id);

describe('applyItemMove', () => {
  it('takes a medkit from a viewed container into the pack', () => {
    const { state } = quietSim();
    const p = state.players[0]!;
    const box = openBox(state);
    state.containers[box.id]!.items = [{ id: 'box-medkit', type: 'medkit', x: 0, y: 0, rotated: false }];
    expect(viewContainer(state, p, box.id)).toBe(true);

    expect(applyItemMove(state, p, takeMedkit(1, box.id))).toBeNull();
    expect(p.medkits).toBe(1);
    expect(state.containers[box.id]!.items).toEqual([]);
    expect(p.inventory.pack.items.some((item) => item.type === 'medkit' && item.x === 0 && item.y === 0)).toBe(true);
    expect(p.lastMoveId).toBe(1);
    expect(answers(state, p)).toEqual([{ type: 'move_ok', playerId: p.id, moveId: 1 }]);
  });

  it('ignores the same move id a second time', () => {
    const { state } = quietSim();
    const p = state.players[0]!;
    const box = openBox(state);
    state.containers[box.id]!.items = [{ id: 'box-medkit', type: 'medkit', x: 0, y: 0, rotated: false }];
    viewContainer(state, p, box.id);
    applyItemMove(state, p, takeMedkit(1, box.id));
    state.containers[box.id]!.items = [{ id: 'box-medkit', type: 'medkit', x: 0, y: 0, rotated: false }];

    expect(applyItemMove(state, p, takeMedkit(1, box.id))).toBe('bad');
    expect(p.medkits).toBe(1);
    expect(state.containers[box.id]!.items).toHaveLength(1);
    expect(answers(state, p)).toHaveLength(1);
  });

  it('gives the item to the first of two viewers and says gone to the second', () => {
    const { state } = quietSim(['a', 'b']);
    const [first, second] = state.players as [PlayerState, PlayerState];
    const box = openBox(state);
    state.containers[box.id]!.items = [{ id: 'box-medkit', type: 'medkit', x: 0, y: 0, rotated: false }];
    viewContainer(state, first, box.id);
    viewContainer(state, second, box.id);

    expect(applyItemMove(state, first, takeMedkit(1, box.id))).toBeNull();
    expect(applyItemMove(state, second, takeMedkit(1, box.id))).toBe('gone');
    expect(first.medkits).toBe(1);
    expect(second.medkits).toBe(0);
    expect(answers(state, second)).toEqual([{ type: 'move_no', playerId: second.id, moveId: 1, reason: 'gone' }]);
    expect(second.lastMoveId).toBe(0);
  });

  it('refuses a container move from someone who does not have it open', () => {
    const { state } = quietSim();
    const p = state.players[0]!;
    const box = openBox(state);
    state.containers[box.id]!.items = [{ id: 'box-medkit', type: 'medkit', x: 0, y: 0, rotated: false }];

    expect(applyItemMove(state, p, takeMedkit(1, box.id))).toBe('bad');
    expect(p.medkits).toBe(0);
    expect(state.containers[box.id]!.items).toHaveLength(1);
    expect(answers(state, p)).toEqual([{ type: 'move_no', playerId: p.id, moveId: 1, reason: 'bad' }]);
  });

  it('deposits a knife into the container and off the survivor', () => {
    const { state } = quietSim();
    const p = state.players[0]!;
    const box = openBox(state);
    p.knife = true;
    syncBag(p.inventory, bagWanted(p));
    const knife = p.inventory.pack.items.find((item) => item.type === 'knife')!;
    viewContainer(state, p, box.id);

    const move: ItemMove = {
      id: 1,
      item: knife.id,
      type: 'knife',
      from: { kind: 'cell', grid: 'pack', x: knife.x, y: knife.y },
      to: { kind: 'cell', grid: 'container', x: 0, y: 0, rotated: false },
      container: box.id,
    };
    expect(applyItemMove(state, p, move)).toBeNull();
    expect(p.knife).toBe(false);
    expect(p.inventory.pack.items.some((item) => item.type === 'knife')).toBe(false);
    expect(state.containers[box.id]!.items).toHaveLength(1);
    expect(state.containers[box.id]!.items![0]!.type).toBe('knife');
  });

  it('deposits candy out of the candy bag', () => {
    const { state } = quietSim();
    const p = state.players[0]!;
    const box = openBox(state);
    p.candy = ['jawbreaker'];
    viewContainer(state, p, box.id);

    const move: ItemMove = {
      id: 1,
      item: 'candy-carried-jawbreaker-0',
      type: 'jawbreaker',
      from: { kind: 'cell', grid: 'candy', x: 0, y: 5 },
      to: { kind: 'cell', grid: 'container', x: 0, y: 0, rotated: false },
      container: box.id,
    };
    expect(applyItemMove(state, p, move)).toBeNull();
    expect(p.candy).toEqual([]);
    expect(state.containers[box.id]!.items!.map((item) => item.type)).toEqual(['jawbreaker']);
  });
});

describe('container viewers', () => {
  it('stops a survivor viewing once they walk past the walk-away gap', () => {
    const { state } = quietSim();
    const p = state.players[0]!;
    const box = openBox(state);
    viewContainer(state, p, box.id);
    expect(viewedContainers(state)).toEqual([{ id: box.id, items: [] }]);

    p.x += SEARCH_WALK_AWAY * 4;
    dropStaleViewers(state);
    expect(isViewing(state, p, box.id)).toBe(false);
    expect(viewedContainers(state)).toEqual([]);
  });

  it('will not view a container that has not been searched', () => {
    const { state } = quietSim();
    const p = state.players[0]!;
    const box = openBox(state);
    state.containers[box.id]!.opened = false;
    expect(viewContainer(state, p, box.id)).toBe(false);
  });
});
