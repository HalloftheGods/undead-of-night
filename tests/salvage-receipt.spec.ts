import { describe, expect, it } from 'vitest';
import { REVIVE_RANGE, TICK_RATE } from '../shared/constants.ts';
import type { SalvageCounts } from '../shared/home-protocol.ts';
import { hurtPlayer } from '../shared/player-health.ts';
import { noSalvage } from '../shared/salvage-data.ts';
import type { PlayerHome, PlayerState, SimState } from '../shared/sim-state.ts';
import type { GameSimulation } from '../shared/simulation.ts';
import { viewFor } from '../shared/snapshot-view.ts';
import { bankTrip, driveToTown, homeSim, playerNamed, quietTown } from './helpers/home-harness.ts';
import { steps } from './helpers/sim-harness.ts';

const GRACE_TICKS = 60 * TICK_RATE;
const CARRIED: SalvageCounts = { fuel_can: 2, car_battery: 0, scrap_steel: 1, sedatives: 3 };

const homeOf = (p: PlayerState): PlayerHome => p.home as PlayerHome;

/** Two players with reconnect tokens, out in a town held still, b carrying salvage. */
function salvageTrip(): { sim: GameSimulation; state: SimState; a: PlayerState; b: PlayerState } {
  const { sim, state } = homeSim({ players: [] });
  sim.addPlayer('a', 'a', 'token-a');
  sim.addPlayer('b', 'b', 'token-b');
  driveToTown(sim, state);
  quietTown(state);
  sim.snapshot();
  const b = playerNamed(state, 'b');
  homeOf(b).salvage = { ...CARRIED };
  return { sim, state, a: playerNamed(state, 'a'), b };
}

function down(state: SimState, p: PlayerState): void {
  hurtPlayer(state, p, p.maxHealth * 2);
  expect(p.status).toBe('downed');
}

function bleedOut(sim: GameSimulation, state: SimState, p: PlayerState): void {
  down(state, p);
  for (const other of state.players) if (other !== p) other.x = p.x + REVIVE_RANGE * 4;
  p.bleedout = 0;
  sim.step();
  expect(p.status).toBe('dead');
}

describe('salvage on the trip receipt', () => {
  it('a banked receipt carries the salvage, and the bunker leaves them holding none', () => {
    const { sim, state, a, b } = salvageTrip();
    bankTrip(sim, state);
    expect(homeOf(b).receipt).toMatchObject({ outcome: 'banked', salvage: CARRIED });
    expect(homeOf(a).receipt).toMatchObject({ outcome: 'banked', salvage: noSalvage() });
    expect(homeOf(b).salvage).toEqual(noSalvage());
  });

  it('a died receipt lists the salvage as lost, and the bunker hands none of it back', () => {
    const { sim, state, b } = salvageTrip();
    bleedOut(sim, state, b);
    bankTrip(sim, state);
    expect(homeOf(b).receipt).toMatchObject({ outcome: 'died', salvage: CARRIED, gear: null });
    expect(homeOf(b).salvage).toEqual(noSalvage());
  });

  it('downed at the van loses it', () => {
    const { sim, state, b } = salvageTrip();
    down(state, b);
    bankTrip(sim, state);
    expect(homeOf(b).receipt).toMatchObject({ outcome: 'died', salvage: CARRIED });
    expect(homeOf(b).salvage).toEqual(noSalvage());
  });

  it('a revived player keeps it', () => {
    const { sim, state, b } = salvageTrip();
    down(state, b);
    b.status = 'alive';
    b.health = b.maxHealth / 2;
    bankTrip(sim, state);
    expect(homeOf(b).receipt).toMatchObject({ outcome: 'banked', salvage: CARRIED });
  });

  it('a body left after the 60 s grace forfeits it', () => {
    const { sim, state, b } = salvageTrip();
    sim.removePlayer('b');
    steps(sim, GRACE_TICKS + 1);
    expect(homeOf(b).salvage).toEqual(noSalvage());
    bankTrip(sim, state);
    expect(homeOf(b).receipt).toMatchObject({ outcome: 'died', salvage: CARRIED });
  });

  it('a new trip clears the salvage that was lost', () => {
    const { sim, state, b } = salvageTrip();
    down(state, b);
    bankTrip(sim, state);
    driveToTown(sim, state);
    expect(homeOf(b).lost.salvage).toEqual(noSalvage());
    expect(homeOf(b).salvage).toEqual(noSalvage());
  });
});

describe('salvage on the wire', () => {
  it('carried salvage is on the snapshot, and left off when there is none', () => {
    const { sim, b } = salvageTrip();
    const frame = sim.snapshot();
    expect(frame.players.find((p) => p.id === b.id)?.home?.salvage).toEqual(CARRIED);
    expect(frame.players.find((p) => p.id === 'a')?.home).not.toHaveProperty('salvage');
  });

  it("viewFor still hides other players' receipts", () => {
    const { sim, state, b } = salvageTrip();
    bankTrip(sim, state);
    const frame = sim.snapshot();
    expect(viewFor(frame, 'a').players.find((p) => p.id === b.id)?.home?.receipt).toBeNull();
    expect(viewFor(frame, b.id).players.find((p) => p.id === b.id)?.home?.receipt).toMatchObject({ salvage: CARRIED });
  });
});
