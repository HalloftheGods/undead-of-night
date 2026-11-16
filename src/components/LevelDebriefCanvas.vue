<template><span hidden /></template>

<script setup lang="ts">
/**
 * End-of-level debrief screen drawn directly on the game canvas via PageModel / useCanvasPage:
 * shows town kill stats, containers searched, houses cleared, and XP split across survivors.
 */
import { computed } from 'vue';
import type { LevelDebriefStats } from '../../shared/protocol.ts';
import type { PageItem, PageModel, PagePanel } from '../engine/page-ui.ts';
import { useGame } from './use-game.ts';
import { useCanvasPage } from './use-canvas-page.ts';

const { debrief } = defineProps<{ debrief: LevelDebriefStats }>();

const game = useGame();

const model = computed<PageModel>(() => {
  const summaryItems: PageItem[] = [
    { kind: 'stat', label: 'Zombies killed', value: String(debrief.kills) },
    { kind: 'stat', label: 'Headshots', value: String(debrief.headshots) },
    { kind: 'stat', label: 'Containers searched', value: `${debrief.containersSearched} of ${debrief.totalContainers}` },
    { kind: 'stat', label: 'Houses cleared', value: `${debrief.buildingsCleared} of ${debrief.totalBuildings}` },
    { kind: 'stat', label: 'Clear bonus XP', value: `+${debrief.totalClearXp} XP` },
  ];

  const panels: PagePanel[] = [
    { heading: 'Town Summary', items: summaryItems },
  ];

  const hasSquad = debrief.players.length > 1;
  if (hasSquad) {
    for (const player of debrief.players) {
      panels.push({
        heading: player.name,
        items: [
          { kind: 'stat', label: 'Kills', value: `${player.kills} (${player.headshots} headshots)` },
          { kind: 'stat', label: 'Containers looted', value: String(player.containersSearched) },
          { kind: 'stat', label: 'Clear XP share', value: `+${player.clearXpEarned} XP` },
        ],
      });
    }
  }

  return {
    heading: `Town Debrief: ${debrief.townName}`,
    panels,
    buttons: [
      { id: 'continue', label: 'Continue', enabled: true, primary: true },
    ],
  };
});

function advance(): void {
  game.continueDebrief();
}

useCanvasPage(model, { press: (id) => { if (id === 'continue') advance(); } }, advance);
</script>
