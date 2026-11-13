// A save from before the camp had people: what it already earned carries over, once.

import { MERCHANT_IDS } from '../../../shared/home-protocol.ts';
import type { SoundUnlock } from '../sound-unlock.ts';
import { emptyCamp } from './home-store.ts';
import type { HomeSave } from './home-store.ts';

const hasHistory = (save: HomeSave): boolean => save.ledger.length > 0 || save.appliedReceipts.length > 0;

/**
 * A save with no `camp` gets one. An existing save (it has trips on file) starts with all four merchants rescued, so nobody
 * loses a shop or a quest partway through; a brand-new save starts with none. The browser's old radio flag and its tracks
 * carry over either way. A save that already has a camp is returned as it is.
 */
export function migrateCamp(save: HomeSave, legacy: SoundUnlock): HomeSave {
  if (save.camp) return save;
  const camp = emptyCamp();
  if (hasHistory(save)) camp.rescued = [...MERCHANT_IDS];
  camp.radio = legacy.radio;
  camp.tracks = [...legacy.tracks];
  return { ...save, camp };
}
