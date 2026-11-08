import { describe, expect, it } from 'vitest';
import { characterOf, CHARACTERS, freeCharacter, isCharacterIndex } from '../shared/characters.ts';
import { KILL_DROP_CHANCE, MELEE_KNOCKBACK_SPEED, PLAYER_SPEED, SPRINT_NOISE_RADIUS, TICK_DT, WEAPONS, ZOMBIE_SIGHT_RANGE } from '../shared/constants.ts';
import { maybeDropOnKill } from '../shared/pickups.ts';
import { playerSpeed } from '../shared/players.ts';
import { GameSimulation } from '../shared/simulation.ts';
import { addRoamer, addZombie, input, quietSim, steps } from './helpers/sim-harness.ts';

const skinOf = (id: string): number => CHARACTERS.findIndex((character) => character.id === id);

describe('the character table', () => {
  it('gives everyone a name, a trait and one thing they do better', () => {
    expect(CHARACTERS.map((character) => character.name)).toEqual(['Night', 'Bear', 'Kat', 'Rex', 'Kai']);
    for (const { sightRange, reloadTime, moveSpeed, shoveForce, dropOdds, trait } of CHARACTERS) {
      expect(trait).not.toBe('');
      const edges = [sightRange < 1, reloadTime < 1, moveSpeed > 1, shoveForce > 1, dropOdds > 1];
      expect(edges.filter(Boolean)).toHaveLength(1);
    }
  });

  it('makes only Night quieter: three quarters of the noise radius and half the clatter chance', () => {
    for (const character of CHARACTERS) {
      const night = character.id === 'night';
      expect(character.noise).toBe(night ? 0.75 : 1);
      expect(character.clatterChance).toBe(night ? 0.5 : 1);
    }
    expect(CHARACTERS[0].trait).toBe('Moves quieter');
    expect(CHARACTERS[0].sightRange).toBe(0.75);
  });

  it('falls back to the first survivor for a skin it does not know', () => {
    expect(characterOf(99)).toBe(CHARACTERS[0]);
  });

  it('only accepts a whole index into the table', () => {
    expect(isCharacterIndex(0)).toBe(true);
    expect(isCharacterIndex(CHARACTERS.length - 1)).toBe(true);
    for (const bad of [-1, CHARACTERS.length, 1.5, '1', null, undefined]) expect(isCharacterIndex(bad)).toBe(false);
  });
});

describe('picking a free survivor', () => {
  it('gives the one asked for when nobody has them', () => {
    expect(freeCharacter(new Set([0, 1]), 3)).toBe(3);
  });

  it('gives the next free one when they are taken, wrapping round', () => {
    expect(freeCharacter(new Set([3]), 3)).toBe(4);
    expect(freeCharacter(new Set([4, 0]), 4)).toBe(1);
  });

  it('never seats two players on one survivor, whatever they ask for', () => {
    const sim = new GameSimulation({ seed: 7 });
    const skins = ['a', 'b', 'c', 'd'].map((id) => sim.addPlayer(id, id, id, 2).skin);
    expect(new Set(skins).size).toBe(4);
    expect(skins[0]).toBe(2);
    expect(skins[1]).toBe(3);
  });

  it('keeps the survivor a returning player left with', () => {
    const sim = new GameSimulation({ seed: 7 });
    sim.addPlayer('a', 'Ann', 'token-a', skinOf('rex'));
    sim.addPlayer('b', 'Bea', 'token-b', skinOf('sol'));
    sim.removePlayer('b');
    const back = sim.addPlayer('b2', 'Bea', 'token-b', skinOf('night'));
    expect(back.skin).toBe(skinOf('sol'));
  });
});

describe('traits in play', () => {
  function reloadTicks(skin: number): number {
    const { sim, state } = quietSim();
    const [p] = state.players;
    p.skin = skin;
    p.guns.pistol = { ammo: 0 };
    p.ammoBag.pistol = 30;
    sim.setInput('a', input({ reload: true, seq: 1 }));
    let ticks = 0;
    do {
      steps(sim, 1);
      ticks += 1;
    } while (p.reloadLeft > 0 && ticks < 300);
    return ticks;
  }

  it('reloads faster as Bear', () => {
    const normal = Math.ceil(WEAPONS.pistol.reloadMs / 1000 / TICK_DT);
    expect(reloadTicks(skinOf('night'))).toBeGreaterThanOrEqual(normal);
    expect(reloadTicks(skinOf('bandus'))).toBeLessThan(normal * 0.8);
  });

  it('runs faster as Kat, in the sim and in the speed the client predicts with', () => {
    expect(playerSpeed(skinOf('satori'))).toBeGreaterThan(PLAYER_SPEED);
    expect(playerSpeed(skinOf('sol'))).toBe(PLAYER_SPEED);

    const walked = (skin: number): number => {
      const { sim, state } = quietSim();
      const [p] = state.players;
      p.skin = skin;
      const from = p.x;
      sim.setInput('a', input({ right: true, seq: 1 }));
      steps(sim, 6);
      return Math.abs(p.x - from);
    };
    expect(walked(skinOf('satori'))).toBeGreaterThan(walked(skinOf('sol')));
  });

  it('shoves harder as Rex', () => {
    const shoved = (skin: number): number => {
      const { sim, state } = quietSim();
      const [p] = state.players;
      p.skin = skin;
      p.angle = 0;
      const zombie = addZombie(state, 'walker', p.x + 14, p.y);
      sim.setInput('a', input({ melee: true, angle: 0, seq: 1 }));
      steps(sim, 1);
      return zombie.knockX;
    };
    const rex = shoved(skinOf('rex'));
    expect(rex).toBeGreaterThan(shoved(skinOf('sol')));
    expect(rex).toBeGreaterThan(MELEE_KNOCKBACK_SPEED);
  });

  it('lets Night get closer to a zombie before it sees her', () => {
    const spotted = (skin: number): boolean => {
      const { sim, state } = quietSim();
      const [p] = state.players;
      p.skin = skin;
      const zombie = addRoamer(state, 'walker', p.x + ZOMBIE_SIGHT_RANGE * 0.9, p.y);
      zombie.wanderLeft = 1e6;
      steps(sim, 12);
      return zombie.mode === 'hunt';
    };
    expect(spotted(skinOf('sol'))).toBe(true);
    expect(spotted(skinOf('night'))).toBe(false);
  });

  it('carries Night\'s shots and sprinting steps three quarters as far', () => {
    const heardBy = (skin: number, act: 'shoot' | 'sprint', reach: number): boolean => {
      const { sim, state } = quietSim();
      const [p] = state.players;
      p.skin = skin;
      const roamer = addRoamer(state, 'walker', p.x - reach, p.y);
      roamer.speed = 0;
      roamer.senseOffset = 1;
      const shooting = input({ seq: 1, shoot: true, angle: 0 });
      const sprinting = input({ seq: 1, angle: 0, right: true, sprint: true });
      sim.setInput('a', act === 'shoot' ? shooting : sprinting);
      steps(sim, 2);
      return roamer.mode !== 'wander';
    };
    const shot = WEAPONS.pistol.noiseRadius;
    const between = (radius: number): number => radius * 0.875;
    expect(heardBy(skinOf('sol'), 'shoot', between(shot))).toBe(true);
    expect(heardBy(skinOf('night'), 'shoot', between(shot))).toBe(false);
    expect(heardBy(skinOf('night'), 'shoot', shot * 0.6)).toBe(true);
    expect(heardBy(skinOf('sol'), 'sprint', between(SPRINT_NOISE_RADIUS))).toBe(true);
    expect(heardBy(skinOf('night'), 'sprint', between(SPRINT_NOISE_RADIUS))).toBe(false);
    expect(heardBy(skinOf('night'), 'sprint', SPRINT_NOISE_RADIUS * 0.6)).toBe(true);
  });

  it('drops more often from the zombies Kai kills', () => {
    const { state } = quietSim();
    const [p] = state.players;
    const dropsOutOf = (skin: number, kills: number): number => {
      p.skin = skin;
      state.pickups = [];
      for (let i = 0; i < kills; i++) maybeDropOnKill(state, 0, 0, p);
      return state.pickups.length;
    };
    const kills = 4000;
    expect(dropsOutOf(skinOf('night'), kills)).toBeLessThan(kills * KILL_DROP_CHANCE * 1.4);
    expect(dropsOutOf(skinOf('sol'), kills)).toBeGreaterThan(kills * KILL_DROP_CHANCE * 1.6);
  });
});
