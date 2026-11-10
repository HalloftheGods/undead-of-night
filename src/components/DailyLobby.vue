<template>
  <section class="px-screen px-title-scale daily-lobby" aria-labelledby="lobby-heading">
    <header class="daily-lobby-head">
      <h2 id="lobby-heading" class="px-heading daily-lobby-title">Nightly MP Lobby</h2>
      <p class="px-label daily-lobby-kicker">
        {{ dayLabel(night.key) }} - {{ facts.title }} - {{ facts.level }}
      </p>
    </header>

    <div v-if="countdown !== null" class="daily-lobby-countdown px-frame">
      <span class="daily-lobby-pulse" aria-hidden="true">●</span>
      Starting in {{ countdown }}s
    </div>

    <div class="daily-lobby-seats">
      <div
        v-for="char in characters"
        :key="char.skin"
        class="daily-lobby-seat px-frame"
        :class="{
          'is-occupied': char.occupied,
          'is-ready': char.ready,
          'is-you': char.isYou,
        }"
      >
        <div class="seat-top">
          <span class="seat-role">{{ char.name }}</span>
          <span v-if="char.isHost" class="seat-badge is-host">HOST</span>
          <span v-else-if="char.isYou" class="seat-badge is-you">YOU</span>
        </div>

        <div class="seat-body">
          <span class="seat-callsign">{{ char.callsign }}</span>
          <span class="seat-trait">{{ char.trait }}</span>
        </div>

        <div class="seat-status">
          <span
            class="seat-state-pill"
            :class="{
              'is-ready': char.ready,
              'is-waiting': char.occupied && !char.ready,
              'is-empty': !char.occupied,
            }"
          >
            {{ char.statusLabel }}
          </span>
        </div>
      </div>
    </div>

    <footer class="daily-lobby-controls">
      <div class="daily-lobby-status">
        <span class="px-label">Survivors: {{ occupiedCount }} / 5</span>
        <span class="px-label">Ready: {{ readyCount }} / {{ occupiedCount }}</span>
      </div>

      <div class="daily-lobby-actions">
        <PixelButton
          v-if="isHost"
          primary
          silent
          :disabled="countdown !== null"
          @press="startOrLaunch"
        >
          {{ countdown !== null ? 'Starting...' : 'Start Run' }}
        </PixelButton>

        <PixelButton
          v-else
          :primary="!isReady"
          silent
          @press="toggleReady"
        >
          {{ isReady ? 'Cancel Ready' : 'Ready Up' }}
        </PixelButton>

        <PixelButton
          v-if="isHost"
          silent
          @press="toggleTimer"
        >
          Auto-start: {{ lobby.autoStartTimer ? 'ON' : 'OFF' }}
        </PixelButton>

        <MenuLink @press="leaveLobby">Leave Lobby</MenuLink>
      </div>
    </footer>
  </section>
</template>

<script setup lang="ts">
/**
 * Daily Night multiplayer pre-match lobby.
 * Displays character seat assignments, ready status, countdown banner,
 * host start controls, and guest ready toggles.
 */
import { computed } from 'vue';
import { CHARACTERS } from '../../shared/characters.ts';
import type { LobbySeat, LobbyStatePacket } from '../../shared/protocol.ts';
import { loadCharacter } from '../game/character-pref.ts';
import { dayLabel, nightFacts, todaysNight } from '../game/daily-night.ts';
import MenuLink from './MenuLink.vue';
import PixelButton from './PixelButton.vue';
import { useGame } from './use-game.ts';

const { lobby } = defineProps<{
  lobby: LobbyStatePacket;
}>();

const game = useGame();
const night = todaysNight();
const facts = nightFacts(night);
const localSkin = loadCharacter();

const seatMap = computed(() => {
  const map = new Map<number, LobbySeat>();
  for (const seat of lobby.seats) {
    map.set(seat.skin, seat);
  }
  return map;
});

const mySeat = computed(() => seatMap.value.get(localSkin) ?? null);
const isHost = computed(() => mySeat.value?.isHost ?? (lobby.seats[0]?.skin === localSkin));
const isReady = computed(() => mySeat.value?.ready ?? false);
const countdown = computed(() => lobby.countdown);
const occupiedCount = computed(() => lobby.seats.length);
const readyCount = computed(() => lobby.seats.filter((seat) => seat.ready).length);

const characters = computed(() =>
  CHARACTERS.map((char, index) => {
    const seat = seatMap.value.get(index);
    const occupied = seat !== undefined;
    const ready = seat?.ready ?? false;
    const seatIsHost = seat?.isHost ?? false;
    const isYou = index === localSkin;

    let callsign = 'Searching...';
    if (occupied) {
      const trimmed = seat.name.trim();
      callsign = trimmed.length > 0 ? trimmed : char.name;
    }

    let statusLabel = 'OPEN';
    if (occupied) {
      statusLabel = ready ? 'READY' : 'WAITING';
    }

    return {
      skin: index,
      name: char.name,
      trait: char.trait,
      occupied,
      ready,
      isHost: seatIsHost,
      isYou,
      callsign,
      statusLabel,
    };
  }),
);

function startOrLaunch(): void {
  game.lobbyStart();
}

function toggleReady(): void {
  game.lobbyReady(!isReady.value);
}

function toggleTimer(): void {
  game.lobbyToggleTimer();
}

function leaveLobby(): void {
  game.toMenu();
}
</script>

<style scoped>
.daily-lobby {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(var(--u) * 5);
  background: rgba(7, 8, 12, 0.92);
  animation: px-fade-in 0.3s steps(4) both;
  padding: calc(var(--u) * 6);
  max-width: 100%;
}

.daily-lobby-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 1.5);
  text-align: center;
}

.daily-lobby-title {
  margin: 0;
  font-size: calc(var(--u) * 16);
  color: var(--bone);
}

.daily-lobby-kicker {
  margin: 0;
  color: var(--amber);
}

.daily-lobby-countdown {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 2);
  padding: calc(var(--u) * 2) calc(var(--u) * 6);
  background: rgba(184, 50, 40, 0.3);
  color: var(--blood-bright, #f86);
  font-family: inherit;
  font-size: calc(var(--u) * 7);
  letter-spacing: 0.05em;
  animation: px-pulse 1s infinite alternate;
}

.daily-lobby-pulse {
  color: var(--blood-bright, #f86);
  font-size: 0.8em;
}

.daily-lobby-seats {
  display: grid;
  grid-template-columns: repeat(5, minmax(calc(var(--u) * 36), 1fr));
  gap: calc(var(--u) * 3);
  width: 100%;
  max-width: calc(var(--u) * 240);
}

.daily-lobby-seat {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: calc(var(--u) * 3);
  padding: calc(var(--u) * 3);
  background: rgba(18, 22, 28, 0.85);
  min-height: calc(var(--u) * 44);
}

.daily-lobby-seat.is-occupied {
  border-color: var(--bone-dim);
}

.daily-lobby-seat.is-ready {
  border-color: var(--amber);
  background: rgba(28, 36, 32, 0.9);
}

.daily-lobby-seat.is-you {
  outline: calc(var(--u) * 0.5) solid var(--amber);
}

.seat-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.seat-role {
  font-size: calc(var(--u) * 6);
  color: var(--bone);
  font-weight: bold;
}

.seat-badge {
  font-size: calc(var(--u) * 4);
  padding: calc(var(--u) * 0.5) calc(var(--u) * 1.5);
  border-radius: 2px;
}

.seat-badge.is-host {
  background: var(--amber);
  color: #111;
  font-weight: bold;
}

.seat-badge.is-you {
  background: var(--bone-dim);
  color: #111;
}

.seat-body {
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * 1);
}

.seat-callsign {
  font-size: calc(var(--u) * 5);
  color: var(--bone-bright, #fff);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.seat-trait {
  font-size: calc(var(--u) * 3.5);
  color: var(--bone-dim);
}

.seat-status {
  display: flex;
  justify-content: flex-start;
}

.seat-state-pill {
  font-size: calc(var(--u) * 3.5);
  letter-spacing: 0.05em;
  padding: calc(var(--u) * 0.5) calc(var(--u) * 1.5);
}

.seat-state-pill.is-ready {
  color: #8f8;
}

.seat-state-pill.is-waiting {
  color: var(--amber);
}

.seat-state-pill.is-empty {
  color: var(--bone-dark, #555);
}

.daily-lobby-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 4);
  margin-top: calc(var(--u) * 2);
}

.daily-lobby-status {
  display: flex;
  gap: calc(var(--u) * 6);
  color: var(--bone-dim);
}

.daily-lobby-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: calc(var(--u) * 4);
}

@keyframes px-pulse {
  from {
    opacity: 0.7;
  }
  to {
    opacity: 1;
  }
}
</style>
