import { TICK_DT } from './constants.ts';
import { themeOf } from './town-rules.ts';
import type { PropInstance } from './protocol.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { emit } from './sim-state.ts';

/** Distance in world pixels from the power substation to allow interaction. */
export const POWER_SUBSTATION_REACH = 44;

/** Seconds of sustained interaction key hold required to engage the substation power breakers. */
export const POWER_SUBSTATION_HOLD_SEC = 1.0;

/** Whether the city is currently under blackout conditions without restored power. */
export function isTownBlackout(sim: { readonly level: number; readonly powered?: boolean }): boolean {
  const isBlackoutTheme = themeOf(sim.level) === 'blackout';
  const isPowered = Boolean(sim.powered);
  return isBlackoutTheme && !isPowered;
}

/** Whether the city's power can be restored right now. */
export function canRestorePower(sim: Pick<SimState, 'level' | 'powered'>): boolean {
  return isTownBlackout(sim);
}

/** Finds the power substation prop near the given world coordinates, or null if out of range. */
export function powerSubstationNear(sim: Pick<SimState, 'map'>, x: number, y: number): PropInstance | null {
  for (const prop of sim.map.props) {
    const isSubstation = prop.kind === 'power_substation';
    if (!isSubstation) continue;
    const distance = Math.hypot(prop.x - x, prop.y - y);
    const inReach = distance <= POWER_SUBSTATION_REACH;
    if (inReach) return prop;
  }
  return null;
}

/** Restores electrical grid power to the city, lighting streetlamps and clearing blackout sensory handicaps. */
export function triggerRestorePower(sim: SimState, p: PlayerState, substation: PropInstance): boolean {
  const canTrigger = canRestorePower(sim);
  if (!canTrigger) return false;

  sim.powered = true;
  emit(sim, { type: 'power_restored', x: substation.x, y: substation.y, playerId: p.id });
  return true;
}

/** What prompt to display when standing in reach of the power substation. */
export function powerSubstationPrompt(touch: boolean, canRestore: boolean, hold = 'E'): string {
  if (!canRestore) return 'POWER ONLINE';
  return touch ? 'RESTORE POWER' : `HOLD ${hold}: RESTORE POWER`;
}

/** Updates player power substation interaction on each simulation tick. */
export function updatePowerSubstation(sim: SimState, p: PlayerState): void {
  const isDeadOrDown = p.status !== 'alive';
  if (isDeadOrDown) {
    p.powerHold = 0;
    return;
  }

  const substation = powerSubstationNear(sim, p.x, p.y);
  const canRestore = canRestorePower(sim);
  const inReach = substation !== null && canRestore;
  if (!inReach) {
    p.powerHold = 0;
    return;
  }

  const isHolding = p.searchHeld && !p.searchSpent && !p.moving;
  if (!isHolding) {
    p.powerHold = 0;
    return;
  }

  p.powerHold = Math.min(1, (p.powerHold ?? 0) + TICK_DT / POWER_SUBSTATION_HOLD_SEC);
  const isComplete = p.powerHold >= 1;
  if (isComplete) {
    triggerRestorePower(sim, p, substation);
    p.searchSpent = true;
    p.powerHold = 0;
  }
}
