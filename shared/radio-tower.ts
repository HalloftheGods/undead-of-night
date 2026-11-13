// Emergency Radio Tower: an outdoor structure in town where players can sound the civil defense
// alarm during intermission to cut the lull short and summon the horde early.

import { TICK_DT } from './constants.ts';
import { isBunkerMap } from './home-protocol.ts';
import { levelDef } from './levels.ts';
import { makeNoise } from './zombie-senses.ts';
import type { PropInstance } from './protocol.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { emit } from './sim-state.ts';

/** Distance in world pixels from the tower's base to allow interaction. */
export const RADIO_TOWER_REACH = 44;

/** Seconds of sustained interaction key hold required to sound the alarm. */
export const RADIO_TOWER_HOLD_SEC = 0.75;

/** Noise radius generated when the alarm sounds, alerting nearby roaming zombies. */
export const RADIO_TOWER_ALARM_NOISE_RADIUS = 500;

/** Whether the radio tower alarm can be activated right now. */
export function canTriggerRadioTower(sim: Pick<SimState, 'phase' | 'wave' | 'level' | 'intermissionLeft' | 'map'>): boolean {
  const isBunker = isBunkerMap(sim.map);
  if (isBunker) return false;
  const isIntermission = sim.phase === 'intermission';
  if (!isIntermission) return false;
  const maxHordes = levelDef(sim.level).hordes;
  const hasRemainingHordes = sim.wave < maxHordes;
  if (!hasRemainingHordes) return false;
  const hasSubstantialLullLeft = sim.intermissionLeft > 0.5;
  return hasSubstantialLullLeft;
}

/** Finds the radio tower prop near the given world coordinates, or null if out of range. */
export function radioTowerNear(sim: Pick<SimState, 'map'>, x: number, y: number): PropInstance | null {
  for (const prop of sim.map.props) {
    const isRadioTower = prop.kind === 'radio_tower';
    if (!isRadioTower) continue;
    const distance = Math.hypot(prop.x - x, prop.y - y);
    const inReach = distance <= RADIO_TOWER_REACH;
    if (inReach) return prop;
  }
  return null;
}

/** Triggers the emergency alarm, alerting zombies and advancing the wave timer to start immediately. */
export function triggerRadioTowerAlarm(sim: SimState, p: PlayerState, tower: PropInstance): boolean {
  const canTrigger = canTriggerRadioTower(sim);
  if (!canTrigger) return false;
  sim.intermissionLeft = 0;
  makeNoise(sim, tower.x, tower.y, RADIO_TOWER_ALARM_NOISE_RADIUS);
  emit(sim, { type: 'radio_tower_alarm', x: tower.x, y: tower.y, playerId: p.id });
  return true;
}

/** What prompt to display when standing in reach of the radio tower. */
export function radioTowerPrompt(touch: boolean, canTrigger: boolean, hold = 'E'): string {
  if (!canTrigger) return 'HORDE ACTIVE';
  return touch ? 'CALL HORDE' : `HOLD ${hold}: CALL HORDE`;
}

/** Updates player radio tower interaction on each simulation tick. */
export function updateRadioTower(sim: SimState, p: PlayerState): void {
  const isDeadOrDown = p.status !== 'alive';
  if (isDeadOrDown) {
    p.towerHold = 0;
    return;
  }
  const tower = radioTowerNear(sim, p.x, p.y);
  const canTrigger = canTriggerRadioTower(sim);
  const inReach = tower !== null && canTrigger;
  if (!inReach) {
    p.towerHold = 0;
    return;
  }

  const isHolding = p.searchHeld && !p.searchSpent && !p.moving;
  if (!isHolding) {
    p.towerHold = 0;
    return;
  }

  p.towerHold = Math.min(1, (p.towerHold ?? 0) + TICK_DT / RADIO_TOWER_HOLD_SEC);
  const isComplete = p.towerHold >= 1;
  if (isComplete) {
    triggerRadioTowerAlarm(sim, p, tower);
    p.searchSpent = true;
    p.towerHold = 0;
  }
}
