import { describe, expect, it } from 'vitest';
import { TICK_DT, TICK_RATE } from '../shared/constants.ts';
import { generateWorldMap } from '../shared/world-map.ts';
import {
  canTriggerRadioTower,
  RADIO_TOWER_ALARM_NOISE_RADIUS,
  RADIO_TOWER_HOLD_SEC,
  RADIO_TOWER_REACH,
  radioTowerNear,
  radioTowerPrompt,
  triggerRadioTowerAlarm,
} from '../shared/radio-tower.ts';
import { input, quietSim, stateOf, steps } from './helpers/sim-harness.ts';
import { BUNKER_SEED } from '../shared/home-protocol.ts';

describe('radio tower map generation', () => {
  it('places a radio tower in generated towns', () => {
    const map = generateWorldMap(12345, 1);
    const tower = map.props.find((p) => p.kind === 'radio_tower');
    expect(tower).toBeDefined();
    expect(tower!.x).toBeGreaterThan(0);
    expect(tower!.y).toBeGreaterThan(0);
  });

  it('places a flashing red warning beacon on the radio tower', () => {
    const map = generateWorldMap(12345, 1);
    const tower = map.props.find((p) => p.kind === 'radio_tower')!;
    const beacon = map.lights.find((l) => l.x === tower.x && l.y === tower.y - 100);
    expect(beacon).toBeDefined();
    expect(beacon!.color).toBe('#ff2222');
    expect(beacon!.flicker).toBe(true);
  });

  it('places a radio station building in generated towns', () => {
    const map = generateWorldMap(12345, 1);
    const station = map.buildings.find((b) => b.kind === 'radio_station');
    expect(station).toBeDefined();
    expect(station!.x).toBeGreaterThan(0);
    expect(station!.y).toBeGreaterThan(0);
  });
});

describe('radio tower reach and validation', () => {
  it('detects when player is within reach', () => {
    const { state } = quietSim();
    const tower = state.map.props.find((p) => p.kind === 'radio_tower')!;
    expect(radioTowerNear(state, tower.x, tower.y)).toBe(tower);
    expect(radioTowerNear(state, tower.x + RADIO_TOWER_REACH, tower.y)).toBe(tower);
    expect(radioTowerNear(state, tower.x + RADIO_TOWER_REACH + 10, tower.y)).toBeNull();
  });

  it('allows triggering only during intermission with remaining hordes', () => {
    const { state } = quietSim();
    state.phase = 'intermission';
    state.wave = 0;
    state.level = 1;
    state.intermissionLeft = 30;
    expect(canTriggerRadioTower(state)).toBe(true);

    // Wave in progress
    state.phase = 'wave';
    expect(canTriggerRadioTower(state)).toBe(false);

    // All hordes finished
    state.phase = 'intermission';
    state.wave = 10;
    expect(canTriggerRadioTower(state)).toBe(false);

    // Negligible intermission left
    state.wave = 0;
    state.intermissionLeft = 0.2;
    expect(canTriggerRadioTower(state)).toBe(false);

    // In the bunker
    const bunkerMap = generateWorldMap(BUNKER_SEED);
    expect(canTriggerRadioTower({ ...state, map: bunkerMap })).toBe(false);
  });

  it('formats prompt for keyboard and touch', () => {
    expect(radioTowerPrompt(false, true)).toBe('HOLD E: CALL HORDE');
    expect(radioTowerPrompt(true, true)).toBe('CALL HORDE');
    expect(radioTowerPrompt(false, false)).toBe('HORDE ACTIVE');
    expect(radioTowerPrompt(true, false)).toBe('HORDE ACTIVE');
  });
});

describe('radio tower interaction and early wave start', () => {
  it('accumulates hold progress and sounds alarm on completion', () => {
    const { sim, state } = quietSim();
    const tower = state.map.props.find((p) => p.kind === 'radio_tower')!;
    const [player] = state.players;
    player.x = tower.x;
    player.y = tower.y;
    state.phase = 'intermission';
    state.wave = 0;
    state.intermissionLeft = 60;

    // Press search key
    sim.setInput('a', input({ search: true }));
    steps(sim, 5);
    expect(player.towerHold).toBeGreaterThan(0);
    expect(player.towerHold).toBeLessThan(1);
    expect(state.intermissionLeft).toBeGreaterThan(50);

    // Release search cancels hold
    sim.setInput('a', input({ search: false }));
    sim.step();
    expect(player.towerHold).toBe(0);

    // Hold through completion (0.75s)
    const neededTicks = Math.ceil(RADIO_TOWER_HOLD_SEC / TICK_DT) + 1;
    sim.setInput('a', input({ search: true }));
    steps(sim, neededTicks);

    // Alarm triggered
    expect(player.searchSpent).toBe(true);
    expect(state.intermissionLeft).toBe(0);

    // Event was emitted
    const events = sim.snapshot().events;
    const alarmEvent = events.find((e) => e.type === 'radio_tower_alarm');
    expect(alarmEvent).toBeDefined();
    expect(alarmEvent).toMatchObject({
      type: 'radio_tower_alarm',
      x: tower.x,
      y: tower.y,
      playerId: 'a',
    });

    // Next step transitions into wave phase
    sim.step();
    expect(state.phase).toBe('wave');
    expect(state.wave).toBe(1);
  });

  it('direct trigger function summons horde and makes noise', () => {
    const { state } = quietSim();
    const tower = state.map.props.find((p) => p.kind === 'radio_tower')!;
    const [player] = state.players;
    state.phase = 'intermission';
    state.wave = 0;
    state.intermissionLeft = 45;

    const triggered = triggerRadioTowerAlarm(state, player, tower);
    expect(triggered).toBe(true);
    expect(state.intermissionLeft).toBe(0);
    const event = state.events.find((e) => e.type === 'radio_tower_alarm');
    expect(event).toBeDefined();
  });
});
