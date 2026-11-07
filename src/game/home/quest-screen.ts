// What the merchant screen's Work tab decides, apart from drawing it: which tab opens, and what a press does.

import type { MerchantId } from '../../../shared/home-protocol.ts';
import type { HomeActions } from '../home-hud.ts';
import type { QuestPanel } from './quest-view.ts';
import type { ObjectiveBar } from './quest-view.ts';
import type { ItemFact } from './shop-item-facts.ts';

export type StallTab = 'shelf' | 'work';

export const STALL_TABS: readonly StallTab[] = ['shelf', 'work'];

/** The screen opens on Work when a job is waiting for its pay, and on the shelf otherwise. */
export function startTab(panels: readonly QuestPanel[]): StallTab {
  return panels.some((panel) => panel.state === 'ready') ? 'work' : 'shelf';
}

const WORDS: Record<QuestPanel['state'], string> = { ready: 'Ready', active: 'Active', busy: 'Waiting', offered: 'Offered' };

/** What a quest tile says about its job, in a word. */
export function stateWord(panel: QuestPanel): string {
  return WORDS[panel.state];
}

/** The button under the panel: accept an offer or collect a finished job. Null when there is nothing to press. */
export function primaryLabel(panel: QuestPanel): string | null {
  const isAccept = panel.action === 'accept';
  if (isAccept) return 'Accept';
  const isTurnIn = panel.action === 'turn_in';
  if (isTurnIn) return 'Turn in';
  return null;
}

/** Accept or Turn in, as the panel's action says; the home layer does the rest and the save shows the outcome. */
export function pressPrimary(panel: QuestPanel, merchant: MerchantId, actions: Pick<HomeActions, 'acceptQuest' | 'turnInQuest'>): void {
  if (!panel.canAct) return;
  const isAccept = panel.action === 'accept';
  if (isAccept) actions.acceptQuest(merchant, panel.id);
  const isTurnIn = panel.action === 'turn_in';
  if (isTurnIn) actions.turnInQuest(merchant);
}

/** The Abandon button's word: it asks once before it gives anything up, in the same place and the same size. */
export const abandonLabel = (armed: boolean): string => (armed ? 'Confirm' : 'Abandon');

/**
 * Abandon takes two presses: the first arms the button, the second gives the quest up. Returns whether the button is armed
 * after this press, so the caller holds that and clears it when focus leaves or the pick moves.
 */
export function pressAbandon(panel: QuestPanel, merchant: MerchantId, actions: Pick<HomeActions, 'abandonQuest'>, armed = false): boolean {
  if (!panel.canAbandon) return false;
  if (!armed) return true;
  actions.abandonQuest(merchant);
  return false;
}

/** An objective bar as the item column's bar rows draw it; the objective itself is the unlabelled one. */
export function barRows(bars: readonly ObjectiveBar[]): ItemFact[] {
  return bars.map((bar) => ({ label: bar.label ?? 'Goal', value: bar.value, filled: bar.filled }));
}

/** The pick stays on its quest while the list changes; if it is gone, it falls to the first. */
export function pickedIndex(panels: readonly QuestPanel[], id: string | null): number {
  const at = panels.findIndex((panel) => panel.id === id);
  return at >= 0 ? at : 0;
}
