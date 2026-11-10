<template>
  <BookCardButton
    :ariaLabel="`Open ${book.title}: ${book.subtitle}`"
    :active="active"
    @press="emit('choose', book.id)"
    @hover="emit('hover', book.id)"
    @unhover="emit('unhover')"
  >
    <BookCardHead :number="book.number" :tag="book.tag" />
    <BookCardArt :src="coverSrc" :title="book.title" />
    <BookCardFoot :subtitle="book.subtitle" :pages-count="book.pagesCount" />
  </BookCardButton>
</template>

<script setup lang="ts">
import type { BookDef } from '../../../game/books-data.ts';
import type { TitlePage } from '../../../game/title-menu.ts';
import BookCardArt from '../atoms/BookCardArt.vue';
import BookCardButton from '../atoms/BookCardButton.vue';
import BookCardFoot from '../atoms/BookCardFoot.vue';
import BookCardHead from '../atoms/BookCardHead.vue';

defineProps<{
  book: BookDef;
  coverSrc?: string;
  active?: boolean;
}>();

const emit = defineEmits<{
  choose: [id: TitlePage];
  hover: [id: TitlePage];
  unhover: [];
}>();
</script>
