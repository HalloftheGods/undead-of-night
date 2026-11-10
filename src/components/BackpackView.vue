<template>
  <div class="backpack-backdrop" role="dialog" aria-modal="true" aria-labelledby="backpack-title">
    <div class="backpack-modal">
      <header class="backpack-header">
        <div class="backpack-title-row">
          <h2 id="backpack-title" class="backpack-title">{{ currentDef.label }}</h2>
          <button type="button" class="backpack-close-btn" @click="emit('close')">
            [ESC] CLOSE
          </button>
        </div>
        <p class="backpack-desc">{{ currentDef.description }}</p>
      </header>

      <div class="backpack-body">
        <!-- Capacity Metrics Overview -->
        <section class="backpack-section">
          <h3 class="section-title">PACK CAPACITY LIMITS</h3>
          <div class="metrics-grid">
            <div class="metric-card">
              <span class="metric-label">AMMO RESERVE</span>
              <span class="metric-val">+{{ Math.round((currentDef.ammoMultiplier - 1) * 100) }}%</span>
            </div>
            <div class="metric-card">
              <span class="metric-label">MEDKITS</span>
              <span class="metric-val">{{ hud.medkits }} / {{ currentDef.medkitMax }}</span>
            </div>
            <div class="metric-card">
              <span class="metric-label">BOTTLES</span>
              <span class="metric-val">{{ hud.bottles }} / {{ currentDef.bottleMax }}</span>
            </div>
            <div class="metric-card">
              <span class="metric-label">THROWABLES</span>
              <span class="metric-val">{{ throwableCount }} / {{ currentDef.throwableMax }}</span>
            </div>
          </div>
        </section>

        <!-- Ammo Reserves Grid -->
        <section class="backpack-section">
          <h3 class="section-title">AMMUNITION RESERVES</h3>
          <div class="ammo-rows">
            <div v-for="ammoRow in ammoList" :key="ammoRow.weapon" class="ammo-row">
              <span class="ammo-weapon-name">{{ ammoRow.label }}</span>
              <div class="ammo-meter-track">
                <div class="ammo-meter-fill" :style="{ '--fill-pct': `${ammoRow.percent}%` }" />
              </div>
              <span class="ammo-count">{{ ammoRow.current }} / {{ ammoRow.max }}</span>
            </div>
          </div>
        </section>

        <!-- Survival Supplies -->
        <section class="backpack-section">
          <h3 class="section-title">SURVIVAL SUPPLIES</h3>
          <div class="supplies-grid">
            <div class="supply-card" :class="{ 'is-empty': hud.medkits === 0 }">
              <span class="supply-name">FIRST AID KITS</span>
              <span class="supply-val">{{ hud.medkits }}</span>
            </div>
            <div class="supply-card" :class="{ 'is-empty': hud.bottles === 0 }">
              <span class="supply-name">THROWABLE BOTTLES</span>
              <span class="supply-val">{{ hud.bottles }}</span>
            </div>
            <div class="supply-card" :class="{ 'is-empty': !hud.knife }">
              <span class="supply-name">COMBAT KNIFE</span>
              <span class="supply-val">{{ hud.knife ? 'EQUIPPED' : 'NONE' }}</span>
            </div>
            <div class="supply-card" :class="{ 'is-empty': throwableCount === 0 }">
              <span class="supply-name">FIREWORKS / FLARES</span>
              <span class="supply-val">{{ throwableCount }}</span>
            </div>
          </div>
        </section>

        <!-- Upgrades & Parts -->
        <section v-if="hud.gear" class="backpack-section">
          <h3 class="section-title">WEAPON PARTS & UPGRADE KITS</h3>
          <div class="supplies-grid">
            <div v-for="[partName, count] in Object.entries(hud.gear.parts)" :key="partName" class="supply-card" :class="{ 'is-empty': count === 0 }">
              <span class="supply-name">{{ partName.toUpperCase() }}</span>
              <span class="supply-val">x{{ count }}</span>
            </div>
          </div>
        </section>
      </div>

      <footer class="backpack-footer">
        <span class="backpack-hint">Khronus Tactical Pack: Search military lockers and supply drops for Tier II and Tier III upgrades.</span>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { HudState } from '../game/hud-state.ts';
import { backpackDef, reserveCapForTier, type BackpackTier } from '../../shared/backpack.ts';
import type { WeaponId } from '../../shared/protocol.ts';

export interface BackpackViewProps {
  hud: HudState;
  tier?: BackpackTier;
}

const props = withDefaults(defineProps<BackpackViewProps>(), {
  tier: 'satchel',
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const currentDef = computed(() => backpackDef(props.tier));

const throwableCount = computed(() => props.hud.fireworks + props.hud.fountains);

interface AmmoRowView {
  weapon: WeaponId;
  label: string;
  current: number;
  max: number;
  percent: number;
}

const WEAPONS_DISPLAY: { id: WeaponId; label: string }[] = [
  { id: 'pistol', label: '9MM PISTOL' },
  { id: 'shotgun', label: '12-GAUGE SHELLS' },
  { id: 'carbine', label: '5.56 CARBINE' },
];

const ammoList = computed<AmmoRowView[]>(() => {
  return WEAPONS_DISPLAY.map(({ id, label }) => {
    const current = props.hud.ammoBag[id] ?? 0;
    const max = reserveCapForTier(id, props.tier);
    const safeMax = Math.max(1, max);
    const percent = Math.min(100, Math.round((current / safeMax) * 100));
    return {
      weapon: id,
      label,
      current,
      max,
      percent,
    };
  });
});
</script>

<style scoped>
.backpack-backdrop {
  position: fixed;
  inset: 0;
  z-index: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(13, 11, 22, 0.85);
  backdrop-filter: blur(4px);
  padding: calc(var(--u) * 4);
}

.backpack-modal {
  width: 100%;
  max-width: calc(var(--u) * 130);
  background: #1b1728;
  border: calc(var(--u) * 0.75) solid #a89a80;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 3);
  padding: calc(var(--u) * 4);
  image-rendering: pixelated;
  color: #faf2d4;
  font-family: inherit;
}

.backpack-header {
  border-bottom: calc(var(--u) * 0.5) solid #484e68;
  padding-bottom: calc(var(--u) * 2);
}

.backpack-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.backpack-title {
  margin: 0;
  font-size: calc(var(--u) * 4);
  color: #ffc03c;
  letter-spacing: 1px;
}

.backpack-desc {
  margin: calc(var(--u) * 1) 0 0;
  font-size: calc(var(--u) * 2.5);
  color: #a89a80;
}

.backpack-close-btn {
  background: transparent;
  border: calc(var(--u) * 0.25) solid #ffc03c;
  color: #ffc03c;
  padding: calc(var(--u) * 1) calc(var(--u) * 2);
  cursor: pointer;
  font-family: inherit;
  font-size: calc(var(--u) * 2);
  font-weight: 700;
}

.backpack-close-btn:hover {
  background: #ffc03c;
  color: #0d0b16;
}

.backpack-body {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 3);
  max-height: 70vh;
  overflow-y: auto;
}

.backpack-section {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 1.5);
}

.section-title {
  margin: 0;
  font-size: calc(var(--u) * 2.5);
  color: #6488bc;
  letter-spacing: 0.5px;
}

.metrics-grid,
.supplies-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(calc(var(--u) * 26), 1fr));
  gap: calc(var(--u) * 2);
}

.metric-card,
.supply-card {
  background: #242840;
  border: calc(var(--u) * 0.25) solid #484e68;
  padding: calc(var(--u) * 1.5);
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.5);
}

.metric-card.is-empty,
.supply-card.is-empty {
  opacity: 0.45;
}

.metric-label,
.supply-name {
  font-size: calc(var(--u) * 1.75);
  color: #a89a80;
}

.metric-val,
.supply-val {
  font-size: calc(var(--u) * 3);
  font-weight: 700;
  color: #faf2d4;
}

.ammo-rows {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 1.5);
}

.ammo-row {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 2);
  background: #242840;
  padding: calc(var(--u) * 1) calc(var(--u) * 2);
  border: calc(var(--u) * 0.25) solid #484e68;
}

.ammo-weapon-name {
  width: calc(var(--u) * 30);
  font-size: calc(var(--u) * 2);
  font-weight: 700;
  color: #ffc03c;
}

.ammo-meter-track {
  flex: 1;
  height: calc(var(--u) * 2);
  background: #0d0b16;
  border: calc(var(--u) * 0.25) solid #484e68;
  position: relative;
  overflow: hidden;
}

.ammo-meter-fill {
  height: 100%;
  width: var(--fill-pct, 0%);
  background: #ffc03c;
  transition: width 0.2s ease-out;
}

.ammo-count {
  width: calc(var(--u) * 18);
  text-align: right;
  font-size: calc(var(--u) * 2);
  font-weight: 700;
}

.backpack-footer {
  border-top: calc(var(--u) * 0.25) solid #484e68;
  padding-top: calc(var(--u) * 1.5);
}

.backpack-hint {
  font-size: calc(var(--u) * 1.75);
  color: #a89a80;
}
</style>
