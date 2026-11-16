<script setup lang="ts">
/**
 * The pause card drawn on the game canvas with the page kit, while the run is paused and In-game menus is on. It draws
 * nothing itself: the canvas page does. Resume, the links out and the sliders do what the page card's do.
 */
import { computed } from 'vue';
import { townName } from '../../shared/levels.ts';
import { onlineRoomsLive } from '../network/play-api.ts';
import type { TransportKind } from '../network/transport.ts';
import { leaveWarning } from '../game/home-screens.ts';
import type { UiState } from '../game/hud-state.ts';
import { brightness, brightnessLift, setBrightness } from '../game/display-prefs.ts';
import { pausePageModel } from '../game/pause-page.ts';
import type { PauseFacts } from '../game/pause-page.ts';
import { loadSoundUnlock } from '../game/sound-unlock.ts';
import { useCanvasPage } from './use-canvas-page.ts';
import { useGame } from './use-game.ts';

const { ui, mode } = defineProps<{ ui: UiState; mode: TransportKind }>();
const emit = defineEmits<{ openBook: []; openControls: []; openRadio: [] }>();
const game = useGame();

const percent = (value: number): string => `${Math.round(value * 100)}%`;

function facts(): PauseFacts {
  const level = ui.hud?.level ?? null;
  const inBunker = ui.home?.inBunker === true;
  const canHost = mode === 'solo' && !game.isDaily && onlineRoomsLive();
  const levelName = level !== null ? `${level} ${townName(level)}` : '';
  return {
    heading: mode === 'solo' ? 'Paused' : 'Menu',
    where: inBunker ? 'The bunker' : levelName,
    coopNote: mode === 'coop' ? 'Co-op does not pause. The horde is still coming.' : null,
    roomCode: ui.onlineRoom ?? null,
    canHost: canHost && !ui.onlineRoom,
    warning: leaveWarning(ui.home),
    error: ui.error ?? null,
    volume: ui.volume,
    volumeReadout: ui.muted ? 'Muted' : percent(ui.volume),
    brightness: brightness.value,
    brightnessReadout: brightnessLift() === 0 ? 'Normal' : `+${percent(brightnessLift())}`,
    hasRadio: loadSoundUnlock().radio || ui.home?.save?.camp?.radio === true,
  };
}

const model = computed(() => pausePageModel(facts()));

function press(id: string): void {
  if (id === 'resume') game.togglePause();
  else if (id === 'host') game.hostCurrentRun();
  else if (id === 'controls') emit('openControls');
  else if (id === 'books') emit('openBook');
  else if (id === 'radio') emit('openRadio');
  else if (id === 'menu') game.toMenu();
}

function slide(id: string, value: number): void {
  if (id === 'volume') game.setVolume(value);
  else if (id === 'brightness') setBrightness(value);
}

useCanvasPage(model, { press, slide }, () => undefined);
</script>

<template>
  <span hidden />
</template>
