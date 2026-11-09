import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../shared/protocol.ts';
import { DeathWitness, deathLine, SHOTS_WINDOW_MS } from '../src/game/death-cause.ts';

const ME = 'p1';
const shot = (playerId = ME): GameEvent => ({ type: 'shot', playerId, weapon: 'pistol', x: 0, y: 0, angle: 0 });
const swing = (zombieType: 'walker' | 'runner' | 'brute', x: number, y = 0): GameEvent => ({ type: 'zombie_attack', zombieId: `z-${zombieType}-${x}`, zombieType, x, y });
const hurt = (playerId = ME, x = 0, y = 0): GameEvent => ({ type: 'player_hurt', playerId, x, y, damage: 20 });
const downed = (playerId = ME): GameEvent => ({ type: 'player_downed', playerId, x: 0, y: 0 });
const dead = (playerId = ME): GameEvent => ({ type: 'player_dead', playerId, x: 0, y: 0 });

describe('death witness', () => {
  it('names the zombie whose swing landed the blow that put you down, and your shots in the last 10 s', () => {
    const w = new DeathWitness();
    w.see(shot(), ME, 0); // too early to count
    for (let i = 0; i < 6; i++) w.see(shot(), ME, 5000 + i * 100);
    w.see(shot('p2'), ME, 5500); // a teammate's shot is not yours
    w.see(swing('runner', 30), ME, 11_500);
    w.see(hurt(), ME, 12_000);
    w.see(downed(), ME, 12_000);
    expect(w.cause()).toEqual({ killer: 'runner', shots: 6 });
    expect(deathLine(w.cause())).toBe('A runner got you. 6 shots in the last 10 seconds.');
  });

  it('picks the nearest swing in reach, not the latest one across the street', () => {
    const w = new DeathWitness();
    w.see(swing('brute', 20), ME, 1000);
    w.see(swing('walker', 400), ME, 1200);
    w.see(hurt(), ME, 1500);
    w.see(dead(), ME, 1500);
    expect(w.cause()?.killer).toBe('brute');
  });

  it('says a bloater burst when the blow came from one going off beside you', () => {
    const w = new DeathWitness();
    w.see({ type: 'bloater_burst', x: 10, y: 0, radius: 48 }, ME, 2000);
    w.see(hurt(), ME, 2000);
    w.see(downed(), ME, 2000);
    expect(deathLine(w.cause())).toBe('A bloater burst on you. No shots fired in the last 10 seconds.');
  });

  it('leaves the line out when nothing names the killer', () => {
    const w = new DeathWitness();
    w.see(swing('runner', 30), ME, 0);
    w.see(hurt(), ME, 5000); // the swing is long stale
    w.see(downed(), ME, 5000);
    expect(w.cause()).toEqual({ killer: null, shots: 0 });
    expect(deathLine(w.cause())).toBeNull();
    expect(deathLine(null)).toBeNull();
  });

  it('ignores a teammate going down, keeps the fall when downed then dead, and takes the newer of two falls', () => {
    const w = new DeathWitness();
    w.see(swing('walker', 10), ME, 0);
    w.see(hurt('p2'), ME, 300);
    w.see(downed('p2'), ME, 300);
    expect(w.cause()).toBeNull();
    w.see(hurt(), ME, 400);
    w.see(downed(), ME, 400);
    w.see(dead(), ME, 400 + SHOTS_WINDOW_MS);
    expect(w.cause()?.killer).toBe('walker');
    w.see({ type: 'player_revived', playerId: ME, x: 0, y: 0 }, ME, 20_000);
    w.see(swing('brute', 10), ME, 30_000);
    w.see(hurt(), ME, 30_500);
    w.see(dead(), ME, 30_500);
    expect(w.cause()?.killer).toBe('brute');
  });

  it('forgets everything on a new run', () => {
    const w = new DeathWitness();
    w.see(swing('walker', 10), ME, 0);
    w.see(hurt(), ME, 100);
    w.see(downed(), ME, 100);
    w.reset();
    expect(w.cause()).toBeNull();
  });

  it('words one shot as one shot', () => {
    expect(deathLine({ killer: 'brute', shots: 1 })).toBe('A brute got you. 1 shot in the last 10 seconds.');
  });
});
