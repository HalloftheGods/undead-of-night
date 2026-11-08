<template>
  <TitlePage :heading size="extra-wide" boxed steady @close="back">
    <template #lead>
      <SetupStepper :stops="stepper" :thumbs @pick="jump" />
    </template>

    <template v-if="flow.step === 'mode'">
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
            @keydown.enter.prevent="next"
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
import { trackTitlePage } from '../game/analytics/index.ts';
import type { PixelSprite } from '../art/types.ts';
import { loadCharacter } from '../game/character-pref.ts';
import { loadDifficulty } from '../game/difficulty-pref.ts';
import { setupLevelLines } from '../game/home-screens.ts';
import { SERVER_FIELD_ID } from '../game/hud-state.ts';
import type { UiState } from '../game/hud-state.ts';
import { buildInviteLink } from '../game/invite-link.ts';
import { onlineRoomsLive } from '../network/play-api.ts';
import type { CoopEntry } from '../game/run-session.ts';
import { chosenStartLevel, continueLevel, isLevelUnlocked, loadLevelProgress } from '../game/level-progress.ts';
import { advance, chooseMode, claimedStyle, playHeading, playStepper, retreat, returnTo, setupFailure, setupStyle, showsServer, showsStyleLabel, startFlow, startsRun, STYLE_LABELS } from '../game/play-flow.ts';
import type { PlayMode, PlayStep } from '../game/play-flow.ts';
import { COOP_ACTIONS, setupActionLabel, type CoopAction } from '../game/title-menu.ts';
import CharacterSelect from './CharacterSelect.vue';
import DifficultySelect from './DifficultySelect.vue';
import ModeSelect from './ModeSelect.vue';
import PixelButton from './PixelButton.vue';
import SetupStepper from './SetupStepper.vue';
import TitlePage from './TitlePage.vue';
import { useGame } from './use-game.ts';

const { ui, join = false, level = null } = defineProps<{ ui: UiState; join?: boolean; level?: number | null }>();
const emit = defineEmits<{ close: [] }>();
const game = useGame();
const callsign = useTemplateRef<HTMLInputElement>('callsign');

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
    mode: art.ui.mode[flow.value.mode],
    difficulty: art.ui.difficulty[loadDifficulty()],
    who: art.survivors[loadCharacter()]?.select,
  };
});
/** Co-op on either step: the mode decides how the run starts. The server field shows on the first step only. */
const multi = computed(() => flow.value.mode === 'multi');
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
const actionLabel = computed(() => setupActionLabel(multi.value, ui.art !== null, ui.connecting, coopAction.value));
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

function pick(mode: PlayMode): void {
  flow.value = chooseMode(flow.value, mode);
}

function start(): void {
  if (multi.value) {
    game.startCoop(runStyle.value, online ? entry.value : undefined);
    return;
  }
  const isContinuing = chosen !== null;
  if (isContinuing) game.continueSolo(chosen);
  else game.startSolo(runStyle.value);
}

/** Puts the keyboard where each step starts: the callsign, the chosen difficulty, or the chosen survivor. */
function focusStep(): void {
  void nextTick(() => {
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
