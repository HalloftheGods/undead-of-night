<template>
  <div class="sandbox-setup">
    <header class="sandbox-header">
      <h3 class="sandbox-title">CUSTOM SANDBOX RULES</h3>
      <p class="sandbox-subtitle">Tune infection parameters, zombie agility, and scavenging rates.</p>
    </header>

    <div class="preset-row">
      <p class="px-label">PRESET TEMPLATES</p>
      <div class="preset-buttons">
        <PixelButton
          v-for="preset in SANDBOX_PRESETS"
          :key="preset.id"
          :primary="activePresetId === preset.id"
          @press="selectPreset(preset)"
        >
          {{ preset.name }}
        </PixelButton>
      </div>
    </div>

    <div class="options-grid">
      <OptionChoice
        label="ZOMBIE SPEED"
        :options="SPEED_OPTIONS"
        :value="settings.zombieSpeed"
        @change="(v) => updateSetting('zombieSpeed', v)"
      />

      <OptionChoice
        label="ZOMBIE SIGHT CONE"
        :options="SENSE_OPTIONS"
        :value="settings.zombieSight"
        @change="(v) => updateSetting('zombieSight', v)"
      />

      <OptionChoice
        label="ZOMBIE HEARING REACH"
        :options="SENSE_OPTIONS"
        :value="settings.zombieHearing"
        @change="(v) => updateSetting('zombieHearing', v)"
      />

      <OptionChoice
        label="LOOT AVAILABILITY"
        :options="LOOT_OPTIONS"
        :value="settings.lootScarcity"
        @change="(v) => updateSetting('lootScarcity', v)"
      />

      <OptionChoice
        label="HORDE INTERVALS"
        :options="HORDE_OPTIONS"
        :value="settings.hordeFrequency"
        @change="(v) => updateSetting('hordeFrequency', v)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import PixelButton from './PixelButton.vue';
import OptionChoice from './OptionChoice.vue';
import {
  SANDBOX_PRESETS,
  type HordeFrequencyOption,
  type LootScarcityOption,
  type SandboxPreset,
  type SandboxSettings,
  type SensesOption,
  type ZombieSpeedOption,
} from '../../shared/sandbox.ts';

const props = defineProps<{ modelValue: SandboxSettings }>();
const emit = defineEmits<{ (e: 'update:modelValue', val: SandboxSettings): void }>();

const activePresetId = ref<string>('default');
const settings = ref<SandboxSettings>({ ...props.modelValue });

const SPEED_OPTIONS: readonly { id: ZombieSpeedOption; label: string }[] = [
  { id: 'shambler', label: 'Shamblers' },
  { id: 'walker', label: 'Walkers' },
  { id: 'sprinter', label: 'Sprinters' },
];

const SENSE_OPTIONS: readonly { id: SensesOption; label: string }[] = [
  { id: 'impaired', label: 'Impaired' },
  { id: 'normal', label: 'Normal' },
  { id: 'heightened', label: 'Heightened' },
];

const LOOT_OPTIONS: readonly { id: LootScarcityOption; label: string }[] = [
  { id: 'abundant', label: 'Abundant' },
  { id: 'normal', label: 'Normal' },
  { id: 'scarce', label: 'Scarce' },
  { id: 'barren', label: 'Barren' },
];

const HORDE_OPTIONS: readonly { id: HordeFrequencyOption; label: string }[] = [
  { id: 'relaxed', label: 'Relaxed' },
  { id: 'normal', label: 'Normal' },
  { id: 'relentless', label: 'Relentless' },
];

function selectPreset(preset: SandboxPreset): void {
  activePresetId.value = preset.id;
  settings.value = { ...preset.settings };
  emit('update:modelValue', settings.value);
}

function updateSetting<K extends keyof SandboxSettings>(key: K, value: SandboxSettings[K]): void {
  activePresetId.value = 'custom';
  settings.value = { ...settings.value, [key]: value };
  emit('update:modelValue', settings.value);
}
</script>

<style scoped>
.sandbox-setup {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 3);
  font-family: 'Silkscreen', monospace;
  color: var(--bone-bright, #faf2d4);
}

.sandbox-header {
  border-bottom: 2px solid var(--metal-soft, #242840);
  padding-bottom: calc(var(--u) * 2);
}

.sandbox-title {
  font-size: calc(var(--u) * 4);
  color: var(--fire-bright, #ffc03c);
  margin: 0 0 calc(var(--u) * 1);
}

.sandbox-subtitle {
  font-size: calc(var(--u) * 2.8);
  color: var(--bone-dim, #a89a80);
  margin: 0;
}

.preset-row {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 1.5);
}

.preset-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--u) * 2);
}

.options-grid {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 2.5);
}

.px-label {
  color: var(--bone-dim, #a89a80);
  font-size: calc(var(--u) * 2.6);
  margin: 0;
}
</style>
