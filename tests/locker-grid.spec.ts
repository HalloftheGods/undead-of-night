import { describe, expect, it } from 'vitest';
import { containerGridDimensions } from '../shared/containers.ts';
import { emptyLoadout } from '../shared/loadout.ts';
import type { Loadout } from '../shared/home-protocol.ts';
import {
  BUNKER_LOCKER_COLS,
  BUNKER_LOCKER_ROWS,
  createBunkerLockerGrid,
  gridToLoadout,
  handsFromGrids,
  loadoutToGrid,
  loadoutToHandsBag,
  mergeGridLocker,
} from '../src/game/home/bunker-locker-grid.ts';

describe('locker grid system', () => {
  describe('container dimensions', () => {
    it('returns 3x8 for world locker containers', () => {
      const dimensions = containerGridDimensions('locker');
      expect(dimensions).toEqual({ cols: 3, rows: 8 });
    });

    it('returns default 5x4 for standard containers or undefined', () => {
      expect(containerGridDimensions('cabinet')).toEqual({ cols: 5, rows: 4 });
      expect(containerGridDimensions('trunk')).toEqual({ cols: 5, rows: 4 });
      expect(containerGridDimensions(undefined)).toEqual({ cols: 5, rows: 4 });
    });
  });

  describe('bunker locker grid', () => {
    it('creates a 4x12 empty grid for bunker locker', () => {
      const grid = createBunkerLockerGrid();
      expect(grid.cols).toBe(BUNKER_LOCKER_COLS);
      expect(grid.rows).toBe(BUNKER_LOCKER_ROWS);
      expect(grid.cols).toBe(4);
      expect(grid.rows).toBe(12);
      expect(grid.items).toEqual([]);
    });

    it('converts loadout to 4x12 grid and back to loadout', () => {
      const startLoadout: Loadout = {
        ...emptyLoadout(),
        guns: { pistol: {}, carbine: {}, shotgun: {} },
        ammoBag: { pistol: 24, carbine: 60, shotgun: 16 },
        medkits: 2,
        knife: true,
        bottles: 2,
        supplies: {
          bandage: 3,
          canned_food: 2,
          water_bottle: 1,
          disinfectant: 1,
          antibiotics: 1,
        },
      };

      const grid = loadoutToGrid(startLoadout);
      expect(grid.cols).toBe(4);
      expect(grid.rows).toBe(12);
      expect(grid.items.length).toBeGreaterThan(0);

      const recovered = gridToLoadout(grid, startLoadout);
      expect(recovered.guns).toEqual(startLoadout.guns);
      expect(recovered.ammoBag).toEqual(startLoadout.ammoBag);
      expect(recovered.medkits).toBe(2);
      expect(recovered.knife).toBe(true);
      expect(recovered.bottles).toBe(2);
      expect(recovered.supplies).toEqual(startLoadout.supplies);
    });

    it('preserves existing item positions when repacking loadout with existingGrid', () => {
      const startLoadout: Loadout = {
        ...emptyLoadout(),
        guns: { pistol: {} },
        ammoBag: { pistol: 12, carbine: 0, shotgun: 0 },
        medkits: 1,
      };

      const initialGrid = loadoutToGrid(startLoadout);
      const pistolItem = initialGrid.items.find((item) => item.type === 'pistol');
      expect(pistolItem).toBeDefined();

      // Repack with same loadout passing initialGrid
      const repackedGrid = loadoutToGrid(startLoadout, initialGrid);
      const repackedPistol = repackedGrid.items.find((item) => item.type === 'pistol');
      expect(repackedPistol).toBeDefined();
      expect(repackedPistol?.x).toBe(pistolItem?.x);
      expect(repackedPistol?.y).toBe(pistolItem?.y);
      expect(repackedPistol?.rotated).toBe(pistolItem?.rotated);
    });

    it('merges banked run loot into bunker grid without disturbing existing layout', () => {
      const initialGrid = createBunkerLockerGrid();
      initialGrid.items.push({ id: 'custom-item-1', type: 'pistol', x: 0, y: 0, rotated: false });

      const bankedLoot: Loadout = {
        ...emptyLoadout(),
        guns: { carbine: {} },
        ammoBag: { pistol: 0, carbine: 30, shotgun: 0 },
        medkits: 1,
        supplies: {
          bandage: 2,
          canned_food: 1,
          water_bottle: 0,
          disinfectant: 0,
          antibiotics: 0,
        },
      };

      const merged = mergeGridLocker(initialGrid, bankedLoot);
      const originalPistol = merged.items.find((item) => item.id === 'custom-item-1');
      expect(originalPistol).toBeDefined();
      expect(originalPistol?.x).toBe(0);
      expect(originalPistol?.y).toBe(0);

      const hasCarbine = merged.items.some((item) => item.type === 'carbine');
      expect(hasCarbine).toBe(true);
      const bandageCount = merged.items.filter((item) => item.type === 'bandage').length;
      expect(bandageCount).toBe(2);
      const cannedFoodCount = merged.items.filter((item) => item.type === 'canned_food').length;
      expect(cannedFoodCount).toBe(1);
    });

    it('converts carried loadout to hands bag grids and back to loadout', () => {
      const carriedLoadout: Loadout = {
        ...emptyLoadout(),
        guns: { pistol: {}, carbine: {} },
        ammoBag: { pistol: 12, carbine: 30, shotgun: 0 },
        medkits: 1,
        knife: true,
        bottles: 1,
        supplies: {
          bandage: 2,
          canned_food: 1,
          water_bottle: 1,
          disinfectant: 0,
          antibiotics: 0,
        },
      };

      const handsBag = loadoutToHandsBag(carriedLoadout, 'satchel');
      expect(handsBag.gear.sidearm?.type).toBe('pistol');
      expect(handsBag.gear.primary?.type).toBe('carbine');

      const recovered = handsFromGrids(
        handsBag.backpackGrid,
        handsBag.pocketsGrid,
        handsBag.gear,
        carriedLoadout
      );

      expect(recovered.guns).toEqual(carriedLoadout.guns);
      expect(recovered.ammoBag).toEqual(carriedLoadout.ammoBag);
      expect(recovered.medkits).toBe(1);
      expect(recovered.knife).toBe(true);
      expect(recovered.bottles).toBe(1);
      expect(recovered.supplies).toEqual(carriedLoadout.supplies);
    });
  });
});
