<template>
  <article ref="pageRef" class="mag-page tg-leaf" :class="[`mag-color-${leaf.color}`, `is-${side}`]">
    <header class="mag-running-head">
      <span>{{ TOWN_GUIDE_TITLE }}</span>
      <span>{{ leaf.head }}</span>
    </header>

    <div v-if="leaf.kind === 'front'" class="mag-flow tg-front">
      <header class="mag-head">
        <p class="mag-head-kicker"><span class="mag-head-number">{{ folio }}</span>Scavenger's edition</p>
        <h3 class="mag-head-title">{{ TOWN_GUIDE_TITLE }}</h3>
        <p class="mag-head-deck">What every kind of building in town still has inside, and where to look for it.</p>
      </header>
      <ol class="tg-contents">
        <li v-for="place in places" :key="place.id">
          <button class="tg-contents-line" type="button" @click="emit('open', placePage(place.id, leaves) - 1)">
            <span class="tg-contents-title">{{ place.name }}</span>
            <span class="tg-contents-best">{{ bestOf(place) }}</span>
            <span class="tg-contents-page">{{ placePage(place.id, leaves) }}</span>
          </button>
        </li>
      </ol>
    </div>

    <div v-else-if="leaf.kind === 'index'" class="mag-flow tg-index">
      <header class="mag-head">
        <p class="mag-head-kicker"><span class="mag-head-number">{{ folio }}</span>Shopping list</p>
        <h3 class="mag-head-title">Where to look</h3>
      </header>
      <ul class="tg-lookup">
        <li v-for="line in lookup" :key="line.id" class="tg-lookup-line">
          <span class="tg-icon-cell"><GuideIcon :icon="line.icon" :art /></span>
          <span class="tg-lookup-name">{{ line.name }}</span>
          <span class="tg-lookup-places">
            <button v-for="place in line.places" :key="place.id" class="tg-place-link" type="button" @click="emit('open', placePage(place.id, leaves) - 1)">
              {{ place.name }}
            </button>
          </span>
        </li>
      </ul>
      <ul class="tg-tips">
        <li v-for="tip in GUIDE_TIPS" :key="tip">{{ tip }}</li>
      </ul>
    </div>

    <div v-else class="mag-flow tg-place">
      <header class="mag-head tg-place-head">
        <div>
          <p class="mag-head-kicker"><span class="mag-head-number">{{ folio }}</span>{{ searchLine(leaf.place) }}</p>
          <h3 class="mag-head-title">{{ leaf.place.name }}</h3>
          <p class="mag-head-deck">{{ leaf.place.blurb }}</p>
        </div>
        <img class="tg-facade" :src="facadeUrl(leaf.place)" alt="" draggable="false" />
      </header>
      <section v-for="group in tiersOf(leaf.place)" :key="group.tier" class="tg-tier" :aria-label="TIER_LABELS[group.tier]">
        <span class="rb-stamp tg-stamp" :class="`is-${group.tier}`">{{ TIER_LABELS[group.tier] }}</span>
        <ul class="tg-finds">
          <li v-for="find in group.finds" :key="find.id" class="tg-find">
            <span class="tg-icon-cell"><GuideIcon :icon="find.icon" :art /></span>
            <span class="tg-find-name">{{ find.name }}</span>
            <span v-if="find.note" class="tg-find-note">{{ find.note }}</span>
          </li>
        </ul>
      </section>
    </div>

    <footer class="mag-folio">{{ folio }}</footer>
  </article>
</template>

<script setup lang="ts">
/** One page of the Town Guide: the contents, the Where to Look index, or one kind of building. Fitted like How to Play. */
import { useTemplateRef } from 'vue';
import { CONTAINER_LABEL } from '../../../shared/containers.ts';
import type { ArtBook } from '../../art/types.ts';
import { spriteDataUrl } from '../../engine/sprite-cache.ts';
import { usePageFit } from '../../game/magazine-fit.ts';
import { GUIDE_TIPS, guidePlaces, placePage, TIER_LABELS, TIER_ORDER, TOWN_GUIDE_TITLE, whereToLook } from '../../game/town-guide.ts';
import type { FindTier, GuideFind, GuideLeaf, GuidePlace } from '../../game/town-guide.ts';
import GuideIcon from './GuideIcon.vue';

interface GuideLeafPageProps {
  leaf: GuideLeaf;
  leaves: readonly GuideLeaf[];
  art: ArtBook;
  side: 'left' | 'right';
  folio: number;
}

const { art } = defineProps<GuideLeafPageProps>();
const emit = defineEmits<{ open: [index: number] }>();

const places = guidePlaces();
const lookup = whereToLook(places);

/** The two likeliest finds, for the contents line. */
function bestOf(place: GuidePlace): string {
  return place.finds.slice(0, 2).map((find) => find.name).join(', ');
}

function searchLine(place: GuidePlace): string {
  const spots = place.searchIn.map((kind) => CONTAINER_LABEL[kind].toLowerCase());
  return `Search: ${spots.join(', ')}`;
}

function facadeUrl(place: GuidePlace): string {
  const { picture } = place;
  const sprite = 'building' in picture ? art.environment.buildings[picture.building][0] : art.containers[picture.container].closed;
  return spriteDataUrl(sprite);
}

interface TierGroup {
  readonly tier: FindTier;
  readonly finds: readonly GuideFind[];
}

function tiersOf(place: GuidePlace): readonly TierGroup[] {
  const groups = TIER_ORDER.map((tier) => ({ tier, finds: place.finds.filter((find) => find.tier === tier) }));
  return groups.filter((group) => group.finds.length > 0);
}

const pageRef = useTemplateRef<HTMLElement>('pageRef');
usePageFit(pageRef);
</script>
