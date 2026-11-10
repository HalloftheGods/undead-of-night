<template>
  <BooksLayout
    :books="BOOKS_CATALOG"
    :covers="coverUrls"
    :featured="featured"
    :active-id="hoveredId"
    @choose="onChoose"
    @hover="onHover"
    @unhover="onUnhover"
    @close="emit('close')"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ArtBook } from '../art/types.ts';
import { spriteDataUrl } from '../engine/sprite-cache.ts';
import { BOOKS_CATALOG } from '../game/books-data.ts';
import type { BookDef } from '../game/books-data.ts';
import type { TitlePage } from '../game/title-menu.ts';
import BooksLayout from './books/templates/BooksLayout.vue';
import { useGame } from './use-game.ts';

const props = defineProps<{
  art: ArtBook | null;
}>();

const emit = defineEmits<{
  open: [page: TitlePage];
  close: [];
}>();

const game = useGame();
const hoveredId = ref<TitlePage | null>(null);

const featured = computed<BookDef>(() => {
  const current = hoveredId.value;
  const match = current !== null ? BOOKS_CATALOG.find((book) => book.id === current) : undefined;
  return match ?? BOOKS_CATALOG[0];
});

const coverUrls = computed<Record<string, string>>(() => {
  const bookCovers = props.art?.ui.bookCovers;
  if (!bookCovers) return {};
  const urls: Record<string, string> = {};
  for (const book of BOOKS_CATALOG) {
    const sprite = bookCovers[book.id];
    if (sprite) urls[book.id] = spriteDataUrl(sprite);
  }
  return urls;
});

function onChoose(id: TitlePage): void {
  game.playUi('click');
  emit('open', id);
}

function onHover(id: TitlePage): void {
  const isSame = hoveredId.value === id;
  if (isSame) return;
  game.playUi('hover');
  hoveredId.value = id;
}

function onUnhover(): void {
  hoveredId.value = null;
}
</script>
