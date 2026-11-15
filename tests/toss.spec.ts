import { describe, expect, it } from 'vitest';
import { applyItemMove } from '../shared/item-move-sim.ts';
import { TOSS_RANGE, tossLanding } from '../shared/toss.ts';
import { isBlockedAt } from '../shared/world-query.ts';
import { clearWay, quietSim, steps } from './helpers/sim-harness.ts';

function open() {
  const quiet = quietSim();
  const p = quiet.state.players[0]!;
  const way = clearWay(quiet.state, 320);
  return { ...quiet, p, way };
}

describe('tossLanding', () => {
  it('clamps a far aim to the toss range along the line', () => {
    const { state, p, way } = open();
    const spot = tossLanding(state.map, p, { x: p.x + way.dx * 300, y: p.y + way.dy * 300 });
    expect(Math.hypot(spot.x - p.x, spot.y - p.y)).toBeCloseTo(TOSS_RANGE, 3);
  });

  it('lands on the near side of a wall in the way, never inside it', () => {
    const { state, p } = open();
    const wall = state.map.buildings[0]!;
    const from = { x: wall.x - 40, y: wall.y + 60 };
    const spot = tossLanding(state.map, from, { x: from.x + 120, y: from.y });
    expect(isBlockedAt(state.map, spot.x, spot.y)).toBe(false);
    expect(spot.x).toBeLessThan(wall.x + 8);
    expect(p).toBeDefined();
  });

  it('lands at the survivor\'s own feet when aimed there', () => {
    const { state, p } = open();
    expect(tossLanding(state.map, p, { x: p.x, y: p.y })).toEqual({ x: p.x, y: p.y });
  });
});

describe('a ground move', () => {
  it('tosses the item to the clamped spot, tags the dropper and says so to everyone', () => {
    const { sim, state, p, way } = open();
    p.bottles = 1;
    steps(sim, 1);
    const item = [...p.inventory.pack.items, ...p.inventory.pockets.items].find((i) => i.type === 'bottle')!;
    const grid = p.inventory.pack.items.includes(item) ? 'pack' : 'pockets';
    const aim = { x: p.x + way.dx * 300, y: p.y + way.dy * 300 };
    const fromX = p.x;
    const fromY = p.y;
    const reason = applyItemMove(state, p, { id: p.lastMoveId + 1, item: item.id, type: item.type, from: { kind: 'cell', grid, x: item.x, y: item.y }, to: { kind: 'ground', x: aim.x, y: aim.y } });
    expect(reason).toBeNull();
    const left = state.pickups.find((i) => i.type === 'bottle')!;
    expect(Math.hypot(left.x - fromX, left.y - fromY)).toBeCloseTo(TOSS_RANGE, 3);
    expect(left.leftBy).toBe(p.id);
    expect(state.events.some((e) => e.type === 'item_tossed' && e.playerId === p.id && e.fromX === fromX && e.toX === left.x && e.toY === left.y)).toBe(true);
  });
});
