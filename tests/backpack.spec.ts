import { describe, expect, it } from 'vitest';
import {
  backpackDef,
  bottleCapForTier,
  isBetterBackpack,
  medkitCapForTier,
  reserveCapForTier,
  throwableCapForTier,
} from '../shared/backpack.ts';

describe('Khronus Backpack Tiers & Capacity System', () => {
  it('provides baseline stats for Tier 1 Canvas Satchel', () => {
    const satchel = backpackDef('satchel');
    expect(satchel.ammoMultiplier).toBe(1.0);
    expect(medkitCapForTier('satchel')).toBe(3);
    expect(bottleCapForTier('satchel')).toBe(3);
    expect(throwableCapForTier('satchel')).toBe(2);
    expect(reserveCapForTier('pistol', 'satchel')).toBe(60);
  });

  it('scales carry capacity for Tier 2 Heavy Duffel', () => {
    const duffel = backpackDef('duffel');
    expect(duffel.ammoMultiplier).toBe(1.5);
    expect(medkitCapForTier('duffel')).toBe(4);
    expect(bottleCapForTier('duffel')).toBe(5);
    expect(reserveCapForTier('pistol', 'duffel')).toBe(90);
  });

  it('doubles ammo capacity and maximizes capacity for Tier 3 ALICE Pack', () => {
    const alice = backpackDef('alice');
    expect(alice.ammoMultiplier).toBe(2.0);
    expect(medkitCapForTier('alice')).toBe(6);
    expect(bottleCapForTier('alice')).toBe(8);
    expect(reserveCapForTier('pistol', 'alice')).toBe(120);
  });

  it('compares backpack upgrade tiers correctly', () => {
    expect(isBetterBackpack('satchel', 'duffel')).toBe(true);
    expect(isBetterBackpack('duffel', 'alice')).toBe(true);
    expect(isBetterBackpack('alice', 'satchel')).toBe(false);
    expect(isBetterBackpack('duffel', 'duffel')).toBe(false);
  });
});
