// Which stalls show a "!" over their merchant: a quest waiting to be taken, or one finished and waiting for its pay.

import type { PropInstance } from '../../../shared/protocol.ts';
import { MERCHANT_IDS } from '../../../shared/home-protocol.ts';
import type { QuestMark } from '../../engine/scene.ts';
import type { HomeSave } from './home-store.ts';
import { MERCHANTS } from './merchant-data.ts';
import { closedStalls } from './shop.ts';
import { questRows } from './quests.ts';

/** The marks for this save, one per open stall whose merchant has a quest ready or on offer. Nothing without a save. */
export function questMarks(save: HomeSave | null, highest: number, props: readonly PropInstance[]): QuestMark[] {
  if (!save) return [];
  const closed = closedStalls(save.shop);
  const marks: QuestMark[] = [];
  for (const merchant of MERCHANT_IDS) {
    const stall = props.find((prop) => prop.kind === merchant);
    const isStallShut = !stall || closed.includes(merchant);
    if (isStallShut) continue;
    const rows = questRows(save, merchant, highest);
    const ready = rows.some((row) => row.state === 'ready');
    const offered = rows.some((row) => row.state === 'offered');
    const hasQuestToShow = ready || offered;
    if (hasQuestToShow) marks.push({ merchant, name: MERCHANTS[merchant].name, x: stall.x, y: stall.y, ready });
  }
  return marks;
}
