import { placeMerchants } from './bunker-merchants.ts';
import { BASELINE_DIFFICULTY } from './difficulty.ts';
import type { DifficultyId } from './difficulty.ts';
import { FlowField } from './flow-field.ts';
import { BUNKER_LEVEL, BUNKER_SEED } from './home-protocol.ts';
import { parkBunkerVan } from './level-exit.ts';
import { FINAL_LEVEL, FIRST_LEVEL, leadInSeconds, levelPopulation, levelSeed } from './levels.ts';
import { placeTownLoot } from './loot.ts';
import { createRng } from './rng.ts';
import type { SimState } from './sim-state.ts';
import { emit } from './sim-state.ts';
import { SpatialHashGrid } from './spatial-grid.ts';
import { seedPopulation } from './town-population.ts';
import { placeTownSalvage } from './salvage.ts';
import { placeTownTreasure } from './treasure.ts';
import { newHomeRun } from './trip.ts';
import type { WorkbenchMode } from './workbench.ts';
import { generateWorldMap } from './world-map.ts';

export interface SimulationOptions {
  readonly seed: number;
  readonly random?: () => number;
  /** Lights Out, the balance the game was tuned on, unless a run asks for another. */
  readonly difficulty?: DifficultyId;
  /** Solo holds at the bench, a server times it too, and leaving it out drives straight on. */
  readonly workbench?: WorkbenchMode;
  /** Begin in this town instead of the first. Anyone joining then arrives with the return kit. */
  readonly startLevel?: number;
  /** Play from the bunker, in trips, instead of one run through the towns. Off unless asked for. */
  readonly home?: boolean;
  /** Run the overrun's horde clock in the bunker. Off unless asked for, and nothing without `home`. */
  readonly overrun?: boolean;
}

/** A level number held to the real range, so a stale or hand-edited save cannot start a town that is not there. */
export function clampLevel(level: number | undefined): number {
  const whole = Number.isFinite(level) ? Math.floor(level!) : FIRST_LEVEL;
  return Math.min(FINAL_LEVEL, Math.max(FIRST_LEVEL, whole));
}

export function announceRunStart(sim: SimState): void {
  emit(sim, { type: 'level_start', level: sim.level });
  emit(sim, { type: 'wave_intermission', wave: 1, seconds: leadInSeconds(sim.level) });
}

/** A stocked, peopled town at the start level with nobody in it yet, or an empty bunker. */
export function createSimState(options: SimulationOptions): SimState {
  const home = options.home === true;
  const startLevel = home ? BUNKER_LEVEL : clampLevel(options.startLevel);
  const map = generateWorldMap(home ? BUNKER_SEED : levelSeed(options.seed, startLevel), startLevel);
  const sim: SimState = {
    runSeed: options.seed,
    difficulty: options.difficulty ?? BASELINE_DIFFICULTY,
    map,
    rng: options.random ?? createRng(options.seed ^ 0x5eed),
    flow: new FlowField(map),
    noiseFlow: new FlowField(map),
    grid: new SpatialHashGrid(),
    tick: 0,
    runStartTick: 0,
    phase: 'intermission',
    level: startLevel,
    exit: null,
    hordesBehind: 0,
    wave: 0,
    intermissionLeft: leadInSeconds(startLevel),
    hordeLeft: 0,
    spawnQueue: [],
    spawnTimer: 0,
    populationTarget: levelPopulation(startLevel),
    topUpTimer: 0,
    noises: [],
    tracks: [],
    killChains: new Map(),
    headshotChains: new Map(),
    spinners: [],
    lures: [],
    drop: null,
    dropDone: false,
    players: [],
    departed: new Map(),
    zombies: [],
    merchants: [],
    bullets: [],
    pickups: [],
    entered: new Set(),
    clues: new Map(),
    containers: [],
    events: [],
    gameOver: null,
    nextEntity: 0,
    workbench: options.workbench ?? 'off',
    bench: null,
    vehicles: new Map(),
    homeRun: home ? newHomeRun(options.seed) : null,
    overrunOn: home && options.overrun === true,
    overrun: null,
  };
  if (home) {
    parkBunkerVan(sim);
    placeMerchants(sim);
    return sim;
  }
  placeTownLoot(sim);
  seedPopulation(sim);
  placeTownTreasure(sim);
  placeTownSalvage(sim);
  announceRunStart(sim);
  return sim;
}
