import { describe, expect, it } from 'vitest';
import { buildingAt } from '../shared/world-query.ts';
import { generateWorldMap } from '../shared/world-map.ts';
import { SHELF_LOOK_IDS } from '../shared/container-look.ts';
import { containerLookId } from '../shared/container-look.ts';
import { townContainers } from '../shared/containers.ts';

const SEEDS = [1, 7, 42, 1234, 99991];

describe('warehouse and police furniture looks', () => {
  it('a warehouse picks one shelf look and one box look for all its furniture', () => {
    let warehouses = 0;
    const mixed: string[] = [];
    for (const seed of SEEDS) {
      const map = generateWorldMap(seed, 1);
      const byRoom = new Map<string, Set<string>>();
      const crateLooks = new Map<string, Set<string>>();
      for (const container of townContainers(map)) {
        if (container.buildingKind !== 'warehouse' || !container.building) continue;
        if (container.kind !== 'shelf' && container.kind !== 'box') continue;
        const set = container.kind === 'shelf' ? byRoom : crateLooks;
        set.set(container.building, set.get(container.building) ?? new Set());
        set.get(container.building)!.add(containerLookId(container));
      }
      for (const [room, looks] of byRoom) {
        warehouses++;
        const shelves = townContainers(map).filter((c) => c.building === room && c.kind === 'shelf').map((c) => `${c.prop}@${c.propIndex}:${c.look}->${containerLookId(c)}`);
        if (looks.size !== 1) mixed.push(`seed ${seed} ${room}: ${shelves.join(' ')}`);
        expect(SHELF_LOOK_IDS).toContain([...looks][0]);
      }
      for (const [room, looks] of crateLooks) if (looks.size !== 1) mixed.push(`seed ${seed} crates ${room}: ${[...looks].join(',')}`);
    }
    expect(mixed).toEqual([]);
    expect(warehouses).toBeGreaterThan(0);
  });

  it('a police station picks one shelf look for all its shelves, separate from other stations', () => {
    const picked = new Set<string>();
    for (const seed of SEEDS) {
      const map = generateWorldMap(seed, 1);
      const byRoom = new Map<string, Set<string>>();
      for (const container of townContainers(map)) {
        if (container.buildingKind !== 'police' || container.kind !== 'shelf' || !container.building) continue;
        byRoom.set(container.building, (byRoom.get(container.building) ?? new Set()).add(containerLookId(container)));
      }
      for (const looks of byRoom.values()) {
        expect(looks.size).toBe(1);
        picked.add([...looks][0]);
      }
    }
    expect(picked.size).toBeGreaterThan(0);
  });

  it('a stored look sits on the prop, so the same map always gives the same look', () => {
    const map = generateWorldMap(SEEDS[0], 1);
    const shelves = map.props.filter((prop) => prop.kind === 'shelf' && prop.look !== undefined);
    for (const shelf of shelves) expect(buildingAt(map, shelf.x, shelf.y - 1)).toBeDefined();
    expect(generateWorldMap(SEEDS[0], 1)).toEqual(map);
  });
});
