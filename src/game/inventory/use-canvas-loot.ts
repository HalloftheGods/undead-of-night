import { computed, onBeforeUnmount, watch, type Ref, type ShallowRef } from 'vue';
import type { GridItem } from '../../../shared/grid-inventory.ts';
import type { ArtBook } from '../../art/types.ts';
import type { SfxName } from '../../audio/sfx-registry.ts';
import type { UiState } from '../hud-state.ts';
import { canvasLoot } from '../loot-prefs.ts';
import { createCanvasLoot, type CanvasLoot } from './canvas-loot.ts';
import type { BagWorking } from './local-bag.ts';

interface Inventory {
  readonly isOpen: Ref<boolean>;
  readonly working: Ref<BagWorking | null>;
  readonly openings: Ref<number>;
  onTransfer: () => void;
  onUse: (item: GridItem) => void;
  onDrop: (item: GridItem) => void;
}

/**
 * Picks the loot window's home. With the in-game switch on, a mouse and keyboard player gets the window drawn
 * on the game canvas; a phone keeps the page version, which has the touch and focus handling. Each opening
 * (and each live use or drop, which rebuilds the grids) gets a fresh window.
 */
export function useCanvasLoot(
  ui: Ref<UiState>,
  inventory: Inventory,
  canvas: Ref<HTMLCanvasElement | null>,
  playSfx: (name: SfxName) => void,
  onClose: () => void,
  /** Where the live window is kept, so the inventory's keys can reach it. */
  panel: ShallowRef<CanvasLoot | null>
) {
  const active = computed(() => inventory.isOpen.value && canvasLoot.value && !ui.value.touch && canvas.value !== null);

  function dispose(): void {
    panel.value?.dispose();
    panel.value = null;
  }

  watch(
    () => [active.value, inventory.openings.value, inventory.working.value] as const,
    ([isActive, , working]) => {
      dispose();
      const target = canvas.value;
      const art: ArtBook | null = ui.value.art;
      if (!isActive || !working || !target) return;
      panel.value = createCanvasLoot(
        target,
        art,
        {
          art,
          containerArt: working.containerArt,
          containerTitle: working.containerTitle || 'Nearby',
          containerKind: working.containerKind,
          backpackTier: working.tier,
          backpackGrid: working.pack,
          pocketsGrid: working.pockets,
          candyBagGrid: working.candyBag,
          containerGrid: working.container,
          equippedPrimary: working.gear.primary,
          equippedSecondary: working.gear.secondary,
          equippedSidearm: working.gear.sidearm,
        },
        { close: onClose, transfer: () => inventory.onTransfer(), use: (item) => inventory.onUse(item), drop: (item) => inventory.onDrop(item), playSfx }
      );
    },
    { immediate: true, flush: 'post' }
  );

  onBeforeUnmount(dispose);
  return { active };
}
