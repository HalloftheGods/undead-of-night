<template><span hidden /></template>

<script setup lang="ts">
/**
 * The candy bag drawn on the game canvas with the page kit: every candy carried as a row with its picture, its count
 * and what it boosts, then what each one does. A click, a pad's A or its number eats one; Close, Esc or a pad's B
 * shuts the bag. In solo the run waits behind it; in co-op the town carries on.
 */
import { computed, onBeforeUnmount, onMounted } from 'vue';
import type { ArtBook } from '../art/types.ts';
import type { CandyId } from '../../shared/protocol.ts';
import { CANDY_SEC, MAX_CANDY_BAG } from '../../shared/candy.ts';
import type { PageItem, PageModel, PagePanel } from '../engine/page-ui.ts';
import type { CandyStack } from '../game/candy-bag.ts';
import type { HudState } from '../game/hud-state.ts';
import type { TransportKind } from '../network/transport.ts';
import { PAD } from '../game/input/gamepad-input.ts';
import { useCanvasPage } from './use-canvas-page.ts';
import { useGame } from './use-game.ts';
import { useKeyLabels } from './use-key-labels.ts';

const PICK_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const EAT = 'eat:';

const { hud, art, mode } = defineProps<{ hud: HudState; art: ArtBook; mode: TransportKind }>();

const game = useGame();
const keys = useKeyLabels();

/** The stat a candy boosts, and how long it has left or would last. */
function timing(stack: CandyStack): string {
  return stack.left > 0 ? `${stack.stat}, working: ${stack.left}s left` : `${stack.stat}, lasts ${CANDY_SEC}s`;
}

/** A candy's row: its number key (when keys are in charge), its picture, its name and how many are carried. */
function candyRow(stack: CandyStack, index: number): PageItem {
  const key = index < PICK_KEYS.length && !keys.readPadInCharge() ? `${PICK_KEYS[index]} ` : '';
  return { kind: 'link', id: `${EAT}${stack.id}`, label: `${key}${stack.name} x${stack.count}`, icon: art.ui.candies[stack.id] };
}

const howTo = computed(() => {
  const wait = mode === 'solo' ? 'Paused.' : 'The town does not wait.';
  if (keys.readPadInCharge()) return `${wait} Stick or D-pad to pick a candy, ${keys.readButtonName(PAD.a)} to eat it, ${keys.readButtonName(PAD.b)} to close.`;
  return `${wait} Click a candy or press its number to eat it. ${keys.readKeyLabel('KeyX') ?? 'X'} to close.`;
});

const panels = computed<readonly PagePanel[]>(() => {
  const note: PagePanel = { heading: 'How to', items: [{ kind: 'text', text: howTo.value, tone: 'dim' }] };
  if (hud.bag.length === 0) {
    return [{ heading: 'Empty', items: [{ kind: 'text', text: 'Search homes, and the candy bowls by every front door.', tone: 'bone' }] }, note];
  }
  const blurbs = hud.bag.map((stack): PageItem => ({ kind: 'text', text: `${stack.name} (${timing(stack)}): ${stack.blurb}`, tone: stack.left > 0 ? 'accent' : 'bone' }));
  return [{ heading: 'Candy', items: hud.bag.map(candyRow) }, { heading: 'What they do', items: blurbs }, note];
});

const model = computed<PageModel>(() => ({
  heading: `Candy Bag ${hud.candyCount}/${MAX_CANDY_BAG}`,
  panels: panels.value,
  buttons: [{ id: 'back', label: 'Close', enabled: true, primary: false }],
}));

function close(): void {
  game.toggleBag();
}

/** Only a survivor still standing eats; the bag stays open for one who is down. */
function eat(id: CandyId): void {
  const canEat = hud.status === 'alive';
  if (canEat) game.eatCandy(id);
}

useCanvasPage(model, { press: (id) => (id.startsWith(EAT) ? eat(id.slice(EAT.length) as CandyId) : close()) }, close);

/** 1 to 9 eat the candy on that row, so a hand need not leave the keys. */
function onKey(event: KeyboardEvent): void {
  const stack = hud.bag[PICK_KEYS.indexOf(event.key)];
  const isPick = stack !== undefined && !event.repeat;
  if (!isPick) return;
  event.preventDefault();
  game.playUi('click');
  eat(stack.id);
}

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>
