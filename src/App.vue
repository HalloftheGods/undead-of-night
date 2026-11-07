<template>
  <main class="game-root" :class="{ 'is-aiming': aiming, 'is-touch': ui.touch }">
    <canvas ref="canvasRef" class="game-canvas" />

    <TitleScreen v-if="ui.screen === 'title'" :ui />

    <template v-else-if="ui.screen === 'game'">
      <template v-if="ui.hud && ui.art">
        <HudOverlay :hud="ui.hud" :art="ui.art" :mode="ui.mode" :signal-weak="ui.signalWeak" :place="ui.place" :home="ui.home" :log="ui.log" />
        <DownedOverlay v-if="ui.hud.status !== 'alive'" :hud="ui.hud" :mode="ui.mode" />
        <TouchControls v-if="ui.touch" />
        <EmoteWheel :art="ui.art" :enabled="emotesOn" />
      </template>
      <LevelCard v-if="ui.levelCard" :key="ui.levelCard.key" :card="ui.levelCard" />
      <WaveBanner v-if="ui.banner" :key="ui.banner.key" :banner="ui.banner" />
      <KillCallout v-if="ui.callout" :key="ui.callout.key" :callout="ui.callout" />
      <LogPanel v-if="ui.logOpen && ui.hud" :log="ui.log" />
      <WorkbenchScreen v-if="ui.hud?.bench && ui.art" :hud="ui.hud" :bench="ui.hud.bench" :art="ui.art" />
      <template v-if="ui.home">
        <LockerScreen v-if="ui.home.station === 'locker'" :home="ui.home" :art="ui.art" />
        <ForgeScreen v-else-if="ui.home.station === 'forge'" :home="ui.home" :art="ui.art" />
        <GarageMap v-else-if="ui.home.station === 'level_map'" :home="ui.home" :art="ui.art" />
        <JukeboxScreen v-else-if="ui.home.station === 'jukebox'" :art="ui.art" />
        <MerchantScreen v-else-if="ui.home.shop && ui.art" :home="ui.home" :art="ui.art" />
        <DeathSummary v-if="ui.home.death" :death="ui.home.death" />
        <OverrunChest v-else-if="ui.home.chest" :chest="ui.home.chest" />
        <OverrunClock :overrun="ui.home.overrun" />
      </template>
      <TownMap v-if="ui.mapOpen" :mode="ui.mode" :in-bunker="ui.home?.inBunker === true" />
      <PauseMenu v-if="ui.paused" :ui :mode="ui.mode" />
      <VanTransition :in-bunker="ui.home?.inBunker ?? null" :art="ui.art" />
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
import { computed, onBeforeUnmount, onMounted, provide, ref, useTemplateRef } from 'vue';
import ConnectionLost from './components/ConnectionLost.vue';
import DeathSummary from './components/DeathSummary.vue';
import DownedOverlay from './components/DownedOverlay.vue';
import EmoteWheel from './components/EmoteWheel.vue';
import ForgeScreen from './components/ForgeScreen.vue';
import GameOverScreen from './components/GameOverScreen.vue';
import GarageMap from './components/GarageMap.vue';
import HudOverlay from './components/HudOverlay.vue';
import LevelCard from './components/LevelCard.vue';
import { EndingFlow, JukeboxScreen, prefetchLazyPages } from './components/lazy-pages.ts';
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
import { GAME_KEY } from './components/use-game.ts';
import VanTransition from './components/VanTransition.vue';
import WaveBanner from './components/WaveBanner.vue';
import KillCallout from './components/KillCallout.vue';
import WorkbenchScreen from './components/WorkbenchScreen.vue';
import { privacyOpen, startAnalytics } from './game/analytics/index.ts';
import { GameController } from './game/game-controller.ts';
import { aimsCursor } from './game/home-screens.ts';
import { shouldShowSplash } from './game/studio-splash.ts';

const game = new GameController();
const ui = game.ui;
const splashing = ref(shouldShowSplash(window.location.search));
const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef');
const aiming = computed(() =>
  aimsCursor({ screen: ui.value.screen, paused: ui.value.paused, mapOpen: ui.value.mapOpen, bench: !!ui.value.hud?.bench, home: ui.value.home })
);
/** The wheel is for a team, and only while the keys are the game's. */
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
