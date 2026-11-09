import { describe, expect, it } from 'vitest';
import { containerInReach, SEARCH_SEC, townContainers } from '../shared/containers.ts';
import type { Container } from '../shared/containers.ts';
import { PLAYER_RADIUS, TICK_RATE } from '../shared/constants.ts';
import { BOOTH_FIREWORKS } from '../shared/fireworks-booth.ts';
import { TILE_KINDS, TILE_SIZE } from '../shared/protocol.ts';
import { GameSimulation } from '../shared/simulation.ts';
import type { PlayerState, SimState } from '../shared/sim-state.ts';
import { FIREWORK_CARRY } from '../shared/throwables.ts';
import { buildingAt, circleHitsSolid } from '../shared/world-query.ts';
import { guidePlaces, whereToLook } from '../src/game/town-guide.ts';
import { eventsOf, input, quietSim, stateOf, steps } from './helpers/sim-harness.ts';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const busesOf = (state: SimState): Container[] => townContainers(state.map).filter((c) => c.kind === 'booth');

/** Open ground just south of the bus, in reach of it and of nothing else. */
function standBy(state: SimState, p: PlayerState, bus: Container): void {
  for (let y = bus.box.y1 + 2; y <= bus.box.y1 + 24; y += 2) {
    for (let x = bus.x - 40; x <= bus.x + 40; x += 2) {
      const open = !circleHitsSolid(state.map, x, y, PLAYER_RADIUS) && !buildingAt(state.map, x, y);
      const usable = open && containerInReach(state.map, x, y, () => false)?.id === bus.id;
      if (!usable) continue;
      p.x = x;
      p.y = y;
      return;
    }
  }
  throw new Error('nowhere to stand by the bus');
}

function atTheBus() {
  const quiet = quietSim();
  const [p] = quiet.state.players;
  const [bus] = busesOf(quiet.state);
  standBy(quiet.state, p, bus);
  return { ...quiet, p, bus };
}

/** One full search, then the key let go so the next one starts fresh. */
function searchOnce(sim: GameSimulation, bus: Container, seq: number): void {
  sim.setInput('a', input({ seq, search: true }));
  steps(sim, Math.ceil(SEARCH_SEC[bus.kind] * TICK_RATE) + 1);
  sim.setInput('a', input({ seq: seq + 1, search: false }));
  steps(sim, 1);
}

describe('S.O.S. Fireworks bus', () => {
  it.each(SEEDS)('seed %i: one is parked in the downtown car park, stocked with fireworks alone', (seed) => {
    const state = stateOf(new GameSimulation({ seed }));
    const buses = busesOf(state);
    expect(buses).toHaveLength(1);
    const [bus] = buses;
    expect(bus.buildingKind).toBe('outdoors');
    expect(state.containers[bus.id]).toEqual({ opened: false, loot: null, fireworks: BOOTH_FIREWORKS });
    const under = state.map.tiles[Math.floor((bus.y - 1) / TILE_SIZE) * state.map.cols + Math.floor(bus.x / TILE_SIZE)];
    expect(['asphalt', 'asphalt_cracked', 'parking_line']).toContain(TILE_KINDS[under]);
  });

  it('fills the searcher\'s hands and keeps the rest for the next search', () => {
    const { sim, state, p, bus } = atTheBus();
    p.fireworks = 0;
    searchOnce(sim, bus, 1);
    expect(p.fireworks).toBe(FIREWORK_CARRY);
    expect(state.containers[bus.id]).toMatchObject({ opened: false, fireworks: BOOTH_FIREWORKS - FIREWORK_CARRY });
    const [sold] = eventsOf(sim.snapshot(), 'container_opened');
    expect(sold).toMatchObject({ found: true, stash: 'firework', fireworks: FIREWORK_CARRY });
  });

  it('tells a searcher with full hands so, and gives nothing away', () => {
    const { sim, state, p, bus } = atTheBus();
    p.fireworks = FIREWORK_CARRY;
    searchOnce(sim, bus, 1);
    expect(state.containers[bus.id].fireworks).toBe(BOOTH_FIREWORKS);
    const [refused] = eventsOf(sim.snapshot(), 'container_opened');
    expect(refused).toMatchObject({ found: false, full: true, stash: 'firework' });
  });

  it('sells out after its last firework and reads as searched', () => {
    const { sim, state, p, bus } = atTheBus();
    let taken = 0;
    for (let seq = 1; !state.containers[bus.id].opened && seq < 100; seq += 2) {
      p.fireworks = 0;
      searchOnce(sim, bus, seq);
      taken += p.fireworks;
    }
    expect(taken).toBe(BOOTH_FIREWORKS);
    expect(state.containers[bus.id]).toMatchObject({ opened: true, fireworks: 0 });
  });

  it('lights up the car park', () => {
    const { map } = stateOf(new GameSimulation({ seed: 3 }));
    const bus = map.props.find((prop) => prop.kind === 'fireworks_bus')!;
    expect(map.lights.filter((light) => Math.hypot(light.x - bus.x, light.y - bus.y) < 48).length).toBeGreaterThanOrEqual(3);
  });

  it('has a page in the Town Guide, and tops the index for fireworks', () => {
    const page = guidePlaces().find((place) => place.id === 'fireworks_bus');
    expect(page?.finds).toEqual([expect.objectContaining({ id: 'firework', tier: 'always' })]);
    expect(whereToLook().find((line) => line.id === 'firework')?.places[0].id).toBe('fireworks_bus');
  });
});
