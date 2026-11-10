import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../shared/protocol.ts';
import { MANHOLE_REACH, manholeFlightNear } from '../shared/take-manhole.ts';
import { buildingAt } from '../shared/world-map.ts';
import { isSewerBuilding } from '../shared/map-protocol.ts';
import { addZombie, eventsOf, input, quietSim, stepUntil } from './helpers/sim-harness.ts';

function atManhole() {
  const { sim, state } = quietSim();
  const flight = (state.map.flights ?? []).find((f) => f.down);
  if (!flight) throw new Error('map has no manhole');
  const [p] = state.players;
  p.x = flight.from.x;
  p.y = flight.from.y;
  return { sim, state, p, flight };
}

const inSewer = (state: ReturnType<typeof quietSim>['state'], x: number, y: number): boolean => {
  const piece = buildingAt(state.map, x, y);
  return piece !== null && isSewerBuilding(piece);
};

describe('taking a manhole', () => {
  it('standing on the cover does nothing without the key', () => {
    const { sim, state, p, flight } = atManhole();
    for (let tick = 0; tick < 30; tick++) sim.step();
    expect(p.x).toBe(flight.from.x);
    expect(p.y).toBe(flight.from.y);
    expect(inSewer(state, p.x, p.y)).toBe(false);
  });

  it('walking over the cover does not take it', () => {
    const { sim, state, p, flight } = atManhole();
    p.x -= 3 * TILE_SIZE;
    sim.setInput('a', input({ seq: 1, right: true }));
    for (let tick = 0; tick < 60; tick++) sim.step();
    expect(p.x).toBeGreaterThan(flight.from.x);
    expect(inSewer(state, p.x, p.y)).toBe(false);
  });

  it('pressing search at the cover climbs down, and the press carries no one back up', () => {
    const { sim, state, p, flight } = atManhole();
    sim.setInput('a', input({ seq: 1, search: true }));
    sim.step();
    expect(p.x).toBe(flight.to.x);
    expect(p.y).toBe(flight.to.y);
    expect(inSewer(state, p.x, p.y)).toBe(true);
    const events = eventsOf(sim.snapshot(), 'stairs_taken');
    expect(events.at(-1)?.to).toBe('SEWERS');
    // Still holding the key: stays down.
    for (let tick = 0; tick < 20; tick++) sim.step();
    expect(inSewer(state, p.x, p.y)).toBe(true);
  });

  it('letting go and pressing again at the ladder climbs back to the street', () => {
    const { sim, state, p, flight } = atManhole();
    sim.setInput('a', input({ seq: 1, search: true }));
    sim.step();
    sim.setInput('a', input({ seq: 2, search: false }));
    sim.step();
    sim.setInput('a', input({ seq: 3, search: true }));
    sim.step();
    expect(p.x).toBe(flight.from.x);
    expect(p.y).toBe(flight.from.y);
    expect(inSewer(state, p.x, p.y)).toBe(false);
    expect(eventsOf(sim.snapshot(), 'stairs_taken').at(-1)?.to).toBe('SURFACE');
  });

  it('out of reach, the key does nothing', () => {
    const { sim, state, p, flight } = atManhole();
    p.x += MANHOLE_REACH + 6;
    const start = { x: p.x, y: p.y };
    sim.setInput('a', input({ seq: 1, search: true }));
    sim.step();
    expect(p.x).toBe(start.x);
    expect(p.y).toBe(start.y);
    expect(manholeFlightNear(state, p.x, p.y)).toBeNull();
    expect(manholeFlightNear(state, flight.from.x + 4, flight.from.y)).toBe(flight);
  });

  it('a downed player cannot climb', () => {
    const { sim, p, flight } = atManhole();
    p.status = 'downed';
    sim.setInput('a', input({ seq: 1, search: true }));
    sim.step();
    expect(p.x).toBe(flight.from.x);
  });

  it('a zombie beside the cover follows a player down with no key', () => {
    const { sim, state, p, flight } = atManhole();
    sim.setInput('a', input({ seq: 1, search: true }));
    sim.step();
    sim.setInput('a', input({ seq: 2, search: false }));
    expect(inSewer(state, p.x, p.y)).toBe(true);
    const z = addZombie(state, 'walker', flight.from.x + 12, flight.from.y);
    const followed = stepUntil(sim, () => inSewer(state, z.x, z.y), 600);
    expect(followed).toBeGreaterThan(0);
  });
});
