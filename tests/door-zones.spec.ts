import { describe, expect, it } from 'vitest';
import { PLAYER_RADIUS } from '../shared/constants.ts';
import { distanceToBox, DOOR_ZONE_COLUMNS, DOOR_ZONE_ROW, DOOR_ZONE_ROWS, findNearbyOpening, getBuildingOpenings, interactionBox, openingBox } from '../shared/building-openings.ts';
import { doorBoxOf } from '../shared/doors.ts';
import { NORTH_WALL_DEPTH } from '../shared/protocol.ts';
import type { BuildingInstance } from '../shared/protocol.ts';
import { drawDoorZone, zoneToShow } from '../src/engine/door-zones.ts';

const house: BuildingInstance = { id: 'h1', kind: 'house', x: 160, y: 160, variant: 0 };
const openings = getBuildingOpenings(house);
const back = openings.find((opening) => opening.facing === 'north' && opening.type === 'door')!;
const front = openings.find((opening) => opening.facing === 'south' && opening.type === 'door')!;

describe('door reach', () => {
  it('fills a back door\'s whole gap with its shut box, and no more', () => {
    const box = doorBoxOf(back);
    expect([box.y0, box.y1]).toEqual([house.y, house.y + NORTH_WALL_DEPTH]);
    expect(openingBox(back)).toEqual(box);
  });

  it('lets a body standing at the foot of the north wall work the back door', () => {
    const feet = house.y + NORTH_WALL_DEPTH + PLAYER_RADIUS + 1;
    expect(findNearbyOpening(openings, back.x, feet)).toBe(back);
  });

  it('is worked from four rows out, in front and behind, on the front door and the back, and no further', () => {
    for (const door of [front, back]) {
      const box = interactionBox(door);
      const rows = DOOR_ZONE_ROWS * DOOR_ZONE_ROW;
      expect(findNearbyOpening(openings, door.x, box.y0 + 1)).toBe(door);
      expect(findNearbyOpening(openings, door.x, box.y1 - 1)).toBe(door);
      expect(findNearbyOpening(openings, door.x, openingBox(door).y0 - rows - 1)).toBeNull();
      expect(findNearbyOpening(openings, door.x, openingBox(door).y1 + rows + 1)).toBeNull();
    }
  });

  it('reaches two columns to the left and right of the gap, and no further', () => {
    const doors = openings.filter((opening) => opening.type === 'door');
    const columns = DOOR_ZONE_COLUMNS * DOOR_ZONE_ROW;
    for (const door of [front, back]) {
      const y = openingBox(door).y1 + 10;
      expect(findNearbyOpening(doors, door.x + door.w / 2 + columns - 1, y)).toBe(door);
      expect(findNearbyOpening(doors, door.x - door.w / 2 - columns + 1, y)).toBe(door);
      expect(findNearbyOpening(doors, door.x + door.w / 2 + columns + 1, y)).toBeNull();
      expect(findNearbyOpening(doors, door.x - door.w / 2 - columns - 1, y)).toBeNull();
    }
  });

  it('refuses a door with a wall between, as from another room', () => {
    const through = findNearbyOpening(openings, back.x, house.y + 20, undefined, () => false);
    expect(through).toBeNull();
  });

  it('measures zero from inside the gap and the plain distance from outside', () => {
    expect(distanceToBox(openingBox(front), front.x, front.y)).toBe(0);
    expect(distanceToBox({ x0: 0, y0: 0, x1: 10, y1: 10 }, 13, 14)).toBe(5);
  });
});

describe('door zones', () => {
  const stand = { x: back.x, y: house.y + NORTH_WALL_DEPTH + 10 };

  it('shows the door the viewer stands at when the key would do something there', () => {
    expect(zoneToShow(openings, { action: 'open', planks: 0 }, stand.x, stand.y)).toBe(back);
    expect(zoneToShow(openings, { action: 'board', planks: 1 }, stand.x, stand.y)).toBe(back);
  });

  it('shows nothing where the key does nothing: no door in reach, none to work, or a door boarded fast', () => {
    expect(zoneToShow(openings, undefined, stand.x, stand.y)).toBeNull();
    expect(zoneToShow(openings, { action: 'boarded', planks: 3 }, stand.x, stand.y)).toBeNull();
    expect(zoneToShow(openings, { action: 'open', planks: 0 }, house.x - 400, house.y - 400)).toBeNull();
  });
});

describe('door zone border', () => {
  function counting(): { ctx: CanvasRenderingContext2D; rects: () => number } {
    let rects = 0;
    const ctx = { save: () => undefined, restore: () => undefined, fillRect: () => { rects += 1; }, fillStyle: '' } as unknown as CanvasRenderingContext2D;
    return { ctx, rects: () => rects };
  }

  it('runs round ground that can be walked, and draws nothing where none can', () => {
    const open = counting();
    drawDoorZone(open.ctx, front, 0, 0, 0, true);
    expect(open.rects()).toBeGreaterThan(0);
    const walled = counting();
    drawDoorZone(walled.ctx, front, 0, 0, 0, true, false, () => false);
    expect(walled.rects()).toBe(0);
  });

  it('outlines an obstacle: a block in the zone adds border round itself', () => {
    const open = counting();
    drawDoorZone(open.ctx, front, 0, 0, 0, true);
    const blocked = counting();
    drawDoorZone(blocked.ctx, front, 0, 0, 0, true, false, (x, y) => !(Math.abs(x - (front.x + 4)) < 1 && Math.abs(y - (front.y + 28)) < 1));
    expect(blocked.rects()).toBeGreaterThan(open.rects());
  });
});
