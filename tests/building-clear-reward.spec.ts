import { describe, expect, it } from 'vitest';
import {
  buildingTotalClearXp,
  CONTAINER_CLEAR_XP,
  mapRootBuildingContainers,
  rootBuildingIdOf,
  splitBuildingClearXp,
} from '../shared/building-clear-reward.ts';
import type { Container } from '../shared/containers.ts';
import type { BuildingInstance, WorldMap } from '../shared/protocol.ts';

describe('building clear reward logic', () => {
  it('assigns higher clear XP to longer search containers', () => {
    expect(CONTAINER_CLEAR_XP.drawer).toBe(4);
    expect(CONTAINER_CLEAR_XP.box).toBe(5);
    expect(CONTAINER_CLEAR_XP.fridge).toBe(6);
    expect(CONTAINER_CLEAR_XP.locker).toBe(8);
  });

  it('calculates total XP for a building based on container types', () => {
    const containers: Container[] = [
      { id: 1, kind: 'drawer', building: 'b1' } as Container,
      { id: 2, kind: 'locker', building: 'b1' } as Container,
      { id: 3, kind: 'fridge', building: 'b1' } as Container,
    ];
    // 4 + 8 + 6 = 18 XP
    expect(buildingTotalClearXp(containers)).toBe(18);
  });

  it('splits XP proportionally according to who searched containers in co-op', () => {
    // 10 containers: Player A searched 8 (80%), Player B searched 2 (20%)
    const searchers = [
      'pA', 'pA', 'pA', 'pA', 'pA', 'pA', 'pA', 'pA',
      'pB', 'pB',
    ];
    const totalXp = 50;
    const shares = splitBuildingClearXp(totalXp, searchers);

    expect(shares).toHaveLength(2);
    expect(shares[0]).toEqual({ playerId: 'pA', points: 40, containers: 8 });
    expect(shares[1]).toEqual({ playerId: 'pB', points: 10, containers: 2 });
    expect(shares[0].points + shares[1].points).toBe(totalXp);
  });

  it('awards 100% of XP to a solo player searching all containers', () => {
    const searchers = ['p1', 'p1', 'p1'];
    const totalXp = 25;
    const shares = splitBuildingClearXp(totalXp, searchers);

    expect(shares).toHaveLength(1);
    expect(shares[0]).toEqual({ playerId: 'p1', points: 25, containers: 3 });
  });

  it('maps containers across storeys and cellars to root building ID', () => {
    const buildings: BuildingInstance[] = [
      { id: 'hospital_main', kind: 'hospital', x: 0, y: 0, variant: 0 },
      { id: 'hospital_upstairs', kind: 'hospital_upstairs', x: 0, y: 0, variant: 0, of: 'hospital_main' },
    ];
    const containers: Container[] = [
      { id: 1, kind: 'drawer', building: 'hospital_main' } as Container,
      { id: 2, kind: 'locker', building: 'hospital_upstairs' } as Container,
    ];
    const fakeMap = {
      buildings,
      props: [],
      cols: 10,
      rows: 10,
    } as unknown as WorldMap;

    const mapped = mapRootBuildingContainers(fakeMap, containers);
    const rootContainers = mapped.get('hospital_main');

    expect(rootContainers).toBeDefined();
    expect(rootContainers).toHaveLength(2);
    expect(rootContainers?.map((c) => c.id)).toEqual([1, 2]);
  });
});
