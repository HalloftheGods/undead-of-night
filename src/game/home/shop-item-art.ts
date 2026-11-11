// Which in-game sprite stands for each thing a merchant sells: the icon the HUD and the ground pickups already use.

import { GUN_EFFECTS } from '../../../shared/round-effect-data.ts';
import type { PixelSprite, UiArt } from '../../art/types.ts';
import type { ItemGrant } from './merchant-data.ts';

/** The part of the art book a shelf draws from. */
export type ShopIcons = Pick<UiArt, 'weaponIcons' | 'pickupIcons' | 'bottle'>;

type GrantOf<K extends ItemGrant['kind']> = Extract<ItemGrant, { kind: K }>;
type IconPicks = { readonly [K in ItemGrant['kind']]: (icons: ShopIcons, grant: GrantOf<K>) => PixelSprite };

/** Guns are the HUD's weapon icons, a bottle is the HUD's bottle, and the rest are the pickups they become on the ground. */
const ICON_OF: IconPicks = {
  gun: (icons, { weapon }) => icons.weaponIcons[weapon],
  ammo: (icons, { ammo }) => icons.pickupIcons[ammo],
  part: (icons, { part }) => icons.pickupIcons[part],
  kit: (icons, { effect }) => icons.pickupIcons[GUN_EFFECTS[effect].kit],
  supply: (icons, { supply }) => icons.pickupIcons[supply],
  medkit: (icons) => icons.pickupIcons.medkit,
  knife: (icons) => icons.pickupIcons.knife,
  bottle: (icons) => icons.bottle,
};

export function itemSprite(icons: ShopIcons, grant: ItemGrant): PixelSprite {
  const pickIcon = ICON_OF[grant.kind] as (icons: ShopIcons, grant: ItemGrant) => PixelSprite;
  return pickIcon(icons, grant);
}
