<template>
  <section class="px-screen gameover">
    <SpriteImg v-if="art" :sprite="art.ui.skull" :scale="3" />
    <h2 class="px-heading is-danger">Game over</h2>
    <p class="gameover-difficulty">{{ difficultyDef(result.stats.difficulty).label }}</p>
    <p v-if="result.isNewBest" class="gameover-best px-blink">New best</p>
    <p v-if="result.daily" class="gameover-difficulty">{{ result.daily.label }}: {{ result.daily.counted ? 'this one counts' : 'practice' }}</p>

    <dl class="gameover-stats">
      <div><dt>Town reached</dt><dd>{{ townName(result.stats.level) }}</dd></div>
      <div><dt>Hordes survived</dt><dd>{{ result.stats.wave }}</dd></div>
      <div><dt>Time survived</dt><dd>{{ formatDuration(result.stats.durationSec) }}</dd></div>
      <div><dt>Kills</dt><dd>{{ result.kills }}</dd></div>
      <div><dt>Score</dt><dd>{{ result.score }}</dd></div>
    </dl>

    <table v-if="result.stats.players.length > 1" class="gameover-table">
      <thead>
        <tr><th>Survivor</th><th>Kills</th><th>Score</th></tr>
      </thead>
      <tbody>
        <tr v-for="player in ranked" :key="player.id" :class="{ 'is-you': player.id === result.localId }">
          <td>{{ displayName(player.name, player.skin) }}</td>
          <td>{{ player.kills }}</td>
          <td>{{ player.score }}</td>
        </tr>
      </tbody>
    </table>

    <div class="gameover-actions">
      <PixelButton primary silent :disabled="restarting" @press="game.playAgain()">
        {{ restarting ? 'Waiting...' : 'Play again' }}
      </PixelButton>
      <PixelButton v-if="resumeAt !== null" :disabled="restarting" @press="game.continueAgain()">
        Continue from {{ townName(resumeAt) }}
      </PixelButton>
      <ShareButton v-if="result.daily" :text="result.daily.share" />
      <PixelButton @press="game.toMenu()">Main menu</PixelButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ArtBook } from '../art/types.ts';
import { displayName } from '../../shared/callsign.ts';
import { difficultyDef } from '../../shared/difficulty.ts';
import { townName } from '../../shared/levels.ts';
import { formatDuration } from '../game/hud-state.ts';
import { continueLevel, loadLevelProgress } from '../game/level-progress.ts';
import type { RunResult } from '../game/hud-state.ts';
import { continuesAfterDeath } from '../game/play-flow.ts';
import PixelButton from './PixelButton.vue';
import ShareButton from './ShareButton.vue';
import SpriteImg from './SpriteImg.vue';
import { useGame } from './use-game.ts';

const { result } = defineProps<{ result: RunResult; art: ArtBook | null; restarting: boolean }>();
const game = useGame();

/** Solo Arcade only; read once, since the death has already been recorded by the time this screen shows. */
const { mode, runStyle } = game.ui.value;
const resumeAt = continuesAfterDeath(mode, runStyle) ? continueLevel(loadLevelProgress()) : null;
const ranked = computed(() => [...result.stats.players].sort((a, b) => b.score - a.score));
</script>

<style scoped>
.gameover {
  justify-content: safe center;
  gap: calc(var(--u) * 4);
  animation: px-fade-in 0.7s steps(7) both;
}

.gameover-difficulty {
  margin: 0;
  color: var(--bone-dim);
}

.gameover-best {
  padding: var(--u) calc(var(--u) * 4);
  background: var(--amber);
  color: var(--ink);
  font-weight: 700;
  animation: px-blink 0.8s steps(2) infinite;
}

.gameover-stats {
  display: grid;
  grid-template-columns: repeat(5, auto);
  gap: calc(var(--u) * 8);
  text-align: center;
}

.gameover-stats dt {
  color: var(--bone-dim);
}

.gameover-stats dd {
  font-size: calc(var(--u) * 12);
  font-weight: 700;
  color: var(--amber);
}

.gameover-table {
  border-collapse: collapse;
  min-width: calc(var(--u) * 140);
}

.gameover-table th {
  color: var(--bone-dim);
  font-weight: 400;
  text-align: left;
}

.gameover-table th,
.gameover-table td {
  padding: var(--u) calc(var(--u) * 4);
}

.gameover-table .is-you td {
  color: var(--sick);
}

.gameover-actions {
  display: flex;
  gap: calc(var(--u) * 5);
  width: calc(var(--u) * 180);
  max-width: 100%;
}

@media (max-width: 560px) {
  .gameover-stats {
    grid-template-columns: repeat(2, auto);
    gap: calc(var(--u) * 4);
  }
}
</style>
