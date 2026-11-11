import { describe, expect, it } from 'vitest';
import { buildArtBook } from '../src/art/index.ts';
import { getItemFootprint } from '../shared/grid-inventory.ts';
import { lootBadge, lootSprite } from '../src/game/loot-item-art.ts';

describe('inventory item art', () => {
  const art = buildArtBook();

  it('draws every bag item and worn gun with one of the game sprites', () => {
    const types = ['medkit', 'bottle', 'firework', 'fountain', 'knife', 'plank', 'nails', 'hammer_tool', 'crowbar', 'sheet_curtain', 'pistol', 'carbine', 'shotgun'];
    for (const type of types) expect(lootSprite(art, type), type).not.toBeNull();
  });

  it('uses the HUD sprites for what has no pickup icon', () => {
    expect(lootSprite(art, 'bottle')).toBe(art.ui.bottle);
    expect(lootSprite(art, 'firework')).toBe(art.ui.fireworks);
    expect(lootSprite(art, 'pistol')).toBe(art.ui.weaponIcons.pistol);
  });

  it('draws a long item end to end in a bag slot, filling the slots it takes', () => {
    for (const type of ['crowbar', 'plank']) {
      const long = lootSprite(art, type, true)!;
      const { height } = getItemFootprint(type, false);
      expect(long, type).not.toBe(lootSprite(art, type));
      expect([long.w, long.h], type).toEqual([15, 17 * height - 2]);
    }
    expect(lootSprite(art, 'medkit', true)).toBe(lootSprite(art, 'medkit'));
  });

  it('has no picture for a type the game does not draw', () => {
    expect(lootSprite(art, 'armor_vest')).toBeNull();
  });

  it('badges a stack with its count and a gun with its rounds', () => {
    expect(lootBadge(3, undefined)).toBe('x3');
    expect(lootBadge(1, undefined)).toBe('');
    expect(lootBadge(undefined, 24)).toBe('24');
    expect(lootBadge(undefined, undefined)).toBe('');
  });
});
