import { ammoBoxWeapon, bagWanted, isAmmoBoxType, isBagItemType, isDroppableBagItem, retierBag, stampAmmoBoxes, syncBag, validateLayout, adoptLayout } from './bag.ts';
import type { BagCommit, BagItemType, BagWanted, DroppableBagItem } from './bag.ts';
import { MAX_COMMIT_DROPS, MAX_COMMIT_LAYOUT } from './bag-commit.ts';
import { FORTIFICATION_ITEMS } from './fortifications.ts';
import { takeFromContainer } from './container-take.ts';
import { autoPackItem, createInventoryGrid, placeItem } from './grid-inventory.ts';
import { spawnPickup } from './pickups.ts';
import { eatCandyDirect, isCandyId, type CandyId } from './candy.ts';
import type { PlayerState, SimState } from './sim-state.ts';
import { useSupply } from './supplies.ts';
import { isSupplyType } from './supply-types.ts';
import { containerGridDimensions, townContainers } from './containers.ts';

/** Takes up to `count` units of a type off the counters and returns how many it took. */
function take(p: PlayerState, type: BagItemType, count: number): number {
  const held = bagWanted(p)[type];
  const taken = Math.min(held, count);
  if (taken <= 0) return 0;
  const m = p.materials;
  if (isSupplyType(type) && p.supplies) p.supplies[type] -= taken;
  else if (type === 'medkit') p.medkits -= taken;
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
function leaveOnGround(sim: SimState, p: PlayerState, type: DroppableBagItem, count: number): void {
  const per = type === 'nails' ? FORTIFICATION_ITEMS.nails.unitsPerFind : 1;
  const pieces = Math.floor(count / per);
  const taken = take(p, type, pieces * per);
  for (let i = 0; i < taken / per; i += 1) {
    spawnPickup(sim, type, p.x, p.y);
    sim.pickups[sim.pickups.length - 1]!.leftBy = p.id;
  }
}

function leaveCandyOnGround(sim: SimState, p: PlayerState, id: CandyId, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const candyIndex = p.candy.indexOf(id);
    const hasCandy = candyIndex >= 0;
    if (hasCandy) p.candy.splice(candyIndex, 1);
    spawnPickup(sim, 'candy', p.x, p.y, 0, null, id);
    const lastPickup = sim.pickups[sim.pickups.length - 1];
    if (lastPickup) lastPickup.leftBy = p.id;
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
    // Rounds with no slot to show stay counted: the bag only limits what a pickup may add (takeAmmo).
    if (isAmmoBoxType(type)) continue;
    if (isDroppableBagItem(type)) leaveOnGround(sim, p, type, count);
    else take(p, type, count);
  }
  if (Object.keys(overflow).length > 0) syncBag(p.inventory, bagWanted(p));
  stampAmmoBoxes(p.inventory, p.ammoBag);
}

/**
 * The bag closed. Drops first (clamped to what is held), then the bag is brought to the counters, then the client's
 * layout is adopted if it holds and the host's own kept if it does not. Never believes a count or a type beyond the clamp.
 * True when the layout was adopted.
 */
export function applyBagCommit(sim: SimState, p: PlayerState, commit: BagCommit): boolean {
  const layout = commit.layout ?? [];
  const drop = commit.drop ?? [];
  const use = commit.use ?? [];
  const tooBig = layout.length > MAX_COMMIT_LAYOUT || drop.length > MAX_COMMIT_DROPS || use.length > MAX_COMMIT_DROPS;
  if (tooBig || p.status !== 'alive') return false;
  if (commit.container) {
    const containerState = sim.containers[commit.container.id];
    if (containerState) {
      const containerDef = sim.map ? townContainers(sim.map)[commit.container.id] : undefined;
      const { cols, rows } = containerGridDimensions(containerDef?.kind);
      const held = new Map((containerState.items ?? []).map((item) => [item.id, item]));
      const contents = createInventoryGrid(cols, rows);
      for (const item of commit.container.items) placeItem(contents, { ...item });
      // Only what the host's container really held can be taken, and each piece once.
      for (const claimed of commit.container.taken) {
        const real = held.get(claimed.id);
        if (!real || real.type !== claimed.type) continue;
        held.delete(claimed.id);
        const left = takeFromContainer(p, real);
        if (left && !placeItem(contents, { ...left })) autoPackItem(contents, left);
      }
      containerState.items = contents.items;
      for (const item of commit.container.deposited ?? []) {
        const isCandy = isCandyId(item.type);
        if (isCandy) {
          const candyIndex = p.candy.indexOf(item.type as CandyId);
          const hasCandy = candyIndex >= 0;
          if (hasCandy) p.candy.splice(candyIndex, 1);
        } else {
          const isBagItem = isBagItemType(item.type);
          if (isBagItem) take(p, item.type, item.count ?? 1);
        }
      }
    }
  }
  for (const row of use) {
    const isCandy = isCandyId(row.type) && Number.isInteger(row.count) && row.count >= 1;
    if (isCandy) {
      for (let used = 0; used < row.count; used += 1) {
        eatCandyDirect(sim, p, row.type as CandyId);
      }
      continue;
    }
    // Loading a box: the gun it feeds, if it is the one in hand, starts its reload. The rounds leave the counter when it ends, and the box with them.
    if (isAmmoBoxType(row.type)) {
      if (ammoBoxWeapon(row.type) === p.weapon) p.reloadQueued = true;
      continue;
    }
    const isUsable = isSupplyType(row.type) && Number.isInteger(row.count) && row.count >= 1;
    if (!isUsable) continue;
    for (let used = 0; used < row.count && useSupply(p, row.type); used += 1);
  }
  for (const row of drop) {
    const isCandy = isCandyId(row.type) && Number.isFinite(row.count) && row.count >= 1;
    if (isCandy) {
      leaveCandyOnGround(sim, p, row.type as CandyId, Math.floor(row.count));
      continue;
    }
    const real = isBagItemType(row.type) && isDroppableBagItem(row.type) && Number.isFinite(row.count) && row.count >= 1;
    if (real) leaveOnGround(sim, p, row.type, Math.floor(row.count));
  }
  reconcileBag(sim, p);
  const placements = validateLayout(p.inventory, layout);
  if (!placements) return false;
  adoptLayout(p.inventory, placements);
  stampAmmoBoxes(p.inventory, p.ammoBag);
  return true;
}
