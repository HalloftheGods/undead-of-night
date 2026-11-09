import { describe, expect, it } from 'vitest';
import { BLEEDOUT_SEC, LEAD_IN_SEC, LEVEL_ONE_LEAD_IN_SEC, PLAYER_RADIUS, REVIVE_RANGE, REVIVE_SEC, SNAPSHOT_RANGE, STANDING_POPULATION, TICK_RATE, WEAPONS } from '../shared/constants.ts';
import { damageZombie } from '../shared/combat.ts';
import { hurtPlayer } from '../shared/player-health.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { circleHitsSolid } from '../shared/world-map.ts';
import { SEED, addZombie, eventsOf, findBuilding, input, quietSim, stateOf, stepUntil, steps } from './helpers/sim-harness.ts';

describe('solo death', () => {
  it('goes straight to dead and game over, then the sim freezes', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.kills = 7;
    p.score = 120;
    state.wave = 3;
    hurtPlayer(state, p, 500);
    expect(p.status).toBe('dead');
    expect(p.health).toBe(0);
    sim.step();

    const over = sim.snapshot();
    expect(over.phase).toBe('gameover');
    const [event] = eventsOf(over, 'game_over');
    expect(event.stats.wave).toBe(3);
    expect(event.stats.durationSec).toBeGreaterThan(0);
    expect(event.stats.players).toEqual([{ id: 'a', name: 'a', skin: 0, kills: 7, score: 120 }]);
    expect(over.gameOver).toEqual(event.stats);
    expect(eventsOf(over, 'player_dead').length).toBe(1);

    const zombie = addZombie(state, 'walker', p.x + 60, p.y);
    const tick = over.tick;
    steps(sim, 60);
    const frozen = sim.snapshot();
    expect(frozen.tick).toBe(tick);
    expect(zombie.x).toBe(p.x + 60);
    expect(frozen.events).toEqual([]);
    expect(frozen.gameOver).toEqual(event.stats);
  });

  it('a dead player cannot move or shoot', () => {
    const { sim, state } = quietSim(['a', 'b']);
    const [a, b] = state.players;
    a.status = 'dead';
    const { x, y } = a;
    b.x += 300;
    sim.setInput('a', input({ seq: 1, right: true, shoot: true }));
    steps(sim, 10);
    expect([a.x, a.y]).toEqual([x, y]);
    expect(a.moving).toBe(false);
    expect(state.bullets.length).toBe(0);
  });

  it('an idle solo player is eaten and the run ends on its own', () => {
    const sim = new GameSimulation({ seed: SEED });
    sim.addPlayer('a', 'a');
    const ticks = stepUntil(sim, () => sim.phase === 'gameover', (LEAD_IN_SEC + 60) * TICK_RATE);
    expect(ticks).toBeGreaterThan(0);
    expect(sim.snapshot().gameOver?.wave).toBe(0);
  });
});

describe('how a run ends', () => {
  /** One tick from the next horde, with this many hordes behind them. */
  function onTheBrink(players: readonly string[]) {
    const quiet = quietSim(players);
    quiet.state.wave = 2;
    quiet.state.intermissionLeft = 1 / TICK_RATE;
    return quiet;
  }

  it('a fatal blow on the tick a horde starts still ends a solo run', () => {
    const { sim, state } = onTheBrink(['a']);
    const [p] = state.players;
    hurtPlayer(state, p, 1e6);
    sim.step();
    const over = sim.snapshot();
    expect(over.phase).toBe('gameover');
    expect(p.status).toBe('dead');
    expect(p.health).toBe(0);
    expect(eventsOf(over, 'player_revived').length).toBe(0);
    expect(eventsOf(over, 'wave_start').length).toBe(0);
    expect(over.gameOver?.wave).toBe(2);
  });

  it('nobody comes back when the last one standing falls on that tick', () => {
    const { sim, state } = onTheBrink(['a', 'b']);
    const [a, b] = state.players;
    a.status = 'dead';
    a.health = 0;
    hurtPlayer(state, b, 1e6);
    expect(b.status).toBe('dead');
    sim.step();
    expect(sim.phase).toBe('gameover');
    expect(a.status).toBe('dead');
  });

  it('the dead still come back at a horde while someone stands', () => {
    const { sim, state } = onTheBrink(['a', 'b']);
    const [a] = state.players;
    a.status = 'dead';
    a.health = 0;
    sim.step();
    expect(sim.phase).toBe('wave');
    expect(a.status).toBe('alive');
  });

  it('counts completed hordes: the one that killed you is not survived', () => {
    const { sim, state } = quietSim();
    state.wave = 3;
    state.phase = 'wave';
    state.hordeLeft = 1e6;
    state.spawnQueue = ['walker'];
    state.spawnTimer = 1e6;
    hurtPlayer(state, state.players[0], 1e6);
    sim.step();
    expect(sim.snapshot().gameOver?.wave).toBe(2);
  });

  it('counts the horde just beaten when death comes in the lull after it', () => {
    const { sim, state } = quietSim();
    state.wave = 3;
    hurtPlayer(state, state.players[0], 1e6);
    sim.step();
    expect(sim.snapshot().gameOver?.wave).toBe(3);
  });

  it('dying before the first horde survives none', () => {
    const { sim, state } = quietSim();
    hurtPlayer(state, state.players[0], 1e6);
    sim.step();
    expect(sim.snapshot().gameOver?.wave).toBe(0);
  });

  it('a game over caused by someone leaving gets a frame of its own', () => {
    const { sim, state } = quietSim(['a', 'b']);
    const [a] = state.players;
    a.status = 'dead';
    a.health = 0;
    sim.step();
    const before = sim.snapshot();
    expect(before.phase).toBe('intermission');

    sim.removePlayer('b');
    sim.step();
    const over = sim.snapshot();
    expect(over.tick).toBeGreaterThan(before.tick);
    expect(over.phase).toBe('gameover');
    expect(over.gameOver).not.toBeNull();
    expect(eventsOf(over, 'game_over').length).toBe(1);

    sim.step();
    expect(sim.snapshot().tick).toBe(over.tick);
  });

  it('a departure from a run already over changes nothing', () => {
    const { sim, state } = quietSim(['a', 'b']);
    for (const p of state.players) p.status = 'dead';
    sim.step();
    const { tick } = sim.snapshot();
    sim.removePlayer('b');
    expect(sim.snapshot().tick).toBe(tick);
  });
});

describe('co-op death', () => {
  function pair() {
    const quiet = quietSim(['a', 'b']);
    const [a, b] = quiet.state.players;
    b.x = a.x + 100;
    b.y = a.y;
    return { ...quiet, a, b };
  }

  it('downs a player while a teammate lives', () => {
    const { sim, state, a } = pair();
    hurtPlayer(state, a, 500);
    expect(a.status).toBe('downed');
    expect(a.bleedout).toBe(BLEEDOUT_SEC);
    expect(eventsOf(sim.snapshot(), 'player_downed').length).toBe(1);
    sim.step();
    expect(sim.phase).toBe('intermission');
  });

  it('a downed player cannot act and pending requests are dropped', () => {
    const { sim, state, a } = pair();
    hurtPlayer(state, a, 500);
    const { x } = a;
    sim.setInput('a', input({ seq: 1, right: true, shoot: true, reload: true }));
    steps(sim, 10);
    expect(a.x).toBe(x);
    expect(state.bullets.length).toBe(0);
    expect(a.reloadQueued).toBe(false);
  });

  it('a teammate in range revives over three seconds at half health', () => {
    const { sim, state, a, b } = pair();
    hurtPlayer(state, a, 500);
    b.x = a.x + REVIVE_RANGE - 2;
    const ticks = stepUntil(sim, () => a.status === 'alive', 200);
    expect(ticks).toBeGreaterThanOrEqual(REVIVE_SEC * TICK_RATE - 2);
    expect(ticks).toBeLessThanOrEqual(REVIVE_SEC * TICK_RATE + 2);
    expect(a.health).toBe(a.maxHealth / 2);
    expect(a.bleedout).toBe(0);
    expect(a.revive).toBe(0);
    expect(eventsOf(sim.snapshot(), 'player_revived').length).toBe(1);
  });

  it('progress resets when the teammate walks away, and bleedout pauses during it', () => {
    const { sim, state, a, b } = pair();
    hurtPlayer(state, a, 500);
    b.x = a.x + 10;
    steps(sim, 30);
    expect(a.revive).toBeGreaterThan(0.3);
    expect(a.bleedout).toBe(BLEEDOUT_SEC);
    b.x = a.x + REVIVE_RANGE + 40;
    sim.step();
    expect(a.revive).toBe(0);
    expect(a.bleedout).toBeLessThan(BLEEDOUT_SEC);
  });

  it('bleeds out to dead after 25 seconds, leaving the survivor playing', () => {
    const { sim, state, a, b } = pair();
    hurtPlayer(state, a, 500);
    const ticks = stepUntil(sim, () => a.status === 'dead', (BLEEDOUT_SEC + 1) * TICK_RATE);
    expect(ticks).toBeGreaterThanOrEqual(BLEEDOUT_SEC * TICK_RATE - 2);
    expect(eventsOf(sim.snapshot(), 'player_dead').length).toBe(1);
    expect(b.status).toBe('alive');
    expect(sim.phase).toBe('intermission');
  });

  it('a dead player returns at the next horde with half health and a single magazine', () => {
    const { sim, state, a } = pair();
    a.owned = ['pistol', 'shotgun'];
    a.guns.shotgun = { ammo: 3 };
    a.ammoBag = { pistol: 30, carbine: 50, shotgun: 9 };
    a.medkits = 2;
    a.weapon = 'shotgun';
    a.status = 'dead';
    a.health = 0;
    state.intermissionLeft = 0.05;
    steps(sim, 3);
    expect(state.wave).toBe(1);
    expect(a.status).toBe('alive');
    expect(a.health).toBe(a.maxHealth / 2);
    expect(a.owned).toEqual(['pistol']);
    expect(a.weapon).toBe('pistol');
    expect(a.ammo).toBe(WEAPONS.pistol.magSize);
    expect(a.reserve).toBe(0);
    expect(a.ammoBag).toEqual({ pistol: 0, carbine: 0, shotgun: 0 });
    expect(a.medkits).toBe(0);
    expect(circleHitsSolid(state.map, a.x, a.y, PLAYER_RADIUS)).toBe(false);
  });

  it('the last living player dying with another downed ends the run after a short bleedout', () => {
    const { sim, state, a, b } = pair();
    hurtPlayer(state, a, 500);
    hurtPlayer(state, b, 500);
    expect(b.status).toBe('dead');
    expect(a.status).toBe('downed');
    sim.step();
    expect(sim.phase).toBe('intermission');
    const ticks = stepUntil(sim, () => sim.phase === 'gameover', BLEEDOUT_SEC * TICK_RATE);
    expect(ticks).toBeGreaterThan(0);
    expect(ticks).toBeLessThan(BLEEDOUT_SEC * TICK_RATE * 0.4);
  });

  it('a survivor leaving ends a run with only the dead left', () => {
    const { sim, state, a } = pair();
    hurtPlayer(state, a, 500);
    a.status = 'dead';
    sim.removePlayer('b');
    expect(sim.phase).toBe('gameover');
  });
});

describe('restart', () => {
  it('resets the run on the same map and keeps connected players', () => {
    const { sim, state } = quietSim(['a', 'b']);
    const [a, b] = state.players;
    const zombie = addZombie(state, 'walker', a.x + 200, a.y);
    damageZombie(state, zombie, 1e6, 0, 'a');
    const leftOver = addZombie(state, 'walker', a.x + 200, a.y);
    a.owned = ['pistol', 'carbine'];
    a.guns.carbine = { ammo: 1 };
    a.ammoBag.carbine = 1;
    a.medkits = 2;
    a.weapon = 'carbine';
    state.wave = 6;
    state.pickups.push({ id: 'x', type: 'pistol_ammo', x: 1, y: 1, ttl: 5, rounds: 8 });
    hurtPlayer(state, a, 500);
    hurtPlayer(state, b, 500);
    a.status = 'dead';
    sim.step();
    expect(sim.phase).toBe('gameover');
    const map = sim.map;
    const lastTick = sim.snapshot().tick;

    sim.restart();
    const fresh = sim.snapshot();
    expect(sim.map).toBe(map);
    expect(fresh.phase).toBe('intermission');
    expect(fresh.wave).toBe(0);
    expect(fresh.intermission).toBeCloseTo(LEVEL_ONE_LEAD_IN_SEC, 1);
    expect(fresh.gameOver).toBeNull();
    expect(fresh.zombies.some((z) => z.id === leftOver.id)).toBe(false);
    expect(state.populationTarget).toBe(STANDING_POPULATION);
    expect(fresh.pickups.some((item) => item.id === 'x')).toBe(false);
    expect(state.pickups.length).toBeGreaterThan(30);
    expect(fresh.bullets).toEqual([]);
    expect(fresh.tick).toBeGreaterThanOrEqual(lastTick);
    expect(eventsOf(fresh, 'wave_intermission').length).toBe(1);
    expect(fresh.players.map((p) => p.id)).toEqual(['a', 'b']);
    for (const p of fresh.players) {
      expect(p).toMatchObject({ status: 'alive', health: 100, score: 0, kills: 0, weapon: 'pistol', owned: ['pistol'], medkits: 0, reserve: 12 });
      expect(Math.hypot(p.x - map.spawn.x, p.y - map.spawn.y)).toBeLessThan(40);
    }

    // The opening shamblers are on them within seconds: nobody dies before the horde.
    for (const p of stateOf(sim).players) p.health = 1e9;
    steps(sim, LEVEL_ONE_LEAD_IN_SEC * TICK_RATE + 1);
    expect(sim.snapshot().wave).toBe(1);
  });

  it('refills the town for the new run', () => {
    const sim = new GameSimulation({ seed: SEED });
    sim.addPlayer('a', 'a');
    const state = stateOf(sim);
    state.zombies = state.zombies.slice(0, 5);
    sim.restart();
    expect(state.zombies.length).toBe(STANDING_POPULATION);
    expect(state.zombies.every((z) => z.mode === 'wander')).toBe(true);
  });

  it('counts the duration of the new run only', () => {
    const { sim, state } = quietSim();
    steps(sim, 300);
    sim.restart();
    steps(sim, 30);
    hurtPlayer(state, state.players[0], 1000);
    sim.step();
    expect(sim.snapshot().gameOver?.durationSec).toBeCloseTo(31 / 30, 1);
  });
});

describe('players and snapshots', () => {
  it('hands out unique skins, reusing freed ones', () => {
    const sim = new GameSimulation({ seed: SEED });
    const skins = ['a', 'b', 'c', 'd'].map((id) => sim.addPlayer(id, id).skin);
    expect([...skins].sort()).toEqual([0, 1, 2, 3]);
    sim.removePlayer('b');
    expect(sim.addPlayer('e', 'e').skin).toBe(skins[1]);
    expect(sim.playerCount).toBe(4);
  });

  it('starts everyone on open ground with a loaded pistol', () => {
    const sim = new GameSimulation({ seed: SEED });
    const player = sim.addPlayer('a', 'Ann');
    expect(circleHitsSolid(sim.map, player.x, player.y, PLAYER_RADIUS)).toBe(false);
    expect(player).toMatchObject({ name: 'Ann', weapon: 'pistol', reserve: 12, magSize: 12, ammo: 12, owned: ['pistol'], status: 'alive', medkits: 0, indoors: null });
    expect(player.ammoBag).toEqual({ pistol: 12, carbine: 0, shotgun: 0 });
  });

  it('tracks which building a player stands in', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const building = findBuilding(sim, 'house');
    p.x = building.x + 40;
    p.y = building.y + 60;
    sim.step();
    expect(sim.snapshot().players[0].indoors).toBe(building.id);
    p.x = sim.map.spawn.x;
    p.y = sim.map.spawn.y;
    sim.step();
    expect(sim.snapshot().players[0].indoors).toBeNull();
  });

  it('snapshots carry only what is near a player', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    const near = addZombie(state, 'walker', p.x + 400, p.y);
    const far = addZombie(state, 'walker', p.x + SNAPSHOT_RANGE + 100, p.y);
    state.pickups.push({ id: 'near', type: 'bandage', x: p.x + 300, y: p.y, ttl: null, rounds: 0 });
    state.pickups.push({ id: 'far', type: 'bandage', x: p.x, y: p.y + SNAPSHOT_RANGE + 100, ttl: null, rounds: 0 });
    const snapshot = sim.snapshot();
    expect(snapshot.zombies.map((z) => z.id)).toEqual([near.id]);
    expect(snapshot.pickups.map((item) => item.id)).toEqual(['near']);
    expect(far.health).toBeGreaterThan(0);
  });

  it('adding the same id twice does not duplicate them', () => {
    const sim = new GameSimulation({ seed: SEED });
    sim.addPlayer('a', 'Ann');
    sim.addPlayer('a', 'Ann');
    expect(sim.playerCount).toBe(1);
  });

  it('does not advance with an empty room', () => {
    const sim = new GameSimulation({ seed: SEED });
    steps(sim, 300);
    expect(sim.snapshot().tick).toBe(0);
    expect(sim.phase).toBe('intermission');
  });

  it('snapshots are detached copies', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    addZombie(state, 'walker', p.x + 100, p.y);
    const snapshot = sim.snapshot();
    const copy = snapshot.players[0] as { x: number; owned: string[] };
    copy.x = -1;
    copy.owned.push('shotgun');
    (snapshot.zombies[0] as { x: number }).x = -1;
    expect(p.x).not.toBe(-1);
    expect(p.owned).toEqual(['pistol']);
    expect(state.zombies[0].x).not.toBe(-1);
  });

  it('snapshots round coordinates to 2 decimals, including events, and survive JSON', () => {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.x += 0.123456;
    p.y += 0.654321;
    addZombie(state, 'walker', p.x + 100.1234567, p.y + 3.3333333);
    sim.setInput('a', input({ seq: 1, shoot: true, angle: 0.7 }));
    steps(sim, 3);
    const snapshot = sim.snapshot();
    const decimals = (value: number) => (String(value).split('.')[1] ?? '').length;
    expect(decimals(snapshot.players[0].x)).toBeLessThanOrEqual(2);
    expect(decimals(snapshot.zombies[0].y)).toBeLessThanOrEqual(2);
    expect(decimals(snapshot.bullets[0].vx)).toBeLessThanOrEqual(2);
    const shot = eventsOf(snapshot, 'shot')[0];
    expect(decimals(shot.x)).toBeLessThanOrEqual(2);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('drains events exactly once', () => {
    const { sim } = quietSim();
    sim.setInput('a', input({ seq: 1, shoot: true }));
    sim.step();
    expect(eventsOf(sim.snapshot(), 'shot').length).toBe(1);
    sim.setInput('a', input({ seq: 2 }));
    sim.step();
    expect(sim.snapshot().events).toEqual([]);
  });
});

describe('determinism', () => {
  // Each case steps and serialises 1500 ticks of a full town twice; a busy machine needs more than the default 5s.
  const SCRIPT_TIMEOUT_MS = 30000;

  function script(seed: number, random?: () => number) {
    const sim = new GameSimulation({ seed, random });
    sim.addPlayer('a', 'a');
    sim.addPlayer('b', 'b');
    const frames: string[] = [];
    for (let tick = 0; tick < 1500; tick++) {
      sim.setInput('a', input({ seq: tick, right: tick % 200 < 100, left: tick % 200 >= 100, angle: tick * 0.05, shoot: tick % 7 < 4 }));
      sim.setInput('b', input({ seq: tick, up: tick % 300 < 150, down: tick % 300 >= 150, angle: -tick * 0.03, shoot: true, reload: tick % 90 === 0 }));
      sim.step();
      frames.push(JSON.stringify(sim.snapshot()));
    }
    return frames;
  }

  it('the same seed and inputs replay exactly', () => {
    expect(script(77)).toEqual(script(77));
  }, SCRIPT_TIMEOUT_MS);

  it('a different seed plays differently', () => {
    expect(script(77).at(-1)).not.toEqual(script(78).at(-1));
  }, SCRIPT_TIMEOUT_MS);

  it('an injected rng drives the outcome', () => {
    const fixed = () => 0.5;
    expect(script(77, fixed).at(-1)).not.toEqual(script(77).at(-1));
  }, SCRIPT_TIMEOUT_MS);
});
