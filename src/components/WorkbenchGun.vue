<template>
  <ul class="bench-work" :aria-label="`Upgrades for ${WEAPONS[weapon].label}`">
    <WorkbenchTile
      v-for="row in rows"
      :key="row.upgrade"
      :sprites="row.cost.map((part) => art.ui.pickupIcons[part])"
      :label="row.label"
      :aria="`Fit ${row.label}, rank ${row.rank} of ${row.maxRank}, takes ${row.cost.map((part) => PART_LABELS[part]).join(' and ')}`"
      :pips="{ on: row.rank, of: row.maxRank }"
      :sub="row.blocked ?? row.costText"
      :tone="row.blocked ? (row.rank >= row.maxRank ? 'done' : 'blocked') : 'cost'"
      :disabled="!row.fittable"
      :fitted="row.rank > 0"
      :moves="row.moves"
      :weapon-icons="art.ui.weaponIcons"
      @fit="install(row.upgrade)"
      @move="(to) => move(row.upgrade, to)"
      @peek="emit('peek', row)"
      @unpeek="emit('peek', null)"
    />
  </ul>
  <WorkbenchTactileFit
    v-if="tactileUpgrade"
    :weapon
    :upgrade="tactileUpgrade"
    :art
    @fit="onTactileFit"
    @cancel="onTactileCancel"
  />
</template>

<script setup lang="ts">
/**
 * The upgrades for the gun in focus, one framed tile each: the parts it takes, its ranks and the guns a
 * toolkit could carry a rank to. Pressing a tile fits a rank; what the gun's slots hold shows in the column.
 */
import { computed, ref } from 'vue';
import { WEAPONS } from '../../shared/constants.ts';
import { PART_LABELS } from '../../shared/gun-upgrade-data.ts';
import type { GunUpgrade } from '../../shared/gun-upgrade-data.ts';
import type { PlayerGear } from '../../shared/gun-upgrades.ts';
import type { WeaponId } from '../../shared/protocol.ts';
import type { ArtBook } from '../art/types.ts';
import { benchRows } from '../game/bench-view.ts';
import type { BenchRow } from '../game/bench-view.ts';
import { isTactileUpgrade } from '../game/workbench-gesture.ts';
import { useGame } from './use-game.ts';
import WorkbenchTactileFit from './WorkbenchTactileFit.vue';
import WorkbenchTile from './WorkbenchTile.vue';

interface GunWorkProps {
  weapon: WeaponId;
  owned: readonly WeaponId[];
  gear: PlayerGear;
  art: ArtBook;
}

const { weapon, owned, gear } = defineProps<GunWorkProps>();
const emit = defineEmits<{ peek: [row: BenchRow | null] }>();
const game = useGame();

const rows = computed(() => benchRows(weapon, owned, gear));
const tactileUpgrade = ref<GunUpgrade | null>(null);

function install(upgrade: GunUpgrade): void {
  const isTactile = isTactileUpgrade(upgrade);
  if (isTactile) {
    tactileUpgrade.value = upgrade;
    return;
  }
  game.bench.send({ kind: 'fit', weapon, upgrade });
}

function onTactileFit(): void {
  const upgrade = tactileUpgrade.value;
  if (upgrade) {
    game.bench.send({ kind: 'fit', weapon, upgrade });
  }
  tactileUpgrade.value = null;
}

function onTactileCancel(): void {
  tactileUpgrade.value = null;
}

function move(upgrade: GunUpgrade, to: WeaponId): void {
  game.bench.send({ kind: 'move', upgrade, from: weapon, to });
}
</script>

<style scoped>
.bench-work {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: calc(var(--u) * 3);
  margin: 0;
  padding: var(--u);
  list-style: none;
}

/* A phone fits three tiles to a row and wraps the rest under them. */
@container select (max-width: 420px) {
  .bench-work {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
