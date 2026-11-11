import { describe, expect, it } from 'vitest';
import { mapDoors } from '../shared/doors.ts';
import { doorChoiceAt, doorPrompt, placedDoors } from '../shared/door-view.ts';
import { calculateDoorMaxHealth, createEmptyFortificationInventory, DOOR_MAX_PLANKS } from '../shared/fortifications.ts';
import type { DoorView } from '../shared/protocol.ts';
import { quietSim } from './helpers/sim-harness.ts';

describe('what a client makes of the door list', () => {
  const { map } = quietSim().state;
  const doors = mapDoors(map);
  const door = doors[0]!;
  const whole = calculateDoorMaxHealth(0);
  const view = (over: Partial<DoorView>): DoorView => ({ i: 0, open: false, planks: 0, health: whole, ...over });
  const stocked = { ...createEmptyFortificationInventory(), planks: 3, nails: 9, hasHammer: true };
  const bare = createEmptyFortificationInventory();
  const at = (views: DoorView[], sneaking: boolean, materials = stocked) => doorChoiceAt(map, views, door.x, door.y, sneaking, materials);

  it('draws nothing for a door standing open and whole', () => {
    expect(placedDoors(map, [])).toEqual([]);
    expect(placedDoors(map, [view({ open: true, health: whole - 40 })])).toEqual([]);
  });

  it('places a shut door on its own opening, with its boards', () => {
    const [placed] = placedDoors(map, [view({ planks: 2, health: calculateDoorMaxHealth(2) })]);
    expect(placed).toMatchObject({ buildingId: door.buildingId, x: door.x, y: door.y, facing: door.facing, planks: 2, broken: false, worn: false });
  });

  it('shows the beating once a shut door is under half of what it could take', () => {
    expect(placedDoors(map, [view({ health: whole * 0.4 })])[0]!.worn).toBe(true);
    expect(placedDoors(map, [view({ health: whole * 0.6 })])[0]!.worn).toBe(false);
  });

  it('tells a door broken in from one merely open', () => {
    expect(placedDoors(map, [view({ open: true, health: 0 })])[0]).toMatchObject({ broken: true, planks: 0 });
  });

  it('skips an index the map has no door for', () => {
    expect(placedDoors(map, [view({ i: doors.length + 5 })])).toEqual([]);
  });

  it('offers to close a door that stands open, listed or not', () => {
    expect(at([], false)?.action).toBe('close');
    expect(at([view({ open: true, health: whole - 10 })], false)?.action).toBe('close');
  });

  it('offers nothing at a door broken in, or away from any door', () => {
    expect(at([view({ open: true, health: 0 })], false)).toBeNull();
    expect(doorChoiceAt(map, [], door.x + 400, door.y + 400, false, stocked)).toBeNull();
  });

  it('opens a shut door, and boards it for whoever carries a plank, nails and a hammer', () => {
    expect(at([view({})], false, bare)?.action).toBe('open');
    expect(at([view({})], false)?.action).toBe('open_or_board');
    expect(at([view({})], false, { ...stocked, hasHammer: false })?.action).toBe('open');
  });

  it('adds boards standing and pries them sneaking', () => {
    const boarded = [view({ planks: 2 })];
    expect(at(boarded, false)).toEqual({ action: 'board', planks: 2 });
    expect(at(boarded, true)).toEqual({ action: 'pry', planks: 2 });
  });

  it('points a standing player at sneaking once no more boards will go on', () => {
    const full = [view({ planks: DOOR_MAX_PLANKS })];
    expect(at(full, false)?.action).toBe('sneak_to_pry');
    expect(at(full, false, bare)?.action).toBe('boarded');
    expect(at(full, true, bare)?.action).toBe('boarded');
  });

  it('words every choice for keys and for touch, and never names a key on touch', () => {
    const actions = ['close', 'open', 'open_or_board', 'board', 'pry', 'sneak_to_pry', 'boarded'] as const;
    for (const action of actions) {
      const keyed = doorPrompt({ action, planks: 2 }, false);
      const touched = doorPrompt({ action, planks: 2 }, true);
      expect(keyed.length, action).toBeGreaterThan(0);
      expect(touched, action).not.toMatch(/\bE\b/);
    }
    expect(doorPrompt({ action: 'board', planks: 2 }, false)).toBe(`HOLD E: BOARD UP 2/${DOOR_MAX_PLANKS}`);
  });
});
