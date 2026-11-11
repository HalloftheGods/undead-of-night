import { isCandyId } from '../../shared/candy.ts';
import type { PickupType, WeaponId } from '../../shared/protocol.ts';
import type { ArtBook, PixelSprite } from '../art/types.ts';

const WEAPONS: readonly string[] = ['pistol', 'carbine', 'shotgun'] satisfies readonly WeaponId[];

/** Items the HUD already draws with a sprite of their own, outside the pickup icons. */
const HUD_SPRITES = { bottle: 'bottle', firework: 'fireworks', fountain: 'fountain', candy: 'candy' } as const;

function isHudItem(type: string): type is keyof typeof HUD_SPRITES {
  return type in HUD_SPRITES;
}

/** The sprite for an item type, or null when the game has no picture of it. */
export function lootSprite(art: ArtBook, type: string): PixelSprite | null {
  if (WEAPONS.includes(type)) return art.ui.weaponIcons[type as WeaponId];
  if (isCandyId(type) && art.ui.candies) return art.ui.candies[type];
  if (isHudItem(type)) return art.ui[HUD_SPRITES[type]];
  return art.ui.pickupIcons[type as PickupType] ?? null;
}

/** The small number on an item: how many are stacked, else the rounds a gun holds. */
export function lootBadge(count: number | undefined, ammo: number | undefined): string {
  const isStack = count !== undefined && count > 1;
  if (isStack) return `x${count}`;
  return ammo === undefined ? '' : `${ammo}`;
}
