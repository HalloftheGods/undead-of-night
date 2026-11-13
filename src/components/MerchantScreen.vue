<template>
  <section class="px-screen">
    <div v-if="open" class="px-panel px-frame shop" :style="{ '--bust-w': BUST_W }">
      <MerchantCard v-if="stalled" :bust="art.merchants[open.merchant].bust" :name="open.view.name" :role="open.view.role" :greeting="open.view.greeting">
        <QuestPanel v-if="working" :panel="workPanel" :merchant="open.merchant" :icons="art.ui" :silver="open.view.silver" />
        <ShopItemPanel v-else :line="shown" :icons="art.ui" :silver="open.view.silver" :difficulty="home.difficulty" :art-size @buy="buyChosen" />
      </MerchantCard>
      <MerchantCard v-else closed :bust="art.merchants[open.merchant].bust" name="Closed" :role="open.view.role" greeting="">
        <p class="px-note stall-notice">{{ open.view.notice }}</p>
      </MerchantCard>
      <p v-if="thin" class="px-note stall-thin">{{ open.view.notice }}</p>
      <div v-if="stalled" class="stall-tabs" role="radiogroup" aria-label="Stall" @keydown="onTabKey">
        <button
          v-for="(each, index) in STALL_TABS"
          :key="each"
          class="stall-tab px-frame"
          :class="{ 'is-chosen': each === tab, 'has-news': each === 'work' && waiting }"
          type="button"
          role="radio"
          :aria-checked="each === tab"
          :tabindex="each === tab ? 0 : -1"
          :ref="(el) => setTab(index, el)"
          @click="pickTab(each)"
        >
          {{ each === 'work' && waiting ? 'Work !' : TAB_LABELS[each] }}
        </button>
      </div>
      <QuestShelf v-if="working" ref="work" :panels :chosen="workAt" @choose="chooseWork" />
      <ShopShelf v-else-if="stalled" ref="shelf" :lines :chosen :icons="art.ui" :silver="open.view.silver" :art-size @choose="choose" @preview="preview" />
      <footer class="shop-foot">
        <p class="px-error shop-error" role="alert">{{ home.saveError ?? '' }}</p>
        <PixelButton class="shop-close" primary silent @press="game.home.closeStation()">Close</PixelButton>
      </footer>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * A merchant's shop, laid out like the survivor select: the merchant's framed bust and the item in focus
 * beside it, over the shelf of items to pick from. Pointing at a tile previews it; Buy buys the picked one.
 */
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue';
import { rosterStep } from '../game/character-select-view.ts';
import { BUST_W } from '../art/survivors/bust.ts';
import type { ArtBook } from '../art/types.ts';
import type { HomeUi } from '../game/home-hud.ts';
import { merchantView } from '../game/home/merchant-view.ts';
import { pickedIndex, startTab, STALL_TABS } from '../game/home/quest-screen.ts';
import type { StallTab } from '../game/home/quest-screen.ts';
import { questPanels } from '../game/home/quest-view.ts';
import { itemSprite } from '../game/home/shop-item-art.ts';
import MerchantCard from './MerchantCard.vue';
import PixelButton from './PixelButton.vue';
import QuestPanel from './QuestPanel.vue';
import QuestShelf from './QuestShelf.vue';
import ShopItemPanel from './ShopItemPanel.vue';
import ShopShelf from './ShopShelf.vue';
import { useGame } from './use-game.ts';

const { home, art } = defineProps<{ home: HomeUi; art: ArtBook }>();
const game = useGame();
const shelf = useTemplateRef<InstanceType<typeof ShopShelf>>('shelf');

/** Follows the open station, so the screen empties the moment the station clears. */
const open = computed(() => (home.shop ? { merchant: home.shop, view: merchantView(home, home.shop) } : null));
const lines = computed(() => open.value?.view.lines ?? []);
/** Someone keeps the stall, so there is a shelf to read. A closed one shows its notice instead. */
const stalled = computed(() => open.value?.view.stall.kind !== 'closed' && open.value?.view.stall.kind !== 'unmet');
const thin = computed(() => open.value?.view.stall.kind === 'thin');

const TAB_LABELS: Record<StallTab, string> = { shelf: 'Shelf', work: 'Work' };
const work = useTemplateRef<InstanceType<typeof QuestShelf>>('work');
const tabs = new Map<number, HTMLElement>();
const panels = computed(() => (open.value ? questPanels(home, open.value.merchant) : []));
const waiting = computed(() => panels.value.some((panel) => panel.state === 'ready'));
const tab = ref<StallTab>('shelf');
const working = computed(() => stalled.value && tab.value === 'work');
const workPicked = ref<string | null>(null);
const workAt = computed(() => pickedIndex(panels.value, workPicked.value));
const workPanel = computed(() => panels.value[workAt.value] ?? null);

function setTab(index: number, el: unknown): void {
  const isTab = el instanceof HTMLElement;
  if (isTab) tabs.set(index, el);
}

function pickTab(next: StallTab): void {
  game.playUi('click');
  tab.value = next;
}

/** Arrows switch the tab and keep the keyboard on it, as on the shelf. */
function onTabKey(event: KeyboardEvent): void {
  const next = rosterStep(STALL_TABS.indexOf(tab.value), event.key, STALL_TABS.length);
  const moves = next !== null;
  if (!moves) return;
  event.preventDefault();
  event.stopPropagation();
  pickTab(STALL_TABS[next]);
  tabs.get(next)?.focus();
}

function chooseWork(index: number): void {
  game.playUi('click');
  workPicked.value = panels.value[index]?.id ?? null;
}

const picked = ref<string | null>(null);
const pickedAt = ref(0);
const previewed = ref<number | null>(null);
/** The pick stays on its item while the shelf changes; once it sells out, the pick falls to what took its place. */
const chosen = computed(() => {
  const at = lines.value.findIndex((line) => line.item === picked.value);
  return at >= 0 ? at : Math.min(pickedAt.value, Math.max(0, lines.value.length - 1));
});
const shown = computed(() => lines.value[previewed.value ?? chosen.value] ?? lines.value[chosen.value] ?? null);

/** The largest icon on this shelf, so the tiles and the column each draw every icon at one scale. */
const artSize = computed(() => {
  const sprites = lines.value.map((line) => itemSprite(art.ui, line.grant));
  return { w: Math.max(1, ...sprites.map((each) => each.w)), h: Math.max(1, ...sprites.map((each) => each.h)) };
});

function choose(index: number): void {
  game.playUi('click');
  picked.value = lines.value[index]?.item ?? null;
  pickedAt.value = index;
}

function preview(index: number | null): void {
  const pointing = index !== null;
  if (pointing) game.playUi('hover');
  previewed.value = index;
}

function buyChosen(): void {
  const merchant = open.value?.merchant;
  const line = lines.value[chosen.value];
  const onShelf = merchant !== undefined && line !== undefined;
  if (onShelf) game.home.buy(merchant, line.item);
}

watch(
  () => home.shop,
  () => {
    tab.value = startTab(panels.value);
    workPicked.value = null;
    picked.value = null;
    pickedAt.value = 0;
    previewed.value = null;
  }
);
onMounted(() => {
  tab.value = startTab(panels.value);
  (working.value ? work.value : shelf.value)?.focus();
});
</script>

<style scoped>
/* As wide as the bust (rounded as SpriteImg rounds it), the column and the gaps; a phone gets the window. */
.shop {
  --bust-px: max(var(--dpx, 1px), round(nearest, calc(var(--u) * 3), var(--dpx, 1px)));
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 4);
  width: calc(var(--bust-px) * var(--bust-w) + var(--u) * 220);
  max-width: 100%;
  container: shop / inline-size;
}

.stall-notice {
  align-self: center;
  max-width: calc(var(--u) * 150);
  color: var(--amber);
}

.stall-tabs {
  display: flex;
  justify-content: center;
  gap: calc(var(--u) * 3);
}

.stall-tab {
  --edge: var(--ink-line);
  min-width: calc(var(--u) * 40);
  border: 0;
  padding: calc(var(--u) * 2) calc(var(--u) * 6);
  background: var(--ink-raised);
  color: var(--bone-dim);
  font: inherit;
  font-size: calc(var(--u) * 7);
  text-transform: uppercase;
  cursor: pointer;
  outline: none;
}

.stall-tab:hover,
.stall-tab:focus-visible {
  --edge: var(--bone-dim);
  color: var(--bone);
}

.stall-tab.is-chosen {
  --edge: var(--amber);
  color: var(--amber);
}

.stall-tab.has-news:not(.is-chosen) {
  color: var(--sick);
}

.shop-foot {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 4);
}

/* One line is always kept, so a failed save never moves the screen. */
.shop-error {
  flex: 1;
  min-height: 1lh;
  font-size: calc(var(--u) * 6);
}

.shop-close {
  width: auto;
  padding-inline: calc(var(--u) * 10);
}
</style>
