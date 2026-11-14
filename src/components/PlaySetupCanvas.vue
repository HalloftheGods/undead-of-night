<template><span hidden /></template>

<script setup lang="ts">
/**
 * The Campaign / Arcade setup drawn on the game canvas instead of PlaySetup's page (the "In-game menus" switch). It
 * has no markup: it works out the same words and choices PlaySetup does, hands them to the canvas screen, and runs
 * what the screen asks for. Solo only: picking Multiplayer hands over to PlaySetup (the `page` event), which keeps the room fields.
 */
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue';
import type { DifficultyId } from '../../shared/difficulty.ts';
import { FIRST_LEVEL, levelDef, townName } from '../../shared/levels.ts';
import type { GameStyle } from '../../shared/game-style.ts';
import type { SetupModel } from '../engine/setup-ui.ts';
import { trackTitlePage } from '../game/analytics/index.ts';
import { createCanvasSetup, type CanvasSetup, type SetupAction } from '../game/canvas-setup.ts';
import { loadCharacter, saveCharacter } from '../game/character-pref.ts';
import { loadDifficulty, saveDifficulty } from '../game/difficulty-pref.ts';
import { setupLevelLines } from '../game/home-screens.ts';
import type { UiState } from '../game/hud-state.ts';
import { chosenStartLevel, continueLevel, isLevelUnlocked, loadCampaignProgress, loadLevelProgress } from '../game/level-progress.ts';
import { motion } from '../game/motion.ts';
import { setupFailure, setupHeading, setupStyle } from '../game/play-flow.ts';
import type { PlayMode } from '../game/play-flow.ts';
import { loadSetupLevel, setupLevelRequest } from '../game/setup-level-pref.ts';
import { setupPicks, setupProgression } from '../game/setup-picks.ts';
import type { LevelLinkCard, PickKey } from '../game/setup-picks.ts';
import { setupActionLabel } from '../game/title-menu.ts';
import { useGame } from './use-game.ts';

const { ui, level = null } = defineProps<{ ui: UiState; level?: number | null }>();
const emit = defineEmits<{ close: []; levels: [style: GameStyle]; page: [multi: boolean] }>();
const game = useGame();

const difficulty = ref<DifficultyId>(loadDifficulty());
const survivor = ref(loadCharacter());
const progression = ref(setupProgression());

/** Read when the screen opens: a run cannot be under way while the setup is showing. */
const resumeAt = continueLevel(loadLevelProgress());
const runStyle = computed(() => setupStyle(level, ui.style));
const savedLevel = loadSetupLevel(runStyle.value);
const requested = level ?? setupLevelRequest(savedLevel, runStyle.value);
const progress = loadLevelProgress();
const chosen = requested === null ? null : chosenStartLevel(requested, progress);
const isChosenUnlocked = requested !== null && isLevelUnlocked(requested, progress);

/** The town the Level card shows: the one set; else the first for Arcade, and for Campaign the furthest reached. */
const cardLevel = computed(() => {
  const furthest = runStyle.value === 'campaign' ? loadCampaignProgress().highest : FIRST_LEVEL;
  return requested ?? savedLevel ?? furthest;
});
const levelLink = computed<LevelLinkCard>(() => {
  const number = cardLevel.value;
  return { number: 3, label: 'Level', name: levelDef(number).town, sprite: ui.art?.ui.levelScenes[number - 1] ?? null, before: 'who' };
});
const ready = computed(() => ui.art !== null && !ui.connecting);

const model = computed<SetupModel>(() => {
  const lines = setupLevelLines({ style: runStyle.value, multi: false, level: requested, unlocked: isChosenUnlocked, chosen });
  const showsResume = resumeAt !== null && runStyle.value === 'arcade';
  return {
    heading: setupHeading(false, 'solo', runStyle.value),
    picks: setupPicks({ mode: 'solo', difficulty: difficulty.value, survivor: survivor.value }, progression.value),
    levelLink: levelLink.value,
    callsign: ui.callsign,
    startLine: lines.startLine,
    failure: setupFailure('solo', runStyle.value, ui.error),
    start: { label: setupActionLabel(false, ui.art !== null, ui.connecting, 'join'), enabled: ready.value },
    resume: showsResume ? { label: `Continue from ${townName(resumeAt)}`, enabled: ready.value } : null,
    open: null,
  };
});

/** A choice from a list: Multiplayer moves to the page, difficulty and survivor are remembered for next time. */
function choose(key: PickKey, id: string): void {
  if (key === 'mode') {
    if ((id as PlayMode) === 'multi') emit('page', true);
    return;
  }
  if (key === 'difficulty') {
    difficulty.value = id as DifficultyId;
    saveDifficulty(difficulty.value);
    return;
  }
  survivor.value = Number(id);
  saveCharacter(survivor.value);
}

function act(action: SetupAction): void {
  if (action === 'levels') {
    emit('levels', runStyle.value);
    return;
  }
  if (action === 'back') {
    // A connection still being tried would otherwise pull the player into a room from the menu.
    if (ui.connecting) game.toMenu();
    emit('close');
    return;
  }
  if (action === 'resume') {
    game.continueSolo();
    return;
  }
  if (chosen !== null) game.continueSolo(chosen);
  else game.startSolo(runStyle.value);
}

let screen: CanvasSetup | null = null;

onMounted(() => {
  const canvas = document.querySelector<HTMLCanvasElement>('.game-canvas');
  if (!canvas) {
    emit('page', false);
    return;
  }
  screen = createCanvasSetup(
    canvas,
    {
      art: ui.art,
      playUi: (sound) => game.playUi(sound),
      reducedMotion: () => motion.reduced.value,
      choose,
      setCallsign: (text) => game.setCallsign(text),
      act,
    },
    model.value
  );
  trackTitlePage('play');
});

// The model is read first, so the effect tracks it even before the screen exists.
watchEffect(() => {
  const next = model.value;
  screen?.update(next);
});
onBeforeUnmount(() => screen?.dispose());
</script>
