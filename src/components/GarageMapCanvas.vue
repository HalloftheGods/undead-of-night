<template><span hidden /></template>

<script setup lang="ts">
/**
 * Van Level Map drawn on the game canvas with the page kit instead of GarageMap:
 * sector destination selection, horde counts, town theme overview, and coop expedition routing.
 */
import { computed } from 'vue';
import { levelDef } from '../../shared/levels.ts';
import type { ArtBook } from '../art/types.ts';
import type { PageItem, PageModel, PagePanel } from '../engine/page-ui.ts';
import type { HomeUi } from '../game/home-hud.ts';
import { garageLevels } from '../game/home-screens.ts';
import { THEME_NAMES } from '../game/level-select.ts';
import { useCanvasPage } from './use-canvas-page.ts';
import { useGame } from './use-game.ts';

const { home, art = null } = defineProps<{ home: HomeUi; art?: ArtBook | null }>();
const game = useGame();

const levels = computed(() => garageLevels(home));

const selectedLevelNumber = computed(() => {
  const all = levels.value;
  const picked = all.find((lvl) => lvl.picked);
  if (picked) return picked.number;
  const frontier = all.find((lvl) => lvl.state === 'frontier');
  if (frontier) return frontier.number;
  return all[0]?.number ?? 1;
});

const model = computed<PageModel>(() => {
  const allLevels = levels.value;
  const currentNum = selectedLevelNumber.value;
  const currentLevel = allLevels.find((l) => l.number === currentNum) ?? allLevels[0];
  const def = levelDef(currentNum);
  const theme = THEME_NAMES[def.theme] ?? def.theme;
  const panels: PagePanel[] = [];

  const targetItems: PageItem[] = [
    {
      kind: 'text',
      text: 'CHOOSE WHERE THE ESCAPE VAN DEPARTS. ALL SURVIVORS IN CAMP DEPLOY TOGETHER.',
      tone: 'accent',
    },
    {
      kind: 'stat',
      label: 'TARGET SECTOR',
      value: `SECTOR ${currentNum}: ${currentLevel?.title.toUpperCase() ?? ''}`,
    },
    {
      kind: 'stat',
      label: 'ENVIRONMENT THEME',
      value: theme.toUpperCase(),
    },
    {
      kind: 'stat',
      label: 'EXTRACTION REQUIREMENT',
      value: `SURVIVE ${def.hordes} HORDES`,
    },
  ];

  panels.push({
    heading: 'CURRENT EXPEDITION DESTINATION',
    items: targetItems,
  });

  const levelItems: PageItem[] = allLevels.map((lvl) => {
    const lvlDef = levelDef(lvl.number);
    const lvlTheme = THEME_NAMES[lvlDef.theme] ?? lvlDef.theme;
    const isPicked = lvl.number === home.pickedLevel;
    const isSelectable = lvl.selectable;
    const sprite = art?.ui?.levelScenes?.[lvl.number - 1];

    const stateBadge = isPicked
      ? '[CURRENT PICK]'
      : lvl.state === 'frontier'
        ? '[NEW EXPEDITION]'
        : lvl.state === 'replay'
          ? '[CLEARED - REPLAY]'
          : '[LOCKED]';

    const subText = isSelectable
      ? `${lvlTheme.toUpperCase()}: ${lvlDef.hordes} HORDES [CLICK TO DEPLOY]`
      : 'SECTOR LOCKED: SURVIVE PREVIOUS TOWNS TO UNLOCK';

    return {
      kind: 'link',
      id: `level:${lvl.number}`,
      label: `${lvl.number}. ${lvl.title.toUpperCase()} ${stateBadge}`,
      icon: sprite,
      value: `${lvlDef.hordes} HORDES`,
      sub: subText,
      disabled: !isSelectable,
    };
  });

  panels.push({
    heading: 'AVAILABLE SECTORS',
    items: levelItems,
  });

  return {
    heading: 'LEVEL MAP',
    width: 420,
    panels,
    buttons: [{ id: 'close', label: 'CLOSE', enabled: true, primary: true }],
  };
});

function press(id: string): void {
  if (id === 'close') {
    game.home.closeStation();
    return;
  }
  const isLevel = id.startsWith('level:');
  if (isLevel) {
    const levelNumber = parseInt(id.slice(6), 10);
    game.home.pickLevel(levelNumber);
  }
}

useCanvasPage(model, { press }, () => game.home.closeStation());
</script>
