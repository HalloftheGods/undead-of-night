<template>
  <BooksGridAtom>
    <BookStopAtom v-for="book in books" :key="book.id">
      <BookCard
        :book="book"
        :cover-src="covers[book.id]"
        :active="activeId === book.id"
        @choose="emit('choose', $event)"
        @hover="emit('hover', $event)"
        @unhover="emit('unhover')"
      />
    </BookStopAtom>
  </BooksGridAtom>
</template>

<script setup lang="ts">
import type { BookDef } from '../../../game/books-data.ts';
import type { TitlePage } from '../../../game/title-menu.ts';
import BookStopAtom from '../atoms/BookStopAtom.vue';
import BooksGridAtom from '../atoms/BooksGridAtom.vue';
import BookCard from '../molecules/BookCard.vue';

defineProps<{
  books: readonly BookDef[];
  covers: Record<string, string>;
  activeId: TitlePage | null;
}>();

const emit = defineEmits<{
  choose: [id: TitlePage];
  hover: [id: TitlePage];
  unhover: [];
}>();
</script>
