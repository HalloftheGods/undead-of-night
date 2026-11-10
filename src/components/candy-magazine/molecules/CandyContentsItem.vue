<template>
  <ContentsItemButton @press="$emit('open', spreadIndex)">
    <ContentsSpriteCell>
      <SpriteImg :sprite="sprite" :scale="2" />
    </ContentsSpriteCell>
    <ContentsNameText :name="entry.name" />
    <ContentsStatBadge :stat="entry.stat" />
    <ContentsPageText :page="page" />
  </ContentsItemButton>
</template>

<script setup lang="ts">
import type { PixelSprite } from '../../../art/types.ts';
import type { CandyMagazineEntry } from '../../../game/candy-magazine-data.ts';
import SpriteImg from '../../SpriteImg.vue';
import ContentsItemButton from '../atoms/ContentsItemButton.vue';
import ContentsNameText from '../atoms/ContentsNameText.vue';
import ContentsPageText from '../atoms/ContentsPageText.vue';
import ContentsSpriteCell from '../atoms/ContentsSpriteCell.vue';
import ContentsStatBadge from '../atoms/ContentsStatBadge.vue';

defineProps<{
  entry: CandyMagazineEntry;
  sprite: PixelSprite;
  page: number;
  spreadIndex: number;
}>();

defineEmits<{ open: [index: number] }>();
</script>
