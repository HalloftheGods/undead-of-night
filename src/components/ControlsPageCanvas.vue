<template></template>

<script setup lang="ts">
/**
 * Controls drawn on the game canvas with the page kit instead of ControlsPage (the "In-game menus" switch): the same
 * bindings and the same remapping, a keyboard or controller tab, and a row per action that listens for its new key.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { PageItem, PageModel, PagePanel } from '../engine/page-ui.ts';
import { ACTION_METADATA, formatKeyCode } from '../game/controls-prefs.ts';
import type { ActionMetadata } from '../game/controls-prefs.ts';
import { padBindingLabel, useRemapping } from './use-remapping.ts';
import { useCanvasPage } from './use-canvas-page.ts';

const emit = defineEmits<{ close: [] }>();
const remap = useRemapping();

const GROUPS = [
  { category: 'movement', label: 'Movement' },
  { category: 'combat', label: 'Combat & Weapons' },
  { category: 'items', label: 'Items & Interactions' },
  { category: 'interface', label: 'Panels & Interface' },
] as const;
const DEVICES = [{ id: 'keys', label: 'Keyboard' }, { id: 'pad', label: 'Controller' }];

function valueOf(action: ActionMetadata): string {
  if (remap.tab.value === 'keys') {
    const codes = remap.keyBinds.value[action.id];
    return codes.length === 0 ? 'Unbound' : codes.map(formatKeyCode).join(' / ');
  }
  return padBindingLabel(action.id, remap.padBinds.value[action.id]);
}

function rowFor(action: ActionMetadata): PageItem {
  const rebindable = remap.tab.value === 'keys' ? action.rebindableKeys : action.rebindablePad;
  const value = valueOf(action);
  if (!rebindable) return { kind: 'stat', label: action.label, value };
  return { kind: 'bind', id: action.id, label: action.label, value, listening: remap.listening.value?.action === action.id };
}

const panels = computed<readonly PagePanel[]>(() => {
  const listening = remap.listening.value;
  const prompt = listening ? [{ kind: 'text', text: remap.prompt.value, tone: 'accent' } as const] : [];
  return [
    {
      heading: 'Device',
      items: [
        { kind: 'choice', id: 'device', label: 'Bindings for', options: DEVICES, value: remap.tab.value },
        ...prompt,
        { kind: 'link', id: 'reset', label: 'Reset to defaults' },
      ],
    },
    ...GROUPS.map((group) => ({
      heading: group.label,
      items: ACTION_METADATA.filter((action) => action.category === group.category).map(rowFor),
    })),
  ];
});

const model = computed<PageModel>(() => ({
  heading: 'Controls',
  panels: panels.value,
  buttons: [{ id: 'back', label: 'Back', enabled: true, primary: false }],
}));

function press(id: string): void {
  if (id === 'back') emit('close');
  else if (id === 'reset') remap.reset();
  else remap.start(id as ActionMetadata['id']);
}

function choose(id: string, option: string): void {
  if (id === 'device') remap.switchTab(option === 'pad' ? 'pad' : 'keys');
}

// While a row listens, the next key is the new binding: the remapper's own handler takes it, and the page keeps out.
useCanvasPage(model, { press, choose, inert: () => remap.listening.value !== null }, () => emit('close'));
onMounted(remap.attach);
onBeforeUnmount(remap.detach);
</script>
