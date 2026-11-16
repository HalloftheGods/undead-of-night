// Hands-on care: one survivor gives another a bandage, food, water or a medkit. The item leaves the giver's bag and
// is held while the two stand still; it lands on the receiver when the time is up. Either one moving, either one
// hurt, or the need going away breaks it, and the item goes back to a cell (or the ground if the bag is full).

import { bagWanted, syncBag } from './bag.ts';
import { take } from './bag-sim.ts';
import { MEDKIT_HEAL } from './constants.ts';
import { canPlaceItem, placeItem, removeItem } from './grid-inventory.ts';
import type { GridItem } from './grid-inventory.ts';
import { CARE_REACH } from './item-move.ts';
import type { ItemMove, MoveReason } from './item-move.ts';
import { spawnPickup } from './pickups.ts';
import type { PickupType } from './protocol.ts';
import { emit } from './sim-state.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { applySupply } from './supplies.ts';
import { isSupplyType } from './supply-types.ts';
import { bandageWound } from './survival-needs.ts';

/** How long a hand-over takes, in ms. */
export const CARE_FOOD_MS = 1500;
export const CARE_MEDICAL_MS = 2500;
/** The receiver answers this long after the giver starts. */
export const CARE_REPLY_MS = 600;

const GIVER_LINES = ["Here, you need this more than me.", "Hold still, this'll sting.", "Eat. That's an order."] as const;
const REPLY_LINES = ['Yes, please!', 'Ow— thanks.'] as const;
const THANKS_LINES = ["You're a lifesaver.", 'Finally.'] as const;

const CARE_TYPES = ['bandage', 'canned_food', 'water_bottle', 'medkit'] as const;
const isCareType = (type: string): boolean => (CARE_TYPES as readonly string[]).includes(type);
const isMedical = (type: string): boolean => type === 'bandage' || type === 'medkit';

/** The care a survivor is giving, with the health each of the pair had last tick so a hit shows as a drop. */
export interface CareState {
  receiver: string;
  item: GridItem;
  leftMs: number;
  from: ItemMove['from'];
  /** The receiver has been answered (`care_reply` sent). */
  replied: boolean;
  giverHealth: number;
  receiverHealth: number;
}

const careTotal = (care: CareState): number => (isMedical(care.item.type) ? CARE_MEDICAL_MS : CARE_FOOD_MS);

/** How far along a care is, 0 to 1. */
export function careProgress(care: CareState): number {
  return Math.min(1, Math.max(0, 1 - care.leftMs / careTotal(care)));
}

const pick = <T>(sim: SimState, lines: readonly T[]): T => lines[Math.min(lines.length - 1, Math.floor(sim.rng() * lines.length))]!;

function needsOf(p: Pick<PlayerState, 'needs'>): PlayerState['needs'] {
  return p.needs ? { ...p.needs } : undefined;
}

/** Would one `type` change anything on `receiver`, as using it on themselves would. Changes nothing. */
export function careHelps(receiver: Pick<PlayerState, 'health' | 'maxHealth' | 'needs'>, type: string): boolean {
  if (!isCareType(type)) return false;
  if (type === 'medkit') return receiver.health < receiver.maxHealth || receiver.needs?.bleeding === true;
  if (!isSupplyType(type)) return false;
  const copy = { health: receiver.health, maxHealth: receiver.maxHealth, needs: needsOf(receiver) };
  return applySupply(copy, type);
}

/** What the receiver gets, once the time is up. Returns false when it no longer does anything. */
function applyCare(receiver: PlayerState, type: string): boolean {
  if (!careHelps(receiver, type)) return false;
  if (type === 'medkit') {
    receiver.health = Math.min(receiver.maxHealth, receiver.health + MEDKIT_HEAL);
    if (receiver.needs) bandageWound(receiver.needs);
    return true;
  }
  return isSupplyType(type) && applySupply(receiver, type);
}

function syncCounters(p: PlayerState): void {
  syncBag(p.inventory, bagWanted(p));
}

/** Gives the carried count back, without making the item vanish if the cell is gone. */
function restore(p: PlayerState, type: string): void {
  if (type === 'medkit') p.medkits += 1;
  else if (isSupplyType(type) && p.supplies) p.supplies[type] += 1;
}

/** The item goes back where it came from, or any cell, or the ground at the giver's feet. */
function returnItem(sim: SimState, giver: PlayerState, care: CareState): void {
  const { item, from } = care;
  const alive = giver.status === 'alive';
  if (!alive) return leaveBehind(sim, giver, item.type);
  restore(giver, item.type);
  const grid = from.kind === 'cell' && (from.grid === 'pack' || from.grid === 'pockets') ? giver.inventory[from.grid] : null;
  if (grid && canPlaceItem(grid, item.type, item.x, item.y, item.rotated)) placeItem(grid, { ...item });
  const overflow = syncBag(giver.inventory, bagWanted(giver));
  if (!(overflow as Record<string, number>)[item.type]) return;
  take(giver, item.type as never, 1);
  syncCounters(giver);
  leaveBehind(sim, giver, item.type);
}

function leaveBehind(sim: SimState, giver: PlayerState, type: string): void {
  spawnPickup(sim, type as PickupType, giver.x, giver.y);
  sim.pickups[sim.pickups.length - 1]!.leftBy = giver.id;
}

function endCare(giver: PlayerState): void {
  giver.care = null;
}

/**
 * The giver hands `move.item` to `receiver`. The item goes into the giver's hand: out of the bag and off the
 * counters. Null when care starts; otherwise the reason, with nothing changed.
 */
export function startCare(sim: SimState, giver: PlayerState, receiver: PlayerState, move: ItemMove): MoveReason | null {
  const { from } = move;
  if (from.kind !== 'cell' || (from.grid !== 'pack' && from.grid !== 'pockets')) return 'bad';
  const item = giver.inventory[from.grid].items.find((each) => each.id === move.item);
  if (!item) return 'gone';
  const isOther = receiver !== giver && receiver.status === 'alive' && giver.status === 'alive';
  const isBusy = giver.care !== null || sim.players.some((each) => each.care?.receiver === receiver.id);
  if (!isOther || isBusy || !isCareType(item.type)) return 'bad';
  if (Math.hypot(receiver.x - giver.x, receiver.y - giver.y) > CARE_REACH) return 'too_far';
  if (!careHelps(receiver, item.type)) return 'not_needed';
  removeItem(giver.inventory[from.grid], item.id);
  take(giver, item.type as never, 1);
  syncCounters(giver);
  const leftMs = isMedical(item.type) ? CARE_MEDICAL_MS : CARE_FOOD_MS;
  giver.care = { receiver: receiver.id, item: { ...item }, leftMs, from, replied: false, giverHealth: giver.health, receiverHealth: receiver.health };
  emit(sim, { type: 'care_start', giver: giver.id, receiver: receiver.id, itemType: item.type, line: pick(sim, GIVER_LINES) });
  return null;
}

function isBroken(giver: PlayerState, receiver: PlayerState | undefined, care: CareState): boolean {
  if (!receiver || receiver.status !== 'alive') return true;
  if (giver.moving || receiver.moving) return true;
  if (giver.health < care.giverHealth || receiver.health < care.receiverHealth) return true;
  return !careHelps(receiver, care.item.type);
}

/** One tick of every care in progress. Call once a tick, after the players have moved. */
export function tickCare(sim: SimState, dtMs: number): void {
  for (const giver of sim.players) {
    const care = giver.care;
    if (!care) continue;
    const receiver = sim.players.find((each) => each.id === care.receiver);
    if (giver.status !== 'alive') {
      leaveBehind(sim, giver, care.item.type);
      emit(sim, { type: 'care_break', giver: giver.id });
      endCare(giver);
      continue;
    }
    if (isBroken(giver, receiver, care)) {
      returnItem(sim, giver, care);
      emit(sim, { type: 'care_break', giver: giver.id });
      endCare(giver);
      continue;
    }
    care.giverHealth = giver.health;
    care.receiverHealth = receiver!.health;
    care.leftMs -= dtMs;
    const isReplyDue = !care.replied && careProgress(care) * careTotal(care) >= CARE_REPLY_MS;
    if (isReplyDue) {
      care.replied = true;
      emit(sim, { type: 'care_reply', receiver: receiver!.id, line: pick(sim, REPLY_LINES) });
    }
    if (care.leftMs > 0) continue;
    applyCare(receiver!, care.item.type);
    emit(sim, { type: 'care_done', giver: giver.id, receiver: receiver!.id, itemType: care.item.type, line: pick(sim, THANKS_LINES) });
    endCare(giver);
  }
}
