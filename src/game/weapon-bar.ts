// The weapon bar at the foot of the HUD: one slot per gun the game has, in the order the
// number keys reach them. A finger presses the slot, which sends that key; a keyboard still
// has the number. The bar does not decide what it looks like, only what each slot stands for.

import { WEAPON_ORDER } from '../../shared/protocol.ts';
import { WEAPONS } from '../../shared/constants.ts';
import type { WeaponId } from '../../shared/protocol.ts';
import { gunRounds } from './hud-state.ts';
import type { HudState } from './hud-state.ts';

export interface BarSlot {
  readonly weapon: WeaponId;
  /** The key this slot stands in for, pressed and released through the touch pad. */
  readonly code: string;
  /** What the key hint reads on a keyboard: '1', '2', '3'. */
  readonly key: string;
  /** The whole phrase, for a screen reader. */
  readonly label: string;
  readonly owned: boolean;
  /** Rounds this gun can still fire, loaded and spare, or null where it is not owned. */
  readonly rounds: number | null;
  readonly active: boolean;
}

type BarHud = Pick<HudState, 'weapon' | 'owned' | 'ammoBag' | 'mags'>;

/** Every gun in key order, whether it is carried or not, so the bar never shifts under a thumb. */
export function weaponBar(hud: BarHud): BarSlot[] {
  return WEAPON_ORDER.map((weapon, index) => {
    const owned = hud.owned.includes(weapon);
    const name = WEAPONS[weapon].label;
    return {
      weapon,
      code: `Digit${index + 1}`,
      key: String(index + 1),
      label: owned ? `Hold the ${name.toLowerCase()}` : `${name}, not carried`,
      owned,
      rounds: owned ? gunRounds(hud, weapon) : null,
      active: weapon === hud.weapon,
    };
  });
}
