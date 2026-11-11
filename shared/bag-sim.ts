import { bagWanted, isBagItemType, retierBag, syncBag, validateLayout, adoptLayout } from './bag.ts';
import type { BagCommit, BagItemType, BagWanted } from './bag.ts';
import { MAX_COMMIT_DROPS, MAX_COMMIT_LAYOUT } from './bag-commit.ts';
import { FORTIFICATION_ITEMS } from './fortifications.ts';
import { spawnPickup } from './pickups.ts';
import type { PickupType } from './protocol.ts';
import type { PlayerState, SimState } from './sim-state.ts';

/** Types that have a pickup to leave on the ground. Bottles, fireworks and fountains have none, so they cannot be dropped. */
type Droppable = Extract<BagItemType, PickupType>;
const DROPPABLE: readonly Droppable[] = ['medkit', 'knife', 'plank', 'hammer_tool', 'crowbar', 'sheet_curtain', 'nails'];

function isDroppable(type: BagItemType): type is Droppable {
  return (DROPPABLE as readonly BagItemType[]).includes(type);
}

/** Takes up to `count` units of a type off the counters and returns how many it took. */
function take(p: PlayerState, type: BagItemType, count: number): number {
  const held = bagWanted(p)[type];
  const taken = Math.min(held, count);
  if (taken <= 0) return 0;
  const m = p.materials;
  if (type === 'medkit') p.medkits -= taken;
  else if (type === 'bottle') p.bottles -= taken;
  else if (type === 'firework') p.fireworks -= taken;
  else if (type === 'fountain') p.fountains -= taken;
  else if (type === 'knife') p.knife = false;
  else if (m && type === 'plank') m.planks -= taken;
  else if (m && type === 'nails') m.nails -= taken;
  else if (m && type === 'sheet_curtain') m.sheets -= taken;
  else if (m && type === 'hammer_tool') m.hasHammer = false;
  else if (m && type === 'crowbar') m.hasCrowbar = false;
  return taken;
}

/** Puts what was taken on the ground at the player's feet. A box of nails goes down as whole finds. */
function leaveOnGround(sim: SimState, p: PlayerState, type: Droppable, count: number): void {
  const per = type === 'nails' ? FORTIFICATION_ITEMS.nails.unitsPerFind : 1;
  const pieces = Math.floor(count / per);
  const taken = take(p, type, pieces * per);
  for (let i = 0; i < taken / per; i += 1) {
    spawnPickup(sim, type, p.x, p.y);
    sim.pickups[sim.pickups.length - 1]!.leftBy = p.id;
  }
}

/**
 * Makes the bag agree with the counters after anything changed them: a pickup, an item used, a purchase, a new pack.
 * What has no room is put on the ground where it can be, and is gone where it cannot.
 */
export function reconcileBag(sim: SimState, p: PlayerState): void {
  const evicted = retierBag(p.inventory, p.backpackTier);
  const overflow: Partial<BagWanted> = syncBag(p.inventory, bagWanted(p));
  for (const item of evicted) overflow[item.type as BagItemType] = (overflow[item.type as BagItemType] ?? 0) + (item.count ?? 1);
  for (const [type, count] of Object.entries(overflow) as [BagItemType, number][]) {
    if (isDroppable(type)) leaveOnGround(sim, p, type, count);
    else take(p, type, count);
  }
  if (Object.keys(overflow).length > 0) syncBag(p.inventory, bagWanted(p));
}

/**
 * The bag closed. Drops first (clamped to what is held), then the bag is brought to the counters, then the client's
 * layout is adopted if it holds and the host's own kept if it does not. Never believes a count or a type beyond the clamp.
 * True when the layout was adopted.
 */
export function applyBagCommit(sim: SimState, p: PlayerState, commit: BagCommit): boolean {
  const tooBig = commit.layout.length > MAX_COMMIT_LAYOUT || commit.drop.length > MAX_COMMIT_DROPS;
  if (tooBig || p.status !== 'alive') return false;
  for (const row of commit.drop) {
    const real = isBagItemType(row.type) && isDroppable(row.type) && Number.isFinite(row.count) && row.count >= 1;
    if (real) leaveOnGround(sim, p, row.type, Math.floor(row.count));
  }
  reconcileBag(sim, p);
  const placements = validateLayout(p.inventory, commit.layout);
  if (!placements) return false;
  adoptLayout(p.inventory, placements);
  return true;
}
