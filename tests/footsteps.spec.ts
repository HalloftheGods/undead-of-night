import { describe, expect, it } from 'vitest';
import { FootstepTracker, StompTracker, stepSfxFor } from '../src/audio/footsteps.ts';
import { SFX } from '../src/audio/sfx-registry.ts';
import type { SfxName } from '../src/audio/sfx-registry.ts';
import type { PlayOpts } from '../src/audio/mixer.ts';
import { TILE_KINDS, TILE_SIZE } from '../shared/protocol.ts';
import type { PlayerEntity, TileKind, WorldMap } from '../shared/protocol.ts';
import { playerSpeed } from '../shared/players.ts';

const STEP_NAMES: SfxName[] = ['step_hard', 'step_soft', 'step_water', 'step_snow', 'step_sludge', 'step_ash'];

describe('stepSfxFor', () => {
  it('gives each ground its own step', () => {
    expect(stepSfxFor('grass')).toBe('step_soft');
    expect(stepSfxFor('dirt')).toBe('step_soft');
    expect(stepSfxFor('water')).toBe('step_water');
    expect(stepSfxFor('snow')).toBe('step_snow');
    expect(stepSfxFor('sludge')).toBe('step_sludge');
    expect(stepSfxFor('ash')).toBe('step_ash');
  });

  it('treats roads, paths, floors and off-map as plain', () => {
    for (const kind of ['asphalt', 'sidewalk', 'curb_n', 'lane_h', 'crosswalk_v', 'floor_wood', 'floor_tile'] as TileKind[]) {
      expect(stepSfxFor(kind)).toBe('step_hard');
    }
    expect(stepSfxFor(null)).toBe('step_hard');
  });

  it('only ever names a registered, short, quiet sound', () => {
    for (const kind of [...TILE_KINDS, null]) {
      const def = SFX[stepSfxFor(kind)];
      expect(def.length).toBeLessThan(0.15);
      expect(def.gain).toBeLessThanOrEqual(0.6);
    }
    for (const n of STEP_NAMES) expect(SFX[n].vary).toBeGreaterThan(0);
  });
});

function mapOf(kind: TileKind): WorldMap {
  const cols = 200;
  const rows = 4;
  const code = TILE_KINDS.indexOf(kind);
  return { cols, rows, tiles: new Array(cols * rows).fill(code) } as unknown as WorldMap;
}

function player(id: string, x: number, status: PlayerEntity['status'] = 'alive'): PlayerEntity {
  return { id, skin: 0, x, y: TILE_SIZE, status } as unknown as PlayerEntity;
}

/** Walks one player along x at a share of walking pace for the given seconds; returns every play. */
function walk(map: WorldMap, ratio: number, seconds: number, id = 'a', localId: string | null = id) {
  const plays: { name: SfxName; opts: PlayOpts }[] = [];
  const tracker = new FootstepTracker();
  const dt = 1 / 60;
  const pace = playerSpeed(0) * ratio;
  const frames = Math.round(seconds / dt);
  for (let i = 0; i <= frames; i += 1) {
    tracker.tick([player(id, 20 + pace * dt * i)], localId, map, dt, (name, opts) => plays.push({ name, opts }));
  }
  return plays;
}

describe('FootstepTracker', () => {
  it('steps faster walking than sneaking, and sprinting is quicker than walking', () => {
    const map = mapOf('asphalt');
    const sneak = walk(map, 0.55, 4).length;
    const stroll = walk(map, 1, 4).length;
    const sprint = walk(map, 1.4, 4).length;
    expect(sneak).toBeGreaterThan(0);
    expect(stroll).toBeGreaterThan(sneak);
    expect(sprint).toBeGreaterThan(stroll);
  });

  it('makes sneaking quieter than walking', () => {
    const map = mapOf('asphalt');
    expect(walk(map, 0.55, 2)[0].opts.gain).toBeLessThan(walk(map, 1, 2)[0].opts.gain ?? 0);
  });

  it('picks the step from the ground underfoot', () => {
    expect(walk(mapOf('snow'), 0.88, 2)[0].name).toBe('step_snow');
    expect(walk(mapOf('water'), 0.7, 2)[0].name).toBe('step_water');
    expect(walk(mapOf('grass'), 1, 2)[0].name).toBe('step_soft');
  });

  it('plays the local player un-attenuated and everyone else at their position', () => {
    const map = mapOf('asphalt');
    expect(walk(map, 1, 2, 'a', 'a')[0].opts).toMatchObject({ local: true });
    const other = walk(map, 1, 2, 'b', 'a')[0].opts;
    expect(other.local).toBeUndefined();
    expect(typeof other.x).toBe('number');
    expect(typeof other.y).toBe('number');
  });

  it('is silent for a player standing still, downed or dead', () => {
    const map = mapOf('asphalt');
    const plays: string[] = [];
    const tracker = new FootstepTracker();
    for (let i = 0; i < 120; i += 1) tracker.tick([player('a', 40)], 'a', map, 1 / 60, (n) => plays.push(n));
    for (let i = 0; i < 120; i += 1) tracker.tick([player('a', 40 + i, 'downed')], 'a', map, 1 / 60, (n) => plays.push(n));
    expect(plays).toEqual([]);
  });

  it('does not step for a teleport, and forgets players who leave', () => {
    const map = mapOf('asphalt');
    const plays: string[] = [];
    const tracker = new FootstepTracker();
    tracker.tick([player('a', 20)], 'a', map, 1 / 60, (n) => plays.push(n));
    tracker.tick([player('a', 900)], 'a', map, 1 / 60, (n) => plays.push(n));
    expect(plays).toEqual([]);
    tracker.tick([], 'a', map, 1 / 60, (n) => plays.push(n));
    expect((tracker as unknown as { walkers: Map<string, unknown> }).walkers.size).toBe(0);
  });
});

describe('heavy zombie stomps', () => {
  it('stomps for brutes and bosses as they walk, never for walkers', () => {
    const tracker = new StompTracker();
    const played: { name: string; boss: boolean }[] = [];
    for (let i = 0; i <= 40; i += 1) {
      const x = i * 4;
      tracker.tick(
        [
          { id: 'w', type: 'walker', x, y: 0 },
          { id: 'b', type: 'brute', x, y: 20 },
          { id: 'k', type: 'brute', boss: 'k', x, y: 40 },
        ],
        (name, opts) => played.push({ name, boss: opts.pitch !== undefined }),
      );
    }
    expect(played.every((p) => p.name === 'step_stomp')).toBe(true);
    const brute = played.filter((p) => !p.boss).length;
    const boss = played.filter((p) => p.boss).length;
    expect(brute).toBeGreaterThanOrEqual(4);
    expect(boss).toBeGreaterThan(0);
    expect(boss).toBeLessThan(brute);
  });

  it('does not stomp across a jump', () => {
    const tracker = new StompTracker();
    let count = 0;
    tracker.tick([{ id: 'b', type: 'brute', x: 0, y: 0 }], () => (count += 1));
    tracker.tick([{ id: 'b', type: 'brute', x: 500, y: 0 }], () => (count += 1));
    expect(count).toBe(0);
  });
});
