import { describe, expect, it } from 'vitest';
import { candyIn, DOORSTEP_HOMES, MAX_CANDY_BAG } from '../shared/candy.ts';
import { containerGridFor, containerInReach, SEARCH_SEC, townContainers } from '../shared/containers.ts';
import type { Container } from '../shared/containers.ts';
import { PLAYER_RADIUS, TICK_RATE } from '../shared/constants.ts';
import { GameSimulation } from '../shared/simulation.ts';
import type { PlayerState, SimState } from '../shared/sim-state.ts';
import { stashIn } from '../shared/throwables.ts';
import { buildingAt, circleHitsSolid, doorBox } from '../shared/world-query.ts';
import { takeOut } from './helpers/item-moves.ts';
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

  it('opens a looting grid with candy when searched', () => {
    const { sim, state, p, bowl } = atAFullBowl();
    searchFor(sim, bowl);
    expect(state.containers[bowl.id].opened).toBe(true);
    expect(state.containers[bowl.id].items).toBeDefined();
    const items = state.containers[bowl.id].items!;
    const grid = containerGridFor(bowl);
    expect(items).toHaveLength(grid.cols * grid.rows - (grid.blocked?.length ?? 0));
    const [opened] = eventsOf(sim.snapshot(), 'container_opened');
    expect(opened.title).toBe('TAKE ONE');
    expect(opened.items).toEqual(items);

    for (const item of [...items]) expect(takeOut(state, p, bowl.id, item)).toBeNull();
    expect(p.candy).toEqual(items.map((it) => it.type));
  });

  it('stays empty once emptied, with no refill', () => {
    const { sim, state, p, bowl } = atAFullBowl();
    searchFor(sim, bowl);
    const items = state.containers[bowl.id].items!;
    for (const item of [...items]) takeOut(state, p, bowl.id, item);
    expect(state.containers[bowl.id].items).toEqual([]);
  });

  it('keeps what a survivor leaves behind for the next one', () => {
    const { sim, state, p, bowl } = atAFullBowl();
    searchFor(sim, bowl);
    const items = state.containers[bowl.id].items!;
    const [first, ...left] = items;
    expect(takeOut(state, p, bowl.id, first!)).toBeNull();
    expect(state.containers[bowl.id].items).toEqual(left);
  });

  it('a second piece out of a bowl arms the horde surge, and the first does not', () => {
    const { sim, state, p, bowl } = atAFullBowl();
    searchFor(sim, bowl);
    const [first, second] = state.containers[bowl.id].items!;
    takeOut(state, p, bowl.id, first!);
    expect(state.hordeSurges ?? 0).toBe(0);
    takeOut(state, p, bowl.id, second!);
    expect(state.hordeSurges).toBe(1);
  });

  it('keeps what a full candy bag has no room for in the bowl', () => {
    const { sim, state, p, bowl } = atAFullBowl();
    p.candy = Array.from({ length: MAX_CANDY_BAG - 1 }, () => 'ghost_gum' as const);
    searchFor(sim, bowl);
    expect(state.containers[bowl.id].opened).toBe(true);
    const items = [...state.containers[bowl.id].items!];
    const answers = items.map((item) => takeOut(state, p, bowl.id, item));
    expect(answers.slice(1).every((answer) => answer === 'no_room')).toBe(true);
    expect(items.length).toBeGreaterThan(1);
    expect(p.candy).toHaveLength(MAX_CANDY_BAG);
    expect(state.containers[bowl.id].items).toHaveLength(items.length - 1);
  });

  it('lights its front step like a jack-o\'-lantern', () => {
    const { map } = stateOf(new GameSimulation({ seed: 3 }));
    const bowls = map.props.filter((prop) => prop.kind === 'candy_bowl');
    for (const bowl of bowls) expect(map.lights.some((light) => Math.hypot(light.x - bowl.x, light.y - bowl.y) < 32)).toBe(true);
  });
});
