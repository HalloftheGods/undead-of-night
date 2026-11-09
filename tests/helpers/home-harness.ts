import { FIRST_LEVEL } from '../../shared/levels.ts';
import type { StationId } from '../../shared/home-protocol.ts';
import type { PlayerState, SimState } from '../../shared/sim-state.ts';
import { GameSimulation } from '../../shared/simulation.ts';
import type { SimulationOptions } from '../../shared/simulation.ts';
import { boardVan, openLevelExit, SEED, stateOf, steps, VAN_WAIT_TICKS } from './sim-harness.ts';

export interface HomeSimOptions extends Partial<SimulationOptions> {
  /** Who is in the room. One player unless a test says otherwise. */
  readonly players?: readonly string[];
}

/** A home room with everyone standing in the bunker and the first frame's events drained. */
export function homeSim(options: HomeSimOptions = {}): { sim: GameSimulation; state: SimState } {
  const { players = ['a'], ...simOptions } = options;
  const sim = new GameSimulation({ seed: SEED, ...simOptions, home: true });
  for (const id of players) sim.addPlayer(id, id);
  sim.snapshot();
  return { sim, state: stateOf(sim) };
}

export const playerNamed = (state: SimState, id: string): PlayerState => {
  const found = state.players.find((p) => p.id === id);
  if (!found) throw new Error(`no player ${id}`);
  return found;
};

/** Stands someone on the van's spot in the bunker. */
export function standAtVan(state: SimState, p: PlayerState): void {
  p.x = state.exit?.x ?? p.x;
  p.y = state.exit?.y ?? p.y;
}

/** Stands someone on a station's spot in the bunker, or right by a merchant, who stops for them. */
export function standAtStation(state: SimState, p: PlayerState, id: StationId): void {
  const merchant = state.merchants.find((m) => m.id === id);
  const station = merchant ?? state.map.stations?.find((spot) => spot.id === id);
  if (!station) throw new Error(`no station ${id}`);
  p.x = station.x;
  p.y = station.y;
}

/** Everyone stands at the van ready for this level, as if they had reached it, and waits it out. */
export function driveToTown(sim: GameSimulation, state: SimState, level = FIRST_LEVEL): void {
  const [first] = state.players;
  sim.homeCommand(first.id, { kind: 'highest', highest: level });
  sim.homeCommand(first.id, { kind: 'pick_level', level });
  for (const p of state.players) {
    standAtVan(state, p);
    sim.homeCommand(p.id, { kind: 'ready', ready: true });
  }
  steps(sim, VAN_WAIT_TICKS);
}

/** Nothing in town can reach anyone, so a test owns the scene. */
export function quietTown(state: SimState): void {
  state.intermissionLeft = 1e6;
  state.zombies = [];
  state.pickups = [];
  state.populationTarget = 0;
}

/** Out on a trip with the town held still. */
export function tripSim(options: HomeSimOptions & { readonly level?: number } = {}): { sim: GameSimulation; state: SimState } {
  const { level, ...simOptions } = options;
  const { sim, state } = homeSim(simOptions);
  driveToTown(sim, state, level);
  quietTown(state);
  sim.snapshot();
  return { sim, state };
}

/** The van comes and everyone on their feet boards it. */
export function bankTrip(sim: GameSimulation, state: SimState): void {
  openLevelExit(state);
  boardVan(sim, state);
}
