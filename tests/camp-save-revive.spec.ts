import { describe, expect, it } from 'vitest';
import { reviveSave } from '../src/game/home/home-save-revive.ts';
import { emptyCamp, emptySave } from '../src/game/home/home-store.ts';
import { createInventoryGrid } from '../shared/grid-inventory.ts';

describe('reviving the camp and the locker grid', () => {
  const blank = emptySave(1);

  it('keeps the locker grid, which it used to drop', () => {
    const lockerGrid = createInventoryGrid(4, 12);
    expect(reviveSave({ ...blank, lockerGrid }, blank)?.lockerGrid).toEqual(lockerGrid);
  });

  it('drops a locker grid that does not read', () => {
    expect(reviveSave({ ...blank, lockerGrid: { cols: 'x' } }, blank)).not.toHaveProperty('lockerGrid');
  });

  it('keeps a camp field by field and drops what is bad', () => {
    const camp = { rescued: ['quartermaster', 'nobody', 'medic'], radio: true, tracks: ['a.mp3', 3], rosterUnlocked: 'no', character: -2 };
    const revived = reviveSave({ ...blank, camp }, blank)?.camp;
    expect(revived).toEqual({ rescued: ['quartermaster', 'medic'], radio: true, tracks: ['a.mp3'], rosterUnlocked: [], character: null });
  });

  it('leaves the camp off an older save, and starts a new one empty', () => {
    const { camp: _camp, ...old } = blank;
    expect(reviveSave(old, blank)).not.toHaveProperty('camp');
    expect(blank.camp).toEqual(emptyCamp());
  });
});

describe('migrating a save from before the camp', () => {
  const legacy = { radio: true, tracks: ['a.mp3'] };

  it('gives an existing save all four merchants and the old radio', async () => {
    const { migrateCamp } = await import('../src/game/home/camp-migrate.ts');
    const { MERCHANT_IDS } = await import('../shared/home-protocol.ts');
    const { camp: _c, ...old } = emptySave(1);
    const existing = { ...old, appliedReceipts: ['sim:1'] };
    expect(migrateCamp(existing, legacy).camp).toMatchObject({ rescued: [...MERCHANT_IDS], radio: true, tracks: ['a.mp3'] });
  });

  it('starts a brand-new save with nobody, and leaves a save with a camp alone', async () => {
    const { migrateCamp } = await import('../src/game/home/camp-migrate.ts');
    const { camp: _c, ...old } = emptySave(1);
    expect(migrateCamp(old, { radio: false, tracks: [] }).camp?.rescued).toEqual([]);
    const withCamp = emptySave(1);
    expect(migrateCamp(withCamp, legacy)).toBe(withCamp);
  });
});
