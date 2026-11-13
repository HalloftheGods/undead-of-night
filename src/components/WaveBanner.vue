<template>
  <div class="banner" :class="`is-${banner.tone}`" role="status">
    <strong class="banner-title">{{ banner.title }}</strong>
    <span class="banner-sub">{{ banner.subtitle }}</span>
  </div>
</template>

<script setup lang="ts">
import type { Banner } from '../game/hud-state.ts';

defineProps<{ banner: Banner }>();
</script>

<style scoped>
.banner {
  position: absolute;
  /* Low on the screen, above the weapon bar, so the world stays clear while it plays. */
  bottom: 18%;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 2);
  padding: calc(var(--u) * 4) 0;
  background: rgba(11, 12, 16, 0.72);
  pointer-events: none;
  animation: banner-life 2.6s steps(13) both;
}

.banner-title {
  font-size: calc(var(--u) * 20);
  line-height: 1;
}

.banner-sub {
  color: var(--bone-dim);
}

.is-danger .banner-title {
  color: var(--blood-bright);
}

.is-quiet .banner-title {
  color: var(--bone-dim);
}

.is-hope .banner-title {
  color: var(--amber);
}

@keyframes banner-life {
  0% { opacity: 0; }
  8% { opacity: 1; }
  85% { opacity: 1; }
  100% { opacity: 0; }
}
</style>
