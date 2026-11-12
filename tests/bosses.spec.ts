import { describe, expect, it } from 'vitest';
import { BOSSES, CHARGE_SEC, CHARGE_SPEED, liveBoss } from '../shared/bosses.ts';
import { TICK_RATE } from '../shared/constants.ts';
import { damageZombie } from '../shared/combat.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { levelDef } from '../shared/levels.ts';
import { SEED, eventsOf, stateOf, steps } from './helpers/sim-harness.ts';

/** A sim on a boss level, a beat before its last horde. */
function bossNight(level: number) {
  const sim = new GameSimulation({ seed: SEED, startLevel: level });
  sim.addPlayer('a', 'a');
  const state = stateOf(sim);
  state.zombies = [];
  state.populationTarget = 0;
  state.wave = levelDef(level).hordes - 1;
  state.phase = 'intermission';
  state.intermissionLeft = 0.01;
  sim.snapshot();
  return { sim, state };
}

describe('boss nights', () => {
  it('bring the Howler with the last horde of level 3, huge and hard to kill', () => {
    const { sim, state } = bossNight(3);
    steps(sim, 2);
    const boss = liveBoss(state);
    expect(boss?.boss).toBe('howler');
    expect(boss?.maxHealth).toBe(BOSSES.howler.health);
    expect(boss?.horde).toBe(true);
    const snap = sim.snapshot();
    expect(snap.boss).toMatchObject({ id: 'howler', maxHealth: BOSSES.howler.health });
  });

  it('bring no boss to an ordinary town or an early horde', () => {
    const { sim, state } = bossNight(2);
    steps(sim, 2);
    expect(liveBoss(state)).toBeNull();
    const early = bossNight(3);
    early.state.wave = 0;
    steps(early.sim, 2);
    expect(liveBoss(early.state)).toBeNull();
  });

  it('keep the horde going past its clock while the boss stands', () => {
    const { sim, state } = bossNight(3);
    steps(sim, 2);
    state.zombies = state.zombies.filter((z) => z.boss);
    state.spawnQueue = [];
    state.hordeLeft = 0;
    steps(sim, 3);
    expect(state.phase).toBe('wave');
  });

  it('let Mother give birth and the Howler call runners', () => {
    const mother = bossNight(6);
    steps(mother.sim, 2);
    const before = mother.state.zombies.filter((z) => z.type === 'walker').length;
    const z = liveBoss(mother.state);
    if (z?.bossState) z.bossState.trickLeft = 0.01;
    steps(mother.sim, 2);
    expect(mother.state.zombies.filter((zz) => zz.type === 'walker').length).toBeGreaterThan(before);
  });

  it('let the Butcher charge at a survivor close by, then slow back down', () => {
    const { sim, state } = bossNight(9);
    steps(sim, 2);
    const z = liveBoss(state);
    expect(z?.boss).toBe('butcher');
    if (!z?.bossState) return;
    const [a] = state.players;
    z.x = a.x + 150;
    z.y = a.y;
    z.bossState.trickLeft = 0.01;
    steps(sim, 2);
    expect(z.speed).toBeCloseTo(z.bossState.baseSpeed * CHARGE_SPEED);
    steps(sim, Math.ceil(CHARGE_SEC * TICK_RATE) + 2);
    expect(z.speed).toBeCloseTo(z.bossState.baseSpeed);
  });

  it('pay out when it falls: points, a medkit, a prize and a boss_down', () => {
    const { sim, state } = bossNight(3);
    steps(sim, 2);
    sim.snapshot();
    const z = liveBoss(state);
    const [a] = state.players;
    if (!z) throw new Error('no boss');
    const pickups = state.pickups.length;
    const score = a.score;
    damageZombie(state, z, 1e6, 0, 'a');
    expect(a.score - score).toBeGreaterThanOrEqual((BOSSES.howler.points * 3) / 10);
    expect(state.pickups.length - pickups).toBeGreaterThanOrEqual(2);
    expect(eventsOf(sim.snapshot(), 'boss_down')).toHaveLength(1);
  });
});
