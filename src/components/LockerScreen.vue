<template>
  <section class="px-screen">
    <!-- Grid Mode (Default 4x12 Bunker Locker) -->
    <div v-if="viewMode === 'grid'" class="locker-grid-wrapper">
      <div class="locker-mode-bar">
        <button type="button" class="action-btn locker-mode-toggle" @click="toggleViewMode">
          [V] SHELF VIEW
        </button>
      </div>
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

    <!-- Shelf Mode (Classic) -->
    <div v-else class="px-panel px-frame locker">
      <div class="locker-shelf-header">
        <PixelButton class="locker-mode-toggle" silent @press="toggleViewMode">
          [V] Grid View
        </PixelButton>
      </div>
      <SceneCard :sprite="art?.ui.stations.locker ?? null" name="Locker" :line="LOCKER_LINE">
        <LockerHands :rows="hands" :icons @stow="stow" />
      </SceneCard>
      <LockerShelf ref="strip" :tiles :chosen :icons :art-size :empty @choose="choose" @take="take" @stow="stow" @hover="game.playUi('hover')" />
      <footer class="locker-foot">
        <p class="px-error locker-error" role="alert">{{ errorText }}</p>
        <PixelButton class="locker-close" primary silent :disabled="!draft" @press="close">Close</PixelButton>
      </footer>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * The locker: provides both a 4x12 physical grid storage mode using DualLootModal
 * and the classic shelf strip view. Closing puts what is in hand onto the player.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import type { ArtBook } from '../art/types.ts';
import type { GridItem, InventoryGrid } from '../../shared/grid-inventory.ts';
import type { HomeUi } from '../game/home-hud.ts';
import { closeLocker, lockerGone, moveToHands, moveToLocker } from '../game/home-screens.ts';
import type { LockerDraft } from '../game/home-screens.ts';
import { handRows, lockerArtSize, lockerTiles } from '../game/home/locker-view.ts';
import {
  createBunkerLockerGrid,
  gridToLoadout,
  handsFromGrids,
  loadoutToGrid,
  loadoutToHandsBag,
} from '../game/home/bunker-locker-grid.ts';
import type { GearEquipState } from '../game/dual-loot-modal.ts';
import DualLootModal from './DualLootModal.vue';
import LockerHands from './LockerHands.vue';
import LockerShelf from './LockerShelf.vue';
import PixelButton from './PixelButton.vue';
import SceneCard from './SceneCard.vue';
import { useGame } from './use-game.ts';

const { home, art } = defineProps<{ home: HomeUi; art: ArtBook | null }>();
const game = useGame();
const strip = useTemplateRef<InstanceType<typeof LockerShelf>>('strip');
const dualModal = useTemplateRef<InstanceType<typeof DualLootModal>>('dualModal');
const LOCKER_LINE = 'Gear in hand goes on the trip, and is lost if you die.';

const viewMode = ref<'grid' | 'shelf'>('grid');

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

const tiles = computed(() => (draft.value ? lockerTiles(draft.value) : []));
const hands = computed(() => (draft.value ? handRows(draft.value) : null));
const icons = computed(() => art?.ui ?? null);
const artSize = computed(() => (icons.value ? lockerArtSize(icons.value, tiles.value.map((tile) => tile.key)) : { w: 1, h: 1 }));
const empty = computed(() => (draft.value ? 'Nothing in the locker or in hand.' : ''));
const errorText = computed(() => (draft.value ? (home.saveError ?? '') : ''));

const picked = ref<string | null>(null);
const pickedAt = ref(0);
/** The pick stays on its kind of gear; moving gear never drops a tile, so it only falls back before the first pick. */
const chosen = computed(() => {
  const at = tiles.value.findIndex((tile) => tile.key === picked.value);
  return at >= 0 ? at : Math.min(pickedAt.value, Math.max(0, tiles.value.length - 1));
});

function choose(index: number): void {
  game.playUi('click');
  picked.value = tiles.value[index]?.key ?? null;
  pickedAt.value = index;
}

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

function toggleViewMode(): void {
  game.playUi('click');
  const isGrid = viewMode.value === 'grid';
  if (isGrid) {
    onGridTransfer();
    viewMode.value = 'shelf';
    void nextTick(() => strip.value?.focus());
  } else {
    if (draft.value) {
      bunkerGrid.value = loadoutToGrid(draft.value.locker, bunkerGrid.value);
      handsBag.value = loadoutToHandsBag(draft.value.hands);
    }
    viewMode.value = 'grid';
  }
}

/** Plays the click only when something moved, so a key on an empty side stays quiet. */
function move(next: LockerDraft): void {
  const moved = next !== draft.value;
  if (moved) game.playUi('click');
  draft.value = next;
  bunkerGrid.value = loadoutToGrid(next.locker, bunkerGrid.value);
  handsBag.value = loadoutToHandsBag(next.hands);
  keepLockerGrid();
}

function take(key: string): void {
  if (draft.value) move(moveToHands(draft.value, key));
}

function stow(key: string): void {
  if (draft.value) move(moveToLocker(draft.value, key));
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
    }
  }
);

/** The keyboard lands on the strip as soon as it has tiles, as the shop's lands on its shelf. */
watch(
  () => tiles.value.length > 0,
  (hasTiles) => {
    const isShelfMode = viewMode.value === 'shelf';
    if (hasTiles && isShelfMode) void nextTick(() => strip.value?.focus());
  },
  { immediate: true }
);

function handleGlobalKey(event: KeyboardEvent): void {
  const isVKey = event.key === 'v' || event.key === 'V';
  if (isVKey) {
    event.preventDefault();
    toggleViewMode();
  }
}

function close(): void {
  sent = draft.value;
  if (viewMode.value === 'grid') {
    dualModal.value?.settle();
    const locker = gridToLoadout(bunkerGrid.value, draft.value?.locker);
    const carried = handsFromGrids(handsBag.value.backpackGrid, handsBag.value.pocketsGrid, handsBag.value.gear, draft.value?.hands);
    draft.value = sent = { locker, hands: carried };
    keepLockerGrid();
  }
  if (draft.value) closeLocker(draft.value, game.home);
  else game.home.closeStation();
}

/** Esc closes the locker the way Close does, or what was just moved would quietly stay where it was. */
onMounted(() => {
  game.home.closeWith(close);
  const isWindowDefined = typeof window !== 'undefined';
  if (isWindowDefined) window.addEventListener('keydown', handleGlobalKey);
});

/** Shut from outside, as at the breach: what was moved still goes on the player. */
onBeforeUnmount(() => {
  lockerGone(draft.value, sent, game.home);
  game.home.closeWith(null);
  const isWindowDefined = typeof window !== 'undefined';
  if (isWindowDefined) window.removeEventListener('keydown', handleGlobalKey);
});
</script>

<style scoped>
/* Trimmed edges, as on the level map, so the whole locker fits an 800x600 window without scrolling. */
.px-screen {
  padding: calc(var(--u) * 3);
}

.locker-grid-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.locker-mode-bar {
  position: fixed;
  top: max(calc(var(--u) * 2), env(safe-area-inset-top, 0px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 960;
  pointer-events: auto;
}

.locker-shelf-header {
  display: flex;
  justify-content: flex-end;
  padding-inline: calc(var(--u) * 2);
}

.action-btn {
  background: var(--ink-dark, #101216);
  border: 1px solid var(--rim, #333a44);
  color: var(--bone, #d8dee9);
  padding: calc(var(--u) * 1.5) calc(var(--u) * 4);
  font-family: inherit;
  font-size: calc(var(--u) * 5.5);
  cursor: pointer;
  letter-spacing: 0.05em;
}

.action-btn:hover {
  background: var(--rim, #2e3440);
  border-color: var(--bone, #e5e9f0);
}

/* As wide as the scene card: the scene at 4 per art pixel, its frame, the gap and the column. */
.locker {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 3);
  width: calc(var(--u) * 540);
  max-width: 100%;
  padding-block: calc(var(--u) * 4);
  container: select / inline-size;
}

.locker :deep(.select-card) {
  padding-block: 0;
}

.locker-foot {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 4);
}

/* One line is always kept, so a failed save never moves the screen. */
.locker-error {
  flex: 1;
  min-height: 1lh;
  font-size: calc(var(--u) * 6);
}

.locker-close {
  width: auto;
  padding-inline: calc(var(--u) * 10);
}
</style>
