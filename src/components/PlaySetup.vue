<template>
  <TitlePage :heading size="extra-wide" boxed steady @close="back">
    <template #lead>
      <SetupStepper :stops="stepper" :thumbs @pick="jump" />
    </template>

    <StyleSelect v-if="flow.step === 'style'" ref="styles" :art="ui.art" :game-style="ui.style" @choose="chooseStyle" />

    <template v-else-if="flow.step === 'mode'">
      <ModeSelect :art="ui.art" :mode="flow.mode" :game-style="shownStyle" @choose="pick" />

      <!-- The server half keeps its room on Solo, hidden, so choosing a mode moves nothing. -->
      <div class="setup-fields">
        <div class="setup-field">
          <label class="px-label" for="callsign">Callsign</label>
          <input
            id="callsign"
            ref="callsign"
            class="px-input px-frame"
            :value="ui.callsign"
            maxlength="12"
            placeholder="SURVIVOR"
            autocomplete="off"
            spellcheck="false"
            @input="game.setCallsign(textOf($event))"
            @keydown.enter.prevent="next"
          />
        </div>

        <div class="setup-field" :class="{ 'is-hidden': !serverShown }" :aria-hidden="!serverShown || undefined">
          <label class="px-label" :for="SERVER_FIELD_ID">{{ online ? 'Room code or server' : 'Server address' }}</label>
          <div class="setup-server">
            <input
              :id="SERVER_FIELD_ID"
              class="px-input px-frame"
              :value="ui.serverAddress"
              :placeholder="online ? 'BLANK HOSTS ONLINE' : defaultServer"
              autocomplete="off"
              spellcheck="false"
              @input="game.setServerAddress(textOf($event))"
              @keydown.enter.prevent="next"
            />
            <PixelButton class="setup-invite" :disabled="!inviteLink" @press="copyInvite">
              {{ INVITE_LABELS[copied] }}
            </PixelButton>
          </div>
        </div>
      </div>
    </template>

    <DifficultySelect v-else-if="flow.step === 'difficulty'" ref="difficulty" :art="ui.art" />

    <template v-else>
      <CharacterSelect ref="survivors" :art="ui.art" />
      <p v-if="showsStyleLabel(join, flow.mode)" class="px-label setup-start-at">{{ STYLE_LABELS[runStyle] }}</p>
      <p v-if="startLine" class="px-label setup-start-at">{{ startLine }}</p>
      <p v-if="coopNote" class="px-label setup-start-at">{{ coopNote }}</p>
      <p v-if="failure" class="px-error" role="alert">{{ failure }}</p>
    </template>

    <template #actions>
      <PixelButton v-if="!startsRun(flow)" @press="next">Next</PixelButton>
      <template v-else>
        <PixelButton primary silent :disabled="!ready" @press="start">{{ actionLabel }}</PixelButton>
        <PixelButton v-if="resumeAt !== null && !multi && runStyle === 'arcade'" :disabled="!ready" @press="game.continueSolo()">
          Continue from level {{ resumeAt }}
        </PixelButton>
      </template>
    </template>
  </TitlePage>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import { DEFAULT_SERVER_PORT } from '../../shared/constants.ts';
import type { GameStyle } from '../../shared/game-style.ts';
import { trackTitlePage } from '../game/analytics/index.ts';
import type { PixelSprite } from '../art/types.ts';
import { loadCharacter } from '../game/character-pref.ts';
import { loadDifficulty } from '../game/difficulty-pref.ts';
import { setupLevelLines } from '../game/home-screens.ts';
import { SERVER_FIELD_ID } from '../game/hud-state.ts';
import type { UiState } from '../game/hud-state.ts';
import { buildInviteLink, buildRoomLink } from '../game/invite-link.ts';
import { onlineRoomsLive } from '../network/play-api.ts';
import { chosenStartLevel, continueLevel, isLevelUnlocked, loadLevelProgress } from '../game/level-progress.ts';
import { advance, chooseMode, claimedStyle, playHeading, playStepper, retreat, returnTo, setupFailure, setupStyle, showsServer, showsStyleLabel, startFlow, startsRun, STYLE_LABELS } from '../game/play-flow.ts';
import type { PlayMode, PlayStep } from '../game/play-flow.ts';
import { setupActionLabel } from '../game/title-menu.ts';
import CharacterSelect from './CharacterSelect.vue';
import DifficultySelect from './DifficultySelect.vue';
import ModeSelect from './ModeSelect.vue';
import PixelButton from './PixelButton.vue';
import SetupStepper from './SetupStepper.vue';
import StyleSelect from './StyleSelect.vue';
import TitlePage from './TitlePage.vue';
import { useGame } from './use-game.ts';

const { ui, join = false, level = null } = defineProps<{ ui: UiState; join?: boolean; level?: number | null }>();
const emit = defineEmits<{ close: [] }>();
const game = useGame();
const callsign = useTemplateRef<HTMLInputElement>('callsign');
const styles = useTemplateRef<InstanceType<typeof StyleSelect>>('styles');
const survivors = useTemplateRef<InstanceType<typeof CharacterSelect>>('survivors');
const difficulty = useTemplateRef<InstanceType<typeof DifficultySelect>>('difficulty');
const flow = ref(startFlow(join, level));
const copied = ref<'idle' | 'done' | 'failed'>('idle');
const INVITE_LABELS = { idle: 'Copy invite link', done: 'Link copied', failed: 'Copy failed' } as const;

/** Read when the page opens: a run cannot be under way while the setup is showing. */
const resumeAt = continueLevel(loadLevelProgress());
/** The level picked on the Levels page, kept only while it is still unlocked and past the first. */
const chosen = level === null ? null : chosenStartLevel(level, loadLevelProgress());
const isChosenUnlocked = level !== null && isLevelUnlocked(level, loadLevelProgress());
const runStyle = computed(() => setupStyle(level, ui.style));
/** What this page may say about the style: nothing on an invite link, since the room decides. The run still offers the remembered one to an empty room. */
const shownStyle = computed(() => claimedStyle(join, runStyle.value));
const levelLines = computed(() => setupLevelLines({ style: shownStyle.value, multi: multi.value, level, unlocked: isChosenUnlocked, chosen }));
const startLine = computed(() => levelLines.value.startLine);
const coopNote = computed(() => levelLines.value.coopNote);
const heading = computed(() => playHeading(flow.value));
const stepper = computed(() => playStepper(flow.value));
/**
 * What each step settled, as its own picture, for the stepper to show once the step is done.
 * Difficulty and survivor are saved prefs, read again whenever the flow moves (it is replaced on every step), the only time a done step can change.
 */
const thumbs = computed<Partial<Record<PlayStep, PixelSprite>>>(() => {
  const art = ui.art;
  const isArtLoading = art === null;
  if (isArtLoading) return {};
  return {
    style: art.ui.style[runStyle.value],
    mode: art.ui.mode[flow.value.mode],
    difficulty: art.ui.difficulty[loadDifficulty()],
    who: art.survivors[loadCharacter()]?.select,
  };
});
/** Co-op on either step: the mode decides how the run starts. The server field shows on the first step only. */
const multi = computed(() => flow.value.mode === 'multi');
const serverShown = computed(() => showsServer(flow.value));
const ready = computed(() => ui.art !== null && !ui.connecting);
const actionLabel = computed(() => setupActionLabel(multi.value, ui.art !== null, ui.connecting));
const failure = computed(() => setupFailure(flow.value.mode, runStyle.value, ui.error));
const defaultServer = `${window.location.hostname}:${DEFAULT_SERVER_PORT}`;
/** The address friends need: what is typed, or this host's default when the field is blank. */
/** A build with online rooms takes a room code in the same field, and a blank one hosts a new room. */
const online = onlineRoomsLive();
const inviteLink = computed(() => {
  const typed = ui.serverAddress.trim();
  if (online) return typed ? (buildRoomLink(window.location.href, typed) ?? buildInviteLink(window.location.href, typed)) : null;
  return buildInviteLink(window.location.href, typed || defaultServer);
});

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

/** A method handed to the template loses its `this`, so the pick goes through here. */
function chooseStyle(style: GameStyle): void {
  game.chooseStyle(style);
}

function pick(mode: PlayMode): void {
  flow.value = chooseMode(flow.value, mode);
}

function start(): void {
  if (multi.value) {
    game.startCoop(runStyle.value);
    return;
  }
  const isContinuing = chosen !== null;
  if (isContinuing) game.continueSolo(chosen);
  else game.startSolo(runStyle.value);
}

/** Puts the keyboard where each step starts: the chosen style, the callsign, the chosen difficulty, or the chosen survivor. */
function focusStep(): void {
  void nextTick(() => {
    styles.value?.focus();
    callsign.value?.focus();
    difficulty.value?.focus();
    survivors.value?.focus();
  });
}

/** Enter in a field only moves one step on, landing on that step's choice; the run starts from the button on the last. */
function next(event?: Event): void {
  const isKeyRepeat = event instanceof KeyboardEvent && event.repeat;
  if (isKeyRepeat) return;
  flow.value = advance(flow.value);
  focusStep();
}

/** A done step picked on the stepper: straight back to it, the keyboard landing on its choice. */
function jump(step: PlayStep): void {
  flow.value = returnTo(flow.value, step);
  focusStep();
}

/** Back and Esc step back first; a connection still being tried would otherwise pull the player into a room from the menu. */
function back(): void {
  if (ui.connecting) game.toMenu();
  const earlier = retreat(flow.value);
  if (earlier) {
    flow.value = earlier;
    focusStep();
    return;
  }
  emit('close');
}

onMounted(() => {
  styles.value?.focus();
  callsign.value?.focus();
  trackTitlePage('play');
});
</script>

<style scoped>
/* Callsign and the server side by side, one input high, so the step fits beside the big card's height. */
.setup-fields {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: calc(var(--u) * 6);
  padding: 0 var(--u);
}

.setup-field {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.setup-field.is-hidden {
  visibility: hidden;
}

.setup-server {
  display: flex;
  gap: calc(var(--u) * 3);
}

.setup-invite {
  flex: none;
  width: auto;
}

.setup-start-at {
  margin: 0;
}

/* A phone stacks the two, the server's room still kept. */
@media (max-width: 600px) {
  .setup-fields {
    grid-template-columns: 1fr;
    gap: calc(var(--u) * 3);
  }
}
</style>
