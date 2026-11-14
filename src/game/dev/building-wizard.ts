import { BUILDING_DEFS } from '../../../shared/map-protocol.ts';
import type { BuildingKind } from '../../../shared/map-protocol.ts';
import { CONTAINER_LABEL, ROOM_CONTAINERS } from '../../../shared/containers.ts';
import type { ContainerKind } from '../../../shared/containers.ts';
import { CONTAINER_LOOT } from '../../../shared/container-loot.ts';
import type { BuildingDraft } from './bench-store.ts';

/**
 * The building bench as a wizard: one small question per step, in plain words, so anyone can get through it.
 * Both benches (HTML and canvas) read the same steps, words and summary from here.
 */

export type BuildingStep = 'pick' | 'rooms' | 'loot' | 'done';

export interface StepInfo {
  readonly id: BuildingStep;
  /** Short name for the step dots. */
  readonly title: string;
  /** The one question this step asks. */
  readonly ask: string;
  /** What to do, in a few easy words. */
  readonly hint: string;
}

export const BUILDING_STEPS: readonly StepInfo[] = [
  { id: 'pick', title: 'Pick', ask: 'Which building do you want to change?', hint: 'Tap a building to start.' },
  { id: 'rooms', title: 'Search spots', ask: 'What opens when you search each spot?', hint: 'Pick a box for each spot. Then press Next.' },
  { id: 'loot', title: 'Loot', ask: 'What can you find inside?', hint: 'Slide to make things easy or hard to find. Then press Next.' },
  { id: 'done', title: 'Done', ask: 'All done! Here is what you changed.', hint: 'Pick another building, or undo your changes.' },
];

export const stepIndex = (step: BuildingStep): number => BUILDING_STEPS.findIndex((s) => s.id === step);
export const stepInfo = (step: BuildingStep): StepInfo => BUILDING_STEPS[stepIndex(step)];

export const nextStep = (step: BuildingStep): BuildingStep =>
  BUILDING_STEPS[Math.min(BUILDING_STEPS.length - 1, stepIndex(step) + 1)].id;

export const prevStep = (step: BuildingStep): BuildingStep => BUILDING_STEPS[Math.max(0, stepIndex(step) - 1)].id;

/** "Step 2 of 4: Search spots". */
export const stepCounter = (step: BuildingStep): string =>
  `Step ${stepIndex(step) + 1} of ${BUILDING_STEPS.length}: ${stepInfo(step).title}`;

/** A code id such as `kitchen_cabinet` or `pickupType` as words: "Kitchen cabinet". */
export const friendlyName = (id: string): string => {
  const words = id
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** A loot weight as a word a child can read. */
export const weightWord = (weight: number): string => {
  if (weight < 0.75) return 'Rare';
  if (weight < 1.5) return 'Sometimes';
  if (weight < 3) return 'Often';
  return 'Lots';
};

/** The odds of a search finding anything, as words. */
export const oddsWords = (odds: number): string => `${Math.round(odds * 100)} out of 100 searches find something`;

/** Every change from the code's own tables, one plain sentence each. Empty when nothing changed. */
export function changeSummary(kind: BuildingKind, draft: BuildingDraft): string[] {
  const lines: string[] = [];
  const rooms = ROOM_CONTAINERS[kind] ?? {};
  for (const [prop, container] of Object.entries(draft.rooms)) {
    const before = rooms[prop as keyof typeof rooms];
    if (container && before !== container) {
      lines.push(`${friendlyName(prop)} now opens as ${CONTAINER_LABEL[container as ContainerKind]}.`);
    }
  }
  const loot = CONTAINER_LOOT[kind];
  if (draft.odds !== loot.odds) {
    lines.push(`Finding something: ${Math.round(loot.odds * 100)}% → ${Math.round(draft.odds * 100)}%.`);
  }
  const table = loot.table as Record<string, number | undefined>;
  for (const [item, weight] of Object.entries(draft.pool)) {
    const before = table[item];
    if (before === undefined) lines.push(`Added ${friendlyName(item)} (${weightWord(weight)}).`);
    else if (before !== weight) lines.push(`${friendlyName(item)}: ${weightWord(before)} → ${weightWord(weight)}.`);
  }
  for (const item of Object.keys(table)) {
    if (!(item in draft.pool)) lines.push(`Removed ${friendlyName(item)}.`);
  }
  return lines;
}

export const buildingLabel = (kind: BuildingKind): string => BUILDING_DEFS[kind].label;
