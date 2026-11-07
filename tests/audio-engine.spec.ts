import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameEvent } from '../shared/protocol.ts';
import { AudioEngine } from '../src/audio/audio-engine.ts';
import { Mixer } from '../src/audio/mixer.ts';
import { TILE_KINDS } from '../shared/protocol.ts';
import type { PlayerEntity, WorldMap } from '../shared/protocol.ts';

const stats = { created: 0, closed: 0 };

/** A recursive no-op stand-in for any Web Audio node or param. */
function deep(): any {
  const kids = new Map<PropertyKey, unknown>();
  return new Proxy(function () { /* callable */ }, {
    get: (_t, k) => {
      if (k === Symbol.toPrimitive) return () => 0;
      if (!kids.has(k)) kids.set(k, deep());
      return kids.get(k);
    },
    set: () => true,
    apply: () => deep(),
  });
}

class FakeAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state = 'suspended';
  destination = deep();
  constructor() {
    return new Proxy(this, {
      get: (t: any, k: string) => {
        if (k in t) return t[k];
        if (k.startsWith('create')) return () => { stats.created++; return deep(); };
        return undefined;
      },
    });
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  close() { stats.closed++; return Promise.resolve(); }
  createBuffer(_c: number, len: number) { return { getChannelData: () => new Float32Array(len) }; }
}

const P = 'p1';
const STEP_MAP = { cols: 200, rows: 4, tiles: new Array(800).fill(TILE_KINDS.indexOf('grass')) } as unknown as WorldMap;
const EVENTS: GameEvent[] = [
  { type: 'shot', playerId: P, weapon: 'pistol', x: 0, y: 0, angle: 0 },
  { type: 'shot', playerId: 'p2', weapon: 'carbine', x: 40, y: 0, angle: 0 },
  { type: 'shot', playerId: P, weapon: 'shotgun', x: 0, y: 0, angle: 0 },
  { type: 'dry_fire', playerId: P, x: 0, y: 0 },
  { type: 'reload_start', playerId: P, weapon: 'pistol', x: 0, y: 0 },
  { type: 'reload_end', playerId: P, weapon: 'shotgun', x: 0, y: 0 },
  { type: 'weapon_switch', playerId: P, weapon: 'carbine', x: 0, y: 0 },
  { type: 'bullet_impact', x: 30, y: 10, angle: 0 },
  { type: 'zombie_hit', zombieId: 'z', zombieType: 'walker', x: 30, y: 0, angle: 0 },
  { type: 'headshot', playerId: P, zombieId: 'z', zombieType: 'walker', x: 30, y: -20, angle: 0, points: 5 },
  { type: 'zombie_die', zombieId: 'z', zombieType: 'brute', x: 30, y: 0, angle: 0, killerId: P, points: 100 },
  { type: 'zombie_attack', zombieId: 'z', zombieType: 'runner', x: 20, y: 0 },
  { type: 'bloater_burst', x: 20, y: 20, radius: 30 },
  { type: 'player_hurt', playerId: P, x: 0, y: 0, damage: 10 },
  { type: 'player_downed', playerId: 'p2', x: 50, y: 0 },
  { type: 'player_revived', playerId: 'p2', x: 50, y: 0 },
  { type: 'player_dead', playerId: 'p2', x: 50, y: 0 },
  { type: 'pickup', playerId: P, pickup: 'medkit', x: 0, y: 0 },
  { type: 'pickup', playerId: P, pickup: 'bandage', x: 0, y: 0 },
  { type: 'pickup', playerId: P, pickup: 'pistol_ammo', x: 0, y: 0 },
  { type: 'pickup', playerId: P, pickup: 'carbine_ammo', x: 0, y: 0 },
  { type: 'pickup', playerId: P, pickup: 'shells', x: 0, y: 0 },
  { type: 'melee', playerId: P, x: 0, y: 0, angle: 0, hit: false },
  { type: 'melee', playerId: P, x: 0, y: 0, angle: 0, hit: true },
  { type: 'heal', playerId: P, x: 0, y: 0, amount: 25 },
  { type: 'zombie_alert', zombieId: 'z', zombieType: 'walker', x: 60, y: 0 },
  { type: 'zombie_alert', zombieId: 'z2', zombieType: 'brute', x: 60, y: 0 },
  { type: 'pickup', playerId: P, pickup: 'shotgun', x: 0, y: 0 },
  { type: 'wave_intermission', wave: 2, seconds: 10 },
  { type: 'wave_start', wave: 2, hostiles: 12 },
  { type: 'wave_clear', wave: 2 },
  { type: 'game_over', stats: { outcome: 'defeat', difficulty: 'lights_out', level: 1, wave: 3, durationSec: 120, players: [] } },
];

describe('reload foley', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('AudioContext', FakeAudioContext);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('loads a shotgun shell by shell until the reload ends, and racks the others after the magazine', async () => {
    const a = new AudioEngine();
    await a.unlock();
    const played: string[] = [];
    vi.spyOn(Mixer.prototype, 'play').mockImplementation((name) => { played.push(name); });
    a.handleEvent({ type: 'reload_start', playerId: P, weapon: 'shotgun', x: 0, y: 0 }, P);
    for (let i = 0; i < 70; i += 1) a.tick(0.01, []);
    a.handleEvent({ type: 'reload_end', playerId: P, weapon: 'shotgun', x: 0, y: 0 }, P);
    for (let i = 0; i < 100; i += 1) a.tick(0.01, []);
    expect(played.filter((n) => n === 'shell_load')).toHaveLength(3);
    expect(played.at(-1)).toBe('pump');
    played.length = 0;
    a.handleEvent({ type: 'reload_end', playerId: P, weapon: 'carbine', x: 0, y: 0 }, P);
    a.handleEvent({ type: 'reload_end', playerId: P, weapon: 'pistol', x: 0, y: 0 }, P);
    expect(played).toEqual(['mag_in', 'bolt_rack', 'mag_in', 'slide_drop']);
    vi.restoreAllMocks();
    a.dispose();
  });
});

describe('Mixer level', () => {
  /** The gain node wired to the speakers, read before any time has passed. */
  function masterGain(level: number): number {
    const destination = {};
    const gains: { gain: { value: number }; target: unknown }[] = [];
    const ctx = {
      destination,
      createGain: () => {
        const node = { gain: { value: 1 }, target: null as unknown, connect(to: unknown) { this.target = to; } };
        gains.push(node);
        return node;
      },
      createDynamicsCompressor: deep,
      createWaveShaper: deep,
      createBiquadFilter: deep,
    };
    new Mixer(ctx as unknown as AudioContext, level);
    return gains.find((node) => node.target === destination)!.gain.value;
  }

  it('starts silent for a muted player, with no ramp down from full', () => {
    expect(masterGain(0)).toBe(0);
  });

  it('starts at the saved volume', () => {
    expect(masterGain(0.4)).toBe(0.4);
  });
});

describe('AudioEngine without Web Audio', () => {
  it('every method is a safe no-op', async () => {
    const a = new AudioEngine();
    await a.unlock();
    a.setListener(1, 2);
    a.setScene('wave');
    a.setIntensity(0.7);
    a.setHealth(0.1);
    a.playUi('click');
    for (const e of EVENTS) a.handleEvent(e, P);
    a.handleEvent(EVENTS[0], null);
    a.tick(0.016, [{ x: 0, y: 0, type: 'walker' }]);
    a.stepPlayers([], P, STEP_MAP, 0.016);
    a.stompZombies([{ id: 'z', type: 'brute', x: 0, y: 0 }]);
    a.heartbeat(0.1);
    a.dispose();
    a.dispose();
  });

  it('keeps volume clamped and mute settable when storage is missing', () => {
    const a = new AudioEngine();
    a.volume = 3;
    expect(a.volume).toBe(1);
    a.volume = Number.NaN;
    expect(a.volume).toBe(0);
    a.muted = true;
    expect(a.muted).toBe(true);
  });
});

describe('AudioEngine with a fake AudioContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stats.created = 0;
    stats.closed = 0;
    vi.stubGlobal('AudioContext', FakeAudioContext);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('accepts every GameEvent variant and releases voices', async () => {
    const a = new AudioEngine();
    await a.unlock();
    await a.unlock();
    a.setListener(0, 0);
    a.setScene('wave');
    a.setIntensity(1);
    for (const e of EVENTS) a.handleEvent(e, P);
    expect(stats.created).toBeGreaterThan(50);
    a.tick(5, [{ x: 100, y: 0, type: 'bloater' }]);
    a.setHealth(0.1);
    a.heartbeat(0.1);
    a.tick(1, []);
    vi.advanceTimersByTime(10_000);
    a.setScene('gameover');
    a.dispose();
    expect(stats.closed).toBe(1);
  });

  it('culls sounds beyond hearing range and plays near ones', async () => {
    const a = new AudioEngine();
    await a.unlock();
    a.setListener(0, 0);
    const before = stats.created;
    a.handleEvent({ type: 'bullet_impact', x: 5000, y: 0, angle: 0 }, P);
    expect(stats.created).toBe(before);
    a.handleEvent({ type: 'bullet_impact', x: 100, y: 0, angle: 0 }, P);
    expect(stats.created).toBeGreaterThan(before);
    a.dispose();
  });

  it('never culls the local player\'s own shots', async () => {
    const a = new AudioEngine();
    await a.unlock();
    a.setListener(0, 0);
    const before = stats.created;
    a.handleEvent({ type: 'shot', playerId: P, weapon: 'pistol', x: 9000, y: 9000, angle: 0 }, P);
    expect(stats.created).toBeGreaterThan(before);
    a.dispose();
  });

  describe('footsteps', () => {
    /** Walks a player at walking pace for a second and returns how many footsteps reached the mixer. */
    async function stepsMade(setup: (a: AudioEngine) => void, id = P): Promise<number> {
      const play = vi.spyOn(Mixer.prototype, 'play');
      const a = new AudioEngine();
      await a.unlock();
      setup(a);
      a.setListener(0, 0);
      const pace = 84;
      for (let i = 0; i <= 60; i += 1) {
        const p = { id, skin: 0, x: pace * (i / 60), y: 16, status: 'alive' } as unknown as PlayerEntity;
        a.stepPlayers([p], P, STEP_MAP, 1 / 60);
      }
      const made = play.mock.calls.filter(([name]) => String(name).startsWith('step_')).length;
      play.mockRestore();
      a.dispose();
      return made;
    }

    it('plays steps for a walking player', async () => {
      expect(await stepsMade(() => undefined)).toBeGreaterThan(0);
      expect(await stepsMade(() => undefined)).toBeLessThan(6);
    });

    it('is silent when muted or at zero volume', async () => {
      expect(await stepsMade((a) => { a.muted = true; })).toBe(0);
      expect(await stepsMade((a) => { a.volume = 0; })).toBe(0);
    });

    it('culls a distant walker but never the local one', async () => {
      const far = { id: 'far', skin: 0, x: 5000, y: 16, status: 'alive' } as unknown as PlayerEntity;
      const a = new AudioEngine();
      await a.unlock();
      a.setListener(0, 0);
      const before = stats.created;
      for (let i = 0; i <= 60; i += 1) {
        a.stepPlayers([{ ...far, x: 5000 + 84 * (i / 60) }], P, STEP_MAP, 1 / 60);
      }
      expect(stats.created).toBe(before);
      a.dispose();
    });
  });

  it('limits polyphony under a burst of full-auto fire', async () => {
    const a = new AudioEngine();
    await a.unlock();
    a.setListener(0, 0);
    const one = stats.created;
    a.handleEvent({ type: 'shot', playerId: 'p2', weapon: 'carbine', x: 10, y: 0, angle: 0 }, P);
    const perVoice = stats.created - one;
    const start = stats.created;
    for (let i = 0; i < 200; i++) a.handleEvent({ type: 'shot', playerId: 'p2', weapon: 'carbine', x: 10, y: 0, angle: 0 }, P);
    expect(stats.created - start).toBeLessThan(perVoice * 10);
    a.dispose();
  });
});
