<template>
  <aside class="room px-frame" aria-live="polite">
    <span class="px-label room-title">Your room</span>
    <span class="room-code">{{ room }}</span>
    <PixelButton class="room-copy" @press="copy">{{ COPY_LABELS[copied] }}</PixelButton>
    <span class="room-note">Send the link, or have friends type the code under Multiplayer. It stays in the menu (Esc) too.</span>
  </aside>
</template>

<script setup lang="ts">
import PixelButton from './PixelButton.vue';
import { COPY_LABELS, useRoomLink } from './use-room-link.ts';

/** Shown while the host waits for friends; once someone joins it goes, and the code stays in the pause menu. */
const { room } = defineProps<{ room: string }>();
const { copied, copy } = useRoomLink(() => room);
</script>

<style scoped>
/* Centred under the score chip, above the level card's middle of the screen. */
.room {
  position: absolute;
  top: calc(var(--u) * 42);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--u);
  padding: calc(var(--u) * 2) calc(var(--u) * 5);
  background: rgba(11, 12, 16, 0.85);
  pointer-events: auto;
  text-align: center;
}

.room-title {
  color: var(--bone-dim);
}

.room-code {
  color: var(--bone);
  font-size: calc(var(--u) * 12);
  letter-spacing: 0.3em;
  padding-left: 0.3em;
}

.room-copy {
  width: auto;
}

.room-note {
  max-width: calc(var(--u) * 90);
  color: var(--bone-dim);
  font-size: calc(var(--u) * 5);
  line-height: 1.4;
}

/* On a phone the top chips fill the row, so the card drops below them. */
@media (max-width: 720px) {
  .room {
    top: calc(var(--u) * 48);
  }
}
</style>
