import { describe, expect, it } from 'vitest';
import { BLEEDOUT_SEC, START_SPARE_ROUNDS, VIEWER_RANGE, WEAPONS } from '../shared/constants.ts';
import { hurtPlayer, returnDeadPlayers } from '../shared/player-health.ts';
import type { SimState } from '../shared/sim-state.ts';
import { igniteZombie } from '../shared/zombie-status.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { viewFor } from '../shared/snapshot-view.ts';
import { addZombie, input, quietSim, steps } from './helpers/sim-harness.ts';

const TOKEN = 'tab-of-the-leaver';

/** Two tabs in a room, with the first horde over so the run is well underway. */
function room() {
  const sim = new GameSimulation({ seed: 4242 });
  sim.addPlayer('a', 'Ann', 'token-a');
  sim.addPlayer('b', 'Bea', TOKEN);
  const state: SimState = sim['sim'];
  state.intermissionLeft = 1e6;
  state.zombies = [];
  state.pickups = [];
  state.populationTarget = 0;
  state.wave = 1;
  const [a, b] = state.players;
  a.x = Math.round(a.x);
  a.y = Math.round(a.y);
  b.x = a.x + 100;
  b.y = a.y;
  sim.snapshot();
  return { sim, state, a, b };
}

const statusOf = (sim: GameSimulation, id: string) => sim.snapshot().players.find((p) => p.id === id);

describe('asking if a token has a body', () => {
  it('finds one in play or left behind, and none for a stranger', () => {
    const { sim } = room();
    expect(sim.hasBodyFor(TOKEN)).toBe(true);
    sim.removePlayer('b');
    expect(sim.hasBodyFor(TOKEN)).toBe(true);
    expect(sim.hasBodyFor('tab-of-a-stranger')).toBe(false);
  });

  it('finds none once a new run has let the body go', () => {
    const { sim } = room();
    sim.removePlayer('b');
    sim.restart();
    expect(sim.hasBodyFor(TOKEN)).toBe(false);
  });
});

describe('coming back to a run', () => {
  it('picks up exactly what was left behind', () => {
    const { sim, state, b } = room();
    b.health = 37;
    b.score = 120;
    b.kills = 9;
    b.medkits = 2;
    b.guns.carbine = { ammo: 7 };
    b.owned = ['pistol', 'carbine'];
    b.weapon = 'carbine';
    b.ammoBag.carbine = 44;
    b.guns.pistol!.ammo = 3;
    const { x, y, skin } = b;

    sim.removePlayer('b');
    expect(state.players.length).toBe(1);
    const back = sim.addPlayer('b2', 'Bea again', TOKEN);

    expect(back).toMatchObject({
      id: 'b2',
      name: 'Bea again',
      skin,
      x,
      y,
      status: 'alive',
      health: 37,
      score: 120,
      kills: 9,
      medkits: 2,
      weapon: 'carbine',
      owned: ['pistol', 'carbine'],
    });
    expect(back.ammoBag.carbine).toBe(44);
    expect(back.mags).toEqual({ pistol: 3, carbine: 7, shotgun: 0 });
  });

  it('is no respawn for the dead: they wait for the next horde like anyone else', () => {
    const { sim, state, b } = room();
    hurtPlayer(state, b, 1e6);
    b.status = 'dead';
    sim.removePlayer('b');
    sim.addPlayer('b2', 'Bea', TOKEN);
    expect(statusOf(sim, 'b2')).toMatchObject({ status: 'dead', health: 0 });
  });

  it('keeps their line on the results screen under the new connection', () => {
    const { sim, state, a, b } = room();
    b.score = 500;
    for (const p of [a, b]) {
      hurtPlayer(state, p, 1e6);
      p.status = 'dead';
    }
    sim.step();
    expect(sim.phase).toBe('gameover');
    sim.addPlayer('b2', 'Bea', TOKEN);
    expect(state.gameOver?.players.find((p) => p.id === 'b2')?.score).toBe(500);
  });

  it('costs the dead nothing if they are away as a horde starts', () => {
    const { sim, state, b } = room();
    hurtPlayer(state, b, 1e6);
    b.status = 'dead';
    sim.removePlayer('b');
    returnDeadPlayers(state);
    sim.addPlayer('b2', 'Bea', TOKEN);
    expect(statusOf(sim, 'b2')).toMatchObject({ status: 'alive', health: 50 });
  });

  it('is no rescue for the downed, and no teleport to a teammate', () => {
    const { sim, state, b } = room();
    hurtPlayer(state, b, 1e6);
    expect(b.status).toBe('downed');
    b.bleedout = BLEEDOUT_SEC / 2;
    const { x } = b;
    sim.removePlayer('b');
    sim.addPlayer('b2', 'Bea', TOKEN);
    expect(statusOf(sim, 'b2')).toMatchObject({ status: 'downed', bleedout: BLEEDOUT_SEC / 2, x });
  });

  it('starts counting input again, since a new tab starts its seq at 1', () => {
    const { sim, b } = room();
    b.queuedSeq = 5000;
    b.lastInputSeq = 5000;
    b.shoot = true;
    b.reloadLeft = 0.4;
    sim.removePlayer('b');
    sim.addPlayer('b2', 'Bea', TOKEN);
    sim.setInput('b2', input({ seq: 1, right: true }));
    sim.step();
    const back = statusOf(sim, 'b2');
    expect(back?.lastInputSeq).toBe(1);
    expect(back?.moving).toBe(true);
    expect(back?.reload).toBe(0);
  });

  it('keeps a kill a fire lands while they are away', () => {
    const { sim, state, b } = room();
    const z = addZombie(state, 'walker', b.x + 400, b.y);
    z.speed = 0;
    z.health = 1;
    igniteZombie(state, z, b.id);
    const { score, kills } = b;
    sim.removePlayer('b');
    steps(sim, 30);
    expect(z.health).toBe(0);
    const back = sim.addPlayer('b2', 'Bea', TOKEN);
    // A walker in town 1 pays 1.
    expect(back).toMatchObject({ score: score + 1, kills: kills + 1 });
  });

  it('keeps the headshot bonus of a round still in the air as they go', () => {
    const { sim, state, b } = room();
    const z = addZombie(state, 'walker', b.x + 60, b.y);
    z.speed = 0;
    z.health = 1;
    const { score, kills } = b;
    state.bullets.push({ id: 'shot', shooterId: b.id, x: b.x, y: b.y, vx: 520, vy: 0, damage: 34, rangeLeft: 300, headTarget: z });
    sim.removePlayer('b');
    steps(sim, 6);
    expect(z.health).toBe(0);
    const back = sim.addPlayer('b2', 'Bea', TOKEN);
    // A walker in town 1 pays 1, and its head 1 more.
    expect(back).toMatchObject({ score: score + 2, kills: kills + 1 });
  });

  it('works once: a token cannot be spent twice', () => {
    const { sim, state } = room();
    sim.removePlayer('b');
    sim.addPlayer('b2', 'Bea', TOKEN);
    expect(state.departed.size).toBe(0);
  });

  it('forgets everyone when the run restarts', () => {
    const { sim, state, b } = room();
    b.score = 300;
    sim.removePlayer('b');
    hurtPlayer(state, state.players[0], 1e6);
    sim.step();
    expect(sim.phase).toBe('gameover');
    sim.restart();
    expect(state.departed.size).toBe(0);
    const back = sim.addPlayer('b2', 'Bea', TOKEN);
    expect(back).toMatchObject({ score: 0, status: 'alive', health: 100 });
    expect(back.reserve).toBe(START_SPARE_ROUNDS);
  });

  it('keeps the list bounded however many tokens pass through', () => {
    const { sim, state } = room();
    for (let i = 0; i < 200; i++) {
      sim.addPlayer(`p${i}`, 'x', `token-${i}`);
      sim.removePlayer(`p${i}`);
    }
    expect(state.departed.size).toBeLessThanOrEqual(32);
    expect(state.departed.has('token-199')).toBe(true);
  });

  it('never puts a token in a snapshot', () => {
    const { sim } = room();
    expect(JSON.stringify(sim.snapshot())).not.toContain(TOKEN);
    expect(JSON.stringify(sim.addPlayer('c', 'Cy', 'token-c'))).not.toContain('token-c');
  });
});

describe('a newcomer', () => {
  it('walks into a run underway with half health and no spares', () => {
    const { sim } = room();
    const late = sim.addPlayer('c', 'Cy', 'brand-new');
    expect(late).toMatchObject({ status: 'alive', health: 50, reserve: 0, ammo: WEAPONS.pistol.magSize, owned: ['pistol'] });
  });

  it('who turns up in the lead-in, with friends still gathering, starts level with them', () => {
    const { sim } = quietSim();
    steps(sim, 300);
    const late = sim.addPlayer('c', 'Cy', 'brand-new');
    expect(late).toMatchObject({ health: 100, reserve: START_SPARE_ROUNDS });
  });

  it('with a token still in the room takes that body over, as after a drop the server has not noticed', () => {
    const { sim, b } = room();
    b.health = 33;
    b.score = 500;
    const back = sim.addPlayer('b2', 'Bea', TOKEN);
    expect(back).toMatchObject({ health: 33, score: 500, skin: b.skin });
    expect(sim.playerCount).toBe(2);
    expect(sim.playerWithToken(TOKEN)).toBe('b2');
    sim.removePlayer('b');
    expect(sim.playerCount).toBe(2);
  });
});

describe('each client\'s cut of a frame', () => {
  function apart() {
    const { sim, state, a, b } = room();
    b.x = a.x + VIEWER_RANGE * 3;
    const nearA = addZombie(state, 'walker', a.x + 40, a.y);
    const nearB = addZombie(state, 'walker', b.x + 40, b.y);
    for (const z of [nearA, nearB]) z.speed = 0;
    state.pickups.push({ id: 'for-a', type: 'bandage', x: a.x, y: a.y + 30, ttl: null, rounds: 0 });
    state.pickups.push({ id: 'for-b', type: 'bandage', x: b.x, y: b.y + 30, ttl: null, rounds: 0 });
    return { sim, state, nearA, nearB, a, b };
  }

  it('holds only what is around that player, with everyone in the room still in it', () => {
    const { sim, nearA, nearB } = apart();
    const frame = sim.snapshot();
    const seenByA = viewFor(frame, 'a');
    expect(seenByA.zombies.map((z) => z.id)).toEqual([nearA.id]);
    expect(seenByA.pickups.map((item) => item.id)).toEqual(['for-a']);
    expect(seenByA.players.map((p) => p.id)).toEqual(['a', 'b']);
    expect(viewFor(frame, 'b').zombies.map((z) => z.id)).toEqual([nearB.id]);
  });

  it('covers the corner of the widest view with margin to spare', () => {
    const { sim, state, a } = room();
    const atCorner = addZombie(state, 'walker', a.x + 512, a.y + 135);
    expect(viewFor(sim.snapshot(), 'a').zombies.map((z) => z.id)).toEqual([atCorner.id]);
  });

  it('shares events and bullets with everyone, whoever they concern', () => {
    const { sim, state } = apart();
    state.events.push({ type: 'wave_clear', wave: 1 });
    state.bullets.push({ id: 'shot', shooterId: 'b', x: 1, y: 1, vx: 1, vy: 1, damage: 1, rangeLeft: 1 });
    const seenByA = viewFor(sim.snapshot(), 'a');
    expect(seenByA.events).toEqual([{ type: 'wave_clear', wave: 1 }]);
    expect(seenByA.bullets.length).toBe(1);
  });

  it('follows a teammate for a dead viewer, whose camera sits on them', () => {
    const { sim, a, nearA, nearB } = apart();
    a.status = 'dead';
    const seenByDead = viewFor(sim.snapshot(), 'a');
    expect(seenByDead.zombies.map((z) => z.id).sort()).toEqual([nearA.id, nearB.id].sort());
  });

  it('leaves the frame itself alone, which is what solo plays from', () => {
    const { sim, nearA, nearB } = apart();
    const frame = sim.snapshot();
    viewFor(frame, 'a');
    expect(frame.zombies.map((z) => z.id).sort()).toEqual([nearA.id, nearB.id].sort());
  });
});
