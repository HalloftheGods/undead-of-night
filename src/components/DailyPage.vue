<template>
  <TitlePage heading="Daily Night" size="extra-wide" boxed steady @close="emit('close')">
    <header class="daily-ticket px-frame">
      <span class="daily-scene"><SpriteImg v-if="scene" :sprite="scene" /></span>
      <div class="daily-title">
        <p class="px-label daily-kicker">{{ dayLabel(night.key) }} - {{ facts.level }} - {{ facts.difficulty }}<template v-if="facts.event"> - {{ facts.event }}</template></p>
        <p class="daily-name">{{ facts.title }}</p>
        <p v-if="facts.rule" class="daily-rule">{{ facts.rule }}</p>
      </div>
      <dl class="daily-facts">
        <div class="daily-fact"><dt class="px-label">Your run</dt><dd>{{ todayLine }}</dd></div>
        <div class="daily-fact"><dt class="px-label">Streak</dt><dd>{{ streak === 1 ? '1 night' : `${streak} nights` }}</dd></div>
        <div class="daily-fact"><dt class="px-label">New town in</dt><dd>{{ countdown }}</dd></div>
        <div class="daily-fact"><dt class="px-label">Rules</dt><dd>Solo, Arcade, same town for all. First run counts</dd></div>
      </dl>
    </header>

    <StreakKit :reward="reward" />

    <CharacterSelect ref="survivors" :art="ui.art" :bust-scale="2" />

    <template #actions>
      <ShareButton v-if="share" :text="share" />
      <PixelButton primary silent :disabled="!ready" @press="game.startDaily()">{{ played ? 'Practice' : 'Start tonight' }}</PixelButton>
    </template>
  </TitlePage>
</template>

<script setup lang="ts">
/** Today's town, what it is, how you did, and the survivor to take in. Start skips the rest of the Play page: the day has already chosen. */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import { countdownText, dailyShare, dayLabel, loadDailyLog, msUntilTomorrow, nightFacts, streakOf, todaysNight } from '../game/daily-night.ts';
import type { UiState } from '../game/hud-state.ts';
import { streakReward } from '../game/streak-reward.ts';
import CharacterSelect from './CharacterSelect.vue';
import PixelButton from './PixelButton.vue';
import ShareButton from './ShareButton.vue';
import SpriteImg from './SpriteImg.vue';
import StreakKit from './StreakKit.vue';
import TitlePage from './TitlePage.vue';
import { useGame } from './use-game.ts';

const { ui } = defineProps<{ ui: UiState }>();
const emit = defineEmits<{ close: [] }>();
const game = useGame();
const survivors = useTemplateRef<InstanceType<typeof CharacterSelect>>('survivors');

const night = todaysNight();
const facts = nightFacts(night);
const log = loadDailyLog();
const today = log[night.key] ?? null;
const played = today !== null;
const share = dailyShare(night.key);
const streak = streakOf(log, night.key);
const reward = streakReward(log, night.key);
const todayLine = today ? `${today.score} points, level ${today.level}${today.attempts > 1 ? `, ${today.attempts - 1} practice` : ''}` : 'Not played yet';
const scene = computed(() => ui.art?.ui.levelScenes[night.level - 1] ?? null);
const ready = computed(() => ui.art !== null && !ui.connecting);

const left = ref(msUntilTomorrow());
const countdown = computed(() => countdownText(left.value));
let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  timer = setInterval(() => (left.value = msUntilTomorrow()), 30_000);
  void nextTick(() => survivors.value?.focus());
});
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.daily-ticket {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: calc(var(--u) * 6);
  padding: calc(var(--u) * 4);
}

.daily-scene {
  display: block;
  width: calc(var(--u) * 64);
  height: calc(var(--u) * 36);
  overflow: hidden;
}

.daily-scene :deep(img),
.daily-scene :deep(canvas) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.daily-title {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 2);
  min-width: 0;
}

.daily-title p {
  margin: 0;
}

.daily-kicker {
  color: var(--amber);
}

.daily-name {
  font-size: calc(var(--u) * 12);
  font-weight: 700;
  line-height: 1;
  color: var(--bone);
}

.daily-rule {
  color: var(--bone-dim);
}

.daily-facts {
  display: grid;
  grid-template-columns: auto auto;
  column-gap: calc(var(--u) * 4);
  row-gap: calc(var(--u) * 2);
  margin: 0;
}

.daily-fact {
  display: contents;
}

@media (max-width: 720px) {
  .daily-ticket {
    grid-template-columns: 1fr;
  }

  .daily-scene {
    width: 100%;
  }
}

.daily-fact dd {
  margin: 0;
  color: var(--bone);
}

.daily-fact .px-label {
  color: var(--amber);
}

</style>
