<template>
  <section class="px-screen">
    <div class="px-panel px-frame candy-shop">
      <header class="shop-header">
        <div class="shop-title-row">
          <h2 class="px-heading shop-title">Candy Exchange</h2>
          <div class="shop-balance">
            <span class="candy-symbol" aria-hidden="true">&#127852;</span>
            <span class="balance-amount">{{ balance }} candy</span>
          </div>
        </div>
        <p class="px-note shop-subtitle">
          Trade salvaged candy for bunker credits, or purchase tactical sweets for your next run.
        </p>
      </header>

      <div class="shop-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          class="stall-tab px-frame"
          :class="{ 'is-chosen': activeTab === 'sell' }"
          :aria-selected="activeTab === 'sell'"
          @click="activeTab = 'sell'"
        >
          Sell Candy ({{ carriedCount }})
        </button>
        <button
          type="button"
          role="tab"
          class="stall-tab px-frame"
          :class="{ 'is-chosen': activeTab === 'buy' }"
          :aria-selected="activeTab === 'buy'"
          @click="activeTab = 'buy'"
        >
          Buy Sweets
        </button>
      </div>

      <!-- Sell View -->
      <div v-if="activeTab === 'sell'" class="tab-content sell-tab">
        <div v-if="carriedCandies.length > 0" class="candy-list">
          <div class="bulk-sell-row">
            <span class="bag-capacity">Carrying {{ carriedCount }} / {{ MAX_CANDY_BAG }} pieces (Worth: {{ totalBagWorth }} candy)</span>
            <PixelButton primary @press="handleSellAll">
              Sell All (+{{ totalBagWorth }})
            </PixelButton>
          </div>

          <div class="candy-cards-grid">
            <div
              v-for="item in carriedCandies"
              :key="item.id"
              class="candy-card px-frame"
            >
              <div class="card-left">
                <span class="card-stat">{{ item.stat }}</span>
                <span class="card-name">{{ item.name }}</span>
                <span class="card-blurb">{{ item.blurb }}</span>
              </div>
              <div class="card-right">
                <span class="card-count">x{{ item.count }}</span>
                <span class="card-value">+{{ item.sellPrice }} each</span>
                <PixelButton
                  @press="handleSellOne(item.id)"
                >
                  Sell 1
                </PixelButton>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-stash px-frame">
          <p class="empty-title">Your candy bag is empty.</p>
          <p class="empty-hint">Scavenge town houses and doorstep bowls on your next trip to find candy.</p>
        </div>
      </div>

      <!-- Buy View -->
      <div v-else class="tab-content buy-tab">
        <div class="candy-catalog">
          <div
            v-for="group in catalog"
            :key="group.tierName"
            class="tier-section"
          >
            <h3 class="tier-heading">{{ group.tierName }}</h3>
            <div class="candy-cards-grid">
              <div
                v-for="item in group.items"
                :key="item.id"
                class="candy-card px-frame"
              >
                <div class="card-left">
                  <span class="card-stat">{{ item.stat }}</span>
                  <span class="card-name">{{ item.name }}</span>
                  <span class="card-blurb">{{ item.blurb }}</span>
                </div>
                <div class="card-right">
                  <span class="card-price">{{ item.buyPrice }} candy</span>
                  <span v-if="item.count > 0" class="card-carried">Bag: {{ item.count }}</span>
                  <PixelButton
                    primary
                    :disabled="balance < item.buyPrice || carriedCount >= MAX_CANDY_BAG"
                    @press="handleBuy(item.id)"
                  >
                    Buy
                  </PixelButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer class="shop-foot">
        <PixelButton @press="game.home.closeStation()">
          Close
        </PixelButton>
      </footer>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { MAX_CANDY_BAG, candyBagWorth } from '../../shared/candy.ts';
import type { CandyId } from '../../shared/candy.ts';
import type { ArtBook } from '../art/types.ts';
import type { HomeUi } from '../game/home-hud.ts';
import { candyTradeCatalog } from '../game/home/candy-shop.ts';
import type { CandyTradeItem } from '../game/home/candy-shop.ts';
import PixelButton from './PixelButton.vue';
import { useGame } from './use-game.ts';

const { home } = defineProps<{ home: HomeUi; art?: ArtBook | null }>();
const game = useGame();

const activeTab = ref<'sell' | 'buy'>('sell');

const balance = computed(() => {
  const save = home.save;
  if (!save) return 0;
  return save.candy ?? save.silver ?? 0;
});

const playerBag = computed<readonly CandyId[]>(() => {
  return home.carried.candyList ?? [];
});

const carriedCount = computed(() => playerBag.value.length);
const totalBagWorth = computed(() => candyBagWorth(playerBag.value));

const catalog = computed(() => candyTradeCatalog(playerBag.value));

const carriedCandies = computed<readonly CandyTradeItem[]>(() => {
  const items: CandyTradeItem[] = [];
  for (const group of catalog.value) {
    for (const item of group.items) {
      if (item.count > 0) items.push(item);
    }
  }
  return items;
});

function handleSellOne(id: CandyId): void {
  game.home.sellCandy(id);
}

function handleSellAll(): void {
  game.home.sellAllCandy();
}

function handleBuy(id: CandyId): void {
  game.home.buyCandy(id);
}
</script>

<style scoped>
.candy-shop {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 3);
  width: min(100%, calc(var(--u) * 160));
  max-height: 85vh;
}

.shop-header {
  display: flex;
  flex-direction: column;
  gap: var(--u);
}

.shop-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.shop-title {
  font-size: calc(var(--u) * 4);
  color: var(--amber);
  margin: 0;
}

.shop-balance {
  display: flex;
  align-items: center;
  gap: var(--u);
  font-size: calc(var(--u) * 3.5);
  font-weight: 700;
  color: var(--amber-glow, #ffb066);
}

.shop-subtitle {
  color: var(--bone-dim);
  font-size: calc(var(--u) * 2.5);
  margin: 0;
}

.shop-tabs {
  display: flex;
  gap: calc(var(--u) * 2);
}

.stall-tab {
  flex: 1;
  padding: calc(var(--u) * 2);
  background: var(--shade-deep, #14161f);
  color: var(--bone-dim);
  border: 1px solid var(--rim-subtle, #2b2d38);
  font-weight: 700;
  cursor: pointer;
}

.stall-tab.is-chosen {
  background: var(--amber);
  color: #0b0c10;
  border-color: var(--amber);
}

.tab-content {
  overflow-y: auto;
  max-height: calc(var(--u) * 90);
  padding-right: var(--u);
}

.bulk-sell-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: calc(var(--u) * 2);
  background: rgba(255, 176, 102, 0.08);
  border: 1px solid var(--amber);
  margin-bottom: calc(var(--u) * 2);
}

.bag-capacity {
  font-size: calc(var(--u) * 2.5);
  color: var(--bone);
  font-weight: 600;
}

.candy-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(calc(var(--u) * 45), 1fr));
  gap: calc(var(--u) * 2);
}

.candy-card {
  display: flex;
  justify-content: space-between;
  padding: calc(var(--u) * 2);
  background: rgba(20, 22, 31, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  gap: calc(var(--u) * 2);
}

.card-left {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.5);
}

.card-stat {
  font-size: calc(var(--u) * 2);
  font-weight: 700;
  color: var(--amber);
  text-transform: uppercase;
}

.card-name {
  font-size: calc(var(--u) * 2.8);
  font-weight: 700;
  color: var(--bone);
}

.card-blurb {
  font-size: calc(var(--u) * 2.2);
  color: var(--bone-dim);
}

.card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--u);
}

.card-count {
  font-size: calc(var(--u) * 2.8);
  font-weight: 700;
  color: var(--bone);
}

.card-value {
  font-size: calc(var(--u) * 2.2);
  color: var(--mint, #5ce6b0);
  font-weight: 600;
}

.card-price {
  font-size: calc(var(--u) * 2.2);
  color: var(--amber);
  font-weight: 600;
}

.card-carried {
  font-size: calc(var(--u) * 2);
  color: var(--bone-dim);
}

.tier-section {
  margin-bottom: calc(var(--u) * 3);
}

.tier-heading {
  font-size: calc(var(--u) * 3);
  color: var(--amber);
  margin-block: calc(var(--u) * 1.5) calc(var(--u) * 1);
  border-bottom: 1px solid rgba(255, 176, 102, 0.2);
  padding-bottom: calc(var(--u) * 0.5);
}

.empty-stash {
  padding: calc(var(--u) * 6);
  text-align: center;
  background: rgba(11, 12, 16, 0.6);
}

.empty-title {
  font-size: calc(var(--u) * 3.5);
  font-weight: 700;
  color: var(--bone);
  margin: 0 0 var(--u) 0;
}

.empty-hint {
  font-size: calc(var(--u) * 2.5);
  color: var(--bone-dim);
  margin: 0;
}

.shop-foot {
  display: flex;
  justify-content: flex-end;
  margin-top: calc(var(--u) * 2);
}
</style>
