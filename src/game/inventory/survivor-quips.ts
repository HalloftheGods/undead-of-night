// How the survivor takes the item in hand, worked out from their own needs and health, and the line they say
// about it. The thresholds follow shared/survival-needs.ts: a `full` item is one the sim would refuse.

import { isAmmoBoxType } from '../../../shared/bag.ts';
import { isCandyId } from '../../../shared/candy.ts';
import type { SurvivalNeeds } from '../../../shared/survival-needs.ts';
import { voiceOf, type NeedReason, type QuipMood } from './survivor-voices.ts';

/** A need at or past this is worth asking for (the HUD's "peckish" mark). */
const WANTS = 25;
/** Health under this share makes a medkit a need, not a nice-to-have. */
const HURT_SHARE = 0.6;

/** What the reaction reads off the survivor. */
export interface QuipSurvivor {
  readonly skin: number;
  readonly health: number;
  readonly maxHealth: number;
  readonly needs?: SurvivalNeeds;
}

export interface SurvivorReaction {
  readonly mood: QuipMood;
  /** Set when the mood is `need`. */
  readonly reason: NeedReason | null;
  readonly line: string;
}

interface Verdict {
  readonly mood: QuipMood;
  readonly reason: NeedReason | null;
}

const need = (reason: NeedReason): Verdict => ({ mood: 'need', reason });
const FINE: Verdict = { mood: 'fine', reason: null };
const FULL: Verdict = { mood: 'full', reason: null };
const CANT: Verdict = { mood: 'cant', reason: null };

/** Whether the item would help, and why. `usable` is whether the item has a use action at all. */
export function judgeItem(type: string, usable: boolean, who: QuipSurvivor): Verdict {
  if (!usable) return CANT;
  if (isCandyId(type) || isAmmoBoxType(type)) return FINE;
  const hurt = who.health < who.maxHealth;
  if (type === 'medkit') {
    if (who.health < who.maxHealth * HURT_SHARE) return need('hurt');
    return hurt ? FINE : FULL;
  }
  const needs = who.needs;
  // Without needs in the snapshot there is nothing to judge by, so the item is simply welcome.
  if (!needs) return FINE;
  if (type === 'canned_food') {
    if (needs.hunger >= WANTS) return need('hunger');
    return needs.hunger > 0 || hurt ? FINE : FULL;
  }
  if (type === 'water_bottle') {
    if (needs.thirst >= WANTS) return need('thirst');
    return needs.thirst > 0 ? FINE : FULL;
  }
  if (type === 'bandage') return needs.bleeding ? need('bleed') : FULL;
  if (type === 'disinfectant') return needs.wound !== 'none' || needs.bleeding ? need('wound') : FULL;
  if (type === 'antibiotics') return needs.isInfected || needs.infection > 0 ? need('sick') : FULL;
  return FINE;
}

/** A small stable hash, so the same item in hand keeps the same line instead of flickering each frame. */
function pick(seed: string, count: number): number {
  let h = 0;
  for (const char of seed) h = (h * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(h) % count;
}

/** The survivor's take on the item in hand, in their own voice. `itemId` keeps the line steady while it is held. */
export function survivorReaction(type: string, itemId: string, usable: boolean, who: QuipSurvivor): SurvivorReaction {
  const verdict = judgeItem(type, usable, who);
  const voice = voiceOf(who.skin);
  const lines = verdict.reason ? voice[verdict.reason] : voice[verdict.mood as Exclude<QuipMood, 'need'>];
  return { ...verdict, line: lines[pick(itemId, lines.length)] };
}
