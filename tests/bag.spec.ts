import { describe, expect, it } from 'vitest';
import { adoptLayout, bagHash, bagLayout, bagRows, bagWanted, canCarry, createBag, layoutHash, retierBag, syncBag, validateLayout } from '../shared/bag.ts';
import type { BagWanted } from '../shared/bag.ts';
import { PICKUP_RADIUS } from '../shared/constants.ts';
import { parseClientPacket } from '../shared/room/client-packets.ts';
import type { PlayerState } from '../shared/sim-state.ts';
import { actOn, rearrange } from './helpers/item-moves.ts';
import { quietSim, steps } from './helpers/sim-harness.ts';

const none: BagWanted = {
  medkit: 0,
  bottle: 0,
  knife: 0,
  plank: 0,
  hammer_tool: 0,
  crowbar: 0,
  sheet_curtain: 0,
  firework: 0,
  fountain: 0,
  nails: 0,
  bandage: 0,
  canned_food: 0,
  water_bottle: 0,
  disinfectant: 0,
  antibiotics: 0,
  pistol_ammo: 0,
  carbine_ammo: 0,
  shells: 0,
};
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
    p.ammoBag = { pistol: 0, carbine: 0, shotgun: 0 };
    p.materials!.planks = 2;
    steps(sim, 1);
    p.backpackTier = 'alice';
    steps(sim, 1);
    expect(p.inventory.pack.cols).toBe(8);
    expect(p.inventory.pack.items.length).toBe(2);
  });
});

describe('a move inside the bag', () => {
  function bagged() {
    const quiet = quietSim();
    const p = quiet.state.players[0]!;
    p.bottles = 0;
    p.medkits = 1;
    p.materials!.planks = 2;
    steps(quiet.sim, 1);
    return { ...quiet, p };
  }
  const first = (p: PlayerState, type: string) => p.inventory.pack.items.find((item) => item.type === type)!;

  it('is applied when the item fits where it was set down', () => {
    const { state, p } = bagged();
    expect(rearrange(state, p, first(p, 'medkit'), 'pack', 'pockets', 0, 0, false)).toBeNull();
    expect(p.inventory.pockets.items.map((item) => item.type)).toEqual(['medkit']);
    expect(p.inventory.pack.items.some((item) => item.type === 'medkit')).toBe(false);
  });

  it('is refused, and the host layout kept, when the item would overlap or leave the grid', () => {
    const { state, p } = bagged();
    const before = bagHash(p.inventory);
    expect(rearrange(state, p, first(p, 'medkit'), 'pack', 'pack', p.inventory.pack.cols - 1, p.inventory.pack.rows - 1, false)).toBe('no_room');
    const planks = p.inventory.pack.items.filter((item) => item.type === 'plank');
    expect(rearrange(state, p, planks[1]!, 'pack', 'pack', planks[0]!.x, planks[0]!.y)).toBe('no_room');
    expect(bagHash(p.inventory)).toBe(before);
  });

  it('is refused when the item is not where the move says, or is not that type', () => {
    const { state, p } = bagged();
    const before = bagHash(p.inventory);
    const plank = first(p, 'plank');
    expect(rearrange(state, p, { ...plank, id: 'forged' }, 'pack', 'pockets', 0, 0)).toBe('gone');
    expect(rearrange(state, p, { ...plank, type: 'knife' }, 'pack', 'pockets', 0, 0)).toBe('gone');
    expect(bagHash(p.inventory)).toBe(before);
  });

  it('keeps the host ids and counts', () => {
    const { sim, state, p } = bagged();
    p.materials!.nails = 12;
    steps(sim, 1);
    const ids = [...p.inventory.pack.items, ...p.inventory.pockets.items].map((item) => item.id).sort();
    expect(rearrange(state, p, first(p, 'medkit'), 'pack', 'pockets', 0, 0, false)).toBeNull();
    const all = [...p.inventory.pack.items, ...p.inventory.pockets.items];
    expect(all.map((item) => item.id).sort()).toEqual([...ids].sort());
    expect(all.find((item) => item.type === 'nails')?.count).toBe(12);
  });

  it('drops what was held, at the feet, and the player does not take it straight back', () => {
    const { sim, state, p } = bagged();
    expect(actOn(state, p, 'plank', 'ground')).toBeNull();
    expect(p.materials!.planks).toBe(1);
    const left = state.pickups.filter((item) => item.type === 'plank');
    expect(left.length).toBe(1);
    expect(Math.hypot(left[0]!.x - p.x, left[0]!.y - p.y)).toBeLessThanOrEqual(PICKUP_RADIUS);
    steps(sim, 5);
    expect(p.materials!.planks).toBe(1);
  });

  it('cannot drop what is not held', () => {
    const { state, p } = bagged();
    p.bottles = 0;
    expect(actOn(state, p, 'bottle', 'ground')).toBe('gone');
    expect(actOn(state, p, 'crowbar', 'ground')).toBe('gone');
    expect(p.bottles).toBe(0);
    expect(state.pickups.length).toBe(0);
  });

  it('no longer comes off the wire as a bag packet', () => {
    const old = { type: 'bag', commit: { layout: [{ type: 'plank', grid: 'pack', x: 0, y: 0, rotated: false }], drop: [{ type: 'plank', count: 1 }] } };
    expect(parseClientPacket(JSON.stringify(old))).toBeNull();
  });
});

describe('ids do not matter across the wire', () => {
  const finalWant = want({ medkit: 2, plank: 2, bottle: 1, nails: 6 });

  it('hashes the same things in the same places the same, whatever their ids', () => {
    const a = createBag('satchel');
    const b = createBag('satchel');
    syncBag(a, want({ medkit: 2, plank: 1 }));
    syncBag(a, want({ medkit: 2, plank: 1, bottle: 1 }));
    syncBag(b, want({ medkit: 3, plank: 1, bottle: 1 }));
    syncBag(b, want({ medkit: 2, plank: 1, bottle: 1 }));
    expect(a.pack.items.map((item) => item.id).sort()).not.toEqual(b.pack.items.map((item) => item.id).sort());
    // Positions may differ because the bags were packed in different orders; put b where a is.
    const moved = validateLayout(b, bagLayout(a));
    expect(moved).not.toBeNull();
    adoptLayout(b, moved!);
    expect(bagHash(b)).toBe(bagHash(a));
  });

  it('sends the host ids on the snapshot rows, so a client that missed a snapshot still names the same items', () => {
    const host = createBag('satchel');
    const client = createBag('satchel');
    const seen = [want({ medkit: 2, plank: 2 }), want({ medkit: 1, plank: 2, bottle: 1 }), want({ medkit: 2, plank: 2, bottle: 1, nails: 6 })];
    for (const w of seen) syncBag(host, w);
    // The client misses the middle snapshot, so the ids it would mint itself differ.
    syncBag(client, seen[0]!);
    syncBag(client, seen[2]!);
    const ids = (bag: typeof client) => [...bag.pack.items, ...bag.pockets.items].map((item) => item.id).sort();
    expect(ids(client)).not.toEqual(ids(host));
    const rows = bagRows(host);
    expect(rows.map((row) => row.id).sort()).toEqual(ids(host));
    expect(layoutHash(rows)).toBe(bagHash(host));
    expect(rows.find((row) => row.type === 'nails')?.count).toBe(6);
  });

  it('reaches the same hash from different orderings of changes once the client layout is committed', () => {
    const host = createBag('satchel');
    const client = createBag('satchel');
    for (const w of [want({ medkit: 1 }), want({ medkit: 1, plank: 2 }), finalWant]) syncBag(host, w);
    for (const w of [want({ plank: 2, bottle: 1 }), want({ plank: 1, medkit: 3, bottle: 1 }), finalWant]) syncBag(client, w);
    const placements = validateLayout(host, bagLayout(client));
    expect(placements).not.toBeNull();
    adoptLayout(host, placements!);
    expect(bagHash(host)).toBe(bagHash(client));
    expect(host.pack.items.find((item) => item.type === 'nails')?.count).toBe(6);
  });
});
