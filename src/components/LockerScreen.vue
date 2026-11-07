<template>
  <section class="px-screen">
    <div class="px-panel px-frame locker">
      <SceneCard :sprite="art?.ui.stations.locker ?? null" name="Locker" :line="LOCKER_LINE">
        <LockerHands :rows="hands" :icons />
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
 * The locker, laid out like the shop: the locker's framed scene with what is in hand beside it, over a strip
 * of every kind of gear on either side. The chosen tile takes one into hand or stows one; Close puts the hands
 * on the player.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import type { ArtBook } from '../art/types.ts';
import type { HomeUi } from '../game/home-hud.ts';
import { closeLocker, lockerGone, moveToHands, moveToLocker } from '../game/home-screens.ts';
import type { LockerDraft } from '../game/home-screens.ts';
import { handRows, lockerArtSize, lockerTiles } from '../game/home/locker-view.ts';
import LockerHands from './LockerHands.vue';
import LockerShelf from './LockerShelf.vue';
import PixelButton from './PixelButton.vue';
import SceneCard from './SceneCard.vue';
import { useGame } from './use-game.ts';

const { home, art } = defineProps<{ home: HomeUi; art: ArtBook | null }>();
const game = useGame();
const strip = useTemplateRef<InstanceType<typeof LockerShelf>>('strip');
const LOCKER_LINE = 'Gear in hand goes on the trip, and is lost if you die.';

/** What the player is arranging. The save is only read when the locker opens, so a save landing mid-edit cannot undo a move. */
const draft = ref<LockerDraft | null>(home.save ? { locker: home.save.locker, hands: home.save.hands } : null);
/** The draft last put on the player, or as it opened: anything since is unsent. */
let sent: LockerDraft | null = draft.value;
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

/** Plays the click only when something moved, so a key on an empty side stays quiet. */
function move(next: LockerDraft): void {
  const moved = next !== draft.value;
  if (moved) game.playUi('click');
  draft.value = next;
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
    if (isFirstSave) draft.value = sent = { locker: save.locker, hands: save.hands };
  }
);

/** The keyboard lands on the strip as soon as it has tiles, as the shop's lands on its shelf. */
watch(
  () => tiles.value.length > 0,
  (hasTiles) => {
    if (hasTiles) void nextTick(() => strip.value?.focus());
  },
  { immediate: true }
);

function close(): void {
  sent = draft.value;
  if (draft.value) closeLocker(draft.value, game.home);
  else game.home.closeStation();
}

/** Esc closes the locker the way Close does, or what was just moved would quietly stay where it was. */
onMounted(() => game.home.closeWith(close));
/** Shut from outside, as at the breach: what was moved still goes on the player. */
onBeforeUnmount(() => {
  lockerGone(draft.value, sent, game.home);
  game.home.closeWith(null);
});
</script>

<style scoped>
/* Trimmed edges, as on the level map, so the whole locker fits an 800x600 window without scrolling. */
.px-screen {
  padding: calc(var(--u) * 3);
}

/* As wide as the scene card: the scene at 4 per art pixel, its frame, the gap and the column. */
.locker {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 3);
  width: calc(var(--u) * 510);
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
