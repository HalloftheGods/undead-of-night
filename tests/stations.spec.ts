import { describe, expect, it } from 'vitest';
import { TICK_RATE } from '../shared/constants.ts';
import { stationInReach } from '../shared/stations.ts';
import { homeSim } from './helpers/home-harness.ts';
import { input, stepUntil, steps } from './helpers/sim-harness.ts';

const HOLD_TICKS = TICK_RATE * 2;

describe('stationInReach', () => {
  it('finds the station whose circle holds the point, and nothing in open floor', () => {
    const { state } = homeSim();
    for (const station of state.map.stations ?? []) expect(stationInReach(state.map, station.x, station.y)?.id).toBe(station.id);
    expect(stationInReach(state.map, state.map.spawn.x, state.map.spawn.y)).toBeNull();
  });

  it('is null on a map with no stations', () => {
    const { state } = homeSim();
    expect(stationInReach({ ...state.map, stations: undefined }, 100, 100)).toBeNull();
  });
});

describe('holding E at a station', () => {
  function atStation(id: 'locker' | 'candy_shop') {
    const { sim, state } = homeSim();
    const station = state.map.stations?.find((candidate) => candidate.id === id);
    if (!station) throw new Error(`no ${id}`);
    const [p] = state.players;
    p.x = station.x;
    p.y = station.y;
    return { sim, state, p };
  }

  it('sets p.home.station, and walking off clears it', () => {
    const { sim, p } = atStation('locker');
    sim.setInput('a', input({ seq: 1, search: true }));
    expect(stepUntil(sim, () => p.home?.station === 'locker', HOLD_TICKS)).toBeGreaterThanOrEqual(0);
    // Along the quarters' floor, since the tent's back wall is a step behind the locker's customers.
    sim.setInput('a', input({ seq: 2, right: true }));
    expect(stepUntil(sim, () => p.home?.station === null, HOLD_TICKS)).toBeGreaterThanOrEqual(0);
  });

  it('shows the hold climbing before it opens', () => {
    const { sim, p } = atStation('candy_shop');
    sim.setInput('a', input({ seq: 1, search: true }));
    steps(sim, 5);
    expect(p.home?.stationHold).toBeGreaterThan(0);
    expect(p.home?.stationHold).toBeLessThan(1);
    expect(p.home?.station).toBeNull();
  });

  it('opens nothing for a tap that lets go early', () => {
    const { sim, p } = atStation('candy_shop');
    sim.setInput('a', input({ seq: 1, search: true }));
    steps(sim, 5);
    sim.setInput('a', input({ seq: 2 }));
    steps(sim, HOLD_TICKS);
    expect(p.home?.station).toBeNull();
    expect(p.home?.stationHold).toBe(0);
  });

  it('opens nothing away from every station', () => {
    const { sim, state } = homeSim();
    const [p] = state.players;
    sim.setInput('a', input({ seq: 1, search: true }));
    steps(sim, HOLD_TICKS);
    expect(p.home?.station).toBeNull();
  });
});
