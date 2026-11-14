<template><span hidden /></template>

<script setup lang="ts">
/**
 * Nightly Run drawn on the game canvas instead of DailyPage (the "In-game menus" switch). It has no markup: it works out
 * the same words and choices DailyPage does, hands them to the canvas setup screen, and runs what the screen asks for.
 * The Mode card picks Solo or Multiplayer; the one run button starts that run (or its practice once tonight's counts).
 */
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue';
import { difficultyDef } from '../../shared/difficulty.ts';
import { townName } from '../../shared/levels.ts';
import { checkApUpkeep } from '../../shared/progression-save.ts';
import type { SetupFact, SetupModel } from '../engine/setup-ui.ts';
import { createCanvasSetup, type CanvasSetup, type SetupAction } from '../game/canvas-setup.ts';
import { loadCharacter, saveCharacter } from '../game/character-pref.ts';
import { countdownText, dailyShare, dayLabel, loadDailyLog, mpResultOf, msUntilTomorrow, nightFacts, soloResultOf, streakOf, todaysNight } from '../game/daily-night.ts';
import type { UiState } from '../game/hud-state.ts';
import { motion } from '../game/motion.ts';
import type { PlayMode } from '../game/play-flow.ts';
import { modePick, survivorPick } from '../game/setup-picks.ts';
import type { FixedCard, PickKey } from '../game/setup-picks.ts';
import { streakReward } from '../game/streak-reward.ts';
import { useGame } from './use-game.ts';

const { ui } = defineProps<{ ui: UiState }>();
const emit = defineEmits<{ close: [] }>();
const game = useGame();

const night = todaysNight();
const facts = nightFacts(night);
const log = loadDailyLog();
const today = log[night.key] ?? null;
const solo = soloResultOf(today);
const mp = mpResultOf(today);
const practice = (attempts: number): string => (attempts > 1 ? `, ${attempts - 1} practice` : '');
const soloLine = solo ? `${solo.score} pts (${townName(solo.level)})${practice(solo.attempts)}` : 'Not played yet';
const mpLine = mp ? `${mp.teamScore} team pts (${mp.partySize}P, ${townName(mp.level)})${practice(mp.attempts)}` : 'Not played yet';
const streak = streakOf(log, night.key);
const reward = streakReward(log, night.key);
const ready = computed(() => ui.art !== null && !ui.connecting);

const left = ref(msUntilTomorrow());
const survivor = ref(loadCharacter());
const mode = ref<PlayMode>('solo');
const progression = checkApUpkeep().book;
const share = dailyShare(night.key);
/** What the Copy button last said, shown for two seconds like the page's own. */
const copied = ref<'idle' | 'done' | 'failed'>('idle');
const COPY_LABELS = { idle: 'Copy result', done: 'Copied', failed: 'Copy failed' } as const;

const fixed = computed<readonly FixedCard[]>(() => [
  { key: 'difficulty', number: 2, label: 'Difficulty', name: difficultyDef(night.difficulty).label, sprite: ui.art?.ui.difficulty[night.difficulty] ?? null, before: 'who' },
  { key: 'town', number: 3, label: 'Tonight', name: facts.title, sprite: ui.art?.ui.levelScenes[night.level - 1] ?? null, before: 'who' },
]);

const lines = computed<readonly SetupFact[]>(() => {
  const event = facts.event ? ` - ${facts.event}` : '';
  const next = reward.next;
  const nextLabel = next !== null && next.night === reward.night + 1 ? 'Tomorrow' : `Night ${next?.night ?? ''}`;
  const kit = `Tonight's kit: ${reward.tonight ?? 'The usual pistol'}${next ? `  ${nextLabel}: ${next.words}` : ''}`;
  const out: SetupFact[] = [{ text: `${dayLabel(night.key)} - ${facts.level}${event} - same town for everyone, first run counts`, tone: 'accent' }];
  if (facts.rule) out.push({ text: facts.rule, tone: 'dim' });
  out.push(
    { text: `Solo run: ${soloLine}`, tone: 'dim' },
    { text: `MP run: ${mpLine}`, tone: 'dim' },
    { text: `Streak: ${streak === 1 ? '1 night' : `${streak} nights`}   New town in: ${countdownText(left.value)}`, tone: 'dim' },
    { text: kit, tone: 'dim' }
  );
  return out;
});

/** The run button for the mode chosen: tonight's counted run, or practice once it is banked. */
const runLabel = computed(() => {
  const isMulti = mode.value === 'multi';
  if (isMulti) return mp ? 'MP Practice' : 'Nightly MP Lobby';
  return solo ? 'Solo Practice' : 'Solo Run';
});

const model = computed<SetupModel>(() => ({
  heading: 'Nightly Run',
  picks: [modePick(mode.value, 1), survivorPick(survivor.value, 4, progression)],
  levelLink: null,
  fixed: fixed.value,
  facts: lines.value,
  callsign: null,
  startLine: null,
  failure: null,
  start: { label: runLabel.value, enabled: ready.value },
  resume: null,
  actions: [
    ...(share ? [{ id: 'share' as const, label: COPY_LABELS[copied.value], enabled: true, primary: false }] : []),
    { id: mode.value === 'multi' ? 'mp' : 'solo', label: runLabel.value, enabled: ready.value, primary: true },
  ],
  open: null,
}));

function choose(key: PickKey, id: string): void {
  const isMode = key === 'mode';
  if (isMode) {
    mode.value = id as PlayMode;
    return;
  }
  const isSurvivor = key === 'who';
  if (!isSurvivor) return;
  survivor.value = Number(id);
  saveCharacter(survivor.value);
}

let resetCopy: ReturnType<typeof setTimeout> | undefined;

async function copyResult(): Promise<void> {
  if (!share) return;
  try {
    await navigator.clipboard.writeText(share);
    copied.value = 'done';
  } catch {
    copied.value = 'failed'; // chemx-allow: best-effort the label says it failed, and the player can try again
  }
  clearTimeout(resetCopy);
  resetCopy = setTimeout(() => (copied.value = 'idle'), 2000);
}

function act(action: SetupAction): void {
  if (action === 'back') emit('close');
  else if (action === 'solo') game.startDaily();
  else if (action === 'mp') game.startDailyMp();
  else if (action === 'share') void copyResult();
}

let screen: CanvasSetup | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  const canvas = document.querySelector<HTMLCanvasElement>('.game-canvas');
  if (!canvas) {
    emit('close');
    return;
  }
  screen = createCanvasSetup(
    canvas,
    {
      art: ui.art,
      playUi: (sound) => game.playUi(sound),
      reducedMotion: () => motion.reduced.value,
      choose,
      setCallsign: () => undefined,
      act,
    },
    model.value
  );
  timer = setInterval(() => (left.value = msUntilTomorrow()), 30_000);
});

// The model is read first, so the effect tracks it even before the screen exists.
watchEffect(() => {
  const next = model.value;
  screen?.update(next);
});
onBeforeUnmount(() => {
  screen?.dispose();
  if (timer) clearInterval(timer);
  clearTimeout(resetCopy);
});
</script>
