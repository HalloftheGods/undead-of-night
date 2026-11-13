// The sound a supply makes when it is used from the grid: candy crunches, drinks glug, a medkit heals. Anything without its own gets a plain click.

import { isCandyId } from '@shared/candy.ts';
import type { SfxName } from '../../audio/sfx-registry.ts';

const USE_SOUNDS: Readonly<Record<string, SfxName>> = {
  medkit: 'heal',
  bandage: 'pickup_bandage',
  disinfectant: 'pickup_bandage',
  antibiotics: 'pickup_pills',
  water_bottle: 'pickup_water',
  bottle: 'pickup_water',
  canned_food: 'pickup_can',
  pistol_ammo: 'pickup_pistol_ammo',
  carbine_ammo: 'pickup_carbine_ammo',
  shells: 'pickup_ammo',
};

/** The sound for one item used by hand, by its type. */
export function useSoundOf(type: string): SfxName {
  if (isCandyId(type)) return 'candy_crunch';
  return USE_SOUNDS[type] ?? 'ui_click';
}
