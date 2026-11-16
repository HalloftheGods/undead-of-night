<template><span hidden /></template>

<script setup lang="ts">
/**
 * Merchant station drawn on the game canvas with the page kit instead of MerchantScreen:
 * live stock shelf, bounty/quest work contracts, dialogue greeting, and silver balance.
 */
import { computed, ref, watch } from 'vue';
import type { ArtBook } from '../art/types.ts';
import type { PageItem, PageModel, PagePanel } from '../engine/page-ui.ts';
import type { HomeUi } from '../game/home-hud.ts';
import { merchantView } from '../game/home/merchant-view.ts';
import { pressPrimary, startTab, type StallTab } from '../game/home/quest-screen.ts';
import { questPanels } from '../game/home/quest-view.ts';
import { itemSprite } from '../game/home/shop-item-art.ts';
import { useCanvasPage } from './use-canvas-page.ts';
import { useGame } from './use-game.ts';

const { home, art } = defineProps<{ home: HomeUi; art: ArtBook }>();
const game = useGame();

const merchantId = computed(() => home.shop);
const open = computed(() => (merchantId.value ? { merchant: merchantId.value, view: merchantView(home, merchantId.value) } : null));
const panelsList = computed(() => (open.value ? questPanels(home, open.value.merchant) : []));

const tab = ref<StallTab>('shelf');
watch(
  () => home.shop,
  () => {
    tab.value = startTab(panelsList.value);
  },
  { immediate: true }
);

const TABS = [
  { id: 'shelf', label: 'SHELF (BUY)' },
  { id: 'work', label: 'WORK (CONTRACTS)' },
];

const model = computed<PageModel>(() => {
  const current = open.value;
  if (!current) {
    return {
      heading: 'MERCHANT',
      width: 420,
      panels: [],
      buttons: [{ id: 'close', label: 'CLOSE', enabled: true, primary: true }],
    };
  }

  const { merchant, view } = current;
  const isStalled = view.stall.kind !== 'closed' && view.stall.kind !== 'unmet';
  const hasNotice = Boolean(view.notice);
  const panels: PagePanel[] = [];

  const stallItems: PageItem[] = [];
  if (isStalled) {
    stallItems.push({
      kind: 'choice',
      id: 'tab',
      label: 'STALL SECTION',
      options: TABS,
      value: tab.value,
    });
  }
  if (hasNotice) {
    stallItems.push({
      kind: 'text',
      text: view.notice ?? '',
      tone: 'accent',
    });
  }
  if (view.greeting) {
    stallItems.push({
      kind: 'text',
      text: `"${view.greeting}"`,
      tone: 'bone',
    });
  }
  stallItems.push({
    kind: 'stat',
    label: 'AVAILABLE SILVER',
    value: `${view.silver} COINS`,
  });

  panels.push({
    heading: 'STALL INFO',
    items: stallItems,
  });

  if (isStalled && tab.value === 'shelf') {
    const shelfItems: PageItem[] = view.lines.map((line) => {
      const sprite = itemSprite(art.ui, line.grant);
      const subText = line.canBuy ? 'IN STOCK: CLICK TO PURCHASE' : (line.refusal ?? 'CANNOT PURCHASE');
      return {
        kind: 'link',
        id: `buy:${line.item}`,
        label: line.label,
        icon: sprite,
        value: `${line.price} SILVER`,
        sub: subText,
        disabled: !line.canBuy,
      };
    });

    panels.push({
      heading: 'MERCHANDISE FOR SALE',
      items: shelfItems,
    });
  } else if (isStalled && tab.value === 'work') {
    const workItems: PageItem[] = [];
    if (panelsList.value.length === 0) {
      workItems.push({
        kind: 'text',
        text: 'NO OPEN CONTRACTS AT THIS TIME.',
        tone: 'dim',
      });
    } else {
      for (const panel of panelsList.value) {
        const rewardText = panel.rewards.map((r) => r.label).join(' + ');
        const barTexts = panel.bars.map((b) => (b.label ? `${b.label}: ${b.value}` : b.value)).join(', ');
        const sub = `${panel.brief} (${barTexts})`;
        const isTurnIn = panel.action === 'turn_in';
        const isAccept = panel.action === 'accept';
        let actionLabel = 'IN PROGRESS';
        if (isTurnIn) actionLabel = 'CLAIM REWARD';
        else if (isAccept) actionLabel = 'ACCEPT CONTRACT';
        workItems.push({
          kind: 'link',
          id: `quest:${panel.id}`,
          label: `${panel.title} [${actionLabel}]`,
          value: rewardText,
          sub,
          disabled: !panel.canAct,
        });
      }
    }

    panels.push({
      heading: 'CONTRACTS & BOUNTIES',
      items: workItems,
    });
  }

  return {
    heading: `${view.name} - ${view.role}`,
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
  const isBuy = id.startsWith('buy:');
  if (isBuy && open.value) {
    const itemKey = id.slice(4);
    game.home.buy(open.value.merchant, itemKey);
    return;
  }
  const isQuest = id.startsWith('quest:');
  if (isQuest && open.value) {
    const questId = id.slice(6);
    const target = panelsList.value.find((p) => p.id === questId);
    if (target) {
      pressPrimary(target, open.value.merchant, game.home);
    }
  }
}

function choose(id: string, option: string): void {
  if (id === 'tab') {
    tab.value = option as StallTab;
  }
}

useCanvasPage(model, { press, choose }, () => game.home.closeStation());
</script>
