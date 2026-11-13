// The call over the local survivor's head when the gun in hand is dry: what to press next.
// "R: RELOAD!" while there are spares for it, the number and name of another gun that still
// fires when it has none ("1: PISTOL"), and the shove when every gun is empty ("F: SHOVE",
// or "F: STAB" with a knife). Fingers have no keys, so a touch player reads the word alone.

import { WEAPONS } from '../../shared/constants.ts';
import { WEAPON_ORDER } from '../../shared/protocol.ts';
import type { PlayerEntity, WeaponId } from '../../shared/protocol.ts';

/** How fast the call flashes, and how much of each beat it is lit: on more than off, so it reads. */
const BLINKS_PER_SEC = 2.5;
const LIT_SHARE = 0.7;

export type AmmoPromptKind = 'reload' | 'switch' | 'melee';

export interface AmmoPrompt {
  readonly kind: AmmoPromptKind;
  readonly text: string;
  /** False on the dark part of the flash. */
  readonly lit: boolean;
}

type Shooter = Pick<PlayerEntity, 'status' | 'weapon' | 'ammo' | 'owned' | 'ammoBag' | 'mags' | 'knife' | 'reload'>;

export interface AmmoPromptContext {
  readonly touch: boolean;
  /** The camp, where nothing needs shooting and an empty gun is not news, until the overrun frees the guns. */
  readonly atHome: boolean;
  /** The overrun has freed the guns at home, so an empty gun is news again. */
  readonly gunsFree?: boolean;
  readonly time: number;
}

function rounds(player: Shooter, weapon: WeaponId): number {
  return (player.mags[weapon] ?? 0) + (player.ammoBag[weapon] ?? 0);
}

/** What to press now the magazine is empty, or null while the gun still fires, a reload is under way, or there is no call to make. */
export function ammoPrompt(player: Shooter, context: AmmoPromptContext): AmmoPrompt | null {
  const holdingFire = context.atHome && context.gunsFree !== true;
  const quiet = player.status !== 'alive' || holdingFire || player.ammo > 0 || player.reload > 0;
  if (quiet) return null;
  const beat = (context.time * BLINKS_PER_SEC) % 1;
  const lit = beat < LIT_SHARE;
  const key = (glyph: string, word: string): string => (context.touch ? word : `${glyph}: ${word}`);

  const sparesInHand = (player.ammoBag[player.weapon] ?? 0) > 0;
  if (sparesInHand) return { kind: 'reload', text: key('R', 'RELOAD!'), lit };

  const slot = WEAPON_ORDER.findIndex((weapon) => weapon !== player.weapon && player.owned.includes(weapon) && rounds(player, weapon) > 0);
  if (slot >= 0) {
    const name = WEAPONS[WEAPON_ORDER[slot]].label.toUpperCase();
    return { kind: 'switch', text: key(String(slot + 1), name), lit };
  }

  return { kind: 'melee', text: key('F', player.knife ? 'STAB' : 'SHOVE'), lit };
}
