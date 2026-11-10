import { describe, expect, it } from 'vitest';
import { DailyGhost, GHOST_ID, ghostAt, GhostRecorder, loadGhost, SAMPLE_TICKS, saveGhost } from '../src/game/daily-ghost.ts';
import type { PlayerEntity, SnapshotPacket } from '../shared/protocol.ts';

function memoryStore(): Pick<Storage, 'getItem' | 'setItem'> {
  const data = new Map<string, string>();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
}

const DAY = '2026-11-07';

function player(x: number, y: number, extra: Partial<PlayerEntity> = {}): PlayerEntity {
  return { id: 'me', skin: 2, x, y, angle: 0, status: 'alive', maxHealth: 100, health: 50, ...extra } as PlayerEntity;
}

function snapshot(level: number, tick: number, me: PlayerEntity): SnapshotPacket {
  return { level, tick, players: [me] } as unknown as SnapshotPacket;
}

describe('Daily Night ghost', () => {
  it('samples a town every few ticks, from its first tick, filling gaps from dropped snapshots', () => {
    const recorder = new GhostRecorder(DAY);
    recorder.observe(3, 100, player(0, 0));
    recorder.observe(3, 100 + SAMPLE_TICKS, player(10, 0));
    // Three slots missed: they repeat where the survivor was next seen.
    recorder.observe(3, 100 + SAMPLE_TICKS * 4, player(40, 0));
    const track = recorder.track(500);
    expect(track.towns['3']).toEqual([0, 0, 0, 10, 0, 0, 40, 0, 0, 40, 0, 0, 40, 0, 0]);
    expect(track.skin).toBe(2);
    expect(track.score).toBe(500);
  });

  it('stops recording once the survivor goes down', () => {
    const recorder = new GhostRecorder(DAY);
    recorder.observe(3, 0, player(0, 0));
    recorder.observe(3, SAMPLE_TICKS, player(5, 0, { status: 'downed' }));
    recorder.observe(3, SAMPLE_TICKS * 2, player(9, 0));
    expect(recorder.track(0).towns['3']).toEqual([0, 0, 0]);
  });

  it('plays back between samples, and is absent before, after, and in towns it never reached', () => {
    const track = { day: DAY, skin: 1, score: 0, towns: { '3': [0, 0, 0, 30, 0, 0] } };
    expect(ghostAt(track, 3, SAMPLE_TICKS / 2)).toMatchObject({ x: 15, y: 0, moving: true });
    expect(ghostAt(track, 3, SAMPLE_TICKS)).toMatchObject({ x: 30 });
    expect(ghostAt(track, 3, -1)).toBeNull();
    expect(ghostAt(track, 3, SAMPLE_TICKS + 1)).toBeNull();
    expect(ghostAt(track, 4, 0)).toBeNull();
  });

  it('keeps only the counted run: never overwritten that day, never shown another day', () => {
    const store = memoryStore();
    const first = { day: DAY, skin: 1, score: 100, towns: { '3': [1, 1, 0] } };
    expect(saveGhost(first, store)).toBe(true);
    expect(saveGhost({ ...first, score: 9999 }, store)).toBe(false);
    expect(loadGhost(DAY, store)?.score).toBe(100);
    expect(loadGhost('2026-11-08', store)).toBeNull();
  });

  it('records the first run of the day, then replays it on the next, timed per town', () => {
    const store = memoryStore();
    const first = new DailyGhost(DAY, store);
    expect(first.showing).toBeNull();
    for (let tick = 50; tick <= 50 + SAMPLE_TICKS * 2; tick += 1) first.observe(snapshot(3, tick, player(tick - 50, 0)), 'me');
    for (let tick = 900; tick <= 900 + SAMPLE_TICKS; tick += 1) first.observe(snapshot(4, tick, player(200, tick - 900)), 'me');
    expect(first.finish(true, 321)).toBe(true);

    // Play again: the same object begins a new run, and the counted run is the ghost.
    first.begin();
    expect(first.showing?.score).toBe(321);
    // The new run reaches the town at a different tick; the ghost is timed from there.
    first.observe(snapshot(3, 7000, player(0, 0)), 'me');
    const me = player(0, 0);
    expect(first.figure(3, 7000 + SAMPLE_TICKS, me)).toMatchObject({ id: GHOST_ID, x: SAMPLE_TICKS, y: 0, skin: 2, status: 'alive' });
    expect(first.figure(4, 7000, me)).toBeNull();
    first.observe(snapshot(4, 8000, player(0, 0)), 'me');
    expect(first.figure(4, 8000 + SAMPLE_TICKS, me)).toMatchObject({ x: 200, y: SAMPLE_TICKS });

    // A practice run never replaces it.
    expect(first.finish(false, 99999)).toBe(false);
    expect(loadGhost(DAY, store)?.score).toBe(321);
  });

  it('does not save a run that was not the counted one as official', () => {
    const store = memoryStore();
    const ghost = new DailyGhost(DAY, store);
    ghost.observe(snapshot(3, 0, player(0, 0)), 'me');
    expect(ghost.finish(false, 10)).toBe(false);
    expect(loadGhost(DAY, store)).toBeNull();
  });

  it('records both the official 1st play ghost and the improved best run ghost', () => {
    const store = memoryStore();
    const ghost = new DailyGhost(DAY, store);
    ghost.observe(snapshot(3, 0, player(0, 0)), 'me');
    expect(ghost.finish(true, 150)).toBe(true);

    expect(loadGhost(DAY, store, 'official')?.score).toBe(150);
    expect(loadGhost(DAY, store, 'best')?.score).toBe(150);

    // Later practice or MP run scores higher
    ghost.begin();
    ghost.observe(snapshot(3, 0, player(10, 0)), 'me');
    ghost.finish(false, 350);

    // Official stays 150, best updates to 350
    expect(loadGhost(DAY, store, 'official')?.score).toBe(150);
    expect(loadGhost(DAY, store, 'best')?.score).toBe(350);

    // Replay on next run shows the best ghost
    ghost.begin();
    expect(ghost.showing?.score).toBe(350);
  });
});
