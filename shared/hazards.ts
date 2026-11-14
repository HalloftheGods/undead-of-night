import type { SimState } from './sim-state.ts';
import type { TileKind } from './map-protocol.ts';
import { TILE_SIZE } from './map-protocol.ts';
import { makeNoise } from './zombie-senses.ts';

// -------------------------------------------------------------
// 1. Auditory Traps & Alarm Clocks
// -------------------------------------------------------------

export interface AuditoryTrap {
  readonly id: string;
  x: number;
  y: number;
  timerLeftSec: number;
  ringingLeftSec: number;
  isRinging: boolean;
  readonly noiseRadius: number;
}

export const ALARM_CLOCK_DEFAULT_TIMER = 10;
export const ALARM_CLOCK_RING_DURATION = 8;
export const ALARM_CLOCK_NOISE_RADIUS = 350;

export function createAuditoryTrap(
  id: string,
  x: number,
  y: number,
  timerSec: number = ALARM_CLOCK_DEFAULT_TIMER,
  noiseRadius: number = ALARM_CLOCK_NOISE_RADIUS
): AuditoryTrap {
  return {
    id,
    x,
    y,
    timerLeftSec: timerSec,
    ringingLeftSec: ALARM_CLOCK_RING_DURATION,
    isRinging: false,
    noiseRadius,
  };
}

export interface AuditoryTrapUpdateResult {
  activeClocks: AuditoryTrap[];
  ringingNoises: { x: number; y: number; radius: number }[];
}

export function updateAuditoryTraps(
  traps: AuditoryTrap[],
  dt: number,
  sim?: SimState
): AuditoryTrapUpdateResult {
  const activeClocks: AuditoryTrap[] = [];
  const ringingNoises: { x: number; y: number; radius: number }[] = [];

  for (const trap of traps) {
    const isWinding = trap.timerLeftSec > 0;
    if (isWinding) {
      trap.timerLeftSec = Math.max(0, trap.timerLeftSec - dt);
      const justTriggered = trap.timerLeftSec === 0;
      if (justTriggered) {
        trap.isRinging = true;
      }
    }

    const isRinging = trap.isRinging && trap.ringingLeftSec > 0;
    if (isRinging) {
      trap.ringingLeftSec = Math.max(0, trap.ringingLeftSec - dt);
      ringingNoises.push({ x: trap.x, y: trap.y, radius: trap.noiseRadius });

      const hasSim = sim !== undefined;
      if (hasSim) {
        makeNoise(sim, trap.x, trap.y, trap.noiseRadius);
      }

      const hasRingingLeft = trap.ringingLeftSec > 0;
      if (!hasRingingLeft) {
        trap.isRinging = false;
      }
    }

    const stillActive = trap.timerLeftSec > 0 || trap.isRinging;
    if (stillActive) {
      activeClocks.push(trap);
    }
  }

  return { activeClocks, ringingNoises };
}

// -------------------------------------------------------------
// 2. Combustible Tile Grid & Fire Spread
// -------------------------------------------------------------

export interface FireCell {
  readonly tileX: number;
  readonly tileY: number;
  fuel: number;
  spreadTimer: number;
}

export const COMBUSTIBLE_TILES: ReadonlySet<TileKind> = new Set([
  'grass',
  'dirt',
  'floor_wood',
  'floor_carpet',
]);

export const FIREBREAK_TILES: ReadonlySet<TileKind> = new Set([
  'asphalt',
  'asphalt_cracked',
  'sidewalk',
  'water',
  'snow',
  'floor_concrete',
  'floor_tile',
  'floor_sewer',
  'void',
]);

export const DEFAULT_CELL_FUEL = 100;
export const FIRE_SPREAD_INTERVAL = 2.0;
export const FIRE_BURN_RATE = 15;
export const FIRE_DAMAGE_PER_SEC = 25;

export interface FireGrid {
  readonly cells: Map<string, FireCell>;
}

export function createFireGrid(): FireGrid {
  return { cells: new Map() };
}

function cellKey(tx: number, ty: number): string {
  return `${tx},${ty}`;
}

export function isTileCombustible(tileKind: TileKind): boolean {
  const isBreak = FIREBREAK_TILES.has(tileKind);
  if (isBreak) return false;
  return COMBUSTIBLE_TILES.has(tileKind);
}

export function igniteCell(grid: FireGrid, tileX: number, tileY: number, fuel: number = DEFAULT_CELL_FUEL): boolean {
  const key = cellKey(tileX, tileY);
  const alreadyBurning = grid.cells.has(key);
  if (alreadyBurning) return false;

  grid.cells.set(key, {
    tileX,
    tileY,
    fuel,
    spreadTimer: FIRE_SPREAD_INTERVAL,
  });
  return true;
}

export function updateFireGrid(grid: FireGrid, mapTiles: (tx: number, ty: number) => TileKind | null, dt: number): void {
  const expiredKeys: string[] = [];
  const newlyIgnited: [number, number][] = [];

  for (const [key, cell] of grid.cells) {
    cell.fuel -= FIRE_BURN_RATE * dt;
    const isFuelExhausted = cell.fuel <= 0;
    if (isFuelExhausted) {
      expiredKeys.push(key);
      continue;
    }

    cell.spreadTimer -= dt;
    const shouldSpread = cell.spreadTimer <= 0;
    if (shouldSpread) {
      cell.spreadTimer = FIRE_SPREAD_INTERVAL;
      const neighbors: [number, number][] = [
        [cell.tileX + 1, cell.tileY],
        [cell.tileX - 1, cell.tileY],
        [cell.tileX, cell.tileY + 1],
        [cell.tileX, cell.tileY - 1],
      ];

      for (const [nx, ny] of neighbors) {
        const neighborKey = cellKey(nx, ny);
        const alreadyLit = grid.cells.has(neighborKey);
        if (alreadyLit) continue;

        const neighborKind = mapTiles(nx, ny);
        const canBurn = neighborKind !== null && isTileCombustible(neighborKind);
        if (canBurn) {
          newlyIgnited.push([nx, ny]);
        }
      }
    }
  }

  for (const key of expiredKeys) {
    grid.cells.delete(key);
  }

  for (const [nx, ny] of newlyIgnited) {
    igniteCell(grid, nx, ny);
  }
}

export function isPointInFire(grid: FireGrid, worldX: number, worldY: number): boolean {
  const tileX = Math.floor(worldX / TILE_SIZE);
  const tileY = Math.floor(worldY / TILE_SIZE);
  const key = cellKey(tileX, tileY);
  return grid.cells.has(key);
}

// -------------------------------------------------------------
// 3. Rotting Corpse Decay Field & Sickness
// -------------------------------------------------------------

export type CorpseStage = 'fresh' | 'decaying' | 'skeleton';

export interface RottingCorpse {
  readonly id: string;
  x: number;
  y: number;
  ageSec: number;
  stage: CorpseStage;
  readonly indoors: string | null;
}

export const CORPSE_FRESH_DURATION = 60;
export const CORPSE_ROTTING_DURATION = 300;
export const SICKNESS_AURA_RADIUS = 80;
export const SICKNESS_CLUSTER_THRESHOLD = 3;

export function createRottingCorpse(id: string, x: number, y: number, indoors: string | null = null): RottingCorpse {
  return {
    id,
    x,
    y,
    ageSec: 0,
    stage: 'fresh',
    indoors,
  };
}

export function updateCorpsesDecay(corpses: RottingCorpse[], dt: number): void {
  for (const corpse of corpses) {
    corpse.ageSec += dt;
    const isFresh = corpse.ageSec < CORPSE_FRESH_DURATION;
    if (isFresh) {
      corpse.stage = 'fresh';
      continue;
    }

    const isDecaying = corpse.ageSec < CORPSE_ROTTING_DURATION;
    if (isDecaying) {
      corpse.stage = 'decaying';
      continue;
    }

    corpse.stage = 'skeleton';
  }
}

export function calculateCorpseSicknessLevel(corpses: readonly RottingCorpse[], playerX: number, playerY: number): number {
  let nearbyDecayingCount = 0;
  const maxRadiusSq = SICKNESS_AURA_RADIUS * SICKNESS_AURA_RADIUS;

  for (const corpse of corpses) {
    const isDecaying = corpse.stage === 'decaying';
    if (!isDecaying) continue;

    const dx = corpse.x - playerX;
    const dy = corpse.y - playerY;
    const distSq = dx * dx + dy * dy;
    const inRange = distSq <= maxRadiusSq;

    if (inRange) {
      nearbyDecayingCount += 1;
    }
  }

  const isDangerousCluster = nearbyDecayingCount >= SICKNESS_CLUSTER_THRESHOLD;
  if (isDangerousCluster) {
    return nearbyDecayingCount * 1.5;
  }

  return nearbyDecayingCount * 0.5;
}
