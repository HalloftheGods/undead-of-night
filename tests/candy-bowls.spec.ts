import { describe, expect, it } from 'vitest';
import { CANDY_CARRY, candyIn, DOORSTEP_HOMES } from '../shared/candy.ts';
import { containerInReach, SEARCH_SEC, townContainers } from '../shared/containers.ts';
import type { Container } from '../shared/containers.ts';
import { PLAYER_RADIUS, TICK_RATE } from '../shared/constants.ts';
import { GameSimulation } from '../shared/simulation.ts';
import type { PlayerState, SimState } from '../shared/sim-state.ts';
import { stashIn } from '../shared/throwables.ts';
import { buildingAt, circleHitsSolid, doorBox } from '../shared/world-query.ts';
import { eventsOf, input, quietSim, stateOf, steps } from './helpers/sim-harness.ts';

const SEEDS = [1, 2, 3, 4, 5, 6];
const bowlsOf = (state: SimState): Container[] => townContainers(state.map).filter((c) => c.kind === 'bowl');

/** Open ground outside, in reach of the bowl and of nothing else. */
function standBy(state: SimState, p: PlayerState, bowl: Container): void {
  for (let y = bowl.box.y1 + 2; y <= bowl.box.y1 + 24; y += 2) {
    for (let x = bowl.x - 20; x <= bowl.x + 20; x += 2) {
      const open = !circleHitsSolid(state.map, x, y, PLAYER_RADIUS) && !buildingAt(state.map, x, y);
      const usable = open && containerInReach(state.map, x, y, () => false)?.id === bowl.id;
      if (!usable) continue;
      p.x = x;
      p.y = y;
      return;
    }
  }
  throw new Error('nowhere to stand by this bowl');
}

function atAFullBowl() {
  const quiet = quietSim();
  const [p] = quiet.state.players;
  const [bowl] = bowlsOf(quiet.state);
  standBy(quiet.state, p, bowl);
  return { ...quiet, p, bowl };
}

const searchFor = (sim: GameSimulation, container: Container): void => {
  sim.setInput('a', input({ seq: 1, search: true }));
  steps(sim, Math.ceil(SEARCH_SEC[container.kind] * TICK_RATE) + 1);
};

describe('Halloween night candy bowls', () => {
  it.each(SEEDS)('seed %i: every house and apartment has one out by its front door, on the step outside', (seed) => {
    const state = stateOf(new GameSimulation({ seed }));
    const bowls = bowlsOf(state);
    const homes = state.map.buildings.filter((b) => DOORSTEP_HOMES.has(b.kind) && b.of === undefined);
    expect(bowls).toHaveLength(homes.length);
    for (const home of homes) {
      const door = doorBox(home);
      const bowl = bowls.find((each) => each.box.y0 === door.y1 && each.box.x1 <= door.x0 && each.box.x1 > door.x0 - 16);
      expect(bowl?.buildingKind).toBe('outdoors');
    }
  });

  it.each(SEEDS)('seed %i: are all full, of candy and nothing else', (seed) => {
    const state = stateOf(new GameSimulation({ seed }));
    for (const bowl of bowlsOf(state)) {
      expect(state.containers[bowl.id]).toEqual({ opened: false, loot: null });
      expect(stashIn(state.map.seed, bowl)).toBeNull();
      expect(candyIn(state.map.seed, bowl)).not.toBeNull();
    }
  });

  it('gives its candy to whoever searches it', () => {
    const { sim, state, p, bowl } = atAFullBowl();
    searchFor(sim, bowl);
    expect(p.candy).toEqual([candyIn(state.map.seed, bowl)]);
    expect(state.containers[bowl.id].opened).toBe(true);
    const [opened] = eventsOf(sim.snapshot(), 'container_opened');
    expect(opened.candy).toBe(p.candy[0]);
  });

  it('stays out for the next survivor when the searcher\'s bag is full', () => {
    const { sim, state, p, bowl } = atAFullBowl();
    p.candy = Array.from({ length: CANDY_CARRY }, () => 'ghost_gum' as const);
    searchFor(sim, bowl);
    expect(p.candy).toHaveLength(CANDY_CARRY);
    expect(state.containers[bowl.id].opened).toBe(false);
    const [refused] = eventsOf(sim.snapshot(), 'container_opened');
    expect(refused.full).toBe(true);
  });

  it('lights its front step like a jack-o\'-lantern', () => {
    const { map } = stateOf(new GameSimulation({ seed: 3 }));
    const bowls = map.props.filter((prop) => prop.kind === 'candy_bowl');
    for (const bowl of bowls) expect(map.lights.some((light) => Math.hypot(light.x - bowl.x, light.y - bowl.y) < 32)).toBe(true);
  });
});
