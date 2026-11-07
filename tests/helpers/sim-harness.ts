import { EXIT_HOLD_SEC, TICK_RATE } from '../../shared/constants.ts';
import { openExit } from '../../shared/level-exit.ts';
import { levelDef } from '../../shared/levels.ts';
import { BUILDING_DEFS, TILE_SIZE } from '../../shared/protocol.ts';
import type { BuildingInstance, BuildingKind, ClientInputPacket, GameEvent, PropInstance, SnapshotPacket, ZombieType } from '../../shared/protocol.ts';
import type { ExitState, SimState, ZombieState } from '../../shared/sim-state.ts';
import { alivePlayers } from '../../shared/sim-state.ts';
import { GameSimulation } from '../../shared/simulation.ts';
import { spawnZombie } from '../../shared/waves.ts';

export const SEED = 4242;

export function input(overrides: Partial<ClientInputPacket> = {}): ClientInputPacket {
  return {
    seq: 0,
    up: false,
    down: false,
    left: false,
    right: false,
    angle: 0,
    shoot: false,
    reload: false,
    weapon: null,
    melee: false,
    heal: false,
    search: false,
    ...overrides,
  };
}

/** The sim's private state, for arranging scenes the public API cannot reach. */
export const stateOf = (sim: GameSimulation): SimState => sim['sim'];

export function steps(sim: GameSimulation, ticks: number): void {
  for (let i = 0; i < ticks; i++) sim.step();
}

/** An empty town parked in a long lull: no roamers, no loot, no horde, so a test owns the scene. */
export function quietSim(players: readonly string[] = ['a']): { sim: GameSimulation; state: SimState } {
  const sim = new GameSimulation({ seed: SEED });
  for (const id of players) sim.addPlayer(id, id);
  const state = stateOf(sim);
  state.intermissionLeft = 1e6;
  state.zombies = [];
  state.pickups = [];
  state.populationTarget = 0;
  sim.snapshot();
  return { sim, state };
}

/** A zombie that knows where everyone is and will not lose interest. */
export function addZombie(state: SimState, type: ZombieType, x: number, y: number): ZombieState {
  const zombie = addRoamer(state, type, x, y);
  zombie.mode = 'hunt';
  zombie.horde = true;
  return zombie;
}

/** A zombie that has noticed nothing. */
export function addRoamer(state: SimState, type: ZombieType, x: number, y: number): ZombieState {
  spawnZombie(state, type, x, y);
  return state.zombies[state.zombies.length - 1];
}

export const VAN_WAIT_TICKS = EXIT_HOLD_SEC * TICK_RATE;

/** The level's hordes are behind everyone and the van has come. */
export function openLevelExit(state: SimState): ExitState {
  state.wave = levelDef(state.level).hordes;
  openExit(state);
  return state.exit as ExitState;
}

/** Starts a horde and sees it off by outlasting it. */
export function surviveHorde(sim: GameSimulation, state: SimState): void {
  state.intermissionLeft = 0;
  sim.step();
  state.hordeLeft = 0;
  sim.step();
}

/** Everyone on their feet walks to the van and waits it out, which leaves the town. */
export function boardVan(sim: GameSimulation, state: SimState): void {
  const exit = state.exit as ExitState;
  for (const p of alivePlayers(state)) {
    p.x = exit.x;
    p.y = exit.y;
  }
  steps(sim, VAN_WAIT_TICKS);
}

export function eventsOf<T extends GameEvent['type']>(snapshot: SnapshotPacket, type: T): Extract<GameEvent, { type: T }>[] {
  return snapshot.events.filter((event): event is Extract<GameEvent, { type: T }> => event.type === type);
}

/** Steps until the predicate holds, or fails the test by returning -1. */
export function stepUntil(sim: GameSimulation, predicate: () => boolean, maxTicks: number): number {
  for (let tick = 0; tick < maxTicks; tick++) {
    const isMet = predicate();
    if (isMet) return tick;
    sim.step();
  }
  return predicate() ? maxTicks : -1;
}

export function findProp(sim: GameSimulation, kind: PropInstance['kind']): PropInstance {
  const prop = sim.map.props.find((p) => p.kind === kind);
  if (!prop) throw new Error(`map has no ${kind}`);
  return prop;
}

export function findBuilding(sim: GameSimulation, kind: BuildingKind): BuildingInstance {
  const building = sim.map.buildings.find((b) => b.kind === kind);
  if (!building) throw new Error(`map has no ${kind}`);
  return building;
}

/** Open points just outside a building's north and south faces, off to one side of the door. */
export function pointsAcross(building: BuildingInstance): { north: { x: number; y: number }; south: { x: number; y: number } } {
  const { w, h } = BUILDING_DEFS[building.kind];
  const x = building.x + w / 2;
  return { north: { x, y: building.y - TILE_SIZE }, south: { x, y: building.y + h + TILE_SIZE } };
}
