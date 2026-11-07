<template>
  <section class="px-screen credits" aria-label="Credits" @click="done">
    <ol class="credits-roll" :style="{ '--roll-duration': duration }" @animationend="done">
      <li v-for="(line, index) in CREDITS" :key="index" :class="'credits-' + line.kind">{{ line.text }}</li>
    </ol>
    <div class="credits-skip">
      <PixelButton silent @press="done">Skip</PixelButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { CREDITS, creditsSeconds } from '../game/credits.ts';
import PixelButton from './PixelButton.vue';

const emit = defineEmits<{ done: [] }>();
const duration = `${creditsSeconds()}s`;
const SKIP_KEYS: readonly string[] = ['Escape', 'Enter', ' '];

function done(): void {
  emit('done');
}

function onKey(event: KeyboardEvent): void {
  const skips = SKIP_KEYS.includes(event.key);
  if (!skips) return;
  event.preventDefault();
  done();
}

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped>
.credits {
  justify-content: flex-start;
  overflow: hidden;
  background: var(--ink);
  cursor: pointer;
}

.credits-roll {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 10);
  margin: 0;
  padding: 0;
  list-style: none;
  text-align: center;
  animation: credits-roll var(--roll-duration) linear both;
}

@keyframes credits-roll {
  from {
    transform: translateY(100vh);
  }
  to {
    transform: translateY(-100%);
  }
}

.credits-title {
  font-size: calc(var(--u) * 14);
  font-weight: 700;
  color: var(--amber);
}

.credits-studio {
  font-size: calc(var(--u) * 8);
  color: var(--bone);
}

.credits-role {
  margin-top: calc(var(--u) * 10);
  color: var(--bone-dim);
}

.credits-name {
  font-size: calc(var(--u) * 9);
  color: var(--bone);
}

.credits-thanks {
  margin-top: calc(var(--u) * 20);
  color: var(--sick);
}

.credits-skip {
  position: absolute;
  right: calc(var(--u) * 6);
  bottom: calc(var(--u) * 6);
}
</style>