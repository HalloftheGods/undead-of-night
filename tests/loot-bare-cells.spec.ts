import { describe, expect, it } from 'vitest';
import { bareCellLook, SWEEP_TRAIL } from '../src/engine/loot-bare-cells.ts';

const idle = { rank: null, open: 0, sweep: 0, hovered: false, holding: false, blocked: false };

describe('bareCellLook', () => {
  it('paints nothing on an idle cell, so the container art shows untouched', () => {
    expect(bareCellLook(idle)).toBeNull();
  });

  it('never shows a void, even while an item is held over the board', () => {
    expect(bareCellLook({ ...idle, blocked: true, holding: true, hovered: true })).toBeNull();
  });

  it('sweeps a void like any other cell while the search runs', () => {
    expect(bareCellLook({ ...idle, blocked: true, rank: 2, open: 4, sweep: 0.5 })).not.toBeNull();
  });

  it('shows a hovered cell and every cell while an item is in hand', () => {
    expect(bareCellLook({ ...idle, hovered: true })).not.toBeNull();
    expect(bareCellLook({ ...idle, holding: true })).not.toBeNull();
  });

  it('lights the search head brightest, fades a short trail behind it, and leaves the rest bare', () => {
    const open = 20;
    const sweep = 10 / open;
    const at = (rank: number) => bareCellLook({ ...idle, rank, open, sweep });
    const head = at(10);
    expect(head).not.toBeNull();
    const trail = at(9);
    expect(trail).not.toBeNull();
    expect(trail!.alpha).toBeLessThan(head!.alpha);
    expect(at(10 - SWEEP_TRAIL - 1)).toBeNull();
    expect(at(11)).toBeNull();
  });

  it('shows nothing once the search is over', () => {
    expect(bareCellLook({ ...idle, rank: 0, open: 4, sweep: 1 })).toBeNull();
  });
});
