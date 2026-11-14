import { describe, expect, it } from 'vitest';
import { restartRun } from '../shared/run-end.ts';
import { createDefaultSurvivalNeeds, resetSurvivalNeeds, type SurvivalNeeds } from '../shared/survival-needs.ts';
import { quietSim } from './helpers/sim-harness.ts';

/** A survivor who died still bleeding, infected and starving. */
function sickNeeds(): SurvivalNeeds {
  return {
    hunger: 90,
    thirst: 85,
    fatigue: 70,
    wound: 'bite',
    bleeding: true,
    bleedTimer: 1.5,
    infection: 64,
    isInfected: true,
  };
}

describe('waking up after a death clears every moodle', () => {
  it('resetSurvivalNeeds returns the needs to a fresh body', () => {
    const needs = sickNeeds();
    resetSurvivalNeeds(needs);
    expect(needs).toEqual(createDefaultSurvivalNeeds());
  });

  it('a new run restart wakes the dead survivor with clean needs', () => {
    const { state } = quietSim(['a']);
    const [p] = state.players;
    p.needs = sickNeeds();
    p.status = 'dead';
    p.health = 0;

    restartRun(state, 1);

    expect(p.status).toBe('alive');
    expect(p.needs).toEqual(createDefaultSurvivalNeeds());
  });
});
