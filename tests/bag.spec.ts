import { describe, expect, it } from 'vitest';
import { applyBagCommit } from '../shared/bag-sim.ts';
import { parseBagCommit } from '../shared/bag-commit.ts';
import { bagHash, bagLayout, bagWanted, canCarry, createBag, retierBag, syncBag } from '../shared/bag.ts';
import type { BagCommit, BagWanted } from '../shared/bag.ts';
import { PICKUP_RADIUS } from '../shared/constants.ts';
import { parseClientPacket } from '../shared/room/client-packets.ts';
import { quietSim, steps } from './helpers/sim-harness.ts';

const none: BagWanted = { medkit: 0, bottle: 0, knife: 0, plank: 0, hammer_tool: 0, crowbar: 0, sheet_curtain: 0, firework: 0, fountain: 0, nails: 0 };
const want = (more: Partial<BagWanted>): BagWanted => ({ ...none, ...more });

describe('syncBag', () => {
  it('is idempotent and deterministic', () => {
    const a = createBag('satchel');
    const b = createBag('satchel');
    const wanted = want({ medkit: 2, plank: 2, nails: 12, firework: 3 });
    syncBag(a, wanted);
    const once = bagHash(a);
    syncBag(a, wanted);
    syncBag(b, wanted);
    expect(bagHash(a)).toBe(once);
    expect(bagHash(b)).toBe(once);
    expect(a.pack.items.find((item) => item.type === 'nails')?.count).toBe(12);
  });

  it('reaches the same layout on both sides from the same sequence of changes', () => {
    const host = createBag('satchel');
    const client = createBag('satchel');
    const sequence = [want({ medkit: 1 }), want({ medkit: 1, plank: 1 }), want({ medkit: 2, plank: 1, bottle: 1 }), want({ medkit: 1, plank: 1, bottle: 1 }), want({ medkit: 1, plank: 2, bottle: 1, nails: 6 })];
    for (const wanted of sequence) {
      syncBag(host, wanted);
      syncBag(client, wanted);
      expect(bagHash(client)).toBe(bagHash(host));
    }
    expect(bagLayout(host).length).toBe(5);
  });

  it('removes the newest of a type first', () => {
    const bag = createBag('satchel');
    syncBag(bag, want({ plank: 3 }));
    syncBag(bag, want({ plank: 2 }));
    expect(bag.pack.items.map((item) => item.id).sort()).toEqual(['plank:1', 'plank:2']);
  });

  it('reports what has no room and mints no id for it', () => {
    const bag = createBag('satchel');
    const overflow = syncBag(bag, want({ medkit: 9 }));
    expect((overflow.medkit ?? 0) > 0).toBe(true);
    expect(canCarry(bag, 'medkit')).toBe(false);
  });

  it('packs the pockets once the pack is full', () => {
    const bag = createBag('satchel');
    syncBag(bag, want({ medkit: 5 }));
    expect(bag.pockets.items.length).toBeGreaterThan(0);
  });
});

describe('retierBag', () => {
  it('keeps what fits where it was and re-packs the rest', () => {
    const bag = createBag('satchel');
    syncBag(bag, want({ plank: 3, medkit: 2 }));
    expect(retierBag(bag, 'alice')).toEqual([]);
    expect(bag.pack.cols).toBe(8);
    expect(bag.pack.items.length).toBe(5);
  });

  it('returns what a smaller pack cannot hold', () => {
    const bag = createBag('alice');
    syncBag(bag, want({ medkit: 6, plank: 4 }));
    const evicted = retierBag(bag, 'satchel');
    expect(evicted.length).toBeGreaterThan(0);
  });
});

describe('in a run', () => {
  function carrier() {
    const quiet = quietSim();
    const p = quiet.state.players[0]!;
    p.bottles = 0;
    steps(quiet.sim, 1);
    return { ...quiet, p };
  }

  it('refuses a pickup with no free slot and leaves it on the ground', () => {
    const { sim, state, p } = carrier();
    p.medkits = 4;
    p.materials!.planks = 2;
    p.materials!.hasCrowbar = true;
    p.materials!.hasHammer = true;
    syncBag(p.inventory, bagWanted(p));
    // Fill what is left of the pack and pockets with nails-free bulk so nothing 2x2 fits.
    p.inventory.pack.items.push({ id: 'fill:1', type: 'sheet_curtain', x: 0, y: 0, rotated: false });
    state.pickups.push({ id: 'p1', type: 'medkit', x: p.x, y: p.y, ttl: null, rounds: 0 });
    expect(canCarry(p.inventory, 'medkit')).toBe(false);
    steps(sim, 3);
    expect(state.pickups.some((item) => item.id === 'p1')).toBe(true);
    expect(p.medkits).toBe(4);
  });

  it('takes a pickup that fits and places it', () => {
    const { sim, state, p } = carrier();
    state.pickups.push({ id: 'p1', type: 'plank', x: p.x, y: p.y, ttl: null, rounds: 0 });
    steps(sim, 2);
    expect(p.materials!.planks).toBe(1);
    expect(p.inventory.pack.items.some((item) => item.type === 'plank')).toBe(true);
  });

  it('hashes the layout into the snapshot', () => {
    const { sim, p } = carrier();
    const entity = sim.snapshot().players.find((e) => e.id === p.id)!;
    expect(entity.bagHash).toBe(bagHash(p.inventory));
  });

  it('drops the bag item the counter loses when something is used', () => {
    const { sim, p } = carrier();
    p.medkits = 2;
    steps(sim, 1);
    expect(p.inventory.pack.items.filter((item) => item.type === 'medkit').length).toBe(2);
    p.medkits = 1;
    steps(sim, 1);
    expect(p.inventory.pack.items.filter((item) => item.type === 'medkit').length).toBe(1);
  });

  it('re-packs on a tier change', () => {
    const { sim, p } = carrier();
    p.materials!.planks = 2;
    steps(sim, 1);
    p.backpackTier = 'alice';
    steps(sim, 1);
    expect(p.inventory.pack.cols).toBe(8);
    expect(p.inventory.pack.items.length).toBe(2);
  });
});

describe('a commit', () => {
  function bagged() {
    const quiet = quietSim();
    const p = quiet.state.players[0]!;
    p.bottles = 0;
    p.medkits = 1;
    p.materials!.planks = 2;
    steps(quiet.sim, 1);
    return { ...quiet, p };
  }
  const idsOf = (p: { inventory: ReturnType<typeof createBag> }, type: string): string[] =>
    bagLayout(p.inventory).filter((row) => p.inventory.pack.items.some((item) => item.id === row.id && item.type === type)).map((row) => row.id);
  const moved = (rows: ReturnType<typeof bagLayout>, id: string, x: number, y: number) =>
    rows.map((row) => (row.id === id ? { ...row, x, y, rotated: false } : row));

  it('is adopted when the layout holds', () => {
    const { state, p } = bagged();
    const rows = bagLayout(p.inventory);
    const layout = rows.map((row) => (row.id === idsOf(p, 'medkit')[0] ? { ...row, grid: 'pockets' as const, x: 0, y: 0, rotated: false } : row));
    expect(applyBagCommit(state, p, { layout, drop: [] })).toBe(true);
    expect(p.inventory.pockets.items.map((item) => item.type)).toEqual(['medkit']);
    expect(p.inventory.pack.items.some((item) => item.type === 'medkit')).toBe(false);
  });

  it('is rejected, and the host layout kept, when items overlap or leave the grid', () => {
    const { state, p } = bagged();
    const before = bagHash(p.inventory);
    const rows = bagLayout(p.inventory);
    expect(applyBagCommit(state, p, { layout: moved(rows, idsOf(p, 'medkit')[0]!, 4, 3), drop: [] })).toBe(false);
    const [first, second] = idsOf(p, 'plank');
    const target = rows.find((row) => row.id === first)!;
    const stacked = rows.map((row) => (row.id === second ? { ...row, x: target.x, y: target.y } : row));
    expect(applyBagCommit(state, p, { layout: stacked, drop: [] })).toBe(false);
    expect(bagHash(p.inventory)).toBe(before);
  });

  it('is rejected when it names ids the bag does not hold', () => {
    const { state, p } = bagged();
    const rows = bagLayout(p.inventory).map((row) => (row.id === idsOf(p, 'plank')[1] ? { ...row, id: 'plank:99' } : row));
    expect(applyBagCommit(state, p, { layout: rows, drop: [] })).toBe(false);
  });

  it('drops what was held, at the feet, and the player does not take it straight back', () => {
    const { sim, state, p } = bagged();
    const drop: BagCommit['drop'] = [{ type: 'plank', count: 1 }];
    const layout = bagLayout(p.inventory).filter((row) => row.id !== idsOf(p, 'plank')[1]);
    expect(applyBagCommit(state, p, { layout, drop })).toBe(true);
    expect(p.materials!.planks).toBe(1);
    const left = state.pickups.filter((item) => item.type === 'plank');
    expect(left.length).toBe(1);
    expect(Math.hypot(left[0]!.x - p.x, left[0]!.y - p.y)).toBeLessThanOrEqual(PICKUP_RADIUS);
    steps(sim, 5);
    expect(p.materials!.planks).toBe(1);
  });

  it('clamps a drop to what is held', () => {
    const { state, p } = bagged();
    applyBagCommit(state, p, { layout: [], drop: [{ type: 'plank', count: 50 }] });
    expect(p.materials!.planks).toBe(0);
    expect(state.pickups.filter((item) => item.type === 'plank').length).toBe(2);
  });

  it('cannot drop what has no pickup, or what is not held', () => {
    const { state, p } = bagged();
    p.bottles = 1;
    applyBagCommit(state, p, { layout: [], drop: [{ type: 'bottle', count: 1 }, { type: 'crowbar', count: 1 }] });
    expect(p.bottles).toBe(1);
    expect(state.pickups.length).toBe(0);
  });

  it('is ignored over the row caps, at the wire and in the sim', () => {
    const { state, p } = bagged();
    const row = { id: 'plank:1', grid: 'pack', x: 0, y: 0, rotated: false };
    const long = { layout: Array.from({ length: 65 }, () => row), drop: [] };
    expect(parseBagCommit(long)).toBeNull();
    expect(parseBagCommit({ layout: [], drop: Array.from({ length: 17 }, () => ({ type: 'plank', count: 1 })) })).toBeNull();
    expect(applyBagCommit(state, p, long as unknown as BagCommit)).toBe(false);
    expect(p.materials!.planks).toBe(2);
  });

  it('comes off the wire as a bag packet, and nothing malformed does', () => {
    const good = { type: 'bag', commit: { layout: [{ id: 'plank:1', grid: 'pack', x: 0, y: 0, rotated: false }], drop: [{ type: 'plank', count: 1 }] } };
    expect(parseClientPacket(JSON.stringify(good))).toEqual(good);
    expect(parseClientPacket(JSON.stringify({ type: 'bag', commit: { layout: [{ id: 'a', grid: 'floor', x: 0, y: 0, rotated: false }], drop: [] } }))).toBeNull();
    expect(parseClientPacket(JSON.stringify({ type: 'bag', commit: { layout: [], drop: [{ type: 'gold', count: 1 }] } }))).toBeNull();
    expect(parseClientPacket(JSON.stringify({ type: 'bag' }))).toBeNull();
  });
});
