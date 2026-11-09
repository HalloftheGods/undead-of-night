<template>
  <section class="bench-effect" :aria-label="`Rounds for ${WEAPONS[weapon].label}`">
    <ul class="bench-effect-kits">
      <WorkbenchTile
        v-for="option in view.options"
        :key="option.effect"
        :sprites="[art.ui.pickupIcons[GUN_EFFECTS[option.effect].kit]]"
        :label="option.label"
        :aria="`${view.current ? 'Replace with' : 'Fit'} ${option.label}, ${option.count} carried: ${option.note}`"
        :count="option.count"
        :disabled="!option.fittable"
        :fitted="view.current?.effect === option.effect"
        :moves="view.current?.effect === option.effect ? view.moves : []"
        :weapon-icons="art.ui.weaponIcons"
        @fit="ask(option)"
        @move="move"
        @peek="emit('peek', option)"
        @unpeek="emit('peek', null)"
      />
    </ul>
    <div v-if="pending" ref="confirmBox" class="bench-effect-confirm" role="alertdialog" aria-live="assertive">
      <p>{{ replaceQuestion(pending) }}</p>
      <PixelButton primary @press="confirm">Replace</PixelButton>
      <PixelButton @press="pending = null">Keep {{ pending.replaces }}</PixelButton>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * The round kits for the gun in focus, one framed tile each with the count carried; the kit on the gun is
 * framed amber and carries the toolkit moves. Fitting over an effect already on the gun asks first, in a box
 * laid over the tiles so the screen never moves.
 */
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';
import { WEAPONS } from '../../shared/constants.ts';
import type { PlayerGear } from '../../shared/gun-upgrades.ts';
import type { WeaponId } from '../../shared/protocol.ts';
import { GUN_EFFECTS } from '../../shared/round-effect-data.ts';
import type { ArtBook } from '../art/types.ts';
import { effectView, needsConfirm, replaceQuestion } from '../game/bench-effects.ts';
import type { EffectOption } from '../game/bench-effects.ts';
import PixelButton from './PixelButton.vue';
import { useGame } from './use-game.ts';
import WorkbenchTile from './WorkbenchTile.vue';

interface EffectProps {
  weapon: WeaponId;
  owned: readonly WeaponId[];
  gear: PlayerGear;
  art: ArtBook;
}

const { weapon, owned, gear } = defineProps<EffectProps>();
const emit = defineEmits<{ peek: [option: EffectOption | null] }>();
const game = useGame();
const confirmBox = useTemplateRef<HTMLElement>('confirmBox');

const view = computed(() => effectView(weapon, owned, gear));
const pending = ref<EffectOption | null>(null);

// A snapshot that changes the gun's effect, or the kits, under an open question closes it.
watch(view, (next) => {
  const stale = pending.value !== null && !next.options.some((o) => o.effect === pending.value?.effect && o.fittable && o.replaces === pending.value?.replaces);
  if (stale) pending.value = null;
});

function fit(option: EffectOption): void {
  game.bench.send({ kind: 'fit_effect', weapon, effect: option.effect });
}

/** The question lies over the tiles, so the keyboard goes to its first answer. */
function ask(option: EffectOption): void {
  if (!needsConfirm(option)) return fit(option);
  pending.value = option;
  void nextTick(() => confirmBox.value?.querySelector('button')?.focus());
}

function confirm(): void {
  if (pending.value) fit(pending.value);
  pending.value = null;
}

function move(to: WeaponId): void {
  game.bench.send({ kind: 'move_effect', from: weapon, to });
}
</script>

<style scoped>
.bench-effect {
  position: relative;
}

.bench-effect-kits {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: calc(var(--u) * 3);
  margin: 0;
  padding: var(--u);
  list-style: none;
}

/* Over the kit tiles and their frames, never beside them: asking moves nothing. */
.bench-effect-confirm {
  position: absolute;
  inset: calc(var(--u) * -1);
  z-index: 1;
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 3);
  padding: calc(var(--u) * 3);
  border: var(--u) solid var(--sick);
  background: var(--ink);
  color: var(--sick);
}

.bench-effect-confirm p {
  flex: 1;
  margin: 0;
  font-size: calc(var(--u) * 6);
}

.bench-effect-confirm .px-button {
  width: auto;
}

/* A phone fits two kits to a row, and the question stacks its answers. */
@container select (max-width: 420px) {
  .bench-effect-kits {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .bench-effect-confirm {
    flex-direction: column;
    justify-content: center;
  }
}
</style>
