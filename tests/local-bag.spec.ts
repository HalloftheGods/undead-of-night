import { describe, expect, it, vi } from 'vitest';
import { applyBagCommit } from '../shared/bag-sim.ts';
import { bagHash } from '../shared/bag.ts';
import type { BagCommit } from '../shared/bag.ts';
import { LocalBag, wornGear } from '../src/game/local-bag.ts';
import { buildHud } from '../src/game/hud-state.ts';
import { quietSim, steps } from './helpers/sim-harness.ts';
import { aHud } from './backpack-fixture.ts';

/** A host player and a client bag that watches it through snapshots, as the real two do. */
function pair() {
  const { sim, state } = quietSim();
  const p = state.players[0]!;
  const sent: BagCommit[] = [];
  let clock = 0;
  const local = new LocalBag((commit) => { sent.push(commit); applyBagCommit(state, p, commit); }, () => clock);
  const watch = () => {
    steps(sim, 1);
    const snapshot = sim.snapshot();
    const hud = buildHud(snapshot, snapshot.players.find((e) => e.id === p.id)!, null);
    local.sync(hud);
    return hud;
  };
  watch();
  p.bottles = 0;
  p.materials!.planks = 2;
  p.medkits = 1;
  return { sim, state, p, local, sent, watch, tick: (ms: number) => { clock += ms; } };
}

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

describe('LocalBag', () => {
  it('reaches the host layout from snapshots alone', () => {
    const { p, local, watch } = pair();
    const hud = watch();
    expect(bagHash(local.bag)).toBe(hud.bagHash);
    p.materials!.planks = 3;
    p.medkits = 0;
    const next = watch();
    expect(bagHash(local.bag)).toBe(next.bagHash);
  });

  it('sends nothing when the bag is opened and closed untouched', () => {
    const { local, sent, watch } = pair();
    local.close(local.open(watch()));
    expect(sent).toEqual([]);
  });

  it('sends one commit for a rearrangement, and the host adopts it', () => {
    const { p, local, sent, watch } = pair();
    const hud = watch();
    const working = local.open(hud);
    const medkit = working.pack.items.find((item) => item.type === 'medkit')!;
    working.pack.items = working.pack.items.filter((item) => item !== medkit);
    working.pockets.items.push({ ...medkit, x: 0, y: 0, rotated: false });
    local.close(working);
    expect(sent).toHaveLength(1);
    expect(p.inventory.pockets.items.map((item) => item.type)).toEqual(['medkit']);
    expect(bagHash(local.bag)).toBe(bagHash(p.inventory));
    expect(watch().bagHash).toBe(bagHash(local.bag));
  });

  it('sends a drop from the container side, and the host and client agree afterwards', () => {
    const { state, p, local, sent, watch } = pair();
    const working = local.open(watch());
    // Drag the older plank out to the ground side, as the player would.
    const [older] = working.pack.items.filter((item) => item.type === 'plank');
    working.pack.items = working.pack.items.filter((item) => item !== older);
    working.container.items.push({ ...older!, x: 0, y: 0, rotated: false });
    local.close(working);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.drop).toEqual([{ type: 'plank', count: 1 }]);
    expect(p.materials!.planks).toBe(1);
    expect(state.pickups.filter((item) => item.type === 'plank')).toHaveLength(1);
    const after = watch();
    expect(bagHash(local.bag)).toBe(after.bagHash);
  });

  it('keeps what the host cannot drop, and sends nothing for it', () => {
    const { p, local, sent, watch } = pair();
    p.bottles = 1;
    const working = local.open(watch());
    const bottle = working.pack.items.find((item) => item.type === 'bottle')!;
    working.pack.items = working.pack.items.filter((item) => item !== bottle);
    working.container.items.push({ ...bottle, x: 0, y: 0, rotated: false });
    local.close(working);
    expect(sent).toEqual([]);
    expect(local.bag.pack.items.some((item) => item.type === 'bottle') || local.bag.pockets.items.some((item) => item.type === 'bottle')).toBe(true);
  });

  it('heals a layout the host disagrees with, once the bag has been shut a second', () => {
    const { p, local, sent, watch, tick } = pair();
    watch();
    const medkit = local.bag.pack.items.find((item) => item.type === 'medkit')!;
    local.bag.pack.items = local.bag.pack.items.filter((item) => item !== medkit);
    local.bag.pockets.items.push({ ...medkit, x: 0, y: 0 });
    local.heal();
    expect(sent).toEqual([]);
    tick(1200);
    local.heal();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.drop).toEqual([]);
    expect(bagHash(p.inventory)).toBe(bagHash(local.bag));
  });

  it('does nothing without a hash from the host', () => {
    const local = new LocalBag(vi.fn(), () => 0);
    local.sync(aHud());
    local.heal();
    expect(local.bag.pack.items.length).toBeGreaterThan(0);
  });

  it('commits candy use and applies the sugar buff to the player', () => {
    const { p, local, sent, watch } = pair();
    p.candy = ['sour_skulls'];
    const working = local.open(watch());
    working.used.push({ id: 'candy-carried-sour_skulls-0', type: 'sour_skulls', x: 0, y: 0, rotated: false });
    local.close(working);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.use).toEqual([{ type: 'sour_skulls', count: 1 }]);
    expect(p.candy).toEqual([]);
    expect(p.sugar.some((s) => s.id === 'sour_skulls')).toBe(true);
  });

  it('commits candy drop and leaves a candy pickup on the floor', () => {
    const { state, p, local, sent, watch } = pair();
    p.candy = ['fang_taffy'];
    const working = local.open(watch());
    working.dropped.push({ id: 'candy-carried-fang_taffy-0', type: 'fang_taffy', x: 0, y: 0, rotated: false });
    local.close(working);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.drop).toEqual([{ type: 'fang_taffy', count: 1 }]);
    expect(p.candy).toEqual([]);
    const pickup = state.pickups.find((item) => item.type === 'candy');
    expect(pickup).toBeDefined();
    expect(pickup?.candyId).toBe('fang_taffy');
  });
});
