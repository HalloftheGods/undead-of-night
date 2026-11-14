import { describe, expect, it } from 'vitest';
import { TICK_DT } from '../shared/constants.ts';
import { generateWorldMap } from '../shared/world-map.ts';
import {
  canRestorePower,
  isTownBlackout,
  POWER_SUBSTATION_HOLD_SEC,
  POWER_SUBSTATION_REACH,
  powerSubstationNear,
  powerSubstationPrompt,
  triggerRestorePower,
  updatePowerSubstation,
} from '../shared/power-substation.ts';
import { hearingScale, sightScale } from '../shared/town-rules.ts';
import { levelSidequest, levelTitle } from '../src/game/level-hud.ts';
import { LEVEL_LOOKS, withPowerRestored } from '../src/engine/level-look.ts';
import { NIGHT_AMBIENT } from '../src/engine/lighting.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { input } from './helpers/sim-harness.ts';

function blackoutSim(seed = 4242) {
  const sim = new GameSimulation({ seed, startLevel: 6 });
  sim.addPlayer('a', 'a');
  const state = sim['sim'];
  state.intermissionLeft = 1e6;
  state.zombies = [];
  state.pickups = [];
  state.populationTarget = 0;
  sim.snapshot();
  return { sim, state };
}

describe('power substation map generation', () => {
  it('places a power substation on the blackout level (level 6)', () => {
    const map = generateWorldMap(12345, 6);
    const substation = map.props.find((p) => p.kind === 'power_substation');
    expect(substation).toBeDefined();
    expect(substation!.x).toBeGreaterThan(0);
    expect(substation!.y).toBeGreaterThan(0);
  });

  it('does not place a power substation on level 1 (temperate)', () => {
    const map = generateWorldMap(12345, 1);
    const substation = map.props.find((p) => p.kind === 'power_substation');
    expect(substation).toBeUndefined();
  });
});

describe('blackout state and power restoration mechanics', () => {
  it('detects blackout state on level 6 until powered', () => {
    const { state } = blackoutSim();
    expect(isTownBlackout(state)).toBe(true);
    expect(canRestorePower(state)).toBe(true);

    state.powered = true;
    expect(isTownBlackout(state)).toBe(false);
    expect(canRestorePower(state)).toBe(false);
  });

  it('detects substation in reach and produces accurate prompts', () => {
    const { state } = blackoutSim();
    const substation = state.map.props.find((p) => p.kind === 'power_substation')!;
    expect(substation).toBeDefined();

    expect(powerSubstationNear(state, substation.x, substation.y)).toBe(substation);
    expect(powerSubstationNear(state, substation.x + POWER_SUBSTATION_REACH, substation.y)).toBe(substation);
    expect(powerSubstationNear(state, substation.x + POWER_SUBSTATION_REACH + 10, substation.y)).toBeNull();

    expect(powerSubstationPrompt(false, true)).toBe('HOLD E: RESTORE POWER');
    expect(powerSubstationPrompt(true, true)).toBe('RESTORE POWER');
    expect(powerSubstationPrompt(false, false)).toBe('POWER ONLINE');
  });

  it('triggers power restoration after sustained 1.0s hold and emits event', () => {
    const { sim, state } = blackoutSim();
    const substation = state.map.props.find((p) => p.kind === 'power_substation')!;
    const [p] = state.players;
    p.x = substation.x;
    p.y = substation.y;

    const neededTicks = Math.ceil(POWER_SUBSTATION_HOLD_SEC / TICK_DT);
    for (let i = 0; i < neededTicks + 2; i++) {
      sim.setInput('a', input({ seq: i + 1, search: true }));
      sim.step();
    }

    expect(state.powered).toBe(true);
    expect(isTownBlackout(state)).toBe(false);
    expect(canRestorePower(state)).toBe(false);
    expect(powerSubstationPrompt(false, false)).toBe('POWER ONLINE');
    expect(state.events.some((e) => e.type === 'power_restored')).toBe(true);
  });
});

describe('sensory and environmental effects of power restoration', () => {
  it('reverts zombie sight and hearing scales to standard when power is restored', () => {
    expect(sightScale(6, false)).toBe(0.7);
    expect(sightScale(6, true)).toBe(1);

    expect(hearingScale(6, false)).toBe(1.3);
    expect(hearingScale(6, true)).toBe(1);
  });

  it('resets streetlamp lighting and ambient look with withPowerRestored', () => {
    const blackoutLook = LEVEL_LOOKS.blackout;
    expect(blackoutLook.lampEvery).toBe(6);
    expect(blackoutLook.lampStrength).toBe(0.7);

    const restoredLook = withPowerRestored(blackoutLook);
    expect(restoredLook.lampEvery).toBe(1);
    expect(restoredLook.lampStrength).toBe(1);
    expect(restoredLook.ambient).toEqual(NIGHT_AMBIENT);
  });
});

describe('HUD and title card sidequest messaging', () => {
  it('provides sidequest text and completion notices for blackout level', () => {
    expect(levelSidequest({ level: 6, powered: false })).toBe('Sidequest: Restore power to the city');
    expect(levelSidequest({ level: 6, powered: true })).toBe('Power restored: Grid online');

    const titleCard = levelTitle(6);
    expect(titleCard.sidequest).toBe('Sidequest: Find the power substation to restore power to the city');
  });
});
