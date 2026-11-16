<template><span hidden /></template>

<script setup lang="ts">
/**
 * Candy Exchange drawn on the game canvas with the page kit instead of CandyShopScreen:
 * trade salvaged sweets for credits or purchase tactical candies for subsequent expeditions.
 */
import { computed, ref } from 'vue';
import { MAX_CANDY_BAG, candyBagWorth, type CandyId } from '../../shared/candy.ts';
import type { ArtBook } from '../art/types.ts';
import type { PageItem, PageModel, PagePanel } from '../engine/page-ui.ts';
import type { HomeUi } from '../game/home-hud.ts';
import { candyTradeCatalog, type CandyTradeItem } from '../game/home/candy-shop.ts';
import { useCanvasPage } from './use-canvas-page.ts';
import { useGame } from './use-game.ts';

const { home, art } = defineProps<{ home: HomeUi; art?: ArtBook | null }>();
const game = useGame();

const activeTab = ref<'sell' | 'buy'>('sell');

const balance = computed(() => {
  const save = home.save;
  if (!save) return 0;
  return save.candy ?? save.silver ?? 0;
});

const playerBag = computed<readonly CandyId[]>(() => home.carried.candyList ?? []);
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

const TABS = [
  { id: 'sell', label: 'SELL CANDY' },
  { id: 'buy', label: 'BUY SWEETS' },
];

const model = computed<PageModel>(() => {
  const panels: PagePanel[] = [];

  panels.push({
    heading: 'CANDY EXCHANGE COUNTER',
    items: [
      {
        kind: 'choice',
        id: 'tab',
        label: 'TRADE MODE',
        options: TABS,
        value: activeTab.value,
      },
      {
        kind: 'stat',
        label: 'AVAILABLE CANDY BALANCE',
        value: `${balance.value} CANDY`,
      },
      {
        kind: 'stat',
        label: 'BAG CAPACITY',
        value: `${carriedCount.value} / ${MAX_CANDY_BAG} PIECES`,
      },
    ],
  });

  if (activeTab.value === 'sell') {
    const sellItems: PageItem[] = [];
    if (carriedCandies.value.length === 0) {
      sellItems.push({
        kind: 'text',
        text: 'YOUR CANDY BAG IS EMPTY. SCAVENGE HOUSES ON TOWN EXPEDITIONS.',
        tone: 'dim',
      });
    } else {
      sellItems.push({
        kind: 'link',
        id: 'sell_all',
        label: 'SELL ALL CARRIED CANDY',
        value: `+${totalBagWorth.value} CANDY`,
        sub: 'LIQUIDATE ALL CANDY IN YOUR BAG FOR IMMEDIATE CREDITS',
      });

      for (const item of carriedCandies.value) {
        const sprite = art?.ui?.candies?.[item.id];
        sellItems.push({
          kind: 'link',
          id: `sell:${item.id}`,
          label: `${item.name} (x${item.count})`,
          icon: sprite,
          value: `+${item.sellPrice} CANDY`,
          sub: `${item.stat}: ${item.blurb} [CLICK TO SELL 1]`,
        });
      }
    }

    panels.push({
      heading: 'CARRIED SWEETS IN BAG',
      items: sellItems,
    });
  } else {
    for (const group of catalog.value) {
      const buyItems: PageItem[] = group.items.map((item) => {
        const sprite = art?.ui?.candies?.[item.id];
        const isAffordable = balance.value >= item.buyPrice && carriedCount.value < MAX_CANDY_BAG;
        const carriedSuffix = item.count > 0 ? ` [BAG: ${item.count}]` : '';
        const isBagFull = carriedCount.value >= MAX_CANDY_BAG;
        const cannotPay = balance.value < item.buyPrice;
        let subNote = `${item.stat}: ${item.blurb} [CLICK TO BUY]`;
        if (isBagFull) subNote = 'BAG CAPACITY REACHED';
        else if (cannotPay) subNote = 'INSUFFICIENT CANDY';

        return {
          kind: 'link',
          id: `buy:${item.id}`,
          label: `${item.name}${carriedSuffix}`,
          icon: sprite,
          value: `${item.buyPrice} CANDY`,
          sub: subNote,
          disabled: !isAffordable,
        };
      });

      panels.push({
        heading: `${group.tierName.toUpperCase()} TACTICAL SWEETS`,
        items: buyItems,
      });
    }
  }

  return {
    heading: 'CANDY EXCHANGE',
    width: 420,
    panels,
    buttons: [{ id: 'close', label: 'CLOSE', enabled: true, primary: true }],
  };
});

function press(id: string): void {
  if (id === 'close') {
    game.home.closeStation();
    return;
  }
  if (id === 'sell_all') {
    game.home.sellAllCandy();
    return;
  }
  const isSell = id.startsWith('sell:');
  if (isSell) {
    const candyId = id.slice(5) as CandyId;
    game.home.sellCandy(candyId);
    return;
  }
  const isBuy = id.startsWith('buy:');
  if (isBuy) {
    const candyId = id.slice(4) as CandyId;
    game.home.buyCandy(candyId);
  }
}

function choose(id: string, option: string): void {
  if (id === 'tab') {
    activeTab.value = option as 'sell' | 'buy';
  }
}

useCanvasPage(model, { press, choose }, () => game.home.closeStation());
</script>
