<template>
  <TitlePage heading="Controls" size="wide" @close="emit('close')">
    <div class="controls-page">
      <div class="controls-toolbar">
        <div class="controls-tabs" role="tablist">
          <button
            class="px-button controls-tab-btn"
            :class="{ 'is-active': activeTab === 'keys' }"
            role="tab"
            :aria-selected="activeTab === 'keys'"
            type="button"
            @click="switchTab('keys')"
          >
            Keyboard
          </button>
          <button
            class="px-button controls-tab-btn"
            :class="{ 'is-active': activeTab === 'pad' }"
            role="tab"
            :aria-selected="activeTab === 'pad'"
            type="button"
            @click="switchTab('pad')"
          >
            Controller
          </button>
        </div>
        <PixelButton @press="resetCurrent">Reset to Defaults</PixelButton>
      </div>

      <p v-if="listening" class="controls-listening-banner px-frame">
        {{ listeningPrompt }}
        <button class="controls-cancel-btn" type="button" @click="cancelRemap">Cancel</button>
      </p>

      <div class="controls-groups">
        <section
          v-for="cat in categories"
          :key="cat.name"
          class="controls-card px-frame"
          :aria-labelledby="`cat-${cat.name}`"
        >
          <h3 :id="`cat-${cat.name}`" class="controls-card-head">{{ cat.label }}</h3>
          <div class="controls-list">
            <div
              v-for="action in cat.actions"
              :key="action.id"
              class="controls-row"
              :class="{ 'is-active': listening?.action === action.id }"
            >
              <span class="controls-label">{{ action.label }}</span>
              <div class="controls-action-binds">
                <template v-if="activeTab === 'keys'">
                  <button
                    v-if="action.rebindableKeys"
                    class="px-button controls-bind-btn"
                    :class="{ 'is-listening': listening?.action === action.id }"
                    type="button"
                    @click="startRemap(action.id)"
                  >
                    {{ keyDisplay(action.id) }}
                  </button>
                  <span v-else class="controls-fixed-label">
                    {{ keyDisplay(action.id) }}
                  </span>
                </template>
                <template v-else>
                  <button
                    v-if="action.rebindablePad"
                    class="px-button controls-bind-btn"
                    :class="{ 'is-listening': listening?.action === action.id }"
                    type="button"
                    @click="startRemap(action.id)"
                  >
                    {{ padDisplay(action.id) }}
                  </button>
                  <span v-else class="controls-fixed-label">
                    {{ padDisplay(action.id) }}
                  </span>
                </template>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </TitlePage>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  ACTION_METADATA,
  formatKeyCode,
  loadKeyBindings,
  loadPadBindings,
  resetKeyBindings,
  resetPadBindings,
  saveKeyBindings,
  savePadBindings,
} from '../game/controls-prefs.ts';
import type { GameAction } from '../game/controls-prefs.ts';
import { padFamily, padLabel } from '../game/pad-glyphs.ts';
import { readPads } from '../game/gamepad-input.ts';
import PixelButton from './PixelButton.vue';
import TitlePage from './TitlePage.vue';

const emit = defineEmits<{ close: [] }>();

type DeviceTab = 'keys' | 'pad';
const activeTab = ref<DeviceTab>('keys');

const keyBinds = ref(loadKeyBindings());
const padBinds = ref(loadPadBindings());

interface ActiveListening {
  action: GameAction;
  tab: DeviceTab;
}
const listening = ref<ActiveListening | null>(null);

let padPollHandle: number | null = null;
const lastPadButtonStates = new Map<number, boolean>();

const categories = computed(() => {
  const groups: { name: string; label: string; actions: typeof ACTION_METADATA }[] = [
    { name: 'movement', label: 'Movement', actions: ACTION_METADATA.filter((a) => a.category === 'movement') },
    { name: 'combat', label: 'Combat & Weapons', actions: ACTION_METADATA.filter((a) => a.category === 'combat') },
    { name: 'items', label: 'Items & Interactions', actions: ACTION_METADATA.filter((a) => a.category === 'items') },
    { name: 'interface', label: 'Panels & Interface', actions: ACTION_METADATA.filter((a) => a.category === 'interface') },
  ];
  return groups;
});

const listeningPrompt = computed(() => {
  if (!listening.value) return '';
  const actionMeta = ACTION_METADATA.find((a) => a.id === listening.value?.action);
  const name = actionMeta ? actionMeta.label : '';
  return listening.value.tab === 'keys'
    ? `Press a new key for "${name}" (or Escape to cancel)...`
    : `Press a controller button for "${name}" (or click Cancel)...`;
});

function switchTab(tab: DeviceTab): void {
  cancelRemap();
  activeTab.value = tab;
}

function keyDisplay(actionId: GameAction): string {
  const codes = keyBinds.value[actionId];
  if (!codes || codes.length === 0) return 'Unbound';
  return codes.map(formatKeyCode).join(' / ');
}

function padDisplay(actionId: GameAction): string {
  const btn = padBinds.value[actionId];
  if (btn === null || btn === undefined) {
    if (actionId === 'moveUp' || actionId === 'moveDown' || actionId === 'moveLeft' || actionId === 'moveRight') {
      return 'Left Stick';
    }
    return 'None';
  }
  const pads = readPads();
  const family = padFamily(pads[0]?.id ?? null);
  return padLabel(family, btn);
}

function startRemap(actionId: GameAction): void {
  listening.value = { action: actionId, tab: activeTab.value };
}

function cancelRemap(): void {
  listening.value = null;
}

function resetCurrent(): void {
  cancelRemap();
  if (activeTab.value === 'keys') {
    keyBinds.value = resetKeyBindings();
  } else {
    padBinds.value = resetPadBindings();
  }
}

function onWindowKeyDown(event: KeyboardEvent): void {
  if (!listening.value || listening.value.tab !== 'keys') return;
  event.preventDefault();
  event.stopPropagation();

  if (event.code === 'Escape') {
    cancelRemap();
    return;
  }

  const { action } = listening.value;
  const newCode = event.code;
  const current = { ...keyBinds.value };

  // If another action has this single code, remove or swap
  for (const [otherAction, codes] of Object.entries(current)) {
    if (otherAction !== action && codes.includes(newCode)) {
      current[otherAction as GameAction] = codes.filter((c) => c !== newCode);
    }
  }

  current[action] = [newCode];
  keyBinds.value = current;
  saveKeyBindings(current);
  cancelRemap();
}

function pollPadForRemap(): void {
  if (listening.value && listening.value.tab === 'pad') {
    const pads = readPads();
    const pad = pads[0];
    if (pad) {
      for (let i = 0; i < pad.buttons.length; i++) {
        const isPressed = pad.buttons[i]?.pressed ?? false;
        const wasPressed = lastPadButtonStates.get(i) ?? false;
        lastPadButtonStates.set(i, isPressed);

        if (isPressed && !wasPressed) {
          // Button pressed
          const { action } = listening.value;
          const current = { ...padBinds.value };

          // Unbind duplicate if bound to another action
          for (const [otherAction, boundBtn] of Object.entries(current)) {
            if (otherAction !== action && boundBtn === i) {
              current[otherAction as GameAction] = null;
            }
          }

          current[action] = i;
          padBinds.value = current;
          savePadBindings(current);
          cancelRemap();
          break;
        }
      }
    }
  } else {
    lastPadButtonStates.clear();
  }

  padPollHandle = requestAnimationFrame(pollPadForRemap);
}

onMounted(() => {
  window.addEventListener('keydown', onWindowKeyDown, true);
  padPollHandle = requestAnimationFrame(pollPadForRemap);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeyDown, true);
  if (padPollHandle !== null) {
    cancelAnimationFrame(padPollHandle);
  }
});
</script>

<style scoped>
.controls-page {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 6);
  padding: calc(var(--u) * 1);
}

.controls-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--u) * 4);
  flex-wrap: wrap;
}

.controls-tabs {
  display: flex;
  gap: calc(var(--u) * 2);
}

.controls-tab-btn {
  padding: calc(var(--u) * 2) calc(var(--u) * 4);
  font-size: calc(var(--u) * 6);
  background: var(--ink-card);
  color: var(--bone-dim);
  border: var(--u) solid var(--ink-line);
}

.controls-tab-btn.is-active {
  background: var(--amber);
  color: var(--ink);
  border-color: var(--amber);
  font-weight: 700;
}

.controls-listening-banner {
  --edge: var(--amber);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--u) * 4);
  padding: calc(var(--u) * 3) calc(var(--u) * 5);
  background: rgba(245, 158, 11, 0.15);
  color: var(--amber);
  font-weight: 700;
  animation: px-fade-in 0.2s ease-out;
}

.controls-cancel-btn {
  padding: calc(var(--u) * 1) calc(var(--u) * 3);
  background: var(--ink);
  color: var(--bone);
  border: var(--u) solid var(--bone-dim);
  cursor: pointer;
  font-family: inherit;
  font-size: calc(var(--u) * 5);
}

.controls-groups {
  columns: 2 calc(var(--u) * 200);
  column-gap: calc(var(--u) * 6);
}

.controls-card {
  --edge: var(--ink-line);
  break-inside: avoid;
  margin-bottom: calc(var(--u) * 6);
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 3);
  min-width: 0;
  padding: calc(var(--u) * 4);
  background: rgba(23, 24, 31, 0.86);
}

.controls-card:focus-within {
  --edge: var(--bone-dim);
}

.controls-card-head {
  margin: calc(var(--u) * -4) calc(var(--u) * -4) 0;
  padding: calc(var(--u) * 2) calc(var(--u) * 4);
  border-bottom: var(--u) solid var(--amber);
  background: var(--ink);
  color: var(--amber);
  font-size: calc(var(--u) * 7);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.controls-list {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 2);
}

.controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(var(--u) * 1) 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.controls-row.is-active {
  background: rgba(245, 158, 11, 0.1);
}

.controls-label {
  color: var(--bone);
  font-size: calc(var(--u) * 5.5);
}

.controls-action-binds {
  display: flex;
  align-items: center;
}

.controls-bind-btn {
  min-width: calc(var(--u) * 40);
  padding: calc(var(--u) * 1.5) calc(var(--u) * 3);
  font-size: calc(var(--u) * 5);
  text-align: center;
  background: var(--ink);
  color: var(--amber);
  border: var(--u) solid var(--ink-line);
  cursor: pointer;
}

.controls-bind-btn:hover,
.controls-bind-btn:focus {
  border-color: var(--amber);
  color: var(--bone-bright);
}

.controls-bind-btn.is-listening {
  border-color: var(--amber);
  background: var(--amber);
  color: var(--ink);
  font-weight: 700;
  animation: pulse-border 1s infinite alternate;
}

.controls-fixed-label {
  color: var(--bone-dim);
  font-size: calc(var(--u) * 5);
  padding: calc(var(--u) * 1.5) 0;
}

@keyframes pulse-border {
  from {
    opacity: 0.7;
  }
  to {
    opacity: 1;
  }
}
</style>
