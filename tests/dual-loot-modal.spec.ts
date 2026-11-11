import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { backpackDef } from '../shared/backpack.ts';
import { createInventoryGrid, getItemFootprint, placeItem } from '../shared/grid-inventory.ts';
import {
  computeTileHighlight,
  createDualLootState,
  formatItemName,
  isItemValidForGearSlot,
  pickUpItemFromGear,
  pickUpItemFromGrid,
  placeHeldItemInGear,
  placeHeldItemInGrid,
  quickTransferBetweenInventories,
  returnHeldItemToSource,
  rotateActiveItem,
  transferItemDirectly,
} from '../src/game/dual-loot-modal.ts';

describe('Dual-Grid Container Looting & Inventory Modal', () => {
  describe('Modal Initialization & Sizing', () => {
    it('initializes with default container 5x4, pockets 2x2, and satchel backpack 5x4', () => {
      const state = createDualLootState({ backpackTier: 'satchel' });

      expect(state.containerGrid.cols).toBe(5);
      expect(state.containerGrid.rows).toBe(4);
      expect(state.pocketsGrid.cols).toBe(2);
      expect(state.pocketsGrid.rows).toBe(2);

      const satchelDef = backpackDef('satchel');
      expect(state.backpackGrid.cols).toBe(satchelDef.cols);
      expect(state.backpackGrid.rows).toBe(satchelDef.rows);
      expect(state.gear.primary).toBeNull();
      expect(state.gear.secondary).toBeNull();
      expect(state.gear.armor).toBeNull();
    });

    it('sizes the backpack grid according to the upgraded backpack tiers', () => {
      const duffelDef = backpackDef('duffel');
      const duffelState = createDualLootState({ backpackTier: 'duffel' });
      expect(duffelState.backpackGrid.cols).toBe(duffelDef.cols);
      expect(duffelState.backpackGrid.rows).toBe(duffelDef.rows);

      const aliceDef = backpackDef('alice');
      const aliceState = createDualLootState({ backpackTier: 'alice' });
      expect(aliceState.backpackGrid.cols).toBe(aliceDef.cols);
      expect(aliceState.backpackGrid.rows).toBe(aliceDef.rows);
    });

    it('sets custom container titles such as Locker, Car Trunk, and Chest', () => {
      const lockerState = createDualLootState({ containerTitle: 'Police Locker' });
      expect(lockerState.containerTitle).toBe('Police Locker');

      const trunkState = createDualLootState({ containerTitle: 'Sedan Trunk' });
      expect(trunkState.containerTitle).toBe('Sedan Trunk');
    });
  });

  describe('Item Placement & Boundary Checking', () => {
    it('places items into container and player grids when valid', () => {
      const state = createDualLootState();

      const placedInContainer = placeItem(state.containerGrid, {
        id: 'box-1',
        type: 'ammo_box',
        x: 0,
        y: 0,
        rotated: false,
      });
      expect(placedInContainer).toBe(true);
      expect(state.containerGrid.items).toHaveLength(1);

      const placedInPockets = placeItem(state.pocketsGrid, {
        id: 'candy-1',
        type: 'candy',
        x: 1,
        y: 1,
        rotated: false,
      });
      expect(placedInPockets).toBe(true);
      expect(state.pocketsGrid.items).toHaveLength(1);

      const placedInBackpack = placeItem(state.backpackGrid, {
        id: 'bottle-1',
        type: 'bottle',
        x: 2,
        y: 1,
        rotated: false,
      });
      expect(placedInBackpack).toBe(true);
      expect(state.backpackGrid.items).toHaveLength(1);
    });

    it('rejects out of bounds placements in container and player grids', () => {
      const state = createDualLootState();

      // Shotgun is 4x1; placing at x=2 in 5-wide container fits (2,3,4,5? No: 2+4=6 > 5)
      const placedShotgun = placeItem(state.containerGrid, {
        id: 'shotgun-1',
        type: 'shotgun',
        x: 2,
        y: 0,
        rotated: false,
      });
      expect(placedShotgun).toBe(false);

      // Pockets is 2x2; medkit is 2x2, placed at x=1 overflows
      const placedMedkit = placeItem(state.pocketsGrid, {
        id: 'medkit-1',
        type: 'medkit',
        x: 1,
        y: 0,
        rotated: false,
      });
      expect(placedMedkit).toBe(false);
    });
  });

  describe('Equippable Gear Slots', () => {
    it('validates primary weapon slot for carbine, shotgun, and pistol', () => {
      expect(isItemValidForGearSlot('carbine', 'primary')).toBe(true);
      expect(isItemValidForGearSlot('shotgun', 'primary')).toBe(true);
      expect(isItemValidForGearSlot('pistol', 'primary')).toBe(true);
      expect(isItemValidForGearSlot('medkit', 'primary')).toBe(false);
      expect(isItemValidForGearSlot('armor_vest', 'primary')).toBe(false);
    });

    it('validates secondary weapon slot for pistol and knife', () => {
      expect(isItemValidForGearSlot('pistol', 'secondary')).toBe(true);
      expect(isItemValidForGearSlot('knife', 'secondary')).toBe(true);
      expect(isItemValidForGearSlot('nails', 'secondary')).toBe(false);
      expect(isItemValidForGearSlot('armor_vest', 'secondary')).toBe(false);
    });

    it('validates armor vest slot exclusively for armor_vest', () => {
      expect(isItemValidForGearSlot('armor_vest', 'armor')).toBe(true);
      expect(isItemValidForGearSlot('carbine', 'armor')).toBe(false);
      expect(isItemValidForGearSlot('medkit', 'armor')).toBe(false);
    });

    it('places and swaps gear items via held item', () => {
      const state = createDualLootState({
        primary: {
          id: 'old-carbine',
          type: 'carbine',
          x: 0,
          y: 0,
          rotated: false,
        },
      });

      // Pick up a shotgun from container
      placeItem(state.containerGrid, {
        id: 'new-shotgun',
        type: 'shotgun',
        x: 0,
        y: 0,
        rotated: false,
      });
      pickUpItemFromGrid(state, 'container', 'new-shotgun');
      expect(state.heldItem?.item.id).toBe('new-shotgun');

      // Place shotgun into primary slot: should swap old-carbine into held item
      const equipped = placeHeldItemInGear(state, 'primary');
      expect(equipped).toBe(true);
      expect(state.gear.primary?.id).toBe('new-shotgun');
      expect(state.heldItem?.item.id).toBe('old-carbine');

      // Now pick up from secondary slot
      state.gear.secondary = {
        id: 'knife-1',
        type: 'knife',
        x: 0,
        y: 0,
        rotated: false,
      };
      // Return carbine to container first
      returnHeldItemToSource(state);
      expect(state.heldItem).toBeNull();

      pickUpItemFromGear(state, 'secondary');
      expect(state.gear.secondary).toBeNull();
      expect(state.heldItem?.item.id).toBe('knife-1');
    });
  });

  describe('Click-to-Pick and Movement Logic', () => {
    it('picks up an item from grid, leaving cell free', () => {
      const state = createDualLootState();
      placeItem(state.containerGrid, {
        id: 'soda-1',
        type: 'soda',
        x: 1,
        y: 1,
        rotated: false,
      });

      const picked = pickUpItemFromGrid(state, 'container', 'soda-1');
      expect(picked).toBe(true);
      expect(state.containerGrid.items).toHaveLength(0);
      expect(state.heldItem?.item.id).toBe('soda-1');
    });

    it('places held item into empty grid cell', () => {
      const state = createDualLootState();
      placeItem(state.containerGrid, {
        id: 'medkit-1',
        type: 'medkit',
        x: 0,
        y: 0,
        rotated: false,
      });

      pickUpItemFromGrid(state, 'container', 'medkit-1');
      const placedInBackpack = placeHeldItemInGrid(state, 'backpack', 2, 1);
      expect(placedInBackpack).toBe(true);
      expect(state.heldItem).toBeNull();
      expect(state.backpackGrid.items[0]).toMatchObject({
        id: 'medkit-1',
        x: 2,
        y: 1,
      });
    });

    it('returns held item to original source on cancellation', () => {
      const state = createDualLootState();
      placeItem(state.containerGrid, {
        id: 'nails-1',
        type: 'nails',
        x: 3,
        y: 2,
        rotated: false,
      });

      pickUpItemFromGrid(state, 'container', 'nails-1');
      expect(state.containerGrid.items).toHaveLength(0);

      const returned = returnHeldItemToSource(state);
      expect(returned).toBe(true);
      expect(state.heldItem).toBeNull();
      expect(state.containerGrid.items[0]).toMatchObject({
        id: 'nails-1',
        x: 3,
        y: 2,
      });
    });
  });

  describe('Rotation Mechanism', () => {
    it('swaps footprint dimensions of held item when rotated', () => {
      const state = createDualLootState();
      placeItem(state.containerGrid, {
        id: 'bottle-1',
        type: 'bottle',
        x: 0,
        y: 0,
        rotated: false,
      });
      pickUpItemFromGrid(state, 'container', 'bottle-1');

      const initialDims = getItemFootprint('bottle', state.heldItem!.item.rotated);
      expect(initialDims).toEqual({ width: 1, height: 2 });

      rotateActiveItem(state);
      expect(state.heldItem?.item.rotated).toBe(true);
      const rotatedDims = getItemFootprint('bottle', state.heldItem!.item.rotated);
      expect(rotatedDims).toEqual({ width: 2, height: 1 });

      rotateActiveItem(state);
      expect(state.heldItem?.item.rotated).toBe(false);
      const backDims = getItemFootprint('bottle', state.heldItem!.item.rotated);
      expect(backDims).toEqual({ width: 1, height: 2 });
    });

    it('rotates selected item in grid in place if space permits', () => {
      const state = createDualLootState();
      placeItem(state.backpackGrid, {
        id: 'knife-1',
        type: 'knife',
        x: 0,
        y: 0,
        rotated: false,
      });

      state.selectedItemId = 'knife-1';
      state.selectedGridId = 'backpack';

      const rotated = rotateActiveItem(state);
      expect(rotated).toBe(true);
      expect(state.backpackGrid.items[0].rotated).toBe(true);
    });
  });

  describe('Color Tile Drop Highlights', () => {
    it('returns valid highlight for empty available tiles within bounds', () => {
      const grid = createInventoryGrid(5, 4);
      const heldItem = {
        id: 'bottle-1',
        type: 'bottle',
        x: 0,
        y: 0,
        rotated: false, // 1x2
      };

      // Hovering at col=1, row=1 covers (1,1) and (1,2)
      const highlightTile1 = computeTileHighlight(grid, 1, 1, 1, 1, heldItem);
      expect(highlightTile1).toBe('valid');

      const highlightTile2 = computeTileHighlight(grid, 1, 2, 1, 1, heldItem);
      expect(highlightTile2).toBe('valid');

      // Tile outside covered span returns none
      const outsideTile = computeTileHighlight(grid, 0, 0, 1, 1, heldItem);
      expect(outsideTile).toBe('none');
    });

    it('returns invalid highlight when item would overlap or go out of bounds', () => {
      const grid = createInventoryGrid(5, 4);
      placeItem(grid, {
        id: 'blocker',
        type: 'ammo_box',
        x: 1,
        y: 2,
        rotated: false,
      });

      const heldItem = {
        id: 'bottle-1',
        type: 'bottle',
        x: 0,
        y: 0,
        rotated: false, // 1x2
      };

      // Hovering at col=1, row=1 covers (1,1) and (1,2); (1,2) is occupied
      const highlight = computeTileHighlight(grid, 1, 1, 1, 1, heldItem);
      expect(highlight).toBe('invalid');

      // Out of bounds: hovering at row=3 with height 2 goes to row 4 (bounds max 3)
      const outOfBoundsHighlight = computeTileHighlight(grid, 0, 3, 0, 3, heldItem);
      expect(outOfBoundsHighlight).toBe('invalid');
    });
  });

  describe('Container Transfer', () => {
    it('transfers item directly between container and player grid', () => {
      const container = createInventoryGrid(5, 4);
      const backpack = createInventoryGrid(5, 4);

      placeItem(container, {
        id: 'carbine-1',
        type: 'carbine',
        x: 0,
        y: 0,
        rotated: false,
      });

      const transferred = transferItemDirectly(container, backpack, 'carbine-1', 1, 1, false);
      expect(transferred).toBe(true);
      expect(container.items).toHaveLength(0);
      expect(backpack.items).toHaveLength(1);
      expect(backpack.items[0]).toMatchObject({
        id: 'carbine-1',
        x: 1,
        y: 1,
      });
    });

    it('quick transfers item via auto-pack from container to player inventory', () => {
      const state = createDualLootState();
      placeItem(state.containerGrid, {
        id: 'ammo-1',
        type: 'ammo_box',
        x: 0,
        y: 0,
        rotated: false,
      });

      const transferred = quickTransferBetweenInventories(state, 'container', 'ammo-1');
      expect(transferred).toBe(true);
      expect(state.containerGrid.items).toHaveLength(0);
      expect(state.backpackGrid.items).toHaveLength(1);
      expect(state.backpackGrid.items[0].id).toBe('ammo-1');
    });

    it('quick transfers a held item when double-clicked from ghost or held state', () => {
      const state = createDualLootState();
      placeItem(state.containerGrid, {
        id: 'knife-1',
        type: 'knife',
        x: 0,
        y: 0,
        rotated: false,
      });

      pickUpItemFromGrid(state, 'container', 'knife-1');
      expect(state.heldItem).not.toBeNull();
      expect(state.containerGrid.items).toHaveLength(0);

      const transferred = quickTransferBetweenInventories(state, 'container', 'knife-1');
      expect(transferred).toBe(true);
      expect(state.heldItem).toBeNull();
      expect(state.backpackGrid.items).toHaveLength(1);
      expect(state.backpackGrid.items[0].id).toBe('knife-1');
    });

    it('quick transfers a held candy to candy bag when double clicked', () => {
      const state = createDualLootState();
      placeItem(state.containerGrid, {
        id: 'candy-1',
        type: 'sour_skulls',
        x: 0,
        y: 0,
        rotated: false,
      });

      pickUpItemFromGrid(state, 'container', 'candy-1');
      expect(state.heldItem).not.toBeNull();

      const transferred = quickTransferBetweenInventories(state, 'container', 'candy-1');
      expect(transferred).toBe(true);
      expect(state.heldItem).toBeNull();
      expect(state.candyBagGrid.items).toHaveLength(1);
      expect(state.candyBagGrid.items[0].id).toBe('candy-1');
    });
  });

  describe('Component Structure & Styling Contracts', () => {
    it('implements required dialog ARIA attributes and template panels in DualLootModal.vue', () => {
      const source = readFileSync(new URL('../src/components/DualLootModal.vue', import.meta.url), 'utf8');

      expect(source).toContain('role="dialog"');
      expect(source).toContain('aria-modal="true"');
      expect(source).toContain('container-panel');
      expect(source).toContain('player-panel');
      expect(source).toContain('PRIMARY WEAPON');
      expect(source).toContain('SECONDARY WEAPON');
      expect(source).toContain('ARMOR VEST');
      expect(source).toContain('POCKETS (2x2)');
      expect(source).toContain('BACKPACK');
      expect(source).toContain('[R] ROTATE');
      expect(source).toContain('[ESC] CLOSE');
      expect(source).toContain('is-valid-target');
      expect(source).toContain('is-invalid-target');
      expect(source).toContain('--u');
      expect(source).toContain('--sick');
      expect(source).toContain('--blood-bright');
    });

    it('contains no em dashes anywhere in source code or template', () => {
      const componentSource = readFileSync(new URL('../src/components/DualLootModal.vue', import.meta.url), 'utf8');
      const logicSource = readFileSync(new URL('../src/game/dual-loot-modal.ts', import.meta.url), 'utf8');

      expect(componentSource).not.toContain('—');
      expect(logicSource).not.toContain('—');
    });

    it('formats item display names cleanly', () => {
      expect(formatItemName('ammo_box')).toBe('Ammo Box');
      expect(formatItemName('armor_vest')).toBe('Armor Vest');
      expect(formatItemName('sheet_curtain')).toBe('Sheet Curtain');
      expect(formatItemName('custom_gear_piece')).toBe('Custom Gear Piece');
    });
  });
});
