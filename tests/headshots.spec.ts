import { describe, expect, it, vi } from 'vitest';
import { parseClientPacket } from '../server/packets.ts';
import { CHEST_HEIGHT, WEAPONS } from '../shared/constants.ts';
import { gunStats } from '../shared/gun-upgrades.ts';
import { HEAD_MARGIN, headSpot, headUnderAim, isOnHead } from '../shared/headshots.ts';
import type { ZombieType } from '../shared/protocol.ts';
import type { PlayerState, SimState, ZombieState } from '../shared/sim-state.ts';
import type { GameSimulation } from '../shared/simulation.ts';
import { buildBloater } from '../src/art/zombies/bloater.ts';
import { buildBrute } from '../src/art/zombies/brute.ts';
import { Figure } from '../src/art/zombies/rig.ts';
import { buildRunner } from '../src/art/zombies/runner.ts';
import { buildScreamer } from '../src/art/zombies/screamer.ts';
import { buildWalker } from '../src/art/zombies/walker.ts';
import { onSeenHead } from '../src/engine/overlay-renderer.ts';
import { InputSender } from '../src/game/input-sender.ts';
import { addRoamer, eventsOf, input, quietSim, steps } from './helpers/sim-harness.ts';

const BUILDERS: Record<ZombieType, () => unknown> = { walker: buildWalker, runner: buildRunner, bloater: buildBloater, brute: buildBrute, screamer: buildScreamer };
const ZOMBIE_TYPES = Object.keys(BUILDERS) as ZombieType[];
/** Close enough that the pistol's spread stays inside a head. */
const RANGE = 60;
const TOUGH = 5000;

let seq = 0;

/** Pulls the trigger once with the crosshair on a spot, and lets the bullet land. */
function shootAt(sim: GameSimulation, p: PlayerState, x: number, y: number): void {
  const angle = Math.atan2(y - (p.y - CHEST_HEIGHT), x - p.x);
  seq += 1;
  sim.setInput('a', input({ seq, angle, aimX: x, aimY: y, shoot: true }));
  sim.step();
  seq += 1;
  sim.setInput('a', input({ seq, angle, aimX: x, aimY: y }));
  steps(sim, 12);
}

function target(state: SimState, type: ZombieType, dx = RANGE): ZombieState {
  const p = state.players[0];
  const z = addRoamer(state, type, p.x + dx, p.y);
  z.speed = 0;
  z.angle = Math.PI;
  z.health = TOUGH;
  z.maxHealth = TOUGH;
  return z;
}

const dealt = (z: ZombieState): number => TOUGH - z.health;

describe('headshots', () => {
  it('multiplies the damage and pays a bonus for a shot aimed at the head', () => {
    const { sim, state } = quietSim();
    const z = target(state, 'walker');
    const head = headSpot(z);
    shootAt(sim, state.players[0], head.x, head.y);
    expect(dealt(z)).toBeCloseTo(WEAPONS.pistol.damage * 2.5);
    expect(state.players[0].score).toBe(5);
    const [event] = eventsOf(sim.snapshot(), 'headshot');
    expect(event).toMatchObject({ playerId: 'a', zombieId: z.id, zombieType: 'walker', points: 5 });
  });

  it('leaves a shot at the chest as it was', () => {
    const { sim, state } = quietSim();
    const z = target(state, 'walker');
    shootAt(sim, state.players[0], z.x, z.y - CHEST_HEIGHT);
    expect(dealt(z)).toBeCloseTo(WEAPONS.pistol.damage);
    expect(state.players[0].score).toBe(0);
    expect(eventsOf(sim.snapshot(), 'headshot')).toEqual([]);
  });

  it.each(ZOMBIE_TYPES)('lands a level shot at the head of a %s, however far it sits over the body', (type) => {
    const { sim, state } = quietSim();
    const z = target(state, type);
    const head = headSpot(z);
    shootAt(sim, state.players[0], head.x, head.y);
    expect(eventsOf(sim.snapshot(), 'headshot')).toHaveLength(1);
  });

  it('gives brutes a smaller bonus', () => {
    const { sim, state } = quietSim();
    const z = target(state, 'brute');
    const head = headSpot(z);
    shootAt(sim, state.players[0], head.x, head.y);
    expect(dealt(z)).toBeCloseTo(WEAPONS.pistol.damage * 1.5);
    expect(state.players[0].score).toBe(2);
  });

  it('multiplies an upgraded gun rather than the stock damage', () => {
    const { sim, state } = quietSim();
    const p = state.players[0];
    const fit = { ranks: { damage: 2 }, quirk: null };
    p.guns.pistol = { ammo: 12, fit };
    const z = target(state, 'walker');
    const head = headSpot(z);
    shootAt(sim, p, head.x, head.y);
    expect(dealt(z)).toBeCloseTo(gunStats('pistol', fit).damage * 2.5);
  });

  it('gives shotgun pellets no bonus', () => {
    const { sim, state } = quietSim();
    const p = state.players[0];
    p.guns.shotgun = { ammo: 6 };
    p.owned = ['pistol', 'shotgun'];
    p.weapon = 'shotgun';
    const z = target(state, 'walker');
    const head = headSpot(z);
    sim.setInput('a', input({ seq: (seq += 1), aimX: head.x, aimY: head.y, shoot: true }));
    sim.step();
    expect(state.bullets.every((b) => b.headTarget === null)).toBe(true);
    steps(sim, 12);
    expect(eventsOf(sim.snapshot(), 'headshot')).toEqual([]);
  });

  it('gives the body in the way an ordinary hit', () => {
    const { sim, state } = quietSim();
    const blocker = target(state, 'walker', RANGE / 2);
    const z = target(state, 'walker');
    const head = headSpot(z);
    blocker.y = head.y + CHEST_HEIGHT;
    shootAt(sim, state.players[0], head.x, head.y);
    expect(dealt(blocker)).toBeCloseTo(WEAPONS.pistol.damage);
    expect(dealt(z)).toBe(0);
    expect(eventsOf(sim.snapshot(), 'headshot')).toEqual([]);
  });

  it('judges the aim as fired, so a head that walks on still counts', () => {
    const { sim, state } = quietSim();
    const z = target(state, 'walker');
    const head = headSpot(z);
    const p = state.players[0];
    sim.setInput('a', input({ seq: (seq += 1), angle: Math.atan2(head.y - (p.y - CHEST_HEIGHT), head.x - p.x), aimX: head.x, aimY: head.y, shoot: true }));
    sim.step();
    z.y += 3;
    steps(sim, 12);
    expect(eventsOf(sim.snapshot(), 'headshot')).toHaveLength(1);
  });

  it('takes no head from a client that sends no aim point', () => {
    const { sim, state } = quietSim();
    const z = target(state, 'walker');
    sim.setInput('a', input({ seq: (seq += 1), angle: Math.PI / 2, shoot: true }));
    sim.step();
    expect(headUnderAim(state, state.players[0], WEAPONS.pistol.range)).toBeNull();
    expect(dealt(z)).toBe(0);
  });

  it('looks no further than the gun reaches, whatever aim point arrives', () => {
    const { sim, state } = quietSim();
    const p = state.players[0];
    sim.setInput('a', input({ seq: (seq += 1), aimX: 3e17, aimY: 3e17 }));
    expect(headUnderAim(state, p, WEAPONS.pistol.range)).toBeNull();
  });

  it('forgives a little more in co-op, where zombies are seen late', () => {
    const { state } = quietSim();
    const p = state.players[0];
    const z = target(state, 'walker');
    const head = headSpot(z);
    state.grid.clear();
    state.grid.insert(z);
    p.aim = { x: head.x, y: head.y - 5 - HEAD_MARGIN - 1 };
    expect(headUnderAim(state, p, WEAPONS.pistol.range)).toBeNull();
    Object.assign(state, { workbench: 'timed' });
    expect(headUnderAim(state, p, WEAPONS.pistol.range)).toBe(z);
  });
});

describe('the head as drawn', () => {
  it.each(ZOMBIE_TYPES)('sits where the %s sprites put it, in every drawn facing', (type) => {
    const heads: { dir: number; x: number; y: number }[] = [];
    const stamp = Figure.prototype.stamp;
    const spy = vi.spyOn(Figure.prototype, 'stamp').mockImplementation(function (this: Figure, ...args) {
      const [art, joint, z] = args;
      const isHead = z === 0.5 || z === -0.5;
      if (isHead) {
        heads.push({
          dir: this.view.dir,
          x: Math.round(joint.x) - art.px + (art.rows[0].length - 1) / 2 - this.ox,
          y: Math.round(joint.y) - art.py + (art.rows.length - 1) / 2 - this.oy - 1,
        });
      }
      stamp.apply(this, args);
    });
    BUILDERS[type]();
    spy.mockRestore();

    const facings = new Set(heads.map((head) => head.dir));
    expect(facings.size).toBe(5);
    const median = (values: readonly number[]): number => [...values].sort((a, b) => a - b)[values.length >> 1];
    for (const dir of facings) {
      const spot = headSpot({ type, x: 0, y: 0, angle: (dir * Math.PI) / 4 });
      const mine = heads.filter((head) => head.dir === dir);
      expect(Math.abs(median(mine.map((head) => head.x)) - spot.x)).toBeLessThanOrEqual(2.5);
      expect(Math.abs(median(mine.map((head) => head.y)) - spot.y)).toBeLessThanOrEqual(2.5);
    }
  });

  it('counts a point on the head and not one on the chest', () => {
    const z = { type: 'walker' as const, x: 100, y: 100, angle: 0 };
    const head = headSpot(z);
    expect(isOnHead(z, head.x, head.y, 0)).toBe(true);
    expect(isOnHead(z, z.x, z.y - CHEST_HEIGHT, 0)).toBe(false);
  });
});

describe('the crosshair over a head', () => {
  const zombie = { id: 'z', type: 'walker' as const, x: 300, y: 200, angle: 0, health: 60, maxHealth: 60, attacking: false };
  const spot = headSpot(zombie);
  const lit = () => 200;
  const alive = () => false;
  const onScreen = (x: number, y: number, light = lit, killed = alive) => onSeenHead([zombie], x - 100, y - 50, 100, 50, light, killed);

  it('reddens on a lit head and not on the chest', () => {
    expect(onScreen(spot.x, spot.y)).toBe(true);
    expect(onScreen(zombie.x, zombie.y - CHEST_HEIGHT)).toBe(false);
  });

  it('gives nothing away in the dark, or over a body already down', () => {
    expect(onScreen(spot.x, spot.y, () => 0)).toBe(false);
    expect(onScreen(spot.x, spot.y, lit, () => true)).toBe(false);
  });
});

describe('aim on the wire', () => {
  function sentWith(aimPoint: { x: number; y: number } | null): Record<string, unknown> {
    const sent: Record<string, unknown>[] = [];
    const sender = new InputSender({ sample: () => input() } as never);
    sender.aimPoint = aimPoint;
    const transport = { sendInput: (packet: Record<string, unknown>) => sent.push(packet) };
    const world = { localPlayer: null, predictor: { record: () => undefined }, recordInput: () => undefined };
    sender.send(transport as never, world as never, 0, 0, 0, 1);
    return sent[0];
  }

  it('sends the crosshair with the input, and nothing when there is none', () => {
    expect(sentWith({ x: 40, y: 50 })).toMatchObject({ aimX: 40, aimY: 50 });
    expect(sentWith(null)).not.toHaveProperty('aimX');
  });

  const base = { seq: 1, up: false, down: false, left: false, right: false, angle: 0, shoot: false, reload: false, weapon: null, melee: false, heal: false, search: false };
  const parse = (extra: Record<string, unknown>) => parseClientPacket(`{"type":"input","input":${JSON.stringify({ ...base, ...extra })}}`);

  it('carries an aim point through', () => {
    expect(parse({ aimX: 12.5, aimY: -3 })).toEqual({ type: 'input', input: { ...base, aimX: 12.5, aimY: -3 } });
  });

  it('takes an input with no crosshair', () => {
    expect(parse({})).toEqual({ type: 'input', input: base });
  });

  it('refuses half an aim point or one that is not a number', () => {
    expect(parse({ aimX: 1 })).toBeNull();
    expect(parse({ aimX: 1, aimY: '2' })).toBeNull();
    expect(parse({ aimX: null, aimY: 2 })).toBeNull();
    expect(parseClientPacket(`{"type":"input","input":${JSON.stringify(base).replace('}', ',"aimX":1e999,"aimY":0}')}}`)).toBeNull();
  });
});
