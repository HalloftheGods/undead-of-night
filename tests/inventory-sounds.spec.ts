import { describe, expect, it } from 'vitest';
import { SFX_NAMES } from '../src/audio/sfx-registry.ts';
import { useSoundOf } from '../src/game/inventory/use-sound.ts';

describe('inventory sounds', () => {
  it('gives each supply its own sound', () => {
    expect(useSoundOf('medkit')).toBe('heal');
    expect(useSoundOf('water_bottle')).toBe('pickup_water');
    expect(useSoundOf('antibiotics')).toBe('pickup_pills');
    expect(useSoundOf('canned_food')).toBe('pickup_can');
  });

  it('plays the candy crunch for any candy', () => {
    expect(useSoundOf('sour_skulls')).toBe('candy_crunch');
  });

  it('falls back to a click for anything else', () => {
    expect(useSoundOf('not_a_real_item')).toBe('ui_click');
  });

  it('only ever names sounds that exist', () => {
    for (const type of ['medkit', 'bandage', 'disinfectant', 'antibiotics', 'water_bottle', 'bottle', 'canned_food', 'sour_skulls', 'nothing']) {
      expect(SFX_NAMES).toContain(useSoundOf(type));
    }
  });
});
