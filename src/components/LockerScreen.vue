<template>
  <span v-if="useInGameInventory" hidden />
  <section v-else class="px-screen">
    <div class="locker-grid-wrapper">
      <DualLootModal
        ref="dualModal"
        :art
        container-title="Bunker Locker"
        container-kind="locker"
        :container-grid="bunkerGrid"
        backpack-tier="satchel"
        :backpack-grid="handsBag.backpackGrid"
        :pockets-grid="handsBag.pocketsGrid"
        :equipped-primary="handsBag.gear.primary"
        :equipped-secondary="handsBag.gear.secondary"
        :equipped-sidearm="handsBag.gear.sidearm"
        :equipped-armor="handsBag.gear.armor"
        @transfer="onGridTransfer"
        @update:equipped-primary="onEquipPrimary"
        @update:equipped-secondary="onEquipSecondary"
        @update:equipped-sidearm="onEquipSidearm"
        @update:equipped-armor="onEquipArmor"
        @close="close"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * The bunker locker: uses in-game canvas inventory (createCanvasLoot) when the
 * in-game inventory switch is active, falling back to DualLootModal for touch.
 */
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import type { ArtBook } from '../art/types.ts';
import type { GridItem, InventoryGrid } from '../../shared/grid-inventory.ts';
import type { HomeUi } from '../game/home-hud.ts';
import { closeLocker, lockerGone } from '../game/home-screens.ts';
import type { LockerDraft } from '../game/home-screens.ts';
import {
  createBunkerLockerGrid,
  gridToLoadout,
  handsFromGrids,
  loadoutToGrid,
  loadoutToHandsBag,
} from '../game/home/bunker-locker-grid.ts';
import type { GearEquipState } from '../game/dual-loot-modal.ts';
import { canvasLoot } from '../game/loot-prefs.ts';
import { createCanvasLoot, type CanvasLoot } from '../game/inventory/canvas-loot.ts';
import DualLootModal from './DualLootModal.vue';
import { useGame } from './use-game.ts';

const { home, art } = defineProps<{ home: HomeUi; art: ArtBook | null }>();
const game = useGame();
const dualModal = useTemplateRef<InstanceType<typeof DualLootModal>>('dualModal');

const useInGameInventory = computed(() => canvasLoot.value && !game.ui.value.touch);
let canvasPanel: CanvasLoot | null = null;

/** What the player is arranging. The save is only read when the locker opens, so a save landing mid-edit cannot undo a move. */
const draft = ref<LockerDraft | null>(home.save ? { locker: home.save.locker, hands: home.save.hands } : null);
/** The draft last put on the player, or as it opened: anything since is unsent. */
let sent: LockerDraft | null = draft.value;

const bunkerGrid = ref<InventoryGrid>(
  home.save?.lockerGrid
    ? { cols: home.save.lockerGrid.cols, rows: home.save.lockerGrid.rows, items: home.save.lockerGrid.items.map((item) => ({ ...item })) }
    : draft.value
      ? loadoutToGrid(draft.value.locker)
      : createBunkerLockerGrid()
);

const handsBag = ref<{
  backpackGrid: InventoryGrid;
  pocketsGrid: InventoryGrid;
  gear: GearEquipState;
}>(
  draft.value
    ? loadoutToHandsBag(draft.value.hands)
    : {
        backpackGrid: { cols: 5, rows: 4, items: [] },
        pocketsGrid: { cols: 2, rows: 2, items: [] },
        gear: { primary: null, secondary: null, sidearm: null, armor: null },
      }
);

/** Writes the bunker grid back to the home save; through a local alias so the prop itself is not flagged as mutated. */
function keepLockerGrid(): void {
  const ui: HomeUi = home;
  if (ui.save) ui.save.lockerGrid = bunkerGrid.value;
}

function onGridTransfer(): void {
  const locker = gridToLoadout(bunkerGrid.value, draft.value?.locker);
  const carried = handsFromGrids(handsBag.value.backpackGrid, handsBag.value.pocketsGrid, handsBag.value.gear, draft.value?.hands);
  draft.value = { locker, hands: carried };
  keepLockerGrid();
}

function onEquipPrimary(item: GridItem | null): void {
  handsBag.value.gear.primary = item;
  onGridTransfer();
}

function onEquipSecondary(item: GridItem | null): void {
  handsBag.value.gear.secondary = item;
  onGridTransfer();
}

function onEquipSidearm(item: GridItem | null): void {
  handsBag.value.gear.sidearm = item;
  onGridTransfer();
}

function onEquipArmor(item: GridItem | null): void {
  handsBag.value.gear.armor = item;
  onGridTransfer();
}

function mountCanvasLoot(): void {
  if (!useInGameInventory.value) return;
  const canvas = document.querySelector<HTMLCanvasElement>('.game-canvas');
  if (!canvas) return;
  canvasPanel?.dispose();
  canvasPanel = createCanvasLoot(
    canvas,
    art,
    {
      art,
      containerArt: art?.containers?.locker ?? null,
      containerTitle: 'Bunker Locker',
      containerKind: 'locker',
      backpackTier: 'satchel',
      backpackGrid: handsBag.value.backpackGrid,
      pocketsGrid: handsBag.value.pocketsGrid,
      containerGrid: bunkerGrid.value,
      equippedPrimary: handsBag.value.gear.primary,
      equippedSecondary: handsBag.value.gear.secondary,
      equippedSidearm: handsBag.value.gear.sidearm,
      equippedArmor: handsBag.value.gear.armor,
    },
    {
      close,
      move: () => onGridTransfer(),
      playSfx: (name) => game.playSfx(name),
    }
  );
}

/** The save can still be loading when the locker opens. */
watch(
  () => home.save,
  (save) => {
    const isFirstSave = save && !draft.value;
    if (isFirstSave) {
      draft.value = sent = { locker: save.locker, hands: save.hands };
      bunkerGrid.value = save.lockerGrid
        ? { cols: save.lockerGrid.cols, rows: save.lockerGrid.rows, items: save.lockerGrid.items.map((item) => ({ ...item })) }
        : loadoutToGrid(save.locker);
      handsBag.value = loadoutToHandsBag(save.hands);
      if (useInGameInventory.value) mountCanvasLoot();
    }
  }
);

function close(): void {
  sent = draft.value;
  if (useInGameInventory.value) {
    canvasPanel?.settle();
  } else {
    dualModal.value?.settle();
  }
  const locker = gridToLoadout(bunkerGrid.value, draft.value?.locker);
  const carried = handsFromGrids(handsBag.value.backpackGrid, handsBag.value.pocketsGrid, handsBag.value.gear, draft.value?.hands);
  draft.value = sent = { locker, hands: carried };
  keepLockerGrid();
  canvasPanel?.dispose();
  canvasPanel = null;
  if (draft.value) closeLocker(draft.value, game.home);
  else game.home.closeStation();
}

/** Esc closes the locker the way Close does, or what was just moved would quietly stay where it was. */
onMounted(() => {
  game.home.closeWith(close);
  mountCanvasLoot();
});

/** Shut from outside, as at the breach: what was moved still goes on the player. */
onBeforeUnmount(() => {
  lockerGone(draft.value, sent, game.home);
  canvasPanel?.dispose();
  canvasPanel = null;
  game.home.closeWith(null);
});
</script>

<style scoped>
.px-screen {
  padding: calc(var(--u) * 3);
}

.locker-grid-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
