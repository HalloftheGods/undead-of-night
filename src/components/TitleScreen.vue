<template>
  <section v-if="nav.page === null" class="px-screen px-title-scale title" :class="{ 'is-revealed': !splashing }">
    <div class="title-hero">
      <SpriteImg v-if="ui.art" class="title-logo" :sprite="ui.art.ui.logo" />
      <h1 v-else class="px-heading">UNDEAD OF NIGHT: LAST ROUND</h1>
    </div>

    <PressAnyKey v-if="asking" class="title-press" :touch="ui.touch" :splashing @wake="answer" />
    <div v-else class="title-columns" :class="{ 'title-arrive': arrived }">
      <TitleMenu v-model="selected" v-model:section="section" :entries="TITLE_MENU" @open="openItem" />
      <InstallCartridge />
    </div>

    <footer class="title-foot">
      <div class="title-links">
        <MenuLink v-if="!privacyOpen" class="title-privacy" @press="openPrivacy()">Privacy</MenuLink>
        <MenuLink class="title-version" aria-label="What's new in this version" @press="nav = openPage(nav, 'changelog')">v{{ APP_VERSION }}</MenuLink>
        <MenuLink v-if="isDev" class="title-dev" @press="nav = openPage(nav, 'dev_inventory')">Dev: Items</MenuLink>
        <MenuLink v-if="isDev" class="title-dev" @press="game.startTestDrive()">Dev: Test Drive</MenuLink>
      </div>
      <p class="title-credit">
        <img class="title-omega" :src="BRAND_MARK" alt="" />
        {{ STUDIO_LINE }}
      </p>
    </footer>
  </section>

  <PlaySetup v-else-if="nav.page === 'play'" :ui :join="nav.invited" :level="nav.startLevel" @close="nav = closePlay(nav)" />
  <DailyPage v-else-if="nav.page === 'daily'" :ui @close="close" />
  <LevelsPage v-else-if="nav.page === 'levels'" :art="ui.art" @start="nav = pickLevel(nav, $event)" @close="close" />
  <BooksPage v-else-if="nav.page === 'books'" :art="ui.art" @open="openBookPage" @close="close" />
  <HowToPlay v-else-if="nav.page === 'howto'" @close="close" />
  <CandyMagazinePage v-else-if="nav.page === 'candy'" @close="close" />
  <TownGuidePage v-else-if="nav.page === 'guide'" @close="close" />
  <RecordsPage v-else-if="nav.page === 'records'" :ui @close="close" />
  <ChangelogPage v-else-if="nav.page === 'changelog'" :art="ui.art" :version="APP_VERSION" @close="close" />
  <SoundTestPage v-else-if="nav.page === 'sound'" :ui @close="close" />
  <RadioPage v-else-if="nav.page === 'radio'" :ui @close="close" />
  <ControlsPage v-else-if="nav.page === 'controls'" @close="close" />
  <DevInventoryPage v-else-if="nav.page === 'dev_inventory'" :art="ui.art" @close="close" />
  <OptionsPage v-else :ui @close="close" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { isLocalHost } from '../game/analytics/analytics-config.ts';
import { openPrivacy, privacyOpen } from '../game/analytics/index.ts';
import type { UiState } from '../game/hud-state.ts';
import { parseInvite, withoutJoinParam } from '../game/invite-link.ts';
import { setPendingRoomCode } from '../game/pending-room.ts';
import { markPressAnswered, shouldAskForPress } from '../game/press-start.ts';
import { onlineRoomsLive } from '../network/play-api.ts';
import { BRAND_MARK, STUDIO_LINE } from '../game/studio-splash.ts';
import { TITLE_MENU } from '../game/title-menu.ts';
import type { MenuGroup, TitleMenuItem, TitlePage } from '../game/title-menu.ts';
import { closeBook, closePage, closePlay, INVITE_LANDING, openBook, openPage, pickLevel, TITLE_HOME } from '../game/title-nav.ts';
import InstallCartridge from './InstallCartridge.vue';
import { BooksPage, CandyMagazinePage, ChangelogPage, ControlsPage, DailyPage, DevInventoryPage, HowToPlay, LevelsPage, RadioPage, RecordsPage, SoundTestPage, TownGuidePage } from './lazy-pages.ts';
import MenuLink from './MenuLink.vue';
import OptionsPage from './OptionsPage.vue';
import PlaySetup from './PlaySetup.vue';
import PressAnyKey from './PressAnyKey.vue';
import SpriteImg from './SpriteImg.vue';
import TitleMenu from './TitleMenu.vue';
import { checkApUpkeep } from '../../shared/progression.ts';
import { useGame } from './use-game.ts';

declare const __APP_VERSION__: string;
const APP_VERSION = __APP_VERSION__;

const { ui, splashing = false } = defineProps<{ ui: UiState; splashing?: boolean }>();

const isDev = computed(() => {
  if (!import.meta.env.DEV) return false;
  if (typeof window === 'undefined') return false;
  return isLocalHost(window.location.hostname);
});

function checkDevRouting(): boolean {
  if (typeof window === 'undefined') return false;
  if (!import.meta.env.DEV) return false;
  const isLocal = isLocalHost(window.location.hostname);
  if (!isLocal) return false;

  const searchParams = new URLSearchParams(window.location.search);
  const devParam = searchParams.get('dev');
  const pageParam = searchParams.get('page');
  const isDevInventoryParam = devParam === 'inventory' || pageParam === 'dev_inventory' || pageParam === 'inventory';
  const isHashDev = window.location.hash === '#dev-inventory';
  return isDevInventoryParam || isHashDev;
}

const game = useGame();
// Missed weeks are charged here, between runs, and never on a kill.
checkApUpkeep();
const nav = ref(TITLE_HOME);
/** Read before the invite below rewrites the address, so an invite link never waits for a key. */
const asking = ref(shouldAskForPress(window.location.search));
/** The menu fades in after a press, not when coming back to the title. */
const arrived = ref(false);

const opensDevInventory = checkDevRouting();
if (opensDevInventory) {
  nav.value = openPage(nav.value, 'dev_inventory');
  asking.value = false;
  arrived.value = true;
}

/**
 * An invite link opens co-op setup. ?join=host:port fills in the server address; ?room=CODE holds
 * the code for the code join screen (?room wins when both are present).
 */
const invite = parseInvite(window.location.search);
if (invite) {
  const isRoomInvite = invite.kind === 'room';
  if (isRoomInvite) {
    setPendingRoomCode(invite.code);
    // An online build joins a code from the same field a LAN address goes in.
    const isOnlineBuild = onlineRoomsLive();
    if (isOnlineBuild) game.setServerAddress(invite.code);
  } else game.setServerAddress(invite.address);
  nav.value = INVITE_LANDING;
  window.history.replaceState(null, '', withoutJoinParam(window.location.href));
}
/** Lives here, so Back returns to the item the player left from. */
const selected = ref(0);
/** Null on the title's three parents; the opened parent once the player is inside one. */
const section = ref<MenuGroup | null>(null);

function answer(): void {
  markPressAnswered();
  asking.value = false;
  arrived.value = true;
}

function close(): void {
  const isBookOpen = nav.value.fromBooks === true;
  if (isBookOpen) {
    nav.value = closeBook(nav.value);
    return;
  }
  nav.value = closePage(nav.value);
}

function openBookPage(page: TitlePage): void {
  nav.value = openBook(nav.value, page);
}

/** Campaign and Arcade each carry a style: pressing one remembers it, then opens the one Play setup, which no longer asks. */
function openItem(item: TitleMenuItem): void {
  if (item.style) game.chooseStyle(item.style);
  nav.value = openPage(nav.value, item.page);
}
</script>

<style scoped>
.title {
  justify-content: safe center;
  gap: calc(var(--u) * 10);
  padding-bottom: calc(var(--u) * 20);
  background: radial-gradient(ellipse at center, rgba(7, 8, 12, 0.5), rgba(7, 8, 12, 0.08));
  overflow: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.title::-webkit-scrollbar {
  display: none;
}

.title-logo {
  flex: none;
  max-width: 100%;
  object-fit: contain;
}

/* A short window: the logo gives up height so the three menu columns fit above the footer. Touch has its own (touch-ui.css). */
@media (max-height: 520px) {
  :where(.game-root:not(.is-touch)) .title {
    gap: calc(var(--u) * 3);
    padding-bottom: calc(var(--u) * 32);
  }

  :where(.game-root:not(.is-touch)) .title-logo {
    max-height: 20vh;
  }
}

/* A small phone held upright: the same trade, so the menu clears the credit line. */
@media (max-aspect-ratio: 4 / 5) and (max-height: 620px) {
  .game-root .title {
    gap: calc(var(--u) * 4);
    padding-bottom: calc(var(--u) * 30);
  }

  .title-logo {
    max-height: 18vh;
  }
}

.title-columns {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: calc(var(--u) * 8);
}

.title-arrive {
  animation: px-fade-in 0.35s ease-out;
}

:root[data-motion='reduced'] .title-arrive {
  animation: none;
}

.title-foot {
  position: absolute;
  bottom: calc(var(--u) * 2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(var(--u) * 1);
  max-width: 100%;
  color: var(--bone-dim);
}

.title-links {
  display: flex;
  align-items: center;
  justify-content: center;
  column-gap: calc(var(--u) * 4);
}

.title-version {
  min-height: 44px;
  margin: 0;
  padding-inline: calc(var(--u) * 2);
  color: var(--bone-dim);
  text-decoration: underline dotted;
  text-underline-offset: 0.25em;
  text-transform: none;
}

.title-credit {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 2);
  margin: 0;
}

.title-privacy {
  min-width: 44px;
  min-height: 44px;
  padding-inline: calc(var(--u) * 2);
  color: var(--bone-dim);
}

.title-omega {
  width: calc(var(--u) * 7);
  height: auto;
}

/* Cinematic Title Entrance (Trenchess-style lockup intro) */
.title-hero {
  display: flex;
  justify-content: center;
  align-items: center;
  max-width: 100%;
}

.is-revealed .title-hero {
  animation: title-drop 0.85s cubic-bezier(0.18, 0.95, 0.28, 1.15) both;
}

.is-revealed .title-press,
.is-revealed .title-columns {
  animation: title-slide-up 0.65s cubic-bezier(0.16, 1, 0.3, 1) 0.32s both;
}

.is-revealed .title-foot {
  animation: title-fade-up 0.5s ease-out 0.6s both;
}

@keyframes title-drop {
  0% {
    opacity: 0;
    transform: translateY(calc(var(--u) * -24)) scale(0.92);
    filter: drop-shadow(0 0 24px rgba(220, 38, 38, 0.9)) brightness(1.6);
  }
  60% {
    opacity: 1;
    transform: translateY(calc(var(--u) * 2)) scale(1.02);
    filter: drop-shadow(0 0 16px rgba(220, 38, 38, 0.5)) brightness(1.15);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.9));
  }
}

@keyframes title-slide-up {
  0% {
    opacity: 0;
    transform: translateY(calc(var(--u) * 12));
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes title-fade-up {
  0% {
    opacity: 0;
    transform: translateY(calc(var(--u) * 4));
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

:root[data-motion='reduced'] .is-revealed .title-hero,
:root[data-motion='reduced'] .is-revealed .title-press,
:root[data-motion='reduced'] .is-revealed .title-columns,
:root[data-motion='reduced'] .is-revealed .title-foot {
  animation: none !important;
}
</style>
