<template>
  <section class="px-screen victory">
    <SpriteImg v-if="art" :sprite="art.ui.skull" :scale="3" />
    <h2 class="px-heading">The night is over</h2>
    <p v-if="result.isNewBest" class="victory-best px-blink">New best</p>
    <p v-if="result.daily" class="victory-best">{{ result.daily.label }}: {{ result.daily.counted ? 'this one counts' : 'practice' }}</p>

    <dl class="victory-stats">
      <div><dt>Towns cleared</dt><dd>{{ result.stats.level }}</dd></div>
      <div><dt>Hordes survived</dt><dd>{{ result.stats.wave }}</dd></div>
      <div><dt>Time survived</dt><dd>{{ formatDuration(result.stats.durationSec) }}</dd></div>
      <div><dt>Kills</dt><dd>{{ result.kills }}</dd></div>
      <div><dt>Score</dt><dd>{{ result.score.toLocaleString() }} XP</dd></div>
    </dl>

    <table v-if="result.stats.players.length > 1" class="victory-table">
      <thead>
        <tr><th>Survivor</th><th>Kills</th><th>XP</th></tr>
      </thead>
      <tbody>
        <tr v-for="player in ranked" :key="player.id" :class="{ 'is-you': player.id === result.localId }">
          <td>{{ displayName(player.name, player.skin) }}</td>
          <td>{{ player.kills }}</td>
          <td>{{ player.score.toLocaleString() }}</td>
        </tr>
      </tbody>
    </table>

    <div class="victory-actions">
      <PixelButton primary @press="emit('continue')">Continue</PixelButton>
      <ShareButton v-if="result.daily" :text="result.daily.share" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ArtBook } from '../art/types.ts';
import { displayName } from '../../shared/callsign.ts';
import { formatDuration } from '../game/hud-state.ts';
import type { RunResult } from '../game/hud-state.ts';
import PixelButton from './PixelButton.vue';
import ShareButton from './ShareButton.vue';
import SpriteImg from './SpriteImg.vue';

const { result } = defineProps<{ result: RunResult; art: ArtBook | null }>();
const emit = defineEmits<{ continue: [] }>();

const ranked = computed(() => [...result.stats.players].sort((a, b) => b.score - a.score));
</script>

<style scoped>
.victory {
  justify-content: safe center;
  gap: calc(var(--u) * 4);
  animation: px-fade-in 0.7s steps(7) both;
}

.victory-best {
  padding: var(--u) calc(var(--u) * 4);
  background: var(--amber);
  color: var(--ink);
  font-weight: 700;
  animation: px-blink 0.8s steps(2) infinite;
}

.victory-stats {
  display: grid;
  grid-template-columns: repeat(5, auto);
  gap: calc(var(--u) * 8);
  text-align: center;
}

.victory-stats dt {
  color: var(--bone-dim);
}

.victory-stats dd {
  font-size: calc(var(--u) * 12);
  font-weight: 700;
  color: var(--sick);
}

.victory-table {
  border-collapse: collapse;
  min-width: calc(var(--u) * 140);
}

.victory-table th {
  color: var(--bone-dim);
  font-weight: 400;
  text-align: left;
}

.victory-table th,
.victory-table td {
  padding: var(--u) calc(var(--u) * 4);
}

.victory-table .is-you td {
  color: var(--sick);
}

.victory-actions {
  display: flex;
  width: calc(var(--u) * 90);
  max-width: 100%;
}

@media (max-width: 560px) {
  .victory-stats {
    grid-template-columns: repeat(2, auto);
    gap: calc(var(--u) * 4);
  }
}
</style>