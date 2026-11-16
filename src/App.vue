<template>
  <main class="game-root" :class="{ 'is-aiming': aiming, 'is-touch': ui.touch, 'is-looting': inventory.isOpen.value, 'is-canvas-loot': canvasLoot.active.value }">
    <canvas ref="canvasRef" class="game-canvas" />

    <aside v-if="promoScene" class="promo-controls">
      <button class="promo-btn" type="button" @click="captureCanvasScreenshot">📸 Screenshot (F2 / O)</button>
      <button class="promo-btn" type="button" @click="devHudHidden = !devHudHidden">{{ devHudHidden ? 'Show HUD (U)' : 'Hide HUD (U)' }}</button>
    </aside>

    <!-- The dev HUD page (?dev=hud): the HUD alone over the live town. No title, menus or game-over screens. -->
    <template v-if="hudTest">
      <HudOverlay v-if="!devHudHidden && ui.hud && ui.art" :hud="ui.hud" :art="ui.art" :mode="ui.mode" :signal-weak="ui.signalWeak" :place="ui.place" :home="ui.home" :log="ui.log" />
    </template>

    <TitleScreen v-else-if="ui.screen === 'title'" v-show="!canvasEditing" :ui :splashing />

    <template v-else-if="ui.screen === 'game'">
      <DailyLobby v-if="ui.lobby && !ui.lobby.launched" :lobby="ui.lobby" />
      <template v-else>
        <template v-if="ui.hud && ui.art">
          <HudOverlay v-if="!devHudHidden" :hud="ui.hud" :art="ui.art" :mode="ui.mode" :signal-weak="ui.signalWeak" :place="ui.place" :home="ui.home" :log="ui.log" />
        <DownedOverlay v-if="ui.hud.status !== 'alive' && !promoScene" :hud="ui.hud" :mode="ui.mode" />
        <TouchControls v-if="ui.touch && !ui.bagOpen && !ui.paused && !inventory.isOpen.value && !promoScene" :seated="ui.hud?.seated === true" />
        <!-- The backpack ring: the Backpack button on a phone, a middle-click on a desktop. -->
        <BackpackWheel
          v-if="ui.backpackOpen"
          :hud="ui.hud"
          :art="ui.art"
          @close="game.closeBackpack()"
          @action="game.pickFromBackpack($event)"
          @inventory="openInventory"
        />
        <!-- The grid inventory: I on a desktop, the Grid button on the backpack ring on a phone. Every move goes to the host as it happens. -->
        <DualLootModal
          v-if="inventory.isOpen.value && inventory.working.value && !canvasLoot.active.value"
          :key="inventory.openings.value"
          ref="vuePanel"
          :art="ui.art"
          :container-title="inventory.working.value.containerTitle || 'Nearby'"
          :container-kind="inventory.working.value.containerKind"
          :container-art="inventory.working.value.containerArt"
          :backpack-tier="inventory.working.value.tier"
          :backpack-grid="inventory.working.value.pack"
          :pockets-grid="inventory.working.value.pockets"
          :candy-bag-grid="inventory.working.value.candyBag"
          :container-grid="inventory.working.value.container"
          :equipped-primary="inventory.working.value.gear.primary"
          :equipped-secondary="inventory.working.value.gear.secondary"
          :equipped-sidearm="inventory.working.value.gear.sidearm"
          @close="onInventoryClose"
          @move="inventory.onMove"
        />
        <EmoteWheel :art="ui.art" :enabled="emotesOn" />
        <RoomInvite v-if="ui.onlineRoom && !ui.paused && ui.hud.teammates.length === 0 && !promoScene" :room="ui.onlineRoom" :is-public="ui.onlinePublic" />
      </template>
      <!-- Banners step aside for any overlay (v-show, so a card does not replay when the overlay closes). -->
      <LevelCard v-if="ui.levelCard && !promoScene" v-show="!overlayUp" :key="ui.levelCard.key" :card="ui.levelCard" />
      <WaveBanner v-if="ui.banner && !promoScene" v-show="!overlayUp" :key="ui.banner.key" :banner="ui.banner" />
      <KillCallout v-if="ui.callout && !promoScene" v-show="!overlayUp" :key="ui.callout.key" :callout="ui.callout" />
      <LogPanel v-if="ui.logOpen && ui.hud && !canvasLogOn" :log="ui.log" />
      <WorkbenchPageCanvas v-if="ui.hud?.bench && ui.art && canvasMenusOn" :hud="ui.hud" :bench="ui.hud.bench" :art="ui.art" />
      <WorkbenchScreen v-else-if="ui.hud?.bench && ui.art" :hud="ui.hud" :bench="ui.hud.bench" :art="ui.art" />
      <template v-if="ui.home">
        <LockerScreen v-if="ui.home.station === 'locker'" :home="ui.home" :art="ui.art" />
        <template v-else-if="ui.home.station === 'candy_shop'">
          <CandyShopPageCanvas v-if="canvasMenusOn" :home="ui.home" :art="ui.art" />
          <CandyShopScreen v-else :home="ui.home" :art="ui.art" />
        </template>
        <template v-else-if="ui.home.station === 'level_map'">
          <GarageMapCanvas v-if="canvasMenusOn" :home="ui.home" :art="ui.art" />
          <GarageMap v-else :home="ui.home" :art="ui.art" />
        </template>
        <template v-else-if="ui.home.station === 'jukebox'">
          <JukeboxPageCanvas v-if="canvasMenusOn" :home="ui.home" :art="ui.art" />
          <JukeboxScreen v-else :home="ui.home" :art="ui.art" />
        </template>
        <template v-else-if="ui.home.shop && ui.art">
          <MerchantPageCanvas v-if="canvasMenusOn" :home="ui.home" :art="ui.art" />
          <MerchantScreen v-else :home="ui.home" :art="ui.art" />
        </template>
        <DeathSummary v-if="ui.home.death" :death="ui.home.death" />
        <OverrunChest v-else-if="ui.home.chest" :chest="ui.home.chest" />
        <OverrunClock :overrun="ui.home.overrun" />
      </template>
      <TownMap v-if="ui.mapOpen" :mode="ui.mode" :in-bunker="ui.home?.inBunker === true" :teammates="ui.hud?.teammates ?? []" />
      <CandyBagCanvas v-if="ui.bagOpen && ui.hud && ui.art" :hud="ui.hud" :art="ui.art" :mode="ui.mode" />
      <template v-if="ui.paused">
        <BooksPage v-if="pausedBook === 'books'" :art="ui.art" @open="onOpenPausedBook" @close="pausedBook = null" />
        <HowToPlay v-else-if="pausedBook === 'howto'" @close="onClosePausedBook" />
        <CandyMagazinePage v-else-if="pausedBook === 'candy'" @close="onClosePausedBook" />
        <TownGuidePage v-else-if="pausedBook === 'guide'" @close="onClosePausedBook" />
        <RecordsPage v-else-if="pausedBook === 'records'" :ui @close="onClosePausedBook" />
        <ControlsPageCanvas v-else-if="pausedBook === 'controls'" @close="pausedBook = null" />
        <RadioPageCanvas v-else-if="pausedBook === 'radio' && canvasPauseOn" @close="pausedBook = null" />
        <RadioPage v-else-if="pausedBook === 'radio'" :ui @close="pausedBook = null" />
        <PauseMenu v-else-if="!canvasPauseOn" :ui :mode="ui.mode" @open-book="pausedBook = 'books'" @open-controls="pausedBook = 'controls'" @open-radio="pausedBook = 'radio'" />
        <PauseCanvas v-else :ui :mode="ui.mode" @open-book="pausedBook = 'books'" @open-controls="pausedBook = 'controls'" @open-radio="pausedBook = 'radio'" />
      </template>
      <LevelDebriefCanvas v-if="ui.debrief" :debrief="ui.debrief" />
      <VanTransition :in-bunker="ui.home?.inBunker ?? null" :art="ui.art" />
      </template>
    </template>

    <EndingFlow v-else-if="ui.screen === 'gameover' && ui.result && ui.result.stats.outcome === 'victory'" :result="ui.result" :art="ui.art" />

    <GameOverScreen
      v-else-if="ui.screen === 'gameover' && ui.result"
      :result="ui.result"
      :art="ui.art"
      :restarting="ui.restarting"
    />

    <ConnectionLost v-else-if="ui.screen === 'lost'" :reason="ui.lostReason" />

    <PrivacyPage v-if="privacyOpen" />

    <StudioSplash v-if="splashing" @done="splashing = false" />
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, shallowRef, useTemplateRef, watch } from 'vue';
import BackpackWheel from './components/BackpackWheel.vue';
import DualLootModal from './components/DualLootModal.vue';
import ConnectionLost from './components/ConnectionLost.vue';
import DeathSummary from './components/DeathSummary.vue';
import DownedOverlay from './components/DownedOverlay.vue';
import EmoteWheel from './components/EmoteWheel.vue';
import CandyShopScreen from './components/CandyShopScreen.vue';
import GameOverScreen from './components/GameOverScreen.vue';
import GarageMap from './components/GarageMap.vue';
import HudOverlay from './components/HudOverlay.vue';
import RoomInvite from './components/RoomInvite.vue';
import LevelCard from './components/LevelCard.vue';
import { BooksPage, CandyMagazinePage, EndingFlow, HowToPlay, JukeboxScreen, prefetchLazyPages, RadioPage, RecordsPage, TownGuidePage } from './components/lazy-pages.ts';
import type { TitlePage } from './game/title-menu.ts';
import LogPanel from './components/log/LogPanel.vue';
import LockerScreen from './components/LockerScreen.vue';
import MerchantScreen from './components/MerchantScreen.vue';
import OverrunChest from './components/OverrunChest.vue';
import OverrunClock from './components/OverrunClock.vue';
import PauseMenu from './components/PauseMenu.vue';
import PauseCanvas from './components/PauseCanvas.vue';
import ControlsPageCanvas from './components/ControlsPageCanvas.vue';
import RadioPageCanvas from './components/RadioPageCanvas.vue';
import PrivacyPage from './components/PrivacyPage.vue';
import StudioSplash from './components/StudioSplash.vue';
import TitleScreen from './components/TitleScreen.vue';
import TouchControls from './components/TouchControls.vue';
import TownMap from './components/TownMap.vue';
import LevelDebriefCanvas from './components/LevelDebriefCanvas.vue';
import CandyBagCanvas from './components/CandyBagCanvas.vue';
import DailyLobby from './components/DailyLobby.vue';
import { GAME_KEY } from './components/use-game.ts';
import VanTransition from './components/VanTransition.vue';
import WaveBanner from './components/WaveBanner.vue';
import KillCallout from './components/KillCallout.vue';
import WorkbenchScreen from './components/WorkbenchScreen.vue';
import CandyShopPageCanvas from './components/CandyShopPageCanvas.vue';
import GarageMapCanvas from './components/GarageMapCanvas.vue';
import JukeboxPageCanvas from './components/JukeboxPageCanvas.vue';
import MerchantPageCanvas from './components/MerchantPageCanvas.vue';
import WorkbenchPageCanvas from './components/WorkbenchPageCanvas.vue';
import { privacyOpen, startAnalytics } from './game/analytics/index.ts';
import { containerLook } from './art/containers.ts';
import { feedSearch, searchArtFor, searchFlipped, searchTitle, startReveal } from './game/inventory/search-overlay.ts';
import { paintedContainer } from './engine/car-looks.ts';
import { CONTAINER_LABEL } from '../shared/containers.ts';
import { isVerticalLook } from '../shared/container-flip.ts';
import { GameController } from './game/game-controller.ts';
import { hudTestOn } from './game/dev/hud-test.ts';
import { promoSceneOn } from './game/dev/promo-scene.ts';
import { canvasHud, canvasHudAllowed } from './game/canvas-hud-prefs.ts';
import { canvasMenus } from './game/canvas-menu-prefs.ts';
import { canvasEditing } from './game/dev/canvas-edit.ts';
import { aimsCursor } from './game/home-screens.ts';
import { useInventoryModal, type InventoryPanel } from './game/inventory-modal.ts';
import type { CanvasLoot } from './game/inventory/canvas-loot.ts';
import { useCanvasLoot } from './game/inventory/use-canvas-loot.ts';
import { shouldShowSplash } from './game/studio-splash.ts';

const game = new GameController();
const ui = game.ui;
/** The in-game menus switch (Pause, Stations, Dev pages), and phones keep the page card. */
const canvasMenusOn = computed(() => canvasMenus.value && !ui.value.touch);
const canvasPauseOn = canvasMenusOn;
/** The in-game HUD draws the run log on the canvas, so the page log stays shut. */
const canvasLogOn = computed(() => canvasHudAllowed(canvasHud.value, ui.value.touch));
const hudTest = hudTestOn(window.location.search, import.meta.env.DEV, window.location.hostname);
const promoSceneFromUrl = promoSceneOn(window.location.search, import.meta.env.DEV, window.location.hostname);
const promoScene = computed(() => promoSceneFromUrl || ui.value.promoScene === true);
const devHudHidden = ref(promoSceneFromUrl || ui.value.promoScene === true);
watch(promoScene, (active) => {
  if (active) devHudHidden.value = true;
});
const splashing = ref(shouldShowSplash(window.location.search) && !hudTest && !promoSceneFromUrl);
const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef');
const pausedBook = ref<TitlePage | null>(null);
const vuePanel = useTemplateRef<InventoryPanel>('vuePanel');
/** The window drawn on the game canvas, when the in-game switch is on; the page version otherwise. */
const canvasPanel = shallowRef<CanvasLoot | null>(null);
const inventoryPanel = computed<InventoryPanel | null>(() => canvasPanel.value ?? vuePanel.value);
const inventory = useInventoryModal(
  ui,
  game.input,
  inventoryPanel,
  (move) => game.sendMove(move),
  (id, open) => game.sendView(id, open),
  (containerId) => game.walkedAwayFrom(containerId),
  () => onInventoryClose()
);

const canvasLoot = useCanvasLoot(ui, inventory, canvasRef, (name) => game.playSfx(name), () => onInventoryClose(), canvasPanel);

function onInventoryClose(): void {
  inventory.hide();
  if (ui.value.openedContainer) {
    (ui.value as { openedContainer?: null }).openedContainer = null;
  }
}

/**
 * A search opens the loot window at once, with an empty grid the sweep runs over for as long as the search takes.
 * What it finds arrives with the search's end and rebuilds the window with the open drawing and the items in it.
 */
watch(() => ui.value.searching, (now, was) => {
  feedSearch(now?.progress ?? null, now?.lootSlot);
  if (now && !was && !inventory.isOpen.value) {
    const prop = now.propIndex !== undefined ? game.currentMap?.props[now.propIndex] : undefined;
    const art = ui.value.art ? searchArtFor(ui.value.art, now.kind, prop, now.propIndex) : null;
    const look = prop ? containerLook({ kind: now.kind, prop: prop.kind, propIndex: now.propIndex, look: prop.look }) : undefined;
    inventory.showContainer(now.id, searchTitle(now.kind), [], now.kind, art, searchFlipped(prop), true, look);
  }
  const over = !now && was && inventory.searchingOpen.value;
  if (over) inventory.hide();
});

watch(() => ui.value.openedContainer, (loot) => {
  // Search pressed again at the container already open here: the host's copy lacks the moves not yet sent, so keep the window.
  const isReopenHere = loot !== null && loot !== undefined && inventory.isOpen.value && !inventory.searchingOpen.value && inventory.working.value?.containerId === loot.id;
  if (isReopenHere) return;
  if (loot && loot.items.length > 0) {
    const title = loot.title ?? (loot.kind ? CONTAINER_LABEL[loot.kind] : 'Container');
    const activeMap = game.currentMap;
    const prop = loot.propIndex !== undefined && activeMap ? activeMap.props[loot.propIndex] : undefined;
    const look = prop ? containerLook({ kind: loot.kind ?? 'car', prop: prop.kind, propIndex: loot.propIndex, look: prop.look }) : undefined;
    const specificArt = prop && ui.value.art && look ? (paintedContainer(ui.value.art, prop) ?? ui.value.art.containers[look]) : null;
    // A car parked nose up is drawn standing on end, so its grid stands on end too.
    const flipped = isVerticalLook(prop?.kind);
    startReveal(loot.items);
    inventory.showContainer(loot.id, title, loot.items, loot.kind, specificArt, flipped, false, look);
  }
});

function openInventory(): void {
  game.closeBackpack();
  inventory.show();
}

function onOpenPausedBook(page: TitlePage): void {
  pausedBook.value = page;
}

function onClosePausedBook(): void {
  pausedBook.value = 'books';
}

watch(() => ui.value.paused, (isPaused) => {
  if (!isPaused) pausedBook.value = null;
});
const aiming = computed(() =>
  aimsCursor({
    screen: ui.value.screen,
    paused: ui.value.paused,
    mapOpen: ui.value.mapOpen || ui.value.bagOpen,
    bench: Boolean(ui.value.hud?.bench),
    home: ui.value.home,
    // On desktop the game stays live under the inventory, so the crosshair stays the cursor; touch keeps it off.
    backpackOpen: ui.value.backpackOpen || (inventory.isOpen.value && ui.value.touch),
    inLobby: Boolean(ui.value.lobby && !ui.value.lobby.launched),
  })
);
/** The pause card, the town map and the candy bag each clear the level card and the banners off the screen. */
const overlayUp = computed(() => ui.value.paused || ui.value.mapOpen || ui.value.bagOpen || inventory.isOpen.value);
/** The emote wheel is for a team, and only while the keys are the game's. */
const emotesOn = computed(() => aiming.value && ui.value.mode === 'coop');

provide(GAME_KEY, game);

let stopAnalytics: (() => void) | null = null;

function captureCanvasScreenshot(): void {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const targetW = 1200;
  const targetH = 630;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = targetW;
  outCanvas.height = targetH;
  const ctx = outCanvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    const canvasAspect = canvas.width / canvas.height;
    const targetAspect = targetW / targetH;
    let sW = canvas.width;
    let sH = canvas.height;
    let sX = 0;
    let sY = 0;
    if (canvasAspect > targetAspect) {
      sW = canvas.height * targetAspect;
      sX = (canvas.width - sW) / 2;
    } else {
      sH = canvas.width / targetAspect;
      sY = (canvas.height - sH) / 2;
    }
    ctx.drawImage(canvas, sX, sY, sW, sH, 0, 0, targetW, targetH);
  }
  const exportCanvas = ctx ? outCanvas : canvas;
  exportCanvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'undead-of-night-screenshot.png';
    link.click();
    URL.revokeObjectURL(url);
    if (import.meta.env.DEV) {
      void fetch('/api/dev-save-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: blob,
      });
    }
  }, 'image/png');
}

function onDevKeyDown(event: KeyboardEvent): void {
  const isCapture = event.code === 'F2' || event.code === 'F12' || event.code === 'PrintScreen' || event.code === 'KeyO';
  if (isCapture && (promoScene.value || import.meta.env.DEV)) {
    event.preventDefault();
    captureCanvasScreenshot();
    return;
  }
  const isToggleHud = (event.code === 'KeyU' || event.code === 'F10' || event.code === 'Backquote') && (promoScene.value || hudTest);
  if (isToggleHud) {
    event.preventDefault();
    devHudHidden.value = !devHudHidden.value;
  }
}

/** The HUD test or promo scene run starts once the art is in, since a run cannot start before it. */
watch(() => ui.value.art, (art) => {
  if (art && hudTest) game.startHudTest();
  else if (art && promoScene.value) game.startPromoScene();
});

onMounted(() => {
  if (canvasRef.value) game.mount(canvasRef.value);
  if (import.meta.env.DEV) window.__outbreak = game;
  if (hudTest && ui.value.art) game.startHudTest();
  else if (promoScene.value && ui.value.art) game.startPromoScene();
  window.addEventListener('keydown', onDevKeyDown);
  stopAnalytics = startAnalytics(() => ui.value);
  prefetchLazyPages();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onDevKeyDown);
  stopAnalytics?.();
  game.dispose();
});
</script>

<style scoped>
.game-root {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: var(--ink);
}

.game-canvas {
  position: absolute;
  top: 0;
  left: 0;
  image-rendering: pixelated;
}

.is-aiming {
  cursor: none;
}

/* The grid is part of the scene: the HUD drops back and the world dims a step, so the survivor and the crate read as the focus. Flat steps only, no blur. */
.game-canvas {
  transition: filter 0.2s steps(4);
}

.is-looting .game-canvas {
  filter: brightness(0.7);
}

/* The canvas window dims the world itself, under its own panels, so the page does not dim the canvas on top of it. */
.is-looting.is-canvas-loot .game-canvas {
  filter: none;
}

/* Lightened, not hidden: the game stays playable under the grid, so ammo and health must stay readable. */
.is-looting :deep(.hud) {
  opacity: 0.6;
}

.game-root :deep(.hud) {
  transition: opacity 0.2s steps(4);
}

@media (prefers-reduced-motion: reduce) {
  .game-canvas,
  .game-root :deep(.hud) {
    transition: none;
  }
}

.promo-controls {
  position: absolute;
  top: calc(var(--u) * 3);
  right: calc(var(--u) * 3);
  display: flex;
  gap: calc(var(--u) * 2);
  z-index: 1000;
  pointer-events: auto;
}

.promo-btn {
  background: rgba(14, 17, 24, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #f0f2f8;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  padding: calc(var(--u) * 1.5) calc(var(--u) * 3);
  border-radius: 4px;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
  transition: background 0.15s, border-color 0.15s;
}

.promo-btn:hover {
  background: rgba(30, 36, 48, 0.95);
  border-color: rgba(255, 255, 255, 0.5);
}
</style>
