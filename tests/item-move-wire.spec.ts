import { describe, expect, it } from 'vitest';
import { bagLayout, bagWanted, createBag, syncBag } from '../shared/bag.ts';
import { townContainers } from '../shared/containers.ts';
import { viewContainer } from '../shared/container-viewers.ts';
import type { ItemMove } from '../shared/item-move.ts';
import { parseClientPacket } from '../shared/room/client-packets.ts';
import { buildSnapshot } from '../shared/snapshot-build.ts';
import { quietSim } from './helpers/sim-harness.ts';

const move: ItemMove = {
  id: 7,
  item: 'box-medkit',
  type: 'medkit',
  from: { kind: 'cell', grid: 'container', x: 0, y: 0 },
  to: { kind: 'cell', grid: 'pack', x: 1, y: 0, rotated: true },
  container: 2,
};

describe('move and container_view packets', () => {
  it('round-trips a move', () => {
    expect(parseClientPacket(JSON.stringify({ type: 'move', move }))).toEqual({ type: 'move', move });
  });

  it('round-trips a container_view', () => {
    expect(parseClientPacket(JSON.stringify({ type: 'container_view', id: 4, open: true }))).toEqual({ type: 'container_view', id: 4, open: true });
    expect(parseClientPacket(JSON.stringify({ type: 'container_view', id: 4, open: false }))).toEqual({ type: 'container_view', id: 4, open: false });
  });

  it('rejects a malformed move or view', () => {
    expect(parseClientPacket(JSON.stringify({ type: 'move', move: { ...move, id: 0 } }))).toBeNull();
    expect(parseClientPacket(JSON.stringify({ type: 'move', move: { ...move, to: { kind: 'cell', grid: 'roof', x: 0, y: 0, rotated: false } } }))).toBeNull();
    expect(parseClientPacket(JSON.stringify({ type: 'move' }))).toBeNull();
    expect(parseClientPacket(JSON.stringify({ type: 'container_view', id: -1, open: true }))).toBeNull();
    expect(parseClientPacket(JSON.stringify({ type: 'container_view', id: 1 }))).toBeNull();
  });
});

describe('snapshot move fields', () => {
  it("carries each survivor's bag layout and last applied move", () => {
    const { state } = quietSim();
    const p = state.players[0]!;
    p.inventory = createBag('satchel');
    p.medkits = 1;
    syncBag(p.inventory, bagWanted(p));
    p.lastMoveId = 5;

    const entity = buildSnapshot(state).players.find((each) => each.id === p.id)!;
    expect(entity.bagLayout).toEqual(bagLayout(p.inventory));
    expect(entity.bagLayout!.some((row) => row.type === 'medkit')).toBe(true);
    expect(entity.lastMoveId).toBe(5);
  });

  it('lists only the containers someone has open', () => {
    const { state } = quietSim();
    const p = state.players[0]!;
    expect(buildSnapshot(state).viewedContainers).toBeUndefined();

    const [viewed, other] = townContainers(state.map) as [ReturnType<typeof townContainers>[number], ReturnType<typeof townContainers>[number]];
    state.containers[viewed.id]!.opened = true;
    state.containers[viewed.id]!.items = [{ id: 'box-knife', type: 'knife', x: 0, y: 0, rotated: false }];
    state.containers[other.id]!.opened = true;
    state.containers[other.id]!.items = [{ id: 'box-plank', type: 'plank', x: 0, y: 0, rotated: false }];
    p.x = viewed.x;
    p.y = viewed.y;
    expect(viewContainer(state, p, viewed.id)).toBe(true);

    expect(buildSnapshot(state).viewedContainers).toEqual([
      { id: viewed.id, items: [{ id: 'box-knife', type: 'knife', x: 0, y: 0, rotated: false }] },
    ]);
  });
});
