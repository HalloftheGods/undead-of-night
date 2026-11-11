import { describe, expect, it } from 'vitest';
import { backpackDef } from '../shared/backpack.ts';
import { carriedPack } from '../src/game/carried-pack.ts';
import { isInventoryKey } from '../src/game/inventory-modal.ts';
import { aHud } from './backpack-fixture.ts';

const NOTHING = { owned: [], medkits: 0, bottles: 0, fireworks: 0, fountains: 0, bag: [] } as const;

function types(pack: ReturnType<typeof carriedPack>): string[] {
  return pack.grid.items.map((item) => item.type);
}

describe('carriedPack', () => {
  it('is an empty satchel grid for a survivor who carries nothing', () => {
    const hud = aHud({ ...NOTHING });
    const pack = carriedPack(hud);
    expect(pack.grid.items).toEqual([]);
    expect(pack.tier).toBe('satchel');
    expect(pack.grid.cols).toBe(backpackDef('satchel').cols);
    expect(pack.grid.rows).toBe(backpackDef('satchel').rows);
    expect(pack.unplaced).toEqual([]);
  });

  it('sizes the grid from the pack tier', () => {
    const pack = carriedPack(aHud({ ...NOTHING, backpackTier: 'alice' }));
    expect(pack.grid.cols).toBe(backpackDef('alice').cols);
    expect(pack.grid.rows).toBe(backpackDef('alice').rows);
  });

  it('packs exactly what is carried, with real counts and rounds', () => {
    const hud = aHud({
      ...NOTHING,
      backpackTier: 'alice',
      owned: ['pistol'],
      mags: { pistol: 12, carbine: 0, shotgun: 0 },
      ammoBag: { pistol: 30, carbine: 0, shotgun: 0 },
      medkits: 2,
      bottles: 1,
      fireworks: 3,
      materials: { planks: 2, nails: 8, sheets: 1, hasHammer: true, hasCrowbar: false },
    });
    const pack = carriedPack(hud);
    expect(types(pack).sort()).toEqual(['bottle', 'firework', 'hammer_tool', 'medkit', 'medkit', 'nails', 'pistol', 'plank', 'plank', 'sheet_curtain'].sort());
    expect(pack.grid.items.find((item) => item.type === 'pistol')?.ammo).toBe(42);
    expect(pack.grid.items.find((item) => item.type === 'nails')?.count).toBe(8);
    expect(pack.grid.items.find((item) => item.type === 'firework')?.count).toBe(3);
    expect(pack.unplaced).toEqual([]);
  });

  it('stacks candy by kind and leaves out what is not carried', () => {
    const stack = { id: 'gummy', name: 'Gummy', stat: '', blurb: '', count: 4, left: 0 };
    const hud = aHud({ ...NOTHING, bag: [stack] as never });
    const pack = carriedPack(hud);
    expect(pack.grid.items).toHaveLength(1);
    expect(pack.grid.items[0]).toMatchObject({ type: 'candy', count: 4 });
  });

  it('never overlaps items and reports what had no room', () => {
    const pack = carriedPack(aHud({ ...NOTHING, medkits: 9 }));
    expect(pack.grid.items.length + pack.unplaced.length).toBe(9);
    expect(pack.unplaced.length).toBeGreaterThan(0);
    const cells = new Set<string>();
    for (const item of pack.grid.items) {
      for (let dx = 0; dx < 2; dx += 1) {
        for (let dy = 0; dy < 2; dy += 1) {
          const key = `${item.x + dx},${item.y + dy}`;
          expect(cells.has(key)).toBe(false);
          cells.add(key);
        }
      }
    }
  });
});

describe('isInventoryKey', () => {
  const press = (over: Partial<Parameters<typeof isInventoryKey>[0]> = {}) => ({ code: 'KeyI', repeat: false, ctrlKey: false, metaKey: false, altKey: false, target: null, ...over });

  it('takes a bare I', () => {
    expect(isInventoryKey(press(), [])).toBe(true);
  });

  it('ignores other keys, repeats, shortcuts and a key the player has rebound', () => {
    expect(isInventoryKey(press({ code: 'KeyO' }), [])).toBe(false);
    expect(isInventoryKey(press({ repeat: true }), [])).toBe(false);
    expect(isInventoryKey(press({ ctrlKey: true }), [])).toBe(false);
    expect(isInventoryKey(press(), ['KeyI'])).toBe(false);
  });
});
