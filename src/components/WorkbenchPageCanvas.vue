<template><span hidden /></template>

<script setup lang="ts">
/**
 * Workbench drawn on the game canvas with the page kit instead of WorkbenchScreen:
 * weapon upgrade fitting, special rounds kit loading, weapon stat metrics, and squad readiness.
 */
import { computed, ref, watch } from 'vue';
import { WEAPONS } from '../../shared/constants.ts';
import { GUN_SLOTS, PART_LABELS, PART_ORDER } from '../../shared/gun-upgrade-data.ts';
import type { GunUpgrade } from '../../shared/gun-upgrade-data.ts';
import { effectOf, slotsUsed } from '../../shared/gun-upgrades.ts';
import type { WeaponId } from '../../shared/protocol.ts';
import { GUN_EFFECTS } from '../../shared/round-effect-data.ts';
import type { GunEffect } from '../../shared/round-effect-data.ts';
import type { ArtBook } from '../art/types.ts';
import { effectView } from '../game/bench-effects.ts';
import { benchNote, benchRows, gunBars, NO_GEAR, type BenchHud } from '../game/bench-view.ts';
import type { HudState } from '../game/hud-state.ts';
import type { PageItem, PageModel, PagePanel } from '../engine/page-ui.ts';
import { useCanvasPage } from './use-canvas-page.ts';
import { useGame } from './use-game.ts';

const { hud, bench, art } = defineProps<{ hud: HudState; bench: BenchHud; art: ArtBook }>();
const game = useGame();

const gear = computed(() => hud.gear ?? NO_GEAR);
const ownedGuns = computed(() => hud.owned);

const pickedWeapon = ref<WeaponId | null>(null);
const currentWeapon = computed<WeaponId>(() => {
  const owned = ownedGuns.value;
  if (pickedWeapon.value && owned.includes(pickedWeapon.value)) return pickedWeapon.value;
  return owned[0] ?? 'pistol';
});

watch(
  () => ownedGuns.value,
  (owned) => {
    if (pickedWeapon.value && !owned.includes(pickedWeapon.value)) {
      pickedWeapon.value = owned[0] ?? null;
    }
  }
);

const model = computed<PageModel>(() => {
  const weapon = currentWeapon.value;
  const fit = gear.value.fits[weapon];
  const activeEffect = effectOf(fit);
  const panels: PagePanel[] = [];

  const weaponOptions = ownedGuns.value.map((w) => ({
    id: w,
    label: WEAPONS[w].label.toUpperCase(),
  }));

  const overviewItems: PageItem[] = [
    {
      kind: 'choice',
      id: 'weapon',
      label: 'CHOSEN FIREARM',
      options: weaponOptions,
      value: weapon,
    },
    {
      kind: 'text',
      text: benchNote(bench).toUpperCase(),
      tone: 'accent',
    },
    {
      kind: 'stat',
      label: 'MODIFICATION SLOTS',
      value: `${slotsUsed(fit)} / ${GUN_SLOTS[weapon]} SLOTS`,
    },
    {
      kind: 'stat',
      label: 'ROUND TYPE LOADED',
      value: activeEffect ? GUN_EFFECTS[activeEffect].label.toUpperCase() : 'STANDARD ROUNDS',
    },
  ];

  const statBars = gunBars(weapon, fit);
  for (const bar of statBars) {
    overviewItems.push({
      kind: 'stat',
      label: bar.label.toUpperCase(),
      value: bar.value.toUpperCase(),
    });
  }

  panels.push({
    heading: `${WEAPONS[weapon].label.toUpperCase()} CONFIGURATION`,
    items: overviewItems,
  });

  const upgradeList = benchRows(weapon, ownedGuns.value, gear.value);
  const upgradeItems: PageItem[] = upgradeList.map((row) => {
    const isFittable = row.fittable;
    const sprite = art.ui.weaponIcons[weapon];
    const subNote = row.blocked ? row.blocked : `${row.effect} [CLICK TO FIT RANK]`;

    return {
      kind: 'link',
      id: `fit:${row.upgrade}`,
      label: `${row.label} (RANK ${row.rank}/${row.maxRank})`,
      icon: sprite,
      value: row.costText.toUpperCase(),
      sub: subNote.toUpperCase(),
      disabled: !isFittable,
    };
  });

  panels.push({
    heading: 'UPGRADES & MODIFICATIONS',
    items: upgradeItems,
  });

  const effectData = effectView(weapon, ownedGuns.value, gear.value);
  const roundItems: PageItem[] = effectData.options.map((option) => {
    const effectMeta = GUN_EFFECTS[option.effect];
    const sprite = art.ui.pickupIcons[effectMeta.kit];
    const isFitted = effectData.current?.effect === option.effect;
    const idleStatusText = option.fittable ? 'READY TO LOAD' : 'KIT REQUIRED';
    const statusText = isFitted ? 'ACTIVE' : idleStatusText;

    return {
      kind: 'link',
      id: `effect:${option.effect}`,
      label: effectMeta.label,
      icon: sprite,
      value: statusText,
      sub: `${effectMeta.note} [${isFitted ? 'LOADED' : 'CLICK TO LOAD'}]`.toUpperCase(),
      disabled: isFitted || !option.fittable,
    };
  });

  panels.push({
    heading: 'SPECIAL ROUND KITS',
    items: roundItems,
  });

  const partItems: PageItem[] = PART_ORDER.map((part) => ({
    kind: 'stat',
    label: PART_LABELS[part].toUpperCase(),
    value: `${gear.value.parts[part]} IN POCKETS`,
  }));

  panels.push({
    heading: 'CARRIED SPARE PARTS',
    items: partItems,
  });

  const waitingLabel = bench.youReady ? 'NOT READY YET' : 'READY';
  const closeButtonLabel = bench.walkUp ? 'CLOSE' : waitingLabel;

  return {
    heading: 'WORKBENCH',
    width: 420,
    panels,
    buttons: [
      {
        id: 'action',
        label: closeButtonLabel,
        enabled: true,
        primary: bench.walkUp || !bench.youReady,
      },
    ],
  };
});

function press(id: string): void {
  if (id === 'action') {
    if (bench.walkUp) {
      game.home.closeStation();
    } else {
      game.bench.send({ kind: 'ready', ready: !bench.youReady });
    }
    return;
  }
  const isFit = id.startsWith('fit:');
  if (isFit) {
    const upgrade = id.slice(4) as GunUpgrade;
    game.bench.send({ kind: 'fit', weapon: currentWeapon.value, upgrade });
    return;
  }
  const isEffect = id.startsWith('effect:');
  if (isEffect) {
    const effect = id.slice(7) as GunEffect;
    game.bench.send({ kind: 'fit_effect', weapon: currentWeapon.value, effect });
  }
}

function choose(id: string, option: string): void {
  if (id === 'weapon') {
    pickedWeapon.value = option as WeaponId;
  }
}

useCanvasPage(model, { press, choose }, () => game.home.closeStation());
</script>
