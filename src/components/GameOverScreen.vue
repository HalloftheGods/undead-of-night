<template>
  <section class="px-screen px-title-scale gameover" aria-labelledby="gameover-heading">
    <h2 id="gameover-heading" class="px-heading is-danger gameover-heading">Game over</h2>

    <div class="gameover-body">
      <!-- The town you fell in, as a Level Select card with the skull stamped over it. -->
      <div class="gameover-card px-frame">
        <span class="gameover-head">
          <span class="gameover-number" aria-hidden="true">{{ level }}</span>
          <span class="gameover-town">{{ town }}</span>
        </span>
        <span class="gameover-art">
          <img v-if="scene" class="gameover-scene" :src="spriteDataUrl(scene)" alt="" draggable="false" />
          <SpriteImg v-if="art" class="gameover-skull" :sprite="art.ui.skull" :scale="3" />
          <span class="gameover-title" :style="{ '--chars': longestWord(title) }">{{ title }}</span>
        </span>
        <span v-if="result.isNewBest" class="gameover-best" role="status">New best!</span>
      </div>

      <div class="gameover-side">
        <p v-if="cause" class="gameover-cause">{{ cause }}</p>
        <p class="px-label gameover-kicker">
          {{ difficultyDef(result.stats.difficulty).label }}<template v-if="result.daily"> - {{ result.daily.label }}: {{ result.daily.counted ? 'this one counts' : 'practice' }}</template>
        </p>

        <dl class="gameover-stats">
          <div><dt>Hordes</dt><dd>{{ result.stats.wave }}</dd></div>
          <div><dt>Time</dt><dd>{{ formatDuration(result.stats.durationSec) }}</dd></div>
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

        <div ref="retryBox" class="gameover-retry">
          <PixelButton primary silent :disabled="restarting" @press="retry">
            {{ restarting ? 'Waiting...' : plan.label }}
          </PixelButton>
        </div>
        <div class="gameover-more">
          <MenuLink v-if="plan.startOver" silent :disabled="restarting" @press="game.playAgain()">Start over</MenuLink>
          <ShareButton v-if="result.daily" class="gameover-share" :text="result.daily.share" />
          <MenuLink @press="game.toMenu()">Main menu</MenuLink>
        </div>

        <p class="gameover-tip"><span class="gameover-tip-label">Tip</span> {{ tip }}</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * The screen after a death, laid out like Level Select: the town you fell in as a portrait card, and beside it
 * what got you, the run's numbers, and Try again as the one big button. It has focus from the start, so Enter
 * or a pad's A is a second run. One tip under it, a different one each time.
 */
import { computed, nextTick, onMounted, useTemplateRef } from 'vue';
import type { ArtBook } from '../art/types.ts';
import { displayName } from '../../shared/callsign.ts';
import { difficultyDef } from '../../shared/difficulty.ts';
import { levelDef } from '../../shared/levels.ts';
import { spriteDataUrl } from '../engine/sprite-cache.ts';
import { deathLine, deathWitness } from '../game/death-cause.ts';
import { nextDeathTip } from '../game/death-tips.ts';
import { retryPlan } from '../game/game-over-view.ts';
import { formatDuration } from '../game/hud-state.ts';
import type { RunResult } from '../game/hud-state.ts';
import { longestWord } from '../game/setup-picks.ts';
import MenuLink from './MenuLink.vue';
import PixelButton from './PixelButton.vue';
import ShareButton from './ShareButton.vue';
import SpriteImg from './SpriteImg.vue';
import { useGame } from './use-game.ts';

const { result, art } = defineProps<{ result: RunResult; art: ArtBook | null; restarting: boolean }>();
const game = useGame();
const retryBox = useTemplateRef<HTMLElement>('retryBox');

const level = computed(() => result.stats.level);
const town = computed(() => levelDef(level.value).town);
const title = computed(() => levelDef(level.value).title);
const scene = computed(() => art?.ui.levelScenes[level.value - 1] ?? null);
const ranked = computed(() => [...result.stats.players].sort((a, b) => b.score - a.score));

/** Read once: the death and the run's mode are settled by the time this screen shows. */
const { mode, runStyle } = game.ui.value;
const plan = retryPlan({ mode, runStyle, level: result.stats.level, daily: result.daily !== undefined });
const cause = deathLine(deathWitness.cause());
const tip = nextDeathTip();

function retry(): void {
  game.playAgain(plan.fromLevel);
}

// Focus sits on Try again, so Enter (or a pad's A) answers it as a click.
onMounted(() => void nextTick(() => retryBox.value?.querySelector('button')?.focus({ preventScroll: true })));
</script>

<style scoped>
.gameover {
  gap: calc(var(--u) * 6);
  background: rgba(7, 8, 12, 0.88);
  animation: px-fade-in 0.7s steps(7) both;
}

.gameover-heading {
  margin: 0;
  font-size: calc(var(--u) * 20);
}

/* The card on the left, the words and buttons beside it; a tall screen stacks them. */
.gameover-body {
  --card: min(calc(var(--u) * 125), calc((100vh - var(--u) * 64) * 0.7));
  display: grid;
  grid-template-columns: var(--card) minmax(0, calc(var(--u) * 190));
  align-items: center;
  gap: calc(var(--u) * 12);
  max-width: 100%;
}

.gameover-card {
  --edge: var(--blood);
  position: relative;
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 1.5);
  container-type: inline-size;
  padding: calc(var(--u) * 1.5);
  background: var(--ink-raised);
  text-transform: uppercase;
}

.gameover-head {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 1.5);
  min-width: 0;
  color: var(--bone);
  font-size: calc(var(--u) * 4.5);
  white-space: nowrap;
}

.gameover-number {
  display: grid;
  flex: none;
  place-items: center;
  width: calc(var(--u) * 7);
  height: calc(var(--u) * 7);
  background: var(--blood);
  color: var(--bone);
  font-weight: 700;
}

.gameover-town {
  overflow: hidden;
  text-overflow: ellipsis;
}

.gameover-art {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 56 / 72;
  overflow: hidden;
  background: var(--ink);
}

.gameover-scene {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated;
  filter: grayscale(0.7) brightness(0.45) sepia(0.5) hue-rotate(-35deg) saturate(2.2);
}

.gameover-skull {
  position: relative;
  margin-bottom: 20%;
  filter: drop-shadow(0 var(--u) 0 var(--ink));
}

/* The town's title along the bottom of its picture, as on Level Select. */
.gameover-title {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: calc(var(--u) * 8) var(--u) calc(var(--u) * 2);
  background: linear-gradient(to top, rgba(7, 8, 12, 0.92) 0%, rgba(7, 8, 12, 0.55) 60%, transparent 100%);
  color: var(--bone);
  font-size: min(clamp(calc(var(--u) * 4), 11cqi, calc(var(--u) * 10)), calc(90cqi / (var(--chars) * 1.3)));
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: 0.1em;
  text-indent: 0.1em;
  text-align: center;
  text-shadow:
    0 calc(var(--u) * 0.75) 0 var(--blood),
    0 calc(var(--u) * 1.5) 0 var(--ink);
  text-wrap: balance;
}

/* A record beaten: an amber stamp slapped across the card's corner. */
.gameover-best {
  position: absolute;
  top: calc(var(--u) * 12);
  right: calc(var(--u) * -6);
  padding: var(--u) calc(var(--u) * 4);
  background: var(--amber);
  color: var(--ink);
  font-size: calc(var(--u) * 7);
  font-weight: 700;
  box-shadow: var(--u) var(--u) 0 var(--ink);
  transform: rotate(8deg);
  animation: gameover-stamp 0.5s steps(5) 0.6s both;
}

@keyframes gameover-stamp {
  from {
    opacity: 0;
    transform: rotate(8deg) scale(2.2);
  }
  to {
    opacity: 1;
    transform: rotate(8deg) scale(1);
  }
}

.gameover-side {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: calc(var(--u) * 4);
  min-width: 0;
}

.gameover-side p {
  margin: 0;
}

/* What got you: the first thing read after the heading. */
.gameover-cause {
  color: var(--bone);
  font-size: calc(var(--u) * 8);
  line-height: 1.35;
}

.gameover-kicker {
  margin: 0;
}

.gameover-stats {
  display: grid;
  grid-template-columns: repeat(4, auto);
  justify-content: space-between;
  gap: calc(var(--u) * 6);
  margin: 0;
}

.gameover-stats dt {
  color: var(--bone-dim);
  font-size: calc(var(--u) * 5);
  text-transform: uppercase;
}

.gameover-stats dd {
  margin: 0;
  color: var(--amber);
  font-size: calc(var(--u) * 11);
  font-weight: 700;
}

.gameover-table {
  border-collapse: collapse;
}

.gameover-table th {
  color: var(--bone-dim);
  font-weight: 400;
  text-align: left;
}

.gameover-table th,
.gameover-table td {
  padding: var(--u) calc(var(--u) * 3);
}

.gameover-table .is-you td {
  color: var(--sick);
}

/* The one big button, thumb-sized on a phone. */
.gameover-retry :deep(.px-button) {
  min-height: 48px;
  padding-block: calc(var(--u) * 5);
  font-size: calc(var(--u) * 9);
}

.gameover-more {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: calc(var(--u) * 2);
}

.gameover-more > :deep(.px-button) {
  width: auto;
}

.gameover-more > :deep(.px-menu-item) {
  justify-content: center;
}

.gameover-tip {
  padding: calc(var(--u) * 2) calc(var(--u) * 3);
  background: rgba(23, 24, 31, 0.72);
  color: var(--bone);
  line-height: 1.35;
}

.gameover-tip-label {
  margin-right: calc(var(--u) * 2);
  color: var(--amber);
  text-transform: uppercase;
}

/* A tall screen: the card above, smaller, and the words under it. */
@media (orientation: portrait) {
  .gameover-body {
    --card: min(calc(var(--u) * 64), 34vh);
    grid-template-columns: minmax(0, calc(var(--u) * 190));
    justify-items: center;
    gap: calc(var(--u) * 6);
  }

  .gameover-card {
    width: var(--card);
  }

  .gameover-side {
    text-align: center;
  }

  .gameover-stats {
    grid-template-columns: repeat(4, auto);
    justify-content: space-around;
    gap: calc(var(--u) * 4);
  }
}

/* A phone on its side: everything tighter, the card as tall as the room allows. */
@media (max-height: 520px) and (orientation: landscape) {
  .gameover {
    gap: calc(var(--u) * 3);
    padding: calc(var(--u) * 3);
  }

  .gameover-heading {
    font-size: calc(var(--u) * 14);
  }

  .gameover-body {
    --card: min(calc(var(--u) * 92), calc((100vh - var(--u) * 40) * 0.7));
    gap: calc(var(--u) * 8);
  }

  .gameover-side {
    gap: calc(var(--u) * 2.5);
  }

  .gameover-retry :deep(.px-button) {
    padding-block: calc(var(--u) * 3);
  }
}
</style>
