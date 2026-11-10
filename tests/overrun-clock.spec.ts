import { describe, expect, it } from 'vitest';
import { TICK_RATE } from '../shared/constants.ts';
import { emptyLoadout } from '../shared/loadout.ts';
import type { DifficultyId } from '../shared/difficulty.ts';
import { OVERRUN_CLOCK_BY_DIFFICULTY, OVERRUN_CLOCK_SEC, OVERRUN_WARNINGS, overrunClockSec } from '../shared/overrun.ts';
import type { PlayerState, SimState } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import type { SimulationOptions } from '../shared/simulation.ts';
import { bankTrip, playerNamed, quietTown, standAtStation, standAtVan } from './helpers/home-harness.ts';
import { SEED, stateOf, steps } from './helpers/sim-harness.ts';

interface RoomOptions extends Partial<SimulationOptions> {
  readonly highest?: number;
  readonly players?: readonly string[];
}

/** A home room whose first arrival has reached `highest`, so the clock starts as the room fills. */
function overrunRoom(options: RoomOptions = {}): { sim: GameSimulation; state: SimState } {
  const { highest = 2, players = ['a'], ...simOptions } = options;
  const sim = new GameSimulation({ seed: SEED, overrun: true, ...simOptions, home: true });
  for (const id of players) sim.addPlayer(id, id, null, undefined, { loadout: emptyLoadout(), highest });
  sim.snapshot();
  return { sim, state: stateOf(sim) };
}

const SECONDS = (n: number): number => n * TICK_RATE;
const openStation = (state: SimState, p: PlayerState): void => {
  standAtStation(state, p, 'locker');
  (p.home as NonNullable<PlayerState['home']>).station = 'locker';
};
const keepActive = (state: SimState): void => {
  for (const p of state.players) (p.home as NonNullable<PlayerState['home']>).lastActiveTick = state.tick;
};
/** Steps in one-second slices, keeping everyone from going quiet and any station open where a test put it. */
function runSeconds(sim: GameSimulation, state: SimState, seconds: number): void {
  for (let i = 0; i < seconds; i++) {
    keepActive(state);
    steps(sim, TICK_RATE);
  }
}

describe('the overrun clock', () => {
  it('starts at the full clock when the first player arrives', () => {
    const { state } = overrunRoom();
    expect(state.overrun).toMatchObject({ phase: 'counting', left: OVERRUN_CLOCK_SEC, slowed: false, total: 0 });
  });

  it('breaches at exactly the clock\'s length in ticks when nobody is in a menu', () => {
    const { sim, state } = overrunRoom();
    steps(sim, SECONDS(OVERRUN_CLOCK_SEC) - 1);
    expect(state.overrun?.left).toBeGreaterThan(0);
    steps(sim, 1);
    expect(state.overrun?.left).toBe(0);
  });

  it('takes twice as long with the one player parked at a station', () => {
    const { sim, state } = overrunRoom();
    openStation(state, playerNamed(state, 'a'));
    runSeconds(sim, state, OVERRUN_CLOCK_SEC);
    expect(state.overrun?.left).toBeCloseTo(OVERRUN_CLOCK_SEC / 2, 5);
    expect(state.overrun?.slowed).toBe(true);
    runSeconds(sim, state, OVERRUN_CLOCK_SEC);
    expect(state.overrun?.left).toBe(0);
  });

  it('runs full speed in co-op while one is in a shop and one is walking', () => {
    const { sim, state } = overrunRoom({ players: ['a', 'b'] });
    openStation(state, playerNamed(state, 'a'));
    runSeconds(sim, state, 10);
    expect(state.overrun?.left).toBeCloseTo(OVERRUN_CLOCK_SEC - 10, 5);
    expect(state.overrun?.slowed).toBe(false);
  });

  it('slows when everyone who counts has a station open, whichever it is', () => {
    const { sim, state } = overrunRoom({ players: ['a', 'b'] });
    openStation(state, playerNamed(state, 'a'));
    const second = playerNamed(state, 'b');
    standAtStation(state, second, 'candy_shop');
    (second.home as NonNullable<PlayerState['home']>).station = 'candy_shop';
    runSeconds(sim, state, 10);
    expect(state.overrun?.left).toBeCloseTo(OVERRUN_CLOCK_SEC - 5, 5);
  });

  it('does not count a gone-quiet player against the slow rate', () => {
    const { sim, state } = overrunRoom({ players: ['a', 'b'] });
    openStation(state, playerNamed(state, 'a'));
    const idle = playerNamed(state, 'b').home as NonNullable<PlayerState['home']>;
    idle.lastActiveTick = state.tick - SECONDS(61);
    steps(sim, SECONDS(10));
    expect(state.overrun?.left).toBeCloseTo(OVERRUN_CLOCK_SEC - 5, 1);
  });

  it('runs full speed when nobody counts', () => {
    const { sim, state } = overrunRoom();
    const home = playerNamed(state, 'a').home as NonNullable<PlayerState['home']>;
    home.station = 'locker';
    home.lastActiveTick = state.tick - SECONDS(61);
    steps(sim, SECONDS(10));
    expect(state.overrun?.left).toBeCloseTo(OVERRUN_CLOCK_SEC - 10, 1);
  });

  it('shares the room clock with a joiner', () => {
    const { sim, state } = overrunRoom();
    steps(sim, SECONDS(20));
    const before = state.overrun;
    sim.addPlayer('b', 'b', null, undefined, { loadout: emptyLoadout(), highest: 1 });
    expect(state.overrun).toBe(before);
    expect(state.overrun?.left).toBeCloseTo(OVERRUN_CLOCK_SEC - 20, 1);
  });

  it('clears with no cost when the van leaves before zero', () => {
    const { sim, state } = overrunRoom();
    steps(sim, SECONDS(30));
    const me = playerNamed(state, 'a');
    sim.homeCommand('a', { kind: 'pick_level', level: 1 });
    standAtVan(state, me);
    sim.homeCommand('a', { kind: 'ready', ready: true });
    steps(sim, SECONDS(10));
    expect(state.homeRun?.tripLevel).toBe(1);
    expect(state.overrun).toBeNull();
  });

  it('starts a fresh clock when the room comes home', () => {
    const { sim, state } = overrunRoom();
    sim.homeCommand('a', { kind: 'pick_level', level: 1 });
    standAtVan(state, playerNamed(state, 'a'));
    sim.homeCommand('a', { kind: 'ready', ready: true });
    steps(sim, SECONDS(10));
    expect(state.overrun).toBeNull();
    quietTown(state);
    bankTrip(sim, state);
    expect(state.homeRun?.tripLevel).toBeNull();
    expect(state.overrun).toMatchObject({ phase: 'counting', left: OVERRUN_CLOCK_SEC });
  });

  it('has no clock with the switch off', () => {
    const { sim, state } = overrunRoom({ overrun: false });
    steps(sim, SECONDS(10));
    expect(state.overrun).toBeNull();
  });

  it('has no clock while the room has not reached level 2', () => {
    const { sim, state } = overrunRoom({ highest: 1 });
    steps(sim, SECONDS(10));
    expect(state.overrun).toBeNull();
  });

  it('gives each warning once and arms the guns at the last one', () => {
    const { sim, state } = overrunRoom();
    const heard: number[] = [];
    let armedAtLast = false;
    for (let t = 0; t < SECONDS(OVERRUN_CLOCK_SEC); t++) {
      steps(sim, 1);
      const warnings = state.events.flatMap((e) => (e.type === 'overrun_warning' ? [e.step] : []));
      heard.push(...warnings);
      state.events.length = 0;
      const allWarned = heard.length === OVERRUN_WARNINGS.length;
      armedAtLast ||= allWarned && state.overrun?.phase === 'armed';
    }
    expect(heard).toEqual([0, 1, 2]);
    expect(armedAtLast).toBe(true);
  });
});

const DIFFICULTY_IDS: readonly DifficultyId[] = ['night_light', 'stay_close', 'lights_out', 'undead_tired'];

describe('the overrun clock by difficulty', () => {
  it('is 240, 180, 150 and 120 seconds from the easiest to the hardest', () => {
    expect(DIFFICULTY_IDS.map(overrunClockSec)).toEqual([240, 180, 150, 120]);
    expect(OVERRUN_CLOCK_BY_DIFFICULTY.lights_out).toBe(OVERRUN_CLOCK_SEC);
  });

  it.each(DIFFICULTY_IDS)('starts at its own length on %s and shows it to the clients', (difficulty) => {
    const { sim, state } = overrunRoom({ difficulty });
    const span = overrunClockSec(difficulty);
    expect(state.overrun).toMatchObject({ phase: 'counting', spanSec: span, left: span });
    expect(sim.snapshot().home?.overrun).toMatchObject({ spanSec: span, left: span });
  });

  it.each(DIFFICULTY_IDS)('gives the warnings at 50%, 25% and 10% of the clock on %s and breaches on time', (difficulty) => {
    const { sim, state } = overrunRoom({ difficulty });
    const span = overrunClockSec(difficulty);
    const leftAt: number[] = [];
    let armedLeft = 0;
    for (let t = 0; t < SECONDS(span); t++) {
      steps(sim, 1);
      leftAt.push(...state.events.flatMap((e) => (e.type === 'overrun_warning' ? [e.left] : [])));
      state.events.length = 0;
      const justArmed = armedLeft === 0 && state.overrun?.phase === 'armed';
      armedLeft = justArmed ? (state.overrun?.left ?? 0) : armedLeft;
    }
    expect(leftAt).toEqual(OVERRUN_WARNINGS.map((share) => Math.round(span * share)));
    expect(armedLeft).toBeCloseTo(span * OVERRUN_WARNINGS[2], 1);
    expect(state.overrun?.phase === 'armed' || state.overrun?.phase === 'breached').toBe(true);
    expect(state.overrun?.left).toBe(0);
  });

  it('keeps the guns-free window to no more than a quarter of the shortest clock', () => {
    const shortest = Math.min(...DIFFICULTY_IDS.map(overrunClockSec));
    const longestWindow = Math.max(...DIFFICULTY_IDS.map((d) => overrunClockSec(d) * OVERRUN_WARNINGS[2]));
    expect(longestWindow).toBeLessThanOrEqual(shortest / 4);
  });
});
