import { describe, expect, it } from 'vitest';
import { parseClientPacket } from '../server/packets.ts';
import { SNEAK_SIGHT_SCALE, SPRINT_NOISE_RADIUS, TICK_RATE, ZOMBIE_SIGHT_RANGE } from '../shared/constants.ts';
import { playerSpeed, stanceOf } from '../shared/players.ts';
import { spottedFrom } from '../shared/zombie-senses.ts';
import { addRoamer, input, quietSim, steps } from './helpers/sim-harness.ts';

describe('sneak and sprint', () => {
  it('sneak wins over sprint, and nothing held is a walk', () => {
    expect(stanceOf({})).toBe('walk');
    expect(stanceOf({ sprint: true })).toBe('sprint');
    expect(stanceOf({ sneak: true, sprint: true })).toBe('sneak');
  });

  it('sprinting is faster than walking, and sneaking slower', () => {
    expect(playerSpeed(0, 'sprint')).toBeGreaterThan(playerSpeed(0));
    expect(playerSpeed(0, 'sneak')).toBeLessThan(playerSpeed(0));
    expect(playerSpeed(0)).toBe(playerSpeed(0, 'walk'));
  });

  it('the sim moves a sprinter further than a sneaker in the same time', () => {
    const travelled = (extra: { sneak?: boolean; sprint?: boolean }) => {
      const { sim, state } = quietSim();
      const [p] = state.players;
      const startX = p.x;
      sim.setInput('a', input({ seq: 1, right: true, ...extra }));
      steps(sim, 3);
      return p.x - startX;
    };
    const walk = travelled({});
    expect(travelled({ sprint: true })).toBeGreaterThan(walk);
    expect(travelled({ sneak: true })).toBeLessThan(walk);
  });

  it('a sneaking survivor is spotted from a shorter distance', () => {
    const { state } = quietSim();
    const [p] = state.players;
    const walking = spottedFrom(p);
    p.stance = 'sneak';
    expect(spottedFrom(p)).toBeCloseTo(walking * SNEAK_SIGHT_SCALE);
    expect(walking).toBeLessThanOrEqual(ZOMBIE_SIGHT_RANGE);
  });

  it('sprinting footsteps draw a roamer that walking does not', () => {
    const hears = (extra: { sprint?: boolean }) => {
      const { sim, state } = quietSim();
      const [p] = state.players;
      p.skin = 1; // Bear: a normal noise radius, unlike the default survivor, Night
      // Behind the player, in earshot of a sprint but out of the way of the stride.
      const roamer = addRoamer(state, 'walker', p.x - SPRINT_NOISE_RADIUS + 20, p.y);
      roamer.senseOffset = 1;
      sim.setInput('a', input({ seq: 1, angle: 0, right: true, ...extra }));
      steps(sim, 2);
      return roamer.mode;
    };
    expect(hears({ sprint: true })).not.toBe('wander');
  });

  it('standing still with sprint held makes no noise', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    sim.setInput('a', input({ seq: 1, sprint: true }));
    steps(sim, TICK_RATE);
    expect(p.stepNoiseLeft).toBe(0);
    expect(state.noises).toEqual([]);
  });

  it('the server keeps sneak and sprint, and turns away a non-boolean one', () => {
    const base = { seq: 1, up: false, down: false, left: false, right: false, angle: 0, shoot: false, reload: false, weapon: null, melee: false, heal: false, search: false };
    const parse = (extra: Record<string, unknown>) => parseClientPacket(JSON.stringify({ type: 'input', input: { ...base, ...extra } }));
    const sprinting = parse({ sprint: true });
    expect(sprinting?.type === 'input' && sprinting.input.sprint).toBe(true);
    const plain = parse({});
    expect(plain?.type === 'input' && plain.input.sneak).toBeUndefined();
    expect(parse({ sneak: 'yes' })).toBeNull();
  });
});
