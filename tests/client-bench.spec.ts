import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { noParts } from '../shared/gun-upgrades.ts';
import type { PlayerGear } from '../shared/gun-upgrades.ts';
import type { PlayerEntity, SnapshotPacket } from '../shared/protocol.ts';
import { BenchLink } from '../src/game/bench-link.ts';
import { benchHud, benchNote, benchRows, statLines } from '../src/game/bench-view.ts';
import type { GameTransport } from '../src/network/transport.ts';

const BENCH = { level: 3, secondsLeft: 12, riders: ['a', 'b'], ready: ['b'] };
const frame = (open: boolean): SnapshotPacket => ({ ...(open ? { bench: BENCH } : {}) }) as unknown as SnapshotPacket;

function linked(menuUp = false) {
  const transport = { sendBench: vi.fn() };
  const setInputEnabled = vi.fn();
  const settle = vi.fn();
  const link = new BenchLink({
    transport: () => transport as unknown as GameTransport,
    menuUp: () => menuUp,
    setInputEnabled,
    settle,
  });
  return { link, transport, setInputEnabled, settle };
}

describe('the bench link', () => {
  it('takes the controls when the bench opens and hands them back when it closes', () => {
    const { link, setInputEnabled, settle } = linked();
    link.observe(frame(true));
    expect(link.open).toBe(true);
    expect(setInputEnabled).toHaveBeenLastCalledWith(false);
    expect(settle).toHaveBeenCalledTimes(1);
    link.observe(frame(true));
    expect(settle).toHaveBeenCalledTimes(1);
    link.observe(frame(false));
    expect(link.open).toBe(false);
    expect(setInputEnabled).toHaveBeenLastCalledWith(true);
  });

  it('leaves the controls with a menu that is still up when the bench closes', () => {
    const { link, setInputEnabled } = linked(true);
    link.observe(frame(true));
    link.observe(frame(false));
    expect(setInputEnabled).toHaveBeenLastCalledWith(false);
  });

  it('sends what the screen asks', () => {
    const { link, transport } = linked();
    link.send({ kind: 'ready', ready: true });
    expect(transport.sendBench).toHaveBeenCalledWith({ kind: 'ready', ready: true });
  });
});

describe('the bench as a player reads it', () => {
  it('names the next town and who is still to come', () => {
    const hud = benchHud(frame(true), { id: 'a' } as PlayerEntity);
    expect(hud).toMatchObject({ level: 3, nextTitle: 'Four Corners', youReady: false, waitingFor: 1, secondsLeft: 12 });
    expect(benchHud(frame(true), { id: 'b' } as PlayerEntity)?.youReady).toBe(true);
    expect(benchHud(frame(false), { id: 'a' } as PlayerEntity)).toBeNull();
  });

  it('the bench between towns names the road, and the walk-up bench closes instead of readying', () => {
    const between = benchHud(frame(true), { id: 'a' } as PlayerEntity);
    const walkUp = benchHud(frame(false), { id: 'a', home: { station: 'bench' } } as PlayerEntity);
    expect(between?.walkUp).toBe(false);
    expect(walkUp?.walkUp).toBe(true);
    expect(benchNote(between!)).toContain('Three Country is behind you');
    expect(benchNote(walkUp!)).not.toContain('Town');

    const screen = readFileSync(new URL('../src/components/WorkbenchScreen.vue', import.meta.url), 'utf8');
    expect(screen).toMatch(/<PixelButton v-if="bench\.walkUp"[^>]*game\.home\.closeStation\(\)[^>]*>Close</);
  });

  it('offers only what the parts and slots allow', () => {
    const gear: PlayerGear = { parts: { ...noParts(), barrel: 1, toolkit: 1 }, fits: { pistol: { ranks: { fireRate: 1 }, quirk: null } } };
    const rows = benchRows('pistol', ['pistol', 'carbine'], gear);
    const row = (upgrade: string) => rows.find((each) => each.upgrade === upgrade);
    expect(row('damage')).toMatchObject({ fittable: true, rank: 0, moves: [] });
    expect(row('reload')).toMatchObject({ fittable: false, cost: ['grip', 'magazine'] });
    expect(row('fireRate')).toMatchObject({ fittable: false, rank: 1, moves: ['carbine'] });
  });

  it('shows the pellets of a shotgun and the noise a suppressor leaves', () => {
    const lines = statLines('shotgun', { ranks: { suppressor: 1 }, quirk: null });
    expect(lines).toContain('Damage 18 x8');
    expect(lines).toContain('Noise 35%');
  });
});
