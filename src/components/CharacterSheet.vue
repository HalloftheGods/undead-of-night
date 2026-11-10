<template>
  <div class="character-sheet-overlay" @keydown.esc="emit('close')">
    <div class="character-sheet-card">
      <header class="sheet-header">
        <div class="header-titles">
          <h2 class="sheet-title">CHARACTER SHEET</h2>
          <span class="survivor-name">{{ characterName }}</span>
        </div>
        <div class="currency-chips">
          <span class="chip chip-level">LVL {{ progression.level }}</span>
          <span class="chip chip-ap" :class="{ 'has-ap': progression.ap > 0 }">
            {{ progression.ap }} AP AVAILABLE
          </span>
          <span class="chip chip-gp">{{ progression.gp }} GP</span>
        </div>
      </header>

      <section class="xp-section">
        <div class="xp-labels">
          <span class="xp-title">EXPERIENCE</span>
          <span class="xp-numbers">{{ progression.xp }} / {{ nextLevelXp }} XP</span>
        </div>
        <div class="xp-bar-track">
          <div class="xp-bar-fill" :style="{ '--fill-width': `${xpRatio * 100}%` }" />
        </div>
      </section>

      <section class="stats-section">
        <h3 class="section-title">ABILITY ATTRIBUTES</h3>
        <div class="stat-rows">
          <div v-for="stat in statRows" :key="stat.key" class="stat-row">
            <div class="stat-info">
              <span class="stat-label">{{ stat.label }}</span>
              <span v-if="stat.isSpecialty" class="specialty-badge">SPECIALTY</span>
            </div>
            <div class="stat-pips-cluster">
              <div class="pips-track">
                <span
                  v-for="pipIndex in MAX_STAT_SLOT"
                  :key="pipIndex"
                  class="stat-pip"
                  :class="{
                    'is-base': pipIndex <= stat.baseSlot,
                    'is-invested': pipIndex > stat.baseSlot && pipIndex <= stat.currentSlot,
                  }"
                />
              </div>
              <button
                v-if="stat.canUpgrade"
                class="upgrade-btn"
                type="button"
                :title="`Upgrade ${stat.label}`"
                @click="emit('allocate', stat.key)"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="proficiencies-section">
        <h3 class="section-title">ACTION PROFICIENCIES</h3>
        <div class="proficiency-grid">
          <div v-for="prof in proficiencyRows" :key="prof.key" class="proficiency-item">
            <div class="prof-header">
              <span class="prof-name">{{ prof.label }}</span>
              <span class="prof-rank">RANK {{ prof.rank }} / 5</span>
            </div>
            <div class="prof-track">
              <div class="prof-fill" :style="{ '--fill-width': `${prof.ratio * 100}%` }" />
            </div>
            <span class="prof-count">{{ prof.current }} / {{ prof.next }} Actions</span>
          </div>
        </div>
      </section>

      <footer class="sheet-footer">
        <button
          class="respec-btn"
          type="button"
          :disabled="!canRespec"
          @click="emit('respec')"
        >
          RESET STATS (50 GP)
        </button>
        <button class="close-btn" type="button" @click="emit('close')">
          RETURN TO SURVIVAL
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  MAX_STAT_SLOT,
  SPECIALTY_STAT_BY_SKIN,
  baseStatSlotFor,
  canAllocateStat,
  canRespecCharacter,
  effectiveStatSlots,
  xpRequiredForLevel,
  type ProgressionState,
} from '../../shared/progression.ts';
import { STATS, type StatKey } from '../../shared/character-stats.ts';
import {
  progressToNextRank,
  rankForSkill,
  type ActionSkillKey,
  type ActionSkillState,
} from '../../shared/action-skills.ts';

export interface CharacterSheetProps {
  skin: number;
  characterName: string;
  progression: ProgressionState;
  skills: ActionSkillState;
}

export type CharacterSheetAction = 'respec' | 'close';

const props = defineProps<CharacterSheetProps>();

const emit = defineEmits<{
  (e: 'allocate', stat: StatKey): void;
  (e: 'respec'): void;
  (e: 'close'): void;
}>();

const nextLevelXp = computed(() => xpRequiredForLevel(props.progression.level + 1));
const xpRatio = computed(() => {
  const req = nextLevelXp.value;
  const isZeroReq = req <= 0;
  if (isZeroReq) return 1.0;
  return Math.min(1.0, props.progression.xp / req);
});

const canRespec = computed(() => canRespecCharacter(props.skin, props.progression));

export interface StatRowView {
  key: StatKey;
  label: string;
  baseSlot: number;
  currentSlot: number;
  isSpecialty: boolean;
  canUpgrade: boolean;
}

const statRows = computed<StatRowView[]>(() => {
  const allocation = props.progression.allocations[props.skin];
  const slots = effectiveStatSlots(props.skin, allocation);
  const specialtyKey = SPECIALTY_STAT_BY_SKIN[props.skin];

  return STATS.map(({ key, label }) => {
    const baseSlot = baseStatSlotFor(props.skin, key);
    const currentSlot = slots[key] ?? baseSlot;
    const isSpecialty = key === specialtyKey;
    const canUpgrade = canAllocateStat(props.skin, key, props.progression);

    return { key, label, baseSlot, currentSlot, isSpecialty, canUpgrade };
  });
});

export interface ProficiencyRow {
  key: ActionSkillKey;
  label: string;
  rank: number;
  current: number;
  next: number;
  ratio: number;
}

const PROFICIENCY_CONFIG: readonly { readonly key: ActionSkillKey; readonly label: string }[] = [
  { key: 'marksmanship', label: 'Marksmanship (Accuracy)' },
  { key: 'reloading', label: 'Reload Speed' },
  { key: 'endurance', label: 'Endurance (Stamina)' },
  { key: 'scavenging', label: 'Scavenging (Speed)' },
  { key: 'strength', label: 'Melee Knockback' },
];

const proficiencyRows = computed<ProficiencyRow[]>(() => {
  return PROFICIENCY_CONFIG.map(({ key, label }) => {
    const count = props.skills.counts[key] ?? 0;
    const rank = rankForSkill(key, count);
    const { current, next, ratio } = progressToNextRank(key, count);
    return { key, label, rank, current, next, ratio };
  });
});
</script>

<style scoped>
.character-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(13, 11, 22, 0.85);
  backdrop-filter: blur(4px);
  padding: calc(var(--u) * 4);
  box-sizing: border-box;
}

.character-sheet-card {
  width: 100%;
  max-width: 680px;
  background: var(--ink-deep, #15171f);
  border: 2px solid var(--metal-base, #484e68);
  box-shadow: 0 0 24px rgba(0, 0, 0, 0.8);
  padding: calc(var(--u) * 4);
  color: var(--bone-bright, #faf2d4);
  font-family: 'Silkscreen', monospace;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 3);
}

.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid var(--metal-soft, #242840);
  padding-bottom: calc(var(--u) * 2);
}

.sheet-title {
  font-size: calc(var(--u) * 5);
  margin: 0;
  color: var(--fire-bright, #ffc03c);
  letter-spacing: 1px;
}

.survivor-name {
  font-size: calc(var(--u) * 3.5);
  color: var(--bone-dim, #a89a80);
}

.currency-chips {
  display: flex;
  gap: calc(var(--u) * 2);
}

.chip {
  padding: calc(var(--u) * 1) calc(var(--u) * 2);
  border: 1px solid var(--metal-base, #484e68);
  font-size: calc(var(--u) * 3);
  background: var(--ink, #0d0b16);
}

.chip-ap.has-ap {
  border-color: var(--fire-bright, #ffc03c);
  color: var(--fire-bright, #ffc03c);
}

.chip-gp {
  color: var(--teal-bright, #58d0a8);
}

.section-title {
  margin: 0 0 calc(var(--u) * 1.5);
  font-size: calc(var(--u) * 3.5);
  color: var(--bone-mid, #dccca0);
  border-bottom: 1px solid var(--metal-soft, #242840);
  padding-bottom: calc(var(--u) * 0.5);
}

.xp-labels {
  display: flex;
  justify-content: space-between;
  font-size: calc(var(--u) * 2.8);
  margin-bottom: calc(var(--u) * 1);
  color: var(--bone-dim, #a89a80);
}

.xp-bar-track, .prof-track {
  height: 8px;
  background: var(--ink, #0d0b16);
  border: 1px solid var(--metal-soft, #242840);
  overflow: hidden;
}

.xp-bar-fill, .prof-fill {
  height: 100%;
  width: var(--fill-width, 0%);
}

.xp-bar-fill {
  background: var(--fire-bright, #ffc03c);
}

.prof-fill {
  background: var(--teal-bright, #58d0a8);
}

.stat-rows {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 1.5);
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(36, 40, 64, 0.4);
  padding: calc(var(--u) * 1.5) calc(var(--u) * 2);
}

.stat-info {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 2);
}

.stat-label {
  font-size: calc(var(--u) * 3.2);
}

.specialty-badge {
  font-size: calc(var(--u) * 2.2);
  padding: 1px 4px;
  background: var(--fire-dark, #a03018);
  color: var(--bone-bright, #faf2d4);
}

.stat-pips-cluster {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 2);
}

.pips-track {
  display: flex;
  gap: calc(var(--u) * 1);
}

.stat-pip {
  width: 14px;
  height: 14px;
  background: var(--ink, #0d0b16);
  border: 1px solid var(--metal-base, #484e68);
}

.stat-pip.is-base {
  background: var(--bone-mid, #dccca0);
  border-color: var(--bone-bright, #faf2d4);
}

.stat-pip.is-invested {
  background: var(--fire-bright, #ffc03c);
  border-color: var(--fire-light, #fff0b4);
}

.upgrade-btn {
  width: 22px;
  height: 22px;
  background: var(--fire-bright, #ffc03c);
  border: 1px solid var(--fire-light, #fff0b4);
  color: var(--ink, #0d0b16);
  font-family: monospace;
  font-weight: bold;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.proficiency-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: calc(var(--u) * 2);
}

.proficiency-item {
  background: rgba(36, 40, 64, 0.3);
  padding: calc(var(--u) * 1.5);
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 0.8);
}

.prof-header {
  display: flex;
  justify-content: space-between;
  font-size: calc(var(--u) * 2.5);
  color: var(--bone-dim, #a89a80);
}

.prof-count {
  font-size: calc(var(--u) * 2.2);
  color: var(--bone-dim, #a89a80);
  text-align: right;
}

.sheet-footer {
  display: flex;
  justify-content: space-between;
  margin-top: calc(var(--u) * 2);
  padding-top: calc(var(--u) * 2);
  border-top: 1px solid var(--metal-soft, #242840);
}

.respec-btn, .close-btn {
  padding: calc(var(--u) * 1.5) calc(var(--u) * 3);
  font-family: 'Silkscreen', monospace;
  font-size: calc(var(--u) * 2.8);
  border: 1px solid var(--metal-base, #484e68);
  background: var(--ink, #0d0b16);
  color: var(--bone-bright, #faf2d4);
  cursor: pointer;
}

.respec-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.close-btn {
  background: var(--metal-soft, #242840);
}

.close-btn:hover {
  background: var(--metal-base, #484e68);
}
</style>
