<template>
  <TitlePage :heading bare boxed @close="back">
    <template #lead>
      <SetupPicks ref="picker" :picks :art="ui.art" :level-link="levelLink" @choose="choose" @levels="emit('levels', runStyle)" />
    </template>

    <!-- The co-op fields show only for Multiplayer, under the callsign. -->
    <div class="setup-fields">
      <div class="setup-field is-callsign">
        <label class="px-label" for="callsign">Callsign</label>
        <input
          id="callsign"
          class="px-input px-frame"
          :value="ui.callsign"
          maxlength="12"
          placeholder="SURVIVOR"
          autocomplete="off"
          spellcheck="false"
          @input="game.setCallsign(textOf($event))"
        />
      </div>

      <div v-if="online" class="setup-field" :class="{ 'is-hidden': !serverShown }" :aria-hidden="!serverShown || undefined">
        <span class="px-label" id="coop-entry">Play with</span>
        <div class="setup-entries" role="group" aria-labelledby="coop-entry">
          <PixelButton
            v-for="choice in COOP_ENTRIES"
            :key="choice.entry"
            class="setup-entry"
            :primary="entry === choice.entry"
            :aria-pressed="entry === choice.entry"
            @press="entry = choice.entry"
          >
            {{ choice.label }}
          </PixelButton>
        </div>
        <input
          v-if="entry === 'code'"
          :id="SERVER_FIELD_ID"
          class="px-input px-frame setup-code"
          :value="ui.serverAddress"
          placeholder="ROOM CODE, E.G. BCDFG"
          aria-label="Friend's room code"
          maxlength="64"
          autocomplete="off"
          spellcheck="false"
          @input="game.setServerAddress(textOf($event))"
        />
        <p v-else class="setup-hint">{{ ENTRY_HINTS[entry] }}</p>
      </div>

      <div v-else class="setup-field" :class="{ 'is-hidden': !serverShown }" :aria-hidden="!serverShown || undefined">
        <label class="px-label" :for="SERVER_FIELD_ID">Server address</label>
        <div class="setup-server">
          <input
            :id="SERVER_FIELD_ID"
            class="px-input px-frame"
            :value="ui.serverAddress"
            :placeholder="defaultServer"
            autocomplete="off"
            spellcheck="false"
            @input="game.setServerAddress(textOf($event))"
          />
          <PixelButton class="setup-invite" :disabled="!inviteLink" @press="copyInvite">
            {{ INVITE_LABELS[copied] }}
          </PixelButton>
        </div>
      </div>
    </div>

    <div class="setup-lines">
      <p v-if="startLine" class="px-label setup-start-at">{{ startLine }}</p>
      <p v-if="coopNote" class="px-label setup-start-at">{{ coopNote }}</p>
      <p v-if="failure" class="px-error" role="alert">{{ failure }}</p>
    </div>

    <template #actions>
      <PixelButton v-if="resumeAt !== null && !isMulti && runStyle === 'arcade'" :disabled="!ready" @press="game.continueSolo()">
        Continue from {{ townName(resumeAt) }}
      </PixelButton>
      <PixelButton primary silent :disabled="!ready" @press="start">{{ actionLabel }}</PixelButton>
    </template>
  </TitlePage>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import { DEFAULT_SERVER_PORT } from '../../shared/constants.ts';
import type { DifficultyId } from '../../shared/difficulty.ts';
import { FIRST_LEVEL, levelDef, townName } from '../../shared/levels.ts';
import type { GameStyle } from '../../shared/game-style.ts';
import { trackTitlePage } from '../game/analytics/index.ts';
import { loadCharacter, saveCharacter } from '../game/character-pref.ts';
import { loadDifficulty, saveDifficulty } from '../game/difficulty-pref.ts';
import { setupLevelLines } from '../game/home-screens.ts';
import { SERVER_FIELD_ID } from '../game/hud-state.ts';
import type { UiState } from '../game/hud-state.ts';
import { buildInviteLink } from '../game/invite-link.ts';
import { onlineRoomsLive } from '../network/play-api.ts';
import type { CoopEntry } from '../game/run-session.ts';
import { chosenStartLevel, continueLevel, isLevelUnlocked, loadCampaignProgress, loadLevelProgress } from '../game/level-progress.ts';
import { chooseMode, claimedStyle, setupFailure, setupHeading, setupStyle, showsServer, startFlow } from '../game/play-flow.ts';
import type { PlayMode } from '../game/play-flow.ts';
import { loadSetupLevel, setupLevelRequest } from '../game/setup-level-pref.ts';
import { setupPicks, setupProgression } from '../game/setup-picks.ts';
import type { LevelLinkCard } from '../game/setup-picks.ts';
import type { PickKey } from '../game/setup-picks.ts';
import { COOP_ACTIONS, setupActionLabel, type CoopAction } from '../game/title-menu.ts';
import PixelButton from './PixelButton.vue';
import SetupPicks from './SetupPicks.vue';
import TitlePage from './TitlePage.vue';
import { useGame } from './use-game.ts';

/** `multi`: the in-game setup handed over because Multiplayer was picked, so the page opens on it. */
const { ui, join = false, level = null, multi: startsMulti = false } = defineProps<{ ui: UiState; join?: boolean; level?: number | null; multi?: boolean }>();
const emit = defineEmits<{ close: []; levels: [style: GameStyle] }>();
const game = useGame();
const picker = useTemplateRef<InstanceType<typeof SetupPicks>>('picker');
const flow = ref(startsMulti ? chooseMode(startFlow(join, level), 'multi') : startFlow(join, level));
/** Saved prefs, so the next visit opens on the same difficulty and survivor. */
const difficulty = ref<DifficultyId>(loadDifficulty());
const survivor = ref(loadCharacter());
const copied = ref<'idle' | 'done' | 'failed'>('idle');
const INVITE_LABELS = { idle: 'Copy invite link', done: 'Link copied', failed: 'Copy failed' } as const;

/** Read when the page opens: a run cannot be under way while the setup is showing. */
const resumeAt = continueLevel(loadLevelProgress());
const runStyle = computed(() => setupStyle(level, ui.style));
/** The town the Level card set for this style, read when the page opens. */
const savedLevel = loadSetupLevel(runStyle.value);
/** The level this page starts from: a Levels pick if one sent the player here, else the one the Level card set. */
const requested = level ?? setupLevelRequest(savedLevel, runStyle.value);
/** Kept only while it is still unlocked and past the first. */
const progress = loadLevelProgress();
const chosen = requested === null ? null : chosenStartLevel(requested, progress);
const isChosenUnlocked = requested !== null && isLevelUnlocked(requested, progress);
/** What this page may say about the style: nothing on an invite link, since the room decides. The run still offers the remembered one to an empty room. */
const shownStyle = computed(() => claimedStyle(join, runStyle.value));
const levelLines = computed(() => setupLevelLines({ style: shownStyle.value, multi: isMulti.value, level: requested, unlocked: isChosenUnlocked, chosen }));
const startLine = computed(() => levelLines.value.startLine);
const coopNote = computed(() => levelLines.value.coopNote);
const heading = computed(() => setupHeading(join, flow.value.mode, runStyle.value));

const progression = ref(setupProgression());
const picks = computed(() => setupPicks({ mode: flow.value.mode, difficulty: difficulty.value, survivor: survivor.value }, progression.value));
/** The town the card shows: the one set; else the first for Arcade, and for Campaign the furthest reached, where its van starts by default. */
const cardLevel = computed(() => {
  const isCampaign = runStyle.value === 'campaign';
  const furthest = isCampaign ? loadCampaignProgress().highest : FIRST_LEVEL;
  return requested ?? savedLevel ?? furthest;
});
/** The Level card, in the row before Survivor (number 3). It names the town and opens the Levels page to set it. */
const levelLink = computed<LevelLinkCard>(() => {
  const number = cardLevel.value;
  return { number: 3, label: 'Level', name: levelDef(number).town, sprite: ui.art?.ui.levelScenes[number - 1] ?? null, before: 'who' };
});
/** The mode decides how the run starts, and whether the co-op fields show. */
const isMulti = computed(() => flow.value.mode === 'multi');
const serverShown = computed(() => showsServer(flow.value));
const ready = computed(() => ui.art !== null && !ui.connecting);
/** A build with online rooms takes a room code in the same field, and a blank one hosts a new room. */
const online = onlineRoomsLive();
/** Online only: Find a team (public), Host for friends (private) or Join with code. An invite link lands on the code. */
const entry = ref<CoopEntry>(join ? 'code' : 'host');
const COOP_ENTRIES: readonly { entry: CoopEntry; label: string }[] = [
  { entry: 'find', label: 'Find a team' },
  { entry: 'host', label: 'Host for friends' },
  { entry: 'code', label: 'Join with code' },
];
const ENTRY_HINTS: Readonly<Record<'find' | 'host', string>> = {
  find: 'Joins an open public game near your difficulty, or opens one. Public games show survivor names, never callsigns.',
  host: 'A private game. Your room code and invite link show on screen once you are in town.',
};
const coopAction = computed<CoopAction>(() => (online ? COOP_ACTIONS[entry.value] : 'join'));
const actionLabel = computed(() => setupActionLabel(isMulti.value, ui.art !== null, ui.connecting, coopAction.value));
const failure = computed(() => setupFailure(flow.value.mode, runStyle.value, ui.error));
const defaultServer = `${window.location.hostname}:${DEFAULT_SERVER_PORT}`;
/** The address friends need: what is typed, or this host's default when the field is blank. */
const inviteLink = computed(() => buildInviteLink(window.location.href, ui.serverAddress.trim() || defaultServer));

function textOf(event: Event): string {
  return (event.target as HTMLInputElement).value;
}

/** Puts the copy label back after a moment; cleared on unmount so it never outlives the page. */
let copiedTimer: ReturnType<typeof setTimeout> | undefined;
onBeforeUnmount(() => clearTimeout(copiedTimer));

async function copyInvite(): Promise<void> {
  const link = inviteLink.value;
  if (!link) return;
  try {
    await navigator.clipboard.writeText(link);
    copied.value = 'done';
  } catch {
    copied.value = 'failed';
  }
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => (copied.value = 'idle'), 2000);
}

/** A choice from one of the picks' lists: the mode moves the page, difficulty and survivor are remembered for next time. */
function choose(key: PickKey, id: string): void {
  const isMode = key === 'mode';
  const isDifficulty = key === 'difficulty';
  if (isMode) {
    flow.value = chooseMode(flow.value, id as PlayMode);
    return;
  }
  if (isDifficulty) {
    difficulty.value = id as DifficultyId;
    saveDifficulty(difficulty.value);
    return;
  }
  survivor.value = Number(id);
  saveCharacter(survivor.value);
}

function start(): void {
  if (isMulti.value) {
    game.startCoop(runStyle.value, online ? entry.value : undefined);
    return;
  }
  const isContinuing = chosen !== null;
  if (isContinuing) game.continueSolo(chosen);
  else game.startSolo(runStyle.value);
}

/** Back and Esc leave for the title; a connection still being tried would otherwise pull the player into a room from the menu. */
function back(): void {
  if (ui.connecting) game.toMenu();
  emit('close');
}

onMounted(() => {
  picker.value?.focus();
  trackTitlePage('play');
});
</script>

<style scoped>
/* Callsign, then the co-op fields when playing together, centred under the picks. */
.setup-fields {
  display: grid;
  grid-template-columns: 1fr;
  gap: calc(var(--u) * 4);
  width: min(calc(var(--u) * 240), 100%);
  margin-inline: auto;
  padding: 0 var(--u);
  text-align: center;
}

.setup-fields .px-input {
  text-align: center;
}

.setup-field {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.setup-field.is-callsign {
  justify-self: center;
  width: min(calc(var(--u) * 150), 100%);
}

.setup-field.is-hidden {
  display: none;
}

.setup-server {
  display: flex;
  gap: calc(var(--u) * 3);
}

.setup-invite {
  flex: none;
  width: auto;
}

.setup-entries {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: calc(var(--u) * 2);
}

.setup-entry {
  width: auto;
  min-width: 0;
}

.setup-code {
  margin-top: calc(var(--u) * 2);
}

.setup-hint {
  margin: var(--u) 0 0;
  color: var(--bone-dim);
  font-size: calc(var(--u) * 5);
  line-height: 1.4;
}

.setup-lines {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 2);
  text-align: center;
}

.setup-lines:empty {
  display: none;
}

.setup-start-at {
  margin: 0;
}

@media (max-width: 600px) {
  .setup-fields {
    gap: calc(var(--u) * 3);
  }
}
</style>
