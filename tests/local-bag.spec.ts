import { describe, expect, it } from 'vitest';
import { bagHash, bagLayout } from '../shared/bag.ts';
import type { ItemMove } from '../shared/item-move.ts';
import { applyItemMove } from '../shared/item-move-sim.ts';
import { wornGear } from '../src/game/inventory/bag-working.ts';
import { MoveLedger, type LedgerView } from '../src/game/inventory/move-ledger.ts';
import { buildHud, type HudState } from '../src/game/hud-state.ts';
import { quietSim, steps } from './helpers/sim-harness.ts';

/** What the window's ledger takes from one HUD, with no container open. */
function viewOf(hud: HudState): LedgerView {
  return { tier: hud.backpackTier ?? 'satchel', bag: hud.bagLayout ?? [], lastMoveId: hud.lastMoveId ?? 0, container: null, candy: hud.bag.map((stack) => ({ id: stack.id, count: stack.count })), gear: wornGear(hud) };
}

/** A host player and a client ledger that watches it through snapshots and sends its moves to it, as the real two do. */
function pair() {
  const { sim, state } = quietSim();
  const p = state.players[0]!;
  const sent: ItemMove[] = [];
  const ledger = new MoveLedger((move) => {
    sent.push(move);
    applyItemMove(state, p, move);
  });
  const watch = () => {
    steps(sim, 1);
    const snapshot = sim.snapshot();
    const hud = buildHud(snapshot, snapshot.players.find((e) => e.id === p.id)!, null);
    ledger.confirm(viewOf(hud));
    return hud;
  };
  p.bottles = 0;
  p.materials!.planks = 2;
  p.medkits = 1;
  watch();
  return { sim, state, p, ledger, sent, watch };
}

const layoutOf = (ledger: MoveLedger) => bagLayout({ pack: ledger.grids().pack, pockets: ledger.grids().pockets, serial: 0 });
const cellOf = (item: { x: number; y: number }, grid: 'pack' | 'pockets' | 'candy') => ({ kind: 'cell' as const, grid, x: item.x, y: item.y });

describe('wornGear', () => {
  const base = { mags: { pistol: 6, carbine: 4, shotgun: 0 }, ammoBag: { pistol: 10, carbine: 8, shotgun: 0 } };

  it('wears the held gun as primary, another long gun as secondary and the pistol as the sidearm', () => {
    const gear = wornGear({ ...base, owned: ['pistol', 'carbine', 'shotgun'], weapon: 'carbine' });
    expect(gear.primary).toMatchObject({ type: 'carbine', ammo: 12 });
    expect(gear.secondary?.type).toBe('shotgun');
    expect(gear.sidearm).toMatchObject({ type: 'pistol', ammo: 16 });
  });

  it('does not show the pistol twice when it is the one held', () => {
    const gear = wornGear({ ...base, owned: ['pistol'], weapon: 'pistol' });
    expect(gear.primary?.type).toBe('pistol');
    expect(gear.sidearm).toBeNull();
    expect(gear.secondary).toBeNull();
  });
});

describe('the window ledger against the host', () => {
  it('reaches the host layout, with the host ids, from snapshots alone', () => {
    const { p, ledger, watch } = pair();
    const hud = watch();
    expect(bagHash({ pack: ledger.grids().pack, pockets: ledger.grids().pockets, serial: 0 })).toBe(hud.bagHash);
    const hostIds = [...p.inventory.pack.items, ...p.inventory.pockets.items].map((item) => item.id).sort();
    expect([...ledger.grids().pack.items, ...ledger.grids().pockets.items].map((item) => item.id).sort()).toEqual(hostIds);
    p.materials!.planks = 3;
    p.medkits = 0;
    const next = watch();
    expect(bagHash({ pack: ledger.grids().pack, pockets: ledger.grids().pockets, serial: 0 })).toBe(next.bagHash);
  });

  it('sends nothing when nothing is moved', () => {
    const { sent, watch } = pair();
    watch();
    watch();
    expect(sent).toEqual([]);
  });

  it('sends one move for a rearrangement, and the host takes it', () => {
    const { p, ledger, sent, watch } = pair();
    const medkit = ledger.grids().pack.items.find((item) => item.type === 'medkit')!;
    const move = ledger.propose({ item: medkit.id, type: 'medkit', from: cellOf(medkit, 'pack'), to: { kind: 'cell', grid: 'pockets', x: 0, y: 0, rotated: false } });
    expect(move).not.toBeNull();
    expect(sent).toHaveLength(1);
    expect(p.inventory.pockets.items.map((item) => item.type)).toEqual(['medkit']);
    const hud = watch();
    expect(ledger.pendingMoves()).toEqual([]);
    expect(layoutOf(ledger)).toEqual(bagLayout(p.inventory));
    expect(hud.lastMoveId).toBe(move!.id);
  });

  it('drops an item, and the host and the window agree afterwards', () => {
    const { state, p, ledger, watch } = pair();
    const plank = ledger.grids().pack.items.find((item) => item.type === 'plank')!;
    ledger.propose({ item: plank.id, type: 'plank', from: cellOf(plank, 'pack'), to: { kind: 'ground', x: p.x, y: p.y } });
    expect(ledger.grids().pack.items.some((item) => item.id === plank.id)).toBe(false);
    expect(state.pickups.some((item) => item.type === 'plank')).toBe(true);
    const hud = watch();
    expect(bagHash({ pack: ledger.grids().pack, pockets: ledger.grids().pockets, serial: 0 })).toBe(hud.bagHash);
  });

  it('eats a candy and the survivor gets its sugar', () => {
    const { p, ledger, watch } = pair();
    p.candy = ['sour_skulls'];
    watch();
    const piece = ledger.grids().candy.items[0]!;
    expect(ledger.propose({ item: piece.id, type: 'sour_skulls', from: cellOf(piece, 'candy'), to: { kind: 'use' } })).not.toBeNull();
    expect(p.candy).toEqual([]);
    expect(p.sugar.some((s) => s.id === 'sour_skulls')).toBe(true);
  });

  it('shows every carried candy in the candy bag, filled from the bottom row up', () => {
    const { p, ledger, watch } = pair();
    p.candy = ['jawbreaker', 'jawbreaker', 'ghost_gum'];
    watch();
    const { cols, rows, items } = ledger.grids().candy;
    expect(items).toHaveLength(3);
    expect(items.every((item) => item.y >= rows - 2)).toBe(true);
    expect(items.filter((item) => item.y === rows - 1)).toHaveLength(Math.min(3, cols));
  });

  it('a candy picked up while the window is open lands in the lowest free cell', () => {
    const { p, ledger, watch } = pair();
    p.candy = ['ghost_gum'];
    watch();
    expect(ledger.grids().candy.items[0]).toMatchObject({ type: 'ghost_gum', x: 0, y: ledger.grids().candy.rows - 1 });
  });

  it('drops a candy and leaves a candy pickup on the floor', () => {
    const { state, p, ledger, watch } = pair();
    p.candy = ['fang_taffy'];
    watch();
    const piece = ledger.grids().candy.items[0]!;
    ledger.propose({ item: piece.id, type: 'fang_taffy', from: cellOf(piece, 'candy'), to: { kind: 'ground', x: p.x, y: p.y } });
    expect(p.candy).toEqual([]);
    const pickup = state.pickups.find((item) => item.type === 'candy');
    expect(pickup?.candyId).toBe('fang_taffy');
  });
});
