<template>
  <button v-if="offered" class="cartridge" type="button" aria-label="Install Game" title="Install Game" @click="installController.press()">
    <img class="cartridge-body" :src="CARTRIDGE_SRC" alt="" draggable="false" />
  </button>
  <IosInstallCard v-if="installController.guideOpen.value" :kind="installController.guideKind.value" @close="installController.closeGuide()" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { cartridgeSrc } from '../art/cartridge.ts';
import { installController, setTitleShowing } from '../game/pwa/index.ts';
import IosInstallCard from './IosInstallCard.vue';

const CARTRIDGE_SRC = cartridgeSrc();
const offered = computed(() => installController.path.value !== 'none');

// A waiting new version takes over while the title is up, never during a run.
onMounted(() => setTitleShowing(true));
onBeforeUnmount(() => setTitleShowing(false));
</script>

<style scoped>
/* --pixel is one pixel of the 48 by 56 cartridge picture, label included (src/art/cartridge-art.ts). */
.cartridge {
  --pixel: calc(var(--u) * 1.25);
  position: absolute;
  top: 0;
  bottom: 0;
  right: max(calc(var(--u) * 12), env(safe-area-inset-right));
  width: calc(var(--pixel) * 48);
  height: calc(var(--pixel) * 56);
  min-width: 44px;
  min-height: 44px;
  margin: auto 0;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  filter: drop-shadow(0 calc(var(--u) * 2) 0 rgba(0, 0, 0, 0.5));
  transition: transform 120ms steps(3);
}

.cartridge:hover,
.cartridge:focus-visible {
  transform: translateY(calc(var(--u) * -2));
}

.cartridge:focus-visible {
  outline: calc(var(--u) * 1) solid var(--amber);
  outline-offset: calc(var(--u) * 2);
}

.cartridge-body {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}

/*
 * Portrait: small, centred above the credit line. It never sits in the flow, so the menu does not jump
 * when the install prompt arrives. A screen too short to hold it clear of the menu and the credit line goes without.
 */
@media (orientation: portrait) {
  .cartridge {
    --pixel: var(--u);
    top: auto;
    bottom: calc(var(--u) * 26);
    left: 0;
    right: 0;
    margin: 0 auto;
  }
}

/* On a very narrow screen the credit line and the Privacy link wrap to two rows, so it sits higher. */
@media (orientation: portrait) and (max-width: 340px) {
  .cartridge {
    bottom: calc(var(--u) * 44);
  }
}

@media (orientation: portrait) and (max-height: 600px), (orientation: portrait) and (max-width: 340px) and (max-height: 680px) {
  .cartridge {
    display: none;
  }
}

@media (orientation: landscape) and (max-height: 520px) {
  .cartridge {
    --pixel: var(--u);
  }
}

@media (orientation: landscape) and (max-height: 340px) {
  .cartridge {
    display: none;
  }
}

:root[data-motion='reduced'] .cartridge {
  transition: none;
}

:root[data-motion='reduced'] .cartridge:hover,
:root[data-motion='reduced'] .cartridge:focus-visible {
  transform: none;
}
</style>
