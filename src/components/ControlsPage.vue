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
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { ACTION_METADATA, formatKeyCode } from '../game/controls-prefs.ts';
import type { GameAction } from '../game/controls-prefs.ts';
import PixelButton from './PixelButton.vue';
import TitlePage from './TitlePage.vue';
import { padBindingLabel, useRemapping } from './use-remapping.ts';

const emit = defineEmits<{ close: [] }>();
const remap = useRemapping();
const { listening, keyBinds, padBinds } = remap;
const activeTab = remap.tab;
const listeningPrompt = remap.prompt;
const switchTab = remap.switchTab;
const cancelRemap = remap.cancel;
const resetCurrent = remap.reset;
const startRemap = remap.start;

const categories = computed(() => [
  { name: 'movement', label: 'Movement', actions: ACTION_METADATA.filter((a) => a.category === 'movement') },
  { name: 'combat', label: 'Combat & Weapons', actions: ACTION_METADATA.filter((a) => a.category === 'combat') },
  { name: 'items', label: 'Items & Interactions', actions: ACTION_METADATA.filter((a) => a.category === 'items') },
  { name: 'interface', label: 'Panels & Interface', actions: ACTION_METADATA.filter((a) => a.category === 'interface') },
]);

function keyDisplay(actionId: GameAction): string {
  const codes = keyBinds.value[actionId];
  return codes.length === 0 ? 'Unbound' : codes.map(formatKeyCode).join(' / ');
}

function padDisplay(actionId: GameAction): string {
  return padBindingLabel(actionId, padBinds.value[actionId]);
}

onMounted(remap.attach);
onBeforeUnmount(remap.detach);
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
