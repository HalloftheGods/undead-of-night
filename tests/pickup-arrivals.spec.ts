import { afterEach, describe, expect, it } from 'vitest';
import { applyBagCommit } from '../shared/bag-sim.ts';
import type { BagCommit } from '../shared/bag.ts';
import { LocalBag } from '../src/game/local-bag.ts';
import { buildHud } from '../src/game/hud-state.ts';
import { arrivalPhase, clearArrivals, FLY_MS, noteMove, notePickup, notePlaced, noteArrivals, POP_MS, setArrivalCamera } from '../src/game/inventory/pickup-arrivals.ts';
import { flightBox } from '../src/engine/loot-arrivals-draw.ts';
import { quietSim, steps } from './helpers/sim-harness.ts';

/** A host player and a client bag that watches it through snapshots. */
function pair() {
  const { sim, state } = quietSim();
  const p = state.players[0]!;
  const local = new LocalBag((commit: BagCommit) => applyBagCommit(state, p, commit), () => 0);
  const watch = () => {
    steps(sim, 1);
    const snapshot = sim.snapshot();
    const hud = buildHud(snapshot, snapshot.players.find((e) => e.id === p.id)!, null);
    local.sync(hud);
    return hud;
  };
  p.bottles = 0;
  p.medkits = 0;
  p.materials!.planks = 0;
  watch();
  return { p, local, watch };
}

const shown = (grids: { items: { type: string }[] }[], type: string) => grids.flatMap((grid) => grid.items).filter((item) => item.type === type).length;

describe('an open inventory takes in a pickup at once', () => {
  it('puts a newly carried item into the open grids and says it arrived', () => {
    const { p, local, watch } = pair();
    const working = local.open(watch());
    expect(shown([working.pack, working.pockets], 'medkit')).toBe(0);
    p.medkits = 1;
    const added = local.absorb(working, watch());
    expect(added.map((item) => item.type)).toEqual(['medkit']);
    expect(shown([working.pack, working.pockets], 'medkit')).toBe(1);
    // A second snapshot with nothing new adds nothing.
    expect(local.absorb(working, watch())).toEqual([]);
  });

  it('keeps a picked-up item when the window closes', () => {
    const { p, local, watch } = pair();
    const working = local.open(watch());
    p.medkits = 1;
    local.absorb(working, watch());
    local.close(working);
    expect(shown([local.bag.pack, local.bag.pockets], 'medkit')).toBe(1);
  });

  it('takes away an item the host used up while the window is open', () => {
    const { p, local, watch } = pair();
    p.medkits = 1;
    watch();
    const working = local.open(watch());
    expect(shown([working.pack, working.pockets], 'medkit')).toBe(1);
    p.medkits = 0;
    local.absorb(working, watch());
    expect(shown([working.pack, working.pockets], 'medkit')).toBe(0);
  });

  it('does nothing while the window is shut', () => {
    const { p, local, watch } = pair();
    const working = local.open(watch());
    local.close(working);
    p.medkits = 1;
    expect(local.absorb(working, watch())).toEqual([]);
  });
});

describe('an arrival', () => {
  afterEach(() => {
    clearArrivals();
    setArrivalCamera(null);
  });

  it('flies from the pickup spot, then pops, then is done', () => {
    notePickup({ x: 50, y: 60 }, 1000);
    const [arrival] = noteArrivals([{ id: 'a', type: 'medkit' }], 1010);
    expect(arrival.from).toEqual({ x: 50, y: 60 });
    expect(arrivalPhase('a', 1010)?.phase).toBe('fly');
    expect(arrivalPhase('a', 1010 + FLY_MS + 1)?.phase).toBe('pop');
    expect(arrivalPhase('a', 1010 + FLY_MS + POP_MS + 1)).toBeNull();
  });

  it('only pops when no pickup was seen, or one too old to be it', () => {
    notePickup({ x: 1, y: 1 }, 0);
    const [arrival] = noteArrivals([{ id: 'b', type: 'medkit' }], 5000);
    expect(arrival.from).toBeNull();
    expect(arrivalPhase('b', 5000)?.phase).toBe('pop');
  });

  it('flies a double-clicked item from the cell it left, at that cell size, into its new cell', () => {
    noteMove({ id: 'm', type: 'medkit' }, { buffer: { x: 0, y: 0, w: 10, h: 10 } }, 0);
    const phase = arrivalPhase('m', 0);
    expect(phase?.phase).toBe('fly');
    const cell = { x: 100, y: 50, w: 20, h: 20 };
    expect(flightBox(phase!.arrival, cell, 0)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
    expect(flightBox(phase!.arrival, cell, 1)).toEqual(cell);
  });

  it('only lands an item the player set down by hand', () => {
    notePlaced({ id: 'p', type: 'medkit' }, 0);
    expect(arrivalPhase('p', 0)?.phase).toBe('pop');
  });

  it('does not fly with reduced motion', () => {
    setArrivalCamera({ still: true, toBuffer: (point) => point, toClient: (point) => point });
    notePickup({ x: 5, y: 5 }, 100);
    expect(noteArrivals([{ id: 'c', type: 'medkit' }], 110)[0].from).toBeNull();
  });
});
