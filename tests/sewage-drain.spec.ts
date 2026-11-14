import { describe, expect, it } from 'vitest';
import { TICK_DT } from '../shared/constants.ts';
import { generateWorldMap } from '../shared/world-map.ts';
import {
  canDrainCity,
  drainTownWater,
  isTownFlooded,
  SEWAGE_DRAIN_HOLD_SEC,
  SEWAGE_DRAIN_REACH,
  sewageDrainNear,
  sewageDrainPrompt,
  triggerDrainCity,
} from '../shared/sewage-drain.ts';
import { climbPrompt, manholeFlightNear, takeManhole } from '../shared/take-manhole.ts';
import { FLOOD_SPEED_SCALE, groundSpeedScale } from '../shared/town-rules.ts';
import { levelSidequest, levelTitle } from '../src/game/level-hud.ts';
import { buildSnapshot } from '../shared/snapshot-build.ts';
import { addZombie, eventsOf, input, quietSim, steps } from './helpers/sim-harness.ts';
import { GameSimulation } from '../shared/simulation.ts';

function floodedSim(seed = 4242) {
  const sim = new GameSimulation({ seed, startLevel: 4 });
  sim.addPlayer('a', 'a');
  const state = sim['sim'];
  state.intermissionLeft = 1e6;
  state.zombies = [];
  state.pickups = [];
  state.populationTarget = 0;
  sim.snapshot();
  return { sim, state };
}

describe('sewage drain map generation', () => {
  it('places a sewage drain on the flooded level (level 4)', () => {
    const map = generateWorldMap(12345, 4);
    const drain = map.props.find((p) => p.kind === 'sewage_drain');
    expect(drain).toBeDefined();
    expect(drain!.x).toBeGreaterThan(0);
    expect(drain!.y).toBeGreaterThan(0);
  });

  it('does not place a sewage drain on level 1 (temperate)', () => {
    const map = generateWorldMap(12345, 1);
    const drain = map.props.find((p) => p.kind === 'sewage_drain');
    expect(drain).toBeUndefined();
  });
});

describe('sewer lockout while flooded', () => {
  it('prevents taking a manhole while town is flooded', () => {
    const { sim, state } = floodedSim();
    const flight = (state.map.flights ?? []).find((f) => f.down);
    expect(flight).toBeDefined();
    const [p] = state.players;
    p.x = flight!.from.x;
    p.y = flight!.from.y;

    expect(isTownFlooded(state)).toBe(true);
    expect(manholeFlightNear(state, p.x, p.y)).toBe(flight);

    // Try climbing down
    sim.setInput('a', input({ seq: 1, search: true }));
    sim.step();
    expect(p.x).toBe(flight!.from.x);
    expect(p.y).toBe(flight!.from.y);
    expect(eventsOf(sim.snapshot(), 'stairs_taken')).toHaveLength(0);
  });

  it('shows SEWERS FLOODED prompt while flooded', () => {
    const { state } = floodedSim();
    const flight = (state.map.flights ?? []).find((f) => f.down)!;
    expect(climbPrompt(flight, false, 'E', true)).toBe('SEWERS FLOODED');
    expect(climbPrompt(flight, true, 'E', true)).toBe('SEWERS FLOODED');
    // Normal prompt once drained
    expect(climbPrompt(flight, false, 'E', false)).toBe('E: CLIMB DOWN');
  });

  it('prevents zombies from entering sewers while flooded', () => {
    const { sim, state } = floodedSim();
    const flight = (state.map.flights ?? []).find((f) => f.down)!;
    const sewers = state.map.sewers!;

    const z = addZombie(state, 'walker', flight.from.x, flight.from.y);
    expect(z.y).toBeLessThan(sewers.top * 16);

    // Zombie steps
    for (let tick = 0; tick < 20; tick++) sim.step();
    expect(z.y).toBeLessThan(sewers.top * 16);
  });
});

describe('sewage drain interaction and city drainage', () => {
  it('finds sewage drain within reach and validates triggering', () => {
    const { state } = floodedSim();
    const drain = state.map.props.find((p) => p.kind === 'sewage_drain')!;
    expect(sewageDrainNear(state, drain.x, drain.y)).toBe(drain);
    expect(sewageDrainNear(state, drain.x + SEWAGE_DRAIN_REACH, drain.y)).toBe(drain);
    expect(sewageDrainNear(state, drain.x + SEWAGE_DRAIN_REACH + 10, drain.y)).toBeNull();
    expect(canDrainCity(state)).toBe(true);
    expect(sewageDrainPrompt(false, true)).toBe('HOLD E: DRAIN CITY');
  });

  it('holding search key drains the city, clears water, and unlocks sewers', () => {
    const { sim, state } = floodedSim();
    const drain = state.map.props.find((p) => p.kind === 'sewage_drain')!;
    const [p] = state.players;
    p.x = drain.x;
    p.y = drain.y;

    const neededTicks = Math.ceil(SEWAGE_DRAIN_HOLD_SEC / TICK_DT);
    for (let i = 0; i < neededTicks + 2; i++) {
      sim.setInput('a', input({ seq: i + 1, search: true }));
      sim.step();
    }

    expect(state.drained).toBe(true);
    expect(isTownFlooded(state)).toBe(false);
    expect(canDrainCity(state)).toBe(false);
    expect(sewageDrainPrompt(false, false)).toBe('DRAIN OPEN');

    // Event emitted
    const events = state.events;
    expect(events.some((e) => e.type === 'city_drained')).toBe(true);

    // Snapshot includes drained
    const snapshot = buildSnapshot(state);
    expect(snapshot.drained).toBe(true);

    // Outdoor wading slowdown is eliminated
    expect(groundSpeedScale(state.level, state.map, p.x, p.y, state.drained)).toBe(1);

    // Now manholes are usable
    const flight = (state.map.flights ?? []).find((f) => f.down)!;
    p.x = flight.from.x;
    p.y = flight.from.y;
    sim.setInput('a', input({ seq: neededTicks + 10, search: false }));
    sim.step();
    sim.setInput('a', input({ seq: neededTicks + 11, search: true }));
    sim.step();
    expect(p.x).toBe(flight.to.x);
    expect(p.y).toBe(flight.to.y);
  });
});

describe('level hud and sidequest tracking', () => {
  it('names sidequest on level title card for flood level', () => {
    const card = levelTitle(4);
    expect(card.sidequest).toContain('sewage drain');
    expect(levelTitle(1).sidequest).toBeUndefined();
  });

  it('updates levelSidequest state between flooded and drained', () => {
    expect(levelSidequest({ level: 4, drained: false })).toBe('Sidequest: Drain the city');
    expect(levelSidequest({ level: 4, drained: true })).toBe('City drained: Sewers unlocked');
    expect(levelSidequest({ level: 1, drained: false })).toBeNull();
  });
});
