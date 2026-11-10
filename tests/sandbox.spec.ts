import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SANDBOX_SETTINGS,
  SANDBOX_PRESETS,
  resolveHearingMultiplier,
  resolveLootMultiplier,
  resolveLullMultiplier,
  resolveSightMultiplier,
  resolveSpeedMultiplier,
} from '../shared/sandbox.ts';

describe('Sandbox Game Rules Engine', () => {
  it('resolves default settings to 1.0 base multipliers', () => {
    expect(resolveSpeedMultiplier(DEFAULT_SANDBOX_SETTINGS)).toBe(1.0);
    expect(resolveSightMultiplier(DEFAULT_SANDBOX_SETTINGS)).toBe(1.0);
    expect(resolveHearingMultiplier(DEFAULT_SANDBOX_SETTINGS)).toBe(1.0);
    expect(resolveLootMultiplier(DEFAULT_SANDBOX_SETTINGS)).toBe(1.0);
    expect(resolveLullMultiplier(DEFAULT_SANDBOX_SETTINGS)).toBe(1.0);
  });

  it('correctly scales sprinter nightmare preset multipliers', () => {
    const sprinters = SANDBOX_PRESETS.find((p) => p.id === 'sprinters');
    expect(sprinters).toBeDefined();
    if (!sprinters) return;

    expect(resolveSpeedMultiplier(sprinters.settings)).toBe(1.35);
    expect(resolveSightMultiplier(sprinters.settings)).toBe(1.4);
    expect(resolveLullMultiplier(sprinters.settings)).toBe(0.6);
  });

  it('correctly scales classic shamblers preset multipliers', () => {
    const shamblers = SANDBOX_PRESETS.find((p) => p.id === 'shamblers');
    expect(shamblers).toBeDefined();
    if (!shamblers) return;

    expect(resolveSpeedMultiplier(shamblers.settings)).toBe(0.65);
    expect(resolveLootMultiplier(shamblers.settings)).toBe(0.55);
  });
});
