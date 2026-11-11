import { describe, expect, it } from 'vitest';
import { BOTTLE_CARRY } from '../shared/bottles.ts';
import { MEDKIT_MAX, WEAPONS } from '../shared/constants.ts';
import type { Loadout } from '../shared/home-protocol.ts';
import { emptyLoadout } from '../shared/loadout.ts';
import { buildBottle, buildPickupIcons, buildWeaponIcons } from '../src/art/fx/icons.ts';
import { loadoutRows, moveToHands, moveToLocker } from '../src/game/home-screens.ts';
import { HAND_ROW_COUNT, handRows, lockerArtSize, lockerGrant, lockerSprite, lockerTiles } from '../src/game/home/locker-view.ts';
import { ITEM_SLOTS } from '../src/game/home/shop-item-facts.ts';

const icons = { weaponIcons: buildWeaponIcons(), pickupIcons: buildPickupIcons(), bottle: buildBottle() };

function gear(patch: Partial<Loadout> = {}): Loadout {
  return { ...emptyLoadout(), ...patch };
}

const locker = gear({
  guns: { pistol: {}, shotgun: {} },
  ammoBag: { pistol: 24, carbine: 0, shotgun: 8 },
  parts: { barrel: 2, grip: 0, magazine: 0, suppressor: 1, toolkit: 0 },
  kits: { incendiary: 0, acid: 1, piercing: 0, tranq: 0 },
  medkits: 2,
});
const hands = gear({ guns: { carbine: {} }, ammoBag: { pistol: 0, carbine: 30, shotgun: 0 }, bottles: 1, knife: true });

describe('the locker view', () => {
  it('gives one tile per kind of gear on either side, in the rows order, with both counts', () => {
    const tiles = lockerTiles({ locker, hands });
    expect(tiles.map((tile) => tile.key)).toEqual([
      'gun:pistol', 'gun:carbine', 'gun:shotgun', 'ammo:pistol', 'ammo:carbine', 'ammo:shotgun',
      'part:barrel', 'part:suppressor', 'kit:acid', 'medkit', 'bottle', 'knife',
    ]);
    expect(tiles.find((tile) => tile.key === 'ammo:pistol')).toMatchObject({ label: 'Pistol rounds', locker: 24, hand: 0 });
    expect(tiles.find((tile) => tile.key === 'knife')).toMatchObject({ locker: 0, hand: 1 });
  });

  it('keeps every tile in place while gear moves back and forth', () => {
    const start = { locker, hands };
    const keys = lockerTiles(start).map((tile) => tile.key);
    const moved = moveToLocker(moveToHands(moveToHands(start, 'ammo:pistol'), 'medkit'), 'knife');
    expect(lockerTiles(moved).map((tile) => tile.key)).toEqual(keys);
    expect(lockerTiles(moved).find((tile) => tile.key === 'medkit')).toMatchObject({ locker: 1, hand: 1 });
  });

  it('lists what is in hand by group, against the carry caps the server checks', () => {
    const rows = handRows({ locker, hands });
    expect(rows.map((row) => row.label)).toEqual(['Guns', 'Ammo', 'Parts', 'Kits', 'Supplies', 'Medkits', 'Bottles', 'Knife']);
    expect(handRows({ locker: gear(), hands: gear() })).toHaveLength(HAND_ROW_COUNT);
    const ammoCap = WEAPONS.pistol.reserveCap + WEAPONS.carbine.reserveCap + WEAPONS.shotgun.reserveCap;
    expect(rows[0]).toMatchObject({ held: 1, cap: 3 });
    expect(rows[1]).toMatchObject({ held: 30, cap: ammoCap });
    expect(rows[1].items.map((item) => item.key)).toEqual(['ammo:carbine']);
    expect(rows[4]).toMatchObject({ held: 0, cap: 20, filled: 0 });
    expect(rows[5]).toMatchObject({ held: 0, cap: MEDKIT_MAX, filled: 0 });
    expect(rows[6]).toMatchObject({ held: 1, cap: BOTTLE_CARRY });
    expect(rows[7]).toMatchObject({ held: 1, cap: 1, filled: ITEM_SLOTS });
  });

  it('lights at least one cell for anything held, and never more than the bar has', () => {
    const one = handRows({ locker: gear(), hands: gear({ ammoBag: { pistol: 1, carbine: 0, shotgun: 0 } }) });
    expect(one[1].filled).toBe(1);
    const over = handRows({ locker: gear(), hands: gear({ bottles: BOTTLE_CARRY + 2 }) });
    expect(over[6].filled).toBe(ITEM_SLOTS);
  });

  it('draws every locker row with the icon the shop and the HUD use', () => {
    const everything = gear({
      guns: { pistol: {}, carbine: {}, shotgun: {} },
      ammoBag: { pistol: 1, carbine: 1, shotgun: 1 },
      parts: { barrel: 1, grip: 1, magazine: 1, suppressor: 1, toolkit: 1 },
      kits: { incendiary: 1, acid: 1, piercing: 1, tranq: 1 },
      medkits: 1,
      bottles: 1,
      knife: true,
    });
    const keys = loadoutRows(everything).map((row) => row.key);
    expect(keys.every((key) => lockerGrant(key) !== null)).toBe(true);
    expect(lockerSprite(icons, 'gun:carbine')).toBe(icons.weaponIcons.carbine);
    expect(lockerSprite(icons, 'ammo:shotgun')).toBe(icons.pickupIcons.shells);
    expect(lockerSprite(icons, 'part:grip')).toBe(icons.pickupIcons.grip);
    expect(lockerSprite(icons, 'kit:tranq')).toBe(icons.pickupIcons.tranq_kit);
    expect(lockerSprite(icons, 'medkit')).toBe(icons.pickupIcons.medkit);
    expect(lockerSprite(icons, 'bottle')).toBe(icons.bottle);
    expect(lockerSprite(icons, 'knife')).toBe(icons.pickupIcons.knife);
    const sprites = keys.map((key) => lockerSprite(icons, key));
    expect(new Set(sprites).size).toBe(sprites.length);
  });

  it('draws nothing for a key the tables do not know', () => {
    expect(lockerGrant('gun:rocket')).toBeNull();
    expect(lockerGrant('jewel')).toBeNull();
    expect(lockerSprite(icons, 'part:spoon')).toBeNull();
  });

  it('sizes the art to the largest icon among the keys', () => {
    const size = lockerArtSize(icons, ['medkit', 'gun:carbine']);
    expect(size.w).toBe(Math.max(icons.pickupIcons.medkit.w, icons.weaponIcons.carbine.w));
    expect(size.h).toBe(Math.max(icons.pickupIcons.medkit.h, icons.weaponIcons.carbine.h));
    expect(lockerArtSize(icons, [])).toEqual({ w: 1, h: 1 });
  });
});
