import { describe, expect, it } from 'vitest';
import {
  deriveMapOpenings,
  findNearbyOpening,
  getBuildingOpenings,
  getOpeningSolidBoxes,
} from '../shared/building-openings.ts';
import type { BuildingInstance, WorldMap } from '../shared/map-protocol.ts';

describe('Building Openings & Barricade Mapping', () => {
  const testHouse: BuildingInstance = {
    id: 'b_house_1',
    kind: 'house',
    x: 100,
    y: 100,
    variant: 0,
  };

  it('derives front door, back door and windows for a house', () => {
    const openings = getBuildingOpenings(testHouse);
    expect(openings.length).toBeGreaterThanOrEqual(4);

    const frontDoor = openings.find((o) => o.type === 'door' && o.facing === 'south');
    expect(frontDoor).toBeDefined();
    expect(frontDoor?.buildingId).toBe('b_house_1');

    const backDoor = openings.find((o) => o.type === 'door' && o.facing === 'north');
    expect(backDoor).toBeDefined();

    const southWindows = openings.filter((o) => o.type === 'window' && o.facing === 'south');
    expect(southWindows.length).toBe(2);
  });

  it('locates nearest opening within reach', () => {
    const openings = getBuildingOpenings(testHouse);
    const frontDoor = openings.find((o) => o.type === 'door' && o.facing === 'south')!;

    // Directly in front of door
    const found = findNearbyOpening(openings, frontDoor.x, frontDoor.y + 10, 28);
    expect(found?.id).toBe(frontDoor.id);

    // Far away
    const notFound = findNearbyOpening(openings, 500, 500, 28);
    expect(notFound).toBeNull();
  });

  it('calculates solid collision boxes based on barricade and window state', () => {
    const openings = getBuildingOpenings(testHouse);
    const door = openings.find((o) => o.type === 'door')!;
    const windowOpening = openings.find((o) => o.type === 'window')!;

    // Open door without planks has no solid collision box
    expect(getOpeningSolidBoxes(door).length).toBe(0);

    // Barricaded door creates collision box
    door.planks = 2;
    expect(getOpeningSolidBoxes(door).length).toBe(1);

    // Intact window has collision box
    expect(getOpeningSolidBoxes(windowOpening).length).toBe(1);

    // Broken window without planks has no collision box (walkable/vaultable)
    windowOpening.isBroken = true;
    expect(getOpeningSolidBoxes(windowOpening).length).toBe(0);

    // Broken window reinforced with planks is solid again
    windowOpening.planks = 1;
    expect(getOpeningSolidBoxes(windowOpening).length).toBe(1);
  });

  it('derives openings across an entire world map', () => {
    const mockMap: WorldMap = {
      seed: 42,
      width: 1000,
      height: 1000,
      cols: 62,
      rows: 62,
      tiles: new Uint8Array(100),
      buildings: [
        testHouse,
        { id: 'b_garage_1', kind: 'garage', x: 300, y: 300, variant: 0 },
      ],
      props: [],
      districts: [],
      lights: [],
      spawn: { x: 50, y: 50 },
    };

    const mapOpenings = deriveMapOpenings(mockMap);
    expect(mapOpenings.length).toBeGreaterThan(5);
  });
});
