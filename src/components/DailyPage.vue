<template>
  <TitlePage heading="Daily Night" bare boxed @close="emit('close')">
    <template #lead>
      <SetupPicks ref="picker" :picks :fixed :art="ui.art" :style="{ '--under': 'calc(var(--u) * 215)' }" @choose="choose" />
    </template>

    <div class="daily-lines">
      <p class="px-label daily-kicker">
        {{ dayLabel(night.key) }} - {{ facts.level }}<template v-if="facts.event"> - {{ facts.event }}</template> - same town for everyone, first run counts
      </p>
      <p v-if="facts.rule" class="daily-rule">{{ facts.rule }}</p>
      <dl class="daily-facts">
        <div class="daily-fact"><dt class="px-label">Solo run</dt><dd>{{ soloLine }}</dd></div>
        <div class="daily-fact"><dt class="px-label">MP run</dt><dd>{{ mpLine }}</dd></div>
        <div class="daily-fact"><dt class="px-label">Streak</dt><dd>{{ streak === 1 ? '1 night' : `${streak} nights` }}</dd></div>
        <div class="daily-fact"><dt class="px-label">New town in</dt><dd>{{ countdown }}</dd></div>
      </dl>
      <p class="daily-kit">
        <span class="px-label">Tonight's kit</span> {{ reward.tonight ?? 'The usual pistol' }}
        <template v-if="reward.next"><span class="px-label daily-next">{{ nextLabel }}</span> + {{ reward.next.words }}</template>
      </p>
    </div>

    <template #actions>
      <ShareButton v-if="share" :text="share" />
      <PixelButton silent :disabled="!ready" @press="game.startDaily()">
        {{ soloPlayed ? 'Solo Practice' : 'Solo Run' }}
      </PixelButton>
      <PixelButton primary silent :disabled="!ready" @press="game.startDailyMp()">
        {{ mpPlayed ? 'MP Practice' : 'Nightly MP Lobby' }}
      </PixelButton>
    </template>
  </TitlePage>
</template>

<script setup lang="ts">
/**
 * Today's town, laid out like the Play page: the day's town and difficulty as fixed cards, the survivor as the one
 * pick, and how you did and the streak kit in a few lines under them. Start skips the rest: the day has already chosen.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import { difficultyDef } from '../../shared/difficulty.ts';
import { townName } from '../../shared/levels.ts';
import { loadCharacter, saveCharacter } from '../game/character-pref.ts';
import { countdownText, dailyShare, dayLabel, loadDailyLog, mpResultOf, msUntilTomorrow, nightFacts, soloResultOf, streakOf, todaysNight } from '../game/daily-night.ts';
import type { UiState } from '../game/hud-state.ts';
import { survivorPick } from '../game/setup-picks.ts';
import type { FixedCard, PickKey } from '../game/setup-picks.ts';
import { streakReward } from '../game/streak-reward.ts';
import PixelButton from './PixelButton.vue';
import SetupPicks from './SetupPicks.vue';
import ShareButton from './ShareButton.vue';
import TitlePage from './TitlePage.vue';
import { useGame } from './use-game.ts';

const { ui } = defineProps<{ ui: UiState }>();
const emit = defineEmits<{ close: [] }>();
const game = useGame();
const picker = useTemplateRef<InstanceType<typeof SetupPicks>>('picker');

const night = todaysNight();
const facts = nightFacts(night);
const log = loadDailyLog();
const today = log[night.key] ?? null;
const solo = soloResultOf(today);
const mp = mpResultOf(today);
const soloPlayed = solo !== null;
const mpPlayed = mp !== null;
const soloLine = solo ? `${solo.score} pts (${townName(solo.level)})${solo.attempts > 1 ? `, ${solo.attempts - 1} practice` : ''}` : 'Not played yet';
const mpLine = mp ? `${mp.teamScore} team pts (${mp.partySize}P, ${townName(mp.level)})${mp.attempts > 1 ? `, ${mp.attempts - 1} practice` : ''}` : 'Not played yet';
const share = dailyShare(night.key);
const streak = streakOf(log, night.key);
const reward = streakReward(log, night.key);
const ready = computed(() => ui.art !== null && !ui.connecting);

const nextLabel = computed(() => {
  const next = reward.next;
  const isTomorrow = next !== null && next.night === reward.night + 1;
  return isTomorrow ? 'Tomorrow' : `Night ${next?.night ?? ''}`;
});

const survivor = ref(loadCharacter());
const picks = computed(() => [survivorPick(survivor.value)]);
const fixed = computed<readonly FixedCard[]>(() => [
  { key: 'town', number: 1, label: 'Tonight', name: facts.title, sprite: ui.art?.ui.levelScenes[night.level - 1] ?? null },
  { key: 'difficulty', number: 2, label: 'Difficulty', name: difficultyDef(night.difficulty).label, sprite: ui.art?.ui.difficulty[night.difficulty] ?? null },
]);

function choose(key: PickKey, id: string): void {
  const isSurvivor = key === 'who';
  if (!isSurvivor) return;
  survivor.value = Number(id);
  saveCharacter(survivor.value);
}

const left = ref(msUntilTomorrow());
const countdown = computed(() => countdownText(left.value));
let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  timer = setInterval(() => (left.value = msUntilTomorrow()), 30_000);
  void nextTick(() => picker.value?.focus());
});
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
/* What the day is and how you stand, a few centred lines under the cards. */
.daily-lines {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 2);
  text-align: center;
}

.daily-lines p {
  margin: 0;
}

.daily-kicker {
  color: var(--amber);
}

.daily-rule {
  color: var(--bone-dim);
}

.daily-facts {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: calc(var(--u) * 2) calc(var(--u) * 8);
  margin: 0;
}

.daily-fact {
  display: flex;
  gap: calc(var(--u) * 3);
}

.daily-fact dd {
  margin: 0;
  color: var(--bone);
}

.daily-fact .px-label,
.daily-kit .px-label {
  color: var(--amber);
}

.daily-kit {
  color: var(--bone);
}

.daily-kit .px-label,
.daily-fact .px-label {
  display: inline;
  margin: 0 calc(var(--u) * 2) 0 0;
}

.daily-next {
  margin-left: calc(var(--u) * 6);
}
</style>
