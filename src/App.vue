<template>
  <main class="game-root" :class="{ 'is-aiming': aiming, 'is-touch': ui.touch }">
    <canvas ref="canvasRef" class="game-canvas" />

    <TitleScreen v-if="ui.screen === 'title'" :ui :splashing />

    <template v-else-if="ui.screen === 'game'">
      <DailyLobby v-if="ui.lobby && !ui.lobby.launched" :lobby="ui.lobby" />
      <template v-else>
        <template v-if="ui.hud && ui.art">
          <HudOverlay :hud="ui.hud" :art="ui.art" :mode="ui.mode" :signal-weak="ui.signalWeak" :place="ui.place" :home="ui.home" :log="ui.log" />
        <DownedOverlay v-if="ui.hud.status !== 'alive'" :hud="ui.hud" :mode="ui.mode" />
        <TouchControls v-if="ui.touch && !ui.bagOpen && !ui.paused && !inventory.isOpen.value" />
        <!-- The backpack ring: the Backpack button on a phone, a middle-click on a desktop. -->
        <BackpackWheel
          v-if="ui.backpackOpen"
          :hud="ui.hud"
          :art="ui.art"
          @close="game.closeBackpack()"
          @action="game.pickFromBackpack($event)"
          @inventory="openInventory"
        />
        <!-- The grid inventory: I on a desktop, the Grid button on the backpack ring on a phone. Local only. -->
        <DualLootModal
          v-if="inventory.isOpen.value && inventory.pack.value"
          :key="inventory.openings.value"
          ref="inventoryPanel"
          container-title="Nearby"
          :backpack-tier="inventory.pack.value.tier"
          :backpack-grid="inventory.pack.value.grid"
          @close="inventory.hide()"
        />
        <EmoteWheel :art="ui.art" :enabled="emotesOn" />
        <RoomInvite v-if="ui.onlineRoom && !ui.paused && ui.hud.teammates.length === 0" :room="ui.onlineRoom" :is-public="ui.onlinePublic" />
      </template>
      <!-- Banners step aside for any overlay (v-show, so a card does not replay when the overlay closes). -->
      <LevelCard v-if="ui.levelCard" v-show="!overlayUp" :key="ui.levelCard.key" :card="ui.levelCard" />
      <WaveBanner v-if="ui.banner" v-show="!overlayUp" :key="ui.banner.key" :banner="ui.banner" />
      <KillCallout v-if="ui.callout" v-show="!overlayUp" :key="ui.callout.key" :callout="ui.callout" />
      <LogPanel v-if="ui.logOpen && ui.hud" :log="ui.log" />
      <WorkbenchScreen v-if="ui.hud?.bench && ui.art" :hud="ui.hud" :bench="ui.hud.bench" :art="ui.art" />
      <template v-if="ui.home">
        <LockerScreen v-if="ui.home.station === 'locker'" :home="ui.home" :art="ui.art" />
        <CandyShopScreen v-else-if="ui.home.station === 'candy_shop'" :home="ui.home" :art="ui.art" />
        <GarageMap v-else-if="ui.home.station === 'level_map'" :home="ui.home" :art="ui.art" />
        <JukeboxScreen v-else-if="ui.home.station === 'jukebox'" :home="ui.home" :art="ui.art" />
        <MerchantScreen v-else-if="ui.home.shop && ui.art" :home="ui.home" :art="ui.art" />
        <DeathSummary v-if="ui.home.death" :death="ui.home.death" />
        <OverrunChest v-else-if="ui.home.chest" :chest="ui.home.chest" />
        <OverrunClock :overrun="ui.home.overrun" />
      </template>
      <TownMap v-if="ui.mapOpen" :mode="ui.mode" :in-bunker="ui.home?.inBunker === true" :teammates="ui.hud?.teammates ?? []" />
      <CandyBag v-if="ui.bagOpen && ui.hud && ui.art" :hud="ui.hud" :art="ui.art" :mode="ui.mode" />
      <template v-if="ui.paused">
        <BooksPage v-if="pausedBook === 'books'" :art="ui.art" @open="onOpenPausedBook" @close="pausedBook = null" />
        <HowToPlay v-else-if="pausedBook === 'howto'" @close="onClosePausedBook" />
        <CandyMagazinePage v-else-if="pausedBook === 'candy'" @close="onClosePausedBook" />
        <TownGuidePage v-else-if="pausedBook === 'guide'" @close="onClosePausedBook" />
        <RecordsPage v-else-if="pausedBook === 'records'" :ui @close="onClosePausedBook" />
        <PauseMenu v-else :ui :mode="ui.mode" @open-book="pausedBook = 'books'" />
      </template>
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
import { computed, onBeforeUnmount, onMounted, provide, ref, useTemplateRef, watch } from 'vue';
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
import { BooksPage, CandyMagazinePage, EndingFlow, HowToPlay, JukeboxScreen, prefetchLazyPages, RecordsPage, TownGuidePage } from './components/lazy-pages.ts';
import type { TitlePage } from './game/title-menu.ts';
import LogPanel from './components/log/LogPanel.vue';
import LockerScreen from './components/LockerScreen.vue';
import MerchantScreen from './components/MerchantScreen.vue';
import OverrunChest from './components/OverrunChest.vue';
import OverrunClock from './components/OverrunClock.vue';
import PauseMenu from './components/PauseMenu.vue';
import PrivacyPage from './components/PrivacyPage.vue';
import StudioSplash from './components/StudioSplash.vue';
import TitleScreen from './components/TitleScreen.vue';
import TouchControls from './components/TouchControls.vue';
import TownMap from './components/TownMap.vue';
import CandyBag from './components/CandyBag.vue';
import DailyLobby from './components/DailyLobby.vue';
import { GAME_KEY } from './components/use-game.ts';
import VanTransition from './components/VanTransition.vue';
import WaveBanner from './components/WaveBanner.vue';
import KillCallout from './components/KillCallout.vue';
import WorkbenchScreen from './components/WorkbenchScreen.vue';
import { privacyOpen, startAnalytics } from './game/analytics/index.ts';
import { GameController } from './game/game-controller.ts';
import { aimsCursor } from './game/home-screens.ts';
import { useInventoryModal, type InventoryPanel } from './game/inventory-modal.ts';
import { shouldShowSplash } from './game/studio-splash.ts';

const game = new GameController();
const ui = game.ui;
const splashing = ref(shouldShowSplash(window.location.search));
const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef');
const pausedBook = ref<TitlePage | null>(null);
const inventoryPanel = useTemplateRef<InventoryPanel>('inventoryPanel');
const inventory = useInventoryModal(ui, game.input, inventoryPanel);

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
    backpackOpen: ui.value.backpackOpen || inventory.isOpen.value,
    inLobby: Boolean(ui.value.lobby && !ui.value.lobby.launched),
  })
);
/** The pause card, the town map and the candy bag each clear the level card and the banners off the screen. */
const overlayUp = computed(() => ui.value.paused || ui.value.mapOpen || ui.value.bagOpen || inventory.isOpen.value);
/** The emote wheel is for a team, and only while the keys are the game's. */
const emotesOn = computed(() => aiming.value && ui.value.mode === 'coop');

provide(GAME_KEY, game);

let stopAnalytics: (() => void) | null = null;

onMounted(() => {
  if (canvasRef.value) game.mount(canvasRef.value);
  if (import.meta.env.DEV) window.__outbreak = game;
  stopAnalytics = startAnalytics(() => ui.value);
  prefetchLazyPages();
});

onBeforeUnmount(() => {
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
</style>
