// Worst-case bytes per guest per tick (#7276): what a host would push down each data channel, measured
// as server/room.ts does it, one `viewFor` cut per player run through JSON. deflate-raw is the size the
// compression slice (#7290) would send. The numbers print so the spec's Costs table can quote them.
import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { MAX_BUFFERED_BYTES } from '../server/limits.ts';
import { MAX_PLAYERS } from '../shared/constants.ts';
import type { Loadout } from '../shared/home-protocol.ts';
import { emptyLoadout } from '../shared/loadout.ts';
import type { SnapshotPacket } from '../shared/protocol.ts';
import { viewFor } from '../shared/snapshot-view.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { CirclingBot } from './helpers/bots.ts';
import { SEED, stateOf } from './helpers/sim-harness.ts';

const ARENA_TICKS = 3600;
const OVERRUN_TICKS = 2400;
/** Past the first visit, so the bunker clock runs and its door can give. */
const HIGHEST = 10;
const KIT: Loadout = { ...emptyLoadout(), guns: { pistol: {}, carbine: {} }, ammoBag: { pistol: 90, carbine: 240, shotgun: 0 }, medkits: 2 };

interface Sizes {
  readonly raw: number[];
  readonly packed: number[];
}

const IDS = Array.from({ length: MAX_PLAYERS }, (_, i) => `p${i + 1}`);

function measure(frame: SnapshotPacket, sizes: Sizes): void {
  for (const id of IDS) {
    const json = JSON.stringify(viewFor(frame, id));
    sizes.raw.push(Buffer.byteLength(json));
    sizes.packed.push(deflateRawSync(json).length);
  }
}

function stats(values: readonly number[]): { mean: number; p95: number; max: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  return { mean: Math.round(mean), p95: sorted[Math.floor(sorted.length * 0.95)], max: sorted[sorted.length - 1] };
}

function report(label: string, peak: number, sizes: Sizes): void {
  const raw = stats(sizes.raw);
  const packed = stats(sizes.packed);
  process.stdout.write(`snapshot size ${label}: peak ${peak} zombies; raw mean ${raw.mean} B, p95 ${raw.p95} B, max ${raw.max} B; deflate-raw mean ${packed.mean} B, p95 ${packed.p95} B, max ${packed.max} B\n`);
}

/** Four unkillable bots circling, one frame per tick, every player's cut measured. */
function run(sim: GameSimulation, ticks: number): { sizes: Sizes; peak: number } {
  const state = stateOf(sim);
  const bots = IDS.map((id) => new CirclingBot(id, sim.map));
  const sizes: Sizes = { raw: [], packed: [] };
  let snapshot = sim.snapshot();
  let peak = 0;
  for (let tick = 0; tick < ticks; tick++) {
    bots.forEach((bot, i) => {
      const packet = bot.think(snapshot);
      if (packet) sim.setInput(IDS[i], packet);
    });
    for (const p of state.players) p.health = p.maxHealth = 1e9;
    sim.step();
    snapshot = sim.snapshot();
    measure(snapshot, sizes);
    peak = Math.max(peak, state.zombies.length);
  }
  return { sizes, peak };
}

describe('snapshot size per guest', () => {
  it('Arcade with a full room deep in the hordes stays under the send buffer', () => {
    const sim = new GameSimulation({ seed: SEED });
    for (const id of IDS) sim.addPlayer(id, id);
    const { sizes, peak } = run(sim, ARENA_TICKS);
    report('arcade', peak, sizes);
    expect(stats(sizes.raw).max).toBeLessThan(MAX_BUFFERED_BYTES);
  }, 120000);

  it('a Campaign overrun with the full horde through the door stays under the send buffer', () => {
    const sim = new GameSimulation({ seed: SEED, overrun: true, home: true });
    for (const id of IDS) sim.addPlayer(id, id, null, undefined, { loadout: KIT, highest: HIGHEST });
    sim.snapshot();
    const overrun = stateOf(sim).overrun;
    expect(overrun).not.toBeNull();
    if (overrun) overrun.left = 1e-6;
    const { sizes, peak } = run(sim, OVERRUN_TICKS);
    expect(stateOf(sim).overrun?.total).toBeGreaterThan(0);
    report('campaign overrun', peak, sizes);
    expect(stats(sizes.raw).max).toBeLessThan(MAX_BUFFERED_BYTES);
  }, 120000);
});
