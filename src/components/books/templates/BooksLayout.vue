<template>
  <TitlePage heading="News Stand" bare boxed @close="emit('close')">
    <template #lead>
      <BooksGrid
        :books="books"
        :covers="covers"
        :active-id="activeId"
        @choose="emit('choose', $event)"
        @hover="emit('hover', $event)"
        @unhover="emit('unhover')"
      />
    </template>
    <BooksFeaturedAtom
      :title="featured.title"
      :subtitle="featured.subtitle"
      :description="featured.description"
      :tag="featured.tag"
      :pages-count="featured.pagesCount"
    />
  </TitlePage>
</template>

<script setup lang="ts">
import type { BookDef } from '../../../game/books-data.ts';
import type { TitlePage as TitlePageType } from '../../../game/title-menu.ts';
import TitlePage from '../../TitlePage.vue';
import BooksFeaturedAtom from '../atoms/BooksFeaturedAtom.vue';
import BooksGrid from '../organisms/BooksGrid.vue';
import '../books.css';

defineProps<{
  books: readonly BookDef[];
  covers: Record<string, string>;
  featured: BookDef;
  activeId: TitlePageType | null;
}>();

const emit = defineEmits<{
  choose: [id: TitlePageType];
  hover: [id: TitlePageType];
  unhover: [];
  close: [];
}>();
</script>
