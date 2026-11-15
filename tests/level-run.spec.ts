import { describe, expect, it } from 'vitest';
import { EXIT_RADIUS, LEAD_IN_SEC, LEVEL_CLEAR_HEAL, PLAYER_MAX_HEALTH, SPAWN_SCATTER, TICK_RATE, WEAPONS } from '../shared/constants.ts';
import { FINAL_LEVEL, levelDef, levelPopulation, levelSeed } from '../shared/levels.ts';
import { hurtPlayer } from '../shared/player-health.ts';
import type { SimState } from '../shared/sim-state.ts';
import { alivePlayers } from '../shared/sim-state.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { viewFor } from '../shared/snapshot-view.ts';
import { generateWorldMap } from '../shared/world-map.ts';
import { addZombie, boardVan, eventsOf, input, openLevelExit, quietSim, SEED, stateOf, steps, surviveHorde, VAN_WAIT_TICKS } from './helpers/sim-harness.ts';

/** Past the van's circle, with a little to spare. */
const AWAY_FROM_VAN = EXIT_RADIUS + 20;

const nearEntry = (state: SimState, p: { x: number; y: number }): boolean =>
  Math.hypot(p.x - state.map.spawn.x, p.y - state.map.spawn.y) <= SPAWN_SCATTER + 1;

function armed(state: SimState, index = 0) {
  const p = state.players[index];
  p.owned = ['pistol', 'carbine'];
  p.guns.carbine = { ammo: 9 };
  p.guns.pistol!.ammo = 4;
  p.ammoBag = { pistol: 31, carbine: 44, shotgun: 0 };
  p.weapon = 'carbine';
  p.ammo = 9;
  p.magSize = WEAPONS.carbine.magSize;
  p.reserve = 44;
  p.medkits = 2;
  p.score = 480;
  p.kills = 37;
  p.health = 40;
  return p;
}

describe('the exit', () => {
  it('stays shut until the level\'s last horde is survived', () => {
    const { sim, state } = quietSim();
    surviveHorde(sim, state);
    expect(state.wave).toBe(1);
    expect(sim.snapshot().exit).toBeNull();

    surviveHorde(sim, state);
    expect(state.wave).toBe(levelDef(1).hordes);
    const frame = sim.snapshot();
    expect(frame.exit).toMatchObject({ progress: 0 });
    const [opened] = eventsOf(frame, 'exit_open');
    expect(opened).toEqual({ type: 'exit_open', level: 1, x: frame.exit?.x, y: frame.exit?.y });
  });

  it('is announced once however many hordes go by', () => {
    const { sim, state } = quietSim();
    let announced = 0;
    for (let horde = 0; horde < 5; horde++) {
      surviveHorde(sim, state);
      announced += eventsOf(sim.snapshot(), 'exit_open').length;
    }
    expect(announced).toBe(1);
  });

  it('reaches everyone wherever they stand, the dead and those far from the van included', () => {
    const { sim, state } = quietSim(['a', 'b']);
    const [a, b] = state.players;
    openLevelExit(state);
    b.status = 'dead';
    const frame = sim.snapshot();
    expect(viewFor(frame, a.id).exit).toEqual(frame.exit);
    expect(viewFor(frame, b.id).exit).toEqual(frame.exit);
  });

  it('does not stop the lull and horde cycle: waiting around brings the next horde', () => {
    const { sim, state } = quietSim();
    openLevelExit(state);
    state.phase = 'intermission';
    state.intermissionLeft = 0.01;
    steps(sim, 2);
    expect(state.phase).toBe('wave');
    expect(state.wave).toBe(levelDef(1).hordes + 1);
    expect(state.spawnQueue.length).toBeGreaterThan(0);
    expect(state.exit).not.toBeNull();
  });

  it('leaves zombies hunting the run for the van', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    openLevelExit(state);
    const hunter = addZombie(state, 'walker', p.x + 60, p.y);
    const startGap = Math.hypot(hunter.x - p.x, hunter.y - p.y);
    steps(sim, TICK_RATE);
    expect(Math.hypot(hunter.x - p.x, hunter.y - p.y)).toBeLessThan(startGap);
  });

  it('takes about two seconds with everyone at the van', () => {
    const { sim, state } = quietSim();
    const exit = openLevelExit(state);
    const [p] = state.players;
    p.x = exit.x;
    p.y = exit.y;
    steps(sim, VAN_WAIT_TICKS - 1);
    expect(state.level).toBe(1);
    expect(sim.snapshot().exit?.progress).toBeGreaterThan(0.9);
    sim.step();
    expect(state.level).toBe(2);
    expect(VAN_WAIT_TICKS / TICK_RATE).toBe(2);
  });

  it('starts the wait over when someone walks off', () => {
    const { sim, state } = quietSim();
    const exit = openLevelExit(state);
    const [p] = state.players;
    p.x = exit.x;
    p.y = exit.y;
    steps(sim, VAN_WAIT_TICKS - 5);
    p.x = exit.x + AWAY_FROM_VAN;
    sim.step();
    expect(sim.snapshot().exit?.progress).toBe(0);
    p.x = exit.x;
    steps(sim, VAN_WAIT_TICKS - 5);
    expect(state.level).toBe(1);
  });

  it('waits for every player on their feet', () => {
    const { sim, state } = quietSim(['a', 'b']);
    const exit = openLevelExit(state);
    const [a, b] = state.players;
    a.x = exit.x;
    a.y = exit.y;
    b.x = exit.x + AWAY_FROM_VAN;
    b.y = exit.y;
    steps(sim, VAN_WAIT_TICKS * 2);
    expect(state.level).toBe(1);
  });

  it('does not wait for the downed or the dead', () => {
    const { sim, state } = quietSim(['a', 'b', 'c']);
    const [a, b, c] = state.players;
    b.x = a.x + 400;
    hurtPlayer(state, b, 500);
    expect(b.status).toBe('downed');
    c.status = 'dead';
    openLevelExit(state);
    boardVan(sim, state);
    expect(state.level).toBe(2);
  });

  it('cannot be used with nobody on their feet', () => {
    const { sim, state } = quietSim(['a', 'b']);
    const exit = openLevelExit(state);
    const [a, b] = state.players;
    a.x = exit.x;
    a.y = exit.y;
    b.status = 'dead';
    hurtPlayer(state, a, 500);
    steps(sim, VAN_WAIT_TICKS);
    expect(state.level).toBe(1);
    expect(sim.phase).toBe('gameover');
  });

  it('counts a walker-off who leaves the room as gone, so the rest can go', () => {
    const { sim, state } = quietSim(['a', 'b']);
    const exit = openLevelExit(state);
    state.players[1].x = exit.x + 500;
    sim.removePlayer('b');
    boardVan(sim, state);
    expect(state.level).toBe(2);
  });
});

describe('moving to the next town', () => {
  function reachLevelTwo(players: readonly string[] = ['a']) {
    const { sim, state } = quietSim(players);
    openLevelExit(state);
    return { sim, state };
  }

  it('raises the level\'s own town from the run seed, and tells clients in the snapshot', () => {
    const { sim, state } = reachLevelTwo();
    const firstTown = sim.map;
    boardVan(sim, state);

    const frame = sim.snapshot();
    expect(frame.level).toBe(2);
    expect(frame.mapSeed).toBe(levelSeed(SEED, 2));
    expect(sim.map).not.toBe(firstTown);
    expect(sim.map.seed).toBe(frame.mapSeed);
    expect(generateWorldMap(frame.mapSeed, frame.level).tiles).toEqual(sim.map.tiles);
  });

  it('starts a clean lead-in in a stocked, populated town with no exit', () => {
    const { sim, state } = reachLevelTwo();
    addZombie(state, 'walker', 50, 50);
    state.pickups.push({ id: 'old', type: 'medkit', x: 1, y: 1, ttl: null, rounds: 0 });
    boardVan(sim, state);

    const frame = sim.snapshot();
    expect(frame.phase).toBe('intermission');
    expect(frame.wave).toBe(0);
    expect(frame.intermission).toBeCloseTo(LEAD_IN_SEC, 1);
    expect(frame.exit).toBeNull();
    expect(state.zombies.filter((z) => !z.dormant).length).toBe(levelPopulation(2));
    expect(state.populationTarget).toBe(levelPopulation(2));
    expect(state.pickups.length).toBeGreaterThan(30);
    expect(state.pickups.some((item) => item.id === 'old')).toBe(false);
    expect(state.bullets).toEqual([]);
  });

  it('puts everyone at the entry of the new town, and the world carries on from there', () => {
    const { sim, state } = reachLevelTwo(['a', 'b']);
    boardVan(sim, state);
    for (const p of state.players) expect(nearEntry(state, p)).toBe(true);

    sim.setInput('a', input({ seq: 999, right: true }));
    steps(sim, TICK_RATE);
    expect(state.players[0].lastInputSeq).toBe(999);
    state.intermissionLeft = 0;
    steps(sim, TICK_RATE);
    expect(state.phase).toBe('wave');
    expect(state.zombies.some((z) => z.horde)).toBe(true);
  });

  it('announces the change in order, and drops what was queued for the old town', () => {
    const { sim, state } = reachLevelTwo();
    const exit = state.exit!;
    const [p] = state.players;
    p.x = exit.x;
    p.y = exit.y;
    steps(sim, VAN_WAIT_TICKS - 1);
    sim.snapshot();
    state.events.push({ type: 'player_hurt', playerId: 'a', x: 1, y: 1, damage: 1 });
    sim.step();
    expect(sim.snapshot().events.map((event) => event.type)).toEqual(['level_complete', 'level_start', 'wave_intermission']);
  });

  it('keeps the guns, ammo, medkits, score and kills of those on their feet, with some health back', () => {
    const { sim, state } = reachLevelTwo();
    const p = armed(state);
    boardVan(sim, state);

    const [me] = sim.snapshot().players;
    expect(me).toMatchObject({ status: 'alive', weapon: 'carbine', owned: ['pistol', 'carbine'], medkits: 2, score: 480, kills: 37, ammo: 9 });
    expect(me.ammoBag).toEqual({ pistol: 31, carbine: 44, shotgun: 0 });
    expect(me.mags).toEqual({ pistol: 4, carbine: 9, shotgun: 0 });
    expect(p.health).toBe(40 + LEVEL_CLEAR_HEAL);
  });

  it('does not heal past full', () => {
    const { sim, state } = reachLevelTwo();
    state.players[0].health = PLAYER_MAX_HEALTH - 1;
    boardVan(sim, state);
    expect(state.players[0].health).toBe(PLAYER_MAX_HEALTH);
  });

  it('calls off a reload in progress without losing rounds', () => {
    const { sim, state } = reachLevelTwo();
    const p = armed(state);
    const exit = state.exit!;
    p.x = exit.x;
    p.y = exit.y;
    steps(sim, VAN_WAIT_TICKS - 1);
    p.reloadLeft = 1;
    p.reload = 0.5;
    sim.step();
    expect(state.level).toBe(2);
    expect(p.reloadLeft).toBe(0);
    expect(p.reload).toBe(0);
    expect(p.ammoBag.carbine).toBe(44);
  });

  it('brings the dead back with the return kit, keeping score and kills', () => {
    const { sim, state } = reachLevelTwo(['a', 'b']);
    const b = armed(state, 1);
    b.status = 'dead';
    b.health = 0;
    boardVan(sim, state);

    const frame = sim.snapshot();
    const back = frame.players.find((p) => p.id === 'b');
    expect(back).toMatchObject({ status: 'alive', health: PLAYER_MAX_HEALTH / 2, weapon: 'pistol', owned: ['pistol'], medkits: 0, score: 480, kills: 37, reserve: 0 });
    expect(back?.ammo).toBe(WEAPONS.pistol.magSize);
    expect(nearEntry(state, state.players[1])).toBe(true);
    expect(eventsOf(frame, 'player_revived').map((event) => event.playerId)).toEqual(['b']);
  });

  it('treats a downed player left behind as dead, and clears the bleedout', () => {
    const { sim, state } = reachLevelTwo(['a', 'b']);
    const [, b] = state.players;
    armed(state, 1);
    b.x = state.players[0].x + 400;
    hurtPlayer(state, b, 500);
    expect(b.status).toBe('downed');
    boardVan(sim, state);

    expect(b).toMatchObject({ status: 'alive', health: PLAYER_MAX_HEALTH / 2, bleedout: 0, revive: 0, owned: ['pistol'], medkits: 0, score: 480, kills: 37 });
    expect(b.ammoBag).toEqual({ pistol: 0, carbine: 0, shotgun: 0 });
  });

  it('carries on being a run, so a newcomer in the lead-in does not get a fresh start', () => {
    const { sim, state } = reachLevelTwo();
    boardVan(sim, state);
    const late = sim.addPlayer('late', 'Late');
    expect(late).toMatchObject({ health: PLAYER_MAX_HEALTH / 2, reserve: 0 });
  });

  it('survives every town in the run without losing the place in it', () => {
    const { sim, state } = quietSim();
    for (let level = 1; level < FINAL_LEVEL; level++) {
      openLevelExit(state);
      boardVan(sim, state);
      expect(state.level).toBe(level + 1);
      expect(state.map.seed).toBe(levelSeed(SEED, level + 1));
      expect(alivePlayers(state).length).toBe(1);
    }
  });
});

describe('reconnect records', () => {
  function roomWithLeaver() {
    const sim = new GameSimulation({ seed: SEED });
    sim.addPlayer('a', 'Ann', 'token-a');
    sim.addPlayer('b', 'Bea', 'token-b');
    const state = stateOf(sim);
    state.intermissionLeft = 1e6;
    state.zombies = [];
    state.populationTarget = 0;
    return { sim, state };
  }

  it('moves a refresh in progress to the new town with the kit it left with', () => {
    const { sim, state } = roomWithLeaver();
    armed(state, 1);
    sim.removePlayer('b');
    openLevelExit(state);
    boardVan(sim, state);

    const back = sim.addPlayer('b2', 'Bea', 'token-b');
    expect(back).toMatchObject({ id: 'b2', status: 'alive', weapon: 'carbine', medkits: 2, score: 480, kills: 37, health: 40 + LEVEL_CLEAR_HEAL });
    expect(back.ammoBag.carbine).toBe(44);
    expect(nearEntry(state, back)).toBe(true);
  });

  it('gives a dead leaver the same return as the dead in the room', () => {
    const { sim, state } = roomWithLeaver();
    const b = armed(state, 1);
    b.status = 'dead';
    sim.removePlayer('b');
    openLevelExit(state);
    boardVan(sim, state);

    const back = sim.addPlayer('b2', 'Bea', 'token-b');
    expect(back).toMatchObject({ status: 'alive', health: PLAYER_MAX_HEALTH / 2, owned: ['pistol'], medkits: 0, score: 480 });
  });

  it('holds through several towns', () => {
    const { sim, state } = roomWithLeaver();
    armed(state, 1);
    sim.removePlayer('b');
    for (let level = 1; level <= 3; level++) {
      openLevelExit(state);
      boardVan(sim, state);
    }
    const back = sim.addPlayer('b2', 'Bea', 'token-b');
    expect(back).toMatchObject({ medkits: 2, kills: 37, weapon: 'carbine', health: PLAYER_MAX_HEALTH });
    expect(state.level).toBe(4);
  });

  it('hands a live body to its new connection in the new town', () => {
    const { sim, state } = roomWithLeaver();
    armed(state, 1);
    openLevelExit(state);
    boardVan(sim, state);
    const back = sim.addPlayer('b2', 'Bea', 'token-b');
    expect(back).toMatchObject({ id: 'b2', medkits: 2, kills: 37 });
    expect(sim.playerCount).toBe(2);
  });
});
