import { TICK_DT } from './constants.ts';
import { FlowField } from './flow-field.ts';
import { themeOf } from './town-rules.ts';
import { TILE_KINDS } from './map-protocol.ts';
import type { PropInstance, WorldMap } from './protocol.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { emit } from './sim-state.ts';

/** Distance in world pixels from the drain station to allow interaction. */
export const SEWAGE_DRAIN_REACH = 44;

/** Seconds of sustained interaction key hold required to open the sewage drain valve. */
export const SEWAGE_DRAIN_HOLD_SEC = 1.0;

/** Whether the city is currently under flood conditions. */
export function isTownFlooded(sim: { readonly level: number; readonly drained?: boolean }): boolean {
  const isFloodedTheme = themeOf(sim.level) === 'flooded';
  const isDrained = Boolean(sim.drained);
  return isFloodedTheme && !isDrained;
}

/** Whether the sewage drain can be activated right now. */
export function canDrainCity(sim: Pick<SimState, 'level' | 'drained'>): boolean {
  return isTownFlooded(sim);
}

/** Finds the sewage drain prop near the given world coordinates, or null if out of range. */
export function sewageDrainNear(sim: Pick<SimState, 'map'>, x: number, y: number): PropInstance | null {
  for (const prop of sim.map.props) {
    const isDrain = prop.kind === 'sewage_drain';
    if (!isDrain) continue;
    const distance = Math.hypot(prop.x - x, prop.y - y);
    const inReach = distance <= SEWAGE_DRAIN_REACH;
    if (inReach) return prop;
  }
  return null;
}

/** Drains surface flood water, restoring flooded ground tiles to dry earth. */
export function drainTownWater(map: WorldMap): void {
  const waterIndex = TILE_KINDS.indexOf('water');
  const dirtIndex = TILE_KINDS.indexOf('dirt');
  const surfaceRows = map.sewers?.top ?? map.rows;
  const maxSurfaceTile = surfaceRows * map.cols;
  for (let i = 0; i < maxSurfaceTile; i++) {
    const isWater = map.tiles[i] === waterIndex;
    if (isWater) map.tiles[i] = dirtIndex;
  }
}

/** Opens the main sewage drain valve, clearing floodwater and unlocking sewer shafts. */
export function triggerDrainCity(sim: SimState, p: PlayerState, drain: PropInstance): boolean {
  const canTrigger = canDrainCity(sim);
  if (!canTrigger) return false;

  sim.drained = true;
  drainTownWater(sim.map);
  sim.flow = new FlowField(sim.map, { manholes: true });
  sim.noiseFlow = new FlowField(sim.map, { manholes: true });

  emit(sim, { type: 'city_drained', x: drain.x, y: drain.y, playerId: p.id });
  return true;
}

/** What prompt to display when standing in reach of the sewage drain. */
export function sewageDrainPrompt(touch: boolean, canDrain: boolean, hold = 'E'): string {
  if (!canDrain) return 'DRAIN OPEN';
  return touch ? 'DRAIN CITY' : `HOLD ${hold}: DRAIN CITY`;
}

/** Updates player sewage drain interaction on each simulation tick. */
export function updateSewageDrain(sim: SimState, p: PlayerState): void {
  const isDeadOrDown = p.status !== 'alive';
  if (isDeadOrDown) {
    p.drainHold = 0;
    return;
  }

  const drain = sewageDrainNear(sim, p.x, p.y);
  const canDrain = canDrainCity(sim);
  const inReach = drain !== null && canDrain;
  if (!inReach) {
    p.drainHold = 0;
    return;
  }

  const isHolding = p.searchHeld && !p.searchSpent && !p.moving;
  if (!isHolding) {
    p.drainHold = 0;
    return;
  }

  p.drainHold = Math.min(1, (p.drainHold ?? 0) + TICK_DT / SEWAGE_DRAIN_HOLD_SEC);
  const isComplete = p.drainHold >= 1;
  if (isComplete) {
    triggerDrainCity(sim, p, drain);
    p.searchSpent = true;
    p.drainHold = 0;
  }
}
