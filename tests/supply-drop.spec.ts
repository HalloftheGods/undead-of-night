import { describe, expect, it } from 'vitest';
import { TICK_RATE } from '../shared/constants.ts';
import { DROP_DELAY_SEC, DROP_FALL_SEC, DROP_MARK_SEC, DROP_MAX_DISTANCE, DROP_MIN_DISTANCE } from '../shared/supply-drop.ts';
import { buildingAt } from '../shared/world-query.ts';
import { eventsOf, quietSim, steps, surviveHorde } from './helpers/sim-harness.ts';
import type { GameSimulation } from '../shared/simulation.ts';
import type { GameEvent } from '../shared/protocol.ts';

/** Steps and keeps every event, since a snapshot only carries the events since the last one. */
function collect(sim: GameSimulation, ticks: number): GameEvent[] {
  const seen: GameEvent[] = [];
  for (let i = 0; i < ticks; i += 1) {
    sim.step();
    seen.push(...sim.snapshot().events);
  }
  return seen;
}

describe('supply drop', () => {
  it('nothing comes before the first horde', () => {
    const { sim, state } = quietSim();
    steps(sim, (DROP_DELAY_SEC + 1) * TICK_RATE);
    expect(state.drop).toBeNull();
  });

  it('after the first horde a flare goes up on open ground a fair walk away, then a crate lands on it', () => {
    const { sim, state } = quietSim();
    surviveHorde(sim, state);
    state.intermissionLeft = 1e6;
    sim.snapshot();
    const called = collect(sim, DROP_DELAY_SEC * TICK_RATE + 2).filter((e) => e.type === 'drop_called');
    expect(called).toHaveLength(1);
    const drop = state.drop!;
    expect(drop.phase).toBe('falling');
    expect(buildingAt(state.map, drop.x, drop.y)).toBeNull();
    const [p] = state.players;
    const away = Math.hypot(p.x - drop.x, p.y - drop.y);
    expect(away).toBeGreaterThanOrEqual(DROP_MIN_DISTANCE);
    expect(away).toBeLessThanOrEqual(DROP_MAX_DISTANCE);
    expect(state.lures).toHaveLength(1);
    expect(sim.snapshot().drop).toMatchObject({ landed: false });

    const before = state.pickups.length;
    const landed = collect(sim, DROP_FALL_SEC * TICK_RATE + 2).filter((e) => e.type === 'drop_landed');
    expect(landed).toHaveLength(1);
    const dropped = state.pickups.slice(before);
    expect(dropped.map((item) => item.type)).toContain('medkit');
    expect(dropped.length).toBe(5);
    expect(sim.snapshot().drop).toMatchObject({ landed: true });

    steps(sim, DROP_MARK_SEC * TICK_RATE + 2);
    expect(state.drop).toBeNull();
    expect(sim.snapshot().drop).toBeUndefined();
  });

  it('comes once a town', () => {
    const { sim, state } = quietSim();
    surviveHorde(sim, state);
    state.intermissionLeft = 1e6;
    steps(sim, (DROP_DELAY_SEC + DROP_FALL_SEC + DROP_MARK_SEC + 2) * TICK_RATE);
    expect(state.dropDone).toBe(true);
    sim.snapshot();
    steps(sim, (DROP_DELAY_SEC + 2) * TICK_RATE);
    expect(eventsOf(sim.snapshot(), 'drop_called')).toEqual([]);
    expect(state.drop).toBeNull();
  });
});
